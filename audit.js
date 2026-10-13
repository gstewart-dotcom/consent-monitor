#!/usr/bin/env node
// Consent Monitor — checks that tracking stops after a visitor clicks "Decline".
// Usage: node src/audit.js [--config config/sites.json] [--site pants-store] [--out reports]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { classifyCookie, classifyStorageKey, classifyRequest } = require('./rules');
const { renderHtml } = require('./report');
const { aiSummary } = require('./ai');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a;
}, []));
const CONFIG = args.config || 'config/sites.json';
const OUT = args.out || 'reports';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Known consent banners: how to detect them and which control means "reject all".
const CMPS = [
  { name: 'Shopify Customer Privacy', detect: '#shopify-pc__banner, .shopify-pc__banner__wrapper', reject: '#shopify-pc__banner__btn-decline' },
  { name: 'OneTrust', detect: '#onetrust-banner-sdk', reject: '#onetrust-reject-all-handler' },
  { name: 'Cookiebot', detect: '#CybotCookiebotDialog', reject: '#CybotCookiebotDialogBodyButtonDecline' },
  { name: 'CookieYes', detect: '.cky-consent-container', reject: '.cky-btn-reject' },
  { name: 'Complianz', detect: '.cmplz-cookiebanner', reject: '.cmplz-deny' },
  { name: 'Osano', detect: '.osano-cm-dialog', reject: '.osano-cm-denyAll, .osano-cm-deny' },
  { name: 'Termly', detect: '[data-tid="banner-decline"]', reject: '[data-tid="banner-decline"]' },
  { name: 'Didomi', detect: '#didomi-notice', reject: '#didomi-notice-disagree-button' },
  { name: 'Pandectes / cookieconsent', detect: '.cc-window', reject: '.cc-deny, .cc-dismiss-deny' },
  { name: 'Iubenda', detect: '#iubenda-cs-banner', reject: '.iubenda-cs-reject-btn' },
];
const GENERIC_REJECT = /^\s*(decline( all)?|reject( all)?|deny( all)?|refuse( all)?|only (essential|necessary)|necessary only|essential only|do not accept|i decline)\s*(cookies)?\s*$/i;

async function findAndDecline(page, log) {
  // 1) Known CMPs (main frame + iframes)
  for (const frame of page.frames()) {
    for (const cmp of CMPS) {
      const banner = frame.locator(cmp.detect).first();
      if (await banner.isVisible().catch(() => false)) {
        const btn = frame.locator(cmp.reject).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 5000 });
          log(`Declined via ${cmp.name}`);
          return { cmp: cmp.name, method: 'known-selector', clicked: true };
        }
        return { cmp: cmp.name, method: 'known-selector', clicked: false, note: 'Banner found but no visible reject control (may require "Manage preferences")' };
      }
    }
  }
  // 2) Generic text match on visible buttons/links
  for (const frame of page.frames()) {
    const candidates = frame.locator('button, a, [role="button"], input[type="button"], input[type="submit"]');
    const n = Math.min(await candidates.count().catch(() => 0), 400);
    for (let i = 0; i < n; i++) {
      const el = candidates.nth(i);
      const txt = ((await el.innerText().catch(() => '')) || (await el.getAttribute('value').catch(() => '')) || '').trim();
      if (txt && GENERIC_REJECT.test(txt) && await el.isVisible().catch(() => false)) {
        await el.click({ timeout: 5000 });
        log(`Declined via generic button "${txt}"`);
        return { cmp: 'Unknown (generic match)', method: 'text-match', clicked: true, buttonText: txt };
      }
    }
  }
  return { cmp: null, method: null, clicked: false, note: 'No consent banner / reject control found' };
}

