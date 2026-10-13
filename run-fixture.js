// Self-test: serves a fake Shopify-style store that leaks trackers after Decline,
// runs the auditor against it, and asserts the leaks are caught.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const page = (title, links) => `<!doctype html><html><head><title>${title}</title></head><body>
<h1>${title}</h1>${links}
<div class="shopify-pc__banner__wrapper" id="shopify-pc__banner" style="position:fixed;bottom:0;left:0;right:0;background:#eee;padding:20px">
  COOKIE CONSENT <button id="shopify-pc__banner__btn-accept">Accept</button>
  <button id="shopify-pc__banner__btn-decline">Decline</button></div>
<script>
  // Consent storage (allowed)
  const consent = document.cookie.match(/_tracking_consent=([^;]+)/);
  if (consent) document.getElementById('shopify-pc__banner').style.display='none';
  document.getElementById('shopify-pc__banner__btn-decline').onclick = () => {
    document.cookie = '_tracking_consent=declined; path=/'; document.getElementById('shopify-pc__banner').style.display='none';
  };
  // Pre-consent leak: Klaviyo-style onsite call (review item)
  fetch('https://a.klaviyo.com/onsite/track-analytics?company_id=TEST').catch(()=>{});
  // Compliant: GA4 consent-mode cookieless ping
  new Image().src = 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&gcs=G100';
  // LEAK (always, regardless of consent): GA cookies + Meta pixel hit + ungated GA hit
  setTimeout(() => {
    document.cookie = '_ga=GA1.1.123.456; path=/; max-age=63072000';
    document.cookie = '_fbp=fb.1.123.456; path=/; max-age=7776000';
    localStorage.setItem('_gcl_ls', 'x');
    new Image().src = 'https://www.facebook.com/tr?id=123&ev=PageView';
    new Image().src = 'https://www.google-analytics.com/g/collect?v=2&tid=G-TEST&en=page_view';
  }, 500);
</script></body></html>`;

const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html');
  if (req.url.startsWith('/collections/')) return res.end(page('Collection', '<a href="/products/test-product">P</a>'));
  if (req.url.startsWith('/products/')) return res.end(page('Product', ''));
  res.end(page('Home', '<a href="/collections/test">C</a> <a href="/products/test-product">P</a>'));
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const tmp = path.join(__dirname, '.tmp');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const cfgPath = path.join(tmp, 'sites.json');
  fs.writeFileSync(cfgPath, JSON.stringify({ sites: [{ id: 'fixture', name: 'Fixture Store', url: `http://127.0.0.1:${port}/`, scenarios: ['decline'], dwellMs: 1500, maxPages: 3 }] }));
  // Must be async: a blocking child call would freeze this process's HTTP server.
  const child = spawn('node', ['src/audit.js', '--config', cfgPath, '--out', path.join(tmp, 'reports')], { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  child.on('exit', code => { server.close(); check(code, tmp); });
});

function check(code, tmp) {
  const r = JSON.parse(fs.readFileSync(path.join(tmp, 'reports', 'fixture', 'latest-decline.json'), 'utf8'));
  const has = (pred, msg) => { if (!r.findings.some(pred)) { console.error('ASSERT FAILED:', msg); process.exitCode = 1; } else console.log('ok -', msg); };
  console.log('\n--- assertions ---');
  if (code !== 1) { console.error('ASSERT FAILED: audit should exit 1 on violations'); process.exitCode = 1; } else console.log('ok - exits 1 on violations');
  if (r.summary.cmp !== 'Shopify Customer Privacy' || !r.summary.declined) { console.error('ASSERT FAILED: Shopify banner declined'); process.exitCode = 1; } else console.log('ok - Shopify banner detected and declined');
  has(f => f.item === '_ga' && f.phase === 'post-decline' && f.severity === 'violation', '_ga cookie after decline = violation');
  has(f => f.item === '_fbp' && f.phase === 'post-decline', '_fbp cookie after decline caught');
  has(f => f.vendor === 'Meta Pixel' && f.type === 'request' && f.phase === 'post-decline' && f.severity === 'violation', 'Meta /tr hit after decline = violation');
  has(f => f.vendor === 'Google Analytics' && f.severity === 'info' && /cookieless/.test(f.detail), 'GA gcs=G100 ping = info (not violation)');
  has(f => f.vendor === 'Google Analytics' && f.severity === 'violation' && f.type === 'request', 'Ungated GA hit = violation');
  has(f => f.item === 'localStorage:_gcl_ls', '_gcl_ls localStorage caught');
  has(f => f.vendor === 'Klaviyo' && f.phase === 'pre-consent' && f.severity === 'warning', 'Klaviyo pre-consent call flagged for review');
  if (r.findings.some(f => f.item === '_tracking_consent' && f.severity !== 'info')) { console.error('ASSERT FAILED: consent cookie should be allowed'); process.exitCode = 1; } else console.log('ok - _tracking_consent treated as necessary');
  if (r.pages.some(p => p.bannerReappeared)) { console.error('ASSERT FAILED: banner should not reappear'); process.exitCode = 1; } else console.log('ok - choice persisted across pages');
  console.log(process.exitCode ? '\nSELF-TEST FAILED' : '\nSELF-TEST PASSED');
}