async function snapshot(context, page, siteCfg) {
  const cookies = (await context.cookies()).map(c => ({
    name: c.name, domain: c.domain, expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session',
    httpOnly: c.httpOnly, thirdParty: !siteCfg._hosts.some(h => c.domain.replace(/^\./, '').endsWith(h) || h.endsWith(c.domain.replace(/^\./, ''))),
    ...classifyCookie(c.name, siteCfg.allowCookies || []),
  }));
  const storage = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })).catch(() => ({ local: [], session: [] }));
  const storageFindings = [...storage.local.map(k => ['localStorage', k]), ...storage.session.map(k => ['sessionStorage', k])]
    .map(([where, key]) => { const c = classifyStorageKey(key); return c ? { where, key, ...c } : null; }).filter(Boolean);
  const consentState = await page.evaluate(() => {
    try {
      const cp = window.Shopify && window.Shopify.customerPrivacy;
      if (cp && cp.currentVisitorConsent) return { platform: 'shopify', ...cp.currentVisitorConsent(), region: cp.getRegion ? cp.getRegion() : undefined };
    } catch {}
    try { if (window.OneTrust) return { platform: 'onetrust', activeGroups: window.OnetrustActiveGroups }; } catch {}
    try { if (window.Cookiebot) return { platform: 'cookiebot', ...window.Cookiebot.consent }; } catch {}
    return null;
  }).catch(() => null);
  return { cookies, storage, storageFindings, consentState };
}

async function autoDiscover(page, siteCfg) {
  const found = await page.evaluate(() => {
    const uniq = sel => [...new Set([...document.querySelectorAll(sel)].map(a => a.pathname))];
    return { collections: uniq('a[href*="/collections/"]'), products: uniq('a[href*="/products/"]'), pages: uniq('a[href*="/pages/"], a[href*="/blogs/"]') };
  }).catch(() => ({ collections: [], products: [], pages: [] }));
  const extra = [found.collections[0], found.products[0], found.pages[0]].filter(Boolean);
  return [...new Set([...(siteCfg.pages || []), ...extra])].slice(0, siteCfg.maxPages || 8);
}

async function auditSite(siteCfg, scenario) {
  const started = new Date();
  const logs = [];
  const log = m => { const line = `[${siteCfg.id}/${scenario}] ${m}`; logs.push(line); console.log(line); };
  const base = new URL(siteCfg.url);
  siteCfg._hosts = [base.hostname.replace(/^www\./, ''), ...(siteCfg.firstPartyHosts || [])];
  const runDir = path.join(OUT, siteCfg.id, started.toISOString().slice(0, 10), scenario);
  fs.mkdirSync(runDir, { recursive: true });

  const proxyUrl = siteCfg.proxyEnv && process.env[siteCfg.proxyEnv];
  const browser = await chromium.launch({ headless: true, ...(proxyUrl ? { proxy: { server: proxyUrl } } : {}) });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    locale: siteCfg.locale || 'en-US',
    timezoneId: siteCfg.timezone || 'America/Chicago',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    recordHar: { path: path.join(runDir, 'network.har'), content: 'omit' },
    ...(scenario === 'gpc' ? { extraHTTPHeaders: { 'Sec-GPC': '1' } } : {}),
  });
  if (scenario === 'gpc') await context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));

  let phase = 'pre-consent';
  let currentPage = '/';
  const requests = [];
  const onReq = req => requests.push({ url: req.url(), method: req.method(), type: req.resourceType(), phase, page: currentPage, t: Date.now() });
  context.on('request', onReq); // includes iframes, popups and workers attached to pages

  const page = await context.newPage();
  page.on('worker', w => log(`worker started: ${w.url().slice(0, 100)}`));
  const result = { site: siteCfg.id, url: siteCfg.url, scenario, startedAt: started.toISOString(), pages: [], banner: null, errors: [] };

  const settle = async () => {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.mouse.wheel(0, 1800).catch(() => {});
    await sleep(siteCfg.dwellMs || 6000);
  };

  try {
    // ---- Phase 1: first load, no interaction ----
    await page.goto(siteCfg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await settle();
    await page.screenshot({ path: path.join(runDir, '01-first-load.png') });
    result.preConsent = await snapshot(context, page, siteCfg);

    // ---- Phase 2: decline ----
    if (scenario === 'decline') {
      result.banner = await findAndDecline(page, log);
      phase = 'post-decline';
      await sleep(3000);
      await page.screenshot({ path: path.join(runDir, '02-after-decline.png') });
    } else {
      result.banner = { cmp: null, clicked: false, note: 'GPC scenario: no banner interaction; browser sends Sec-GPC: 1' };
    }
    result.afterChoice = await snapshot(context, page, siteCfg);

    // ---- Phase 3: browse ----
    phase = 'post-decline';
    const pages = await autoDiscover(page, siteCfg);
    log(`Pages: ${pages.join(', ')}`);
    let i = 3;
    for (const p of pages) {
      currentPage = p;
      const target = new URL(p, siteCfg.url).toString();
      try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await settle();
        const bannerReappeared = await page.locator(CMPS.map(c => c.detect).join(', ')).first().isVisible().catch(() => false);
        const snap = await snapshot(context, page, siteCfg);
        await page.screenshot({ path: path.join(runDir, `${String(i++).padStart(2, '0')}-${p.replace(/[^a-z0-9]+/gi, '_').slice(0, 40) || 'home'}.png`) });
        result.pages.push({ path: p, bannerReappeared, ...snap });
      } catch (e) { result.errors.push(`${p}: ${e.message.split('\n')[0]}`); }
    }
  } catch (e) {
    result.errors.push(e.message.split('\n')[0]);
  }
  context.off('request', onReq);
  await context.close();
  await browser.close();

  // ---- Classification ----
  const preCookieNames = new Set((result.preConsent?.cookies || []).map(c => c.name));
  const findings = [];
  const add = f => { const key = `${f.type}|${f.vendor}|${f.item}|${f.phase}|${f.severity}`; if (!findings.some(x => x.key === key)) findings.push({ key, ...f }); };

  const allSnaps = [['pre-consent', result.preConsent], ['after-decline', result.afterChoice], ...result.pages.map(p => [`post-decline ${p.path}`, p])];
  for (const [label, snap] of allSnaps) {
    if (!snap) continue;
    const ph = label.startsWith('pre') ? 'pre-consent' : 'post-decline';
    for (const c of snap.cookies) if (c.severity !== 'info') add({ type: 'cookie', phase: ph, where: label, item: c.name, vendor: c.vendor, category: c.category, severity: c.severity, detail: `${c.domain} · expires ${c.expires}${c.thirdParty ? ' · third-party' : ''}${ph === 'post-decline' && !preCookieNames.has(c.name) ? ' · NEW after decline' : ''}` });
    for (const s of snap.storageFindings) add({ type: 'storage', phase: ph, where: label, item: `${s.where}:${s.key}`, vendor: s.vendor, category: s.category, severity: s.severity, detail: '' });
  }
  for (const r of requests) {
    const c = classifyRequest(r.url);
    if (!c) continue;
    const ph = r.phase;
    add({ type: 'request', phase: ph, where: r.page, item: r.url.split('?')[0].slice(0, 140), vendor: c.vendor, category: c.kind, severity: c.severity, detail: ph === 'pre-consent' ? String(c.note).replace('after Decline', 'before the visitor made any choice') : c.note, sample: r.url.slice(0, 400) });
  }
  // Inventory of all third-party hosts contacted post-decline (for human review)
  const thirdPartyHosts = {};
  for (const r of requests.filter(r => r.phase === 'post-decline')) {
    let h; try { h = new URL(r.url).hostname; } catch { continue; }
    if (siteCfg._hosts.some(x => h.endsWith(x))) continue;
    thirdPartyHosts[h] = (thirdPartyHosts[h] || 0) + 1;
  }

  const postViolations = findings.filter(f => f.phase === 'post-decline' && f.severity === 'violation');
  const preViolations = findings.filter(f => f.phase === 'pre-consent' && f.severity === 'violation');
  result.findings = findings;
  result.thirdPartyHosts = Object.entries(thirdPartyHosts).sort((a, b) => b[1] - a[1]);
  result.summary = {
    status: result.errors.length && !result.pages.length ? 'ERROR' : postViolations.length ? 'FAIL' : (scenario === 'decline' && !result.banner?.clicked) ? 'REVIEW' : 'PASS',
    bannerFound: !!result.banner?.cmp, declined: !!result.banner?.clicked, cmp: result.banner?.cmp || null,
    postDeclineViolations: postViolations.length, preConsentViolations: preViolations.length,
    warnings: findings.filter(f => f.severity === 'warning').length,
    vendorsLeaking: [...new Set(postViolations.map(f => f.vendor))],
  };
  result.requestCount = requests.length;
  result.logs = logs;
  result.finishedAt = new Date().toISOString();

  // ---- Diff vs previous run ----
  const latestPath = path.join(OUT, siteCfg.id, `latest-${scenario}.json`);
  if (fs.existsSync(latestPath)) {
    const prev = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    const prevKeys = new Set((prev.findings || []).filter(f => f.severity === 'violation').map(f => f.key));
    const curKeys = new Set(findings.filter(f => f.severity === 'violation').map(f => f.key));
    result.diff = {
      previousRun: prev.startedAt,
      newViolations: findings.filter(f => f.severity === 'violation' && !prevKeys.has(f.key)).map(f => `${f.vendor} — ${f.item} (${f.phase})`),
      resolved: (prev.findings || []).filter(f => f.severity === 'violation' && !curKeys.has(f.key)).map(f => `${f.vendor} — ${f.item} (${f.phase})`),
    };
  }

  result.aiSummary = await aiSummary(result).catch(e => `AI summary unavailable: ${e.message}`);

  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(runDir, 'report.html'), renderHtml(result, siteCfg));
  fs.writeFileSync(latestPath, JSON.stringify(result, null, 2));
  log(`STATUS ${result.summary.status} — ${postViolations.length} post-decline violations, ${preViolations.length} pre-consent violations. Report: ${runDir}/report.html`);
  return { result, runDir };
}

(async () => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const sites = cfg.sites.filter(s => s.enabled !== false && (!args.site || s.id === args.site));
  const outcomes = [];
  for (const s of sites) {
    for (const scenario of s.scenarios || ['decline']) {
      outcomes.push(await auditSite(s, scenario));
    }
  }
  // GitHub Actions job summary
  const lines = ['| Site | Scenario | Status | Post-decline violations | Pre-consent violations | Leaking vendors |', '|---|---|---|---|---|---|',
    ...outcomes.map(({ result: r }) => `| ${r.site} | ${r.scenario} | **${r.summary.status}** | ${r.summary.postDeclineViolations} | ${r.summary.preConsentViolations} | ${r.summary.vendorsLeaking.join(', ') || '—'} |`)];
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Consent Monitor\n\n${lines.join('\n')}\n`);
  fs.writeFileSync(path.join(OUT, 'last-run-summary.md'), lines.join('\n') + '\n');
  console.log('\n' + lines.join('\n'));

  if (process.env.SLACK_WEBHOOK_URL) {
    const text = outcomes.map(({ result: r }) => `${r.summary.status === 'PASS' ? ':white_check_mark:' : ':rotating_light:'} *${r.site}* (${r.scenario}): ${r.summary.status} — ${r.summary.postDeclineViolations} violations${r.summary.vendorsLeaking.length ? ` (${r.summary.vendorsLeaking.join(', ')})` : ''}`).join('\n');
    await fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: `Weekly consent check\n${text}` }) }).catch(e => console.error('Slack failed', e.message));
  }
  const failed = outcomes.some(o => ['FAIL', 'ERROR'].includes(o.result.summary.status));
  process.exit(failed && !args['no-fail'] ? 1 : 0);
})();
