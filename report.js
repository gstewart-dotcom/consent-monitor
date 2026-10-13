// Self-contained HTML report for one site/scenario run.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderHtml(r, cfg) {
  const s = r.summary;
  const color = { PASS: '#1f7a4d', FAIL: '#b42318', REVIEW: '#b54708', ERROR: '#6b7280' }[s.status];
  const rows = list => list.map(f => `<tr class="${f.severity}"><td><span class="pill ${f.severity}">${f.severity}</span></td><td>${esc(f.phase)}</td><td>${esc(f.type)}</td><td>${esc(f.vendor)}</td><td><code>${esc(f.item)}</code></td><td>${esc(f.where)}</td><td>${esc(f.detail)}</td></tr>`).join('');
  const sorted = [...r.findings].sort((a, b) => ['violation', 'warning', 'info'].indexOf(a.severity) - ['violation', 'warning', 'info'].indexOf(b.severity) || a.phase.localeCompare(b.phase));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Consent check · ${esc(cfg.name || r.site)} · ${r.startedAt.slice(0, 10)}</title>
<style>
:root{--fg:#111827;--muted:#6b7280;--bg:#fff;--line:#e5e7eb;--card:#f9fafb}
body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg);margin:0;padding:24px;max-width:1200px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}
.muted{color:var(--muted)}.status{display:inline-block;padding:6px 14px;border-radius:6px;color:#fff;font-weight:700;background:${color}}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:16px 0}
.k{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px}.k b{display:block;font-size:20px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{background:var(--card)}code{font-size:12px;word-break:break-all}
.pill{padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600;text-transform:uppercase}
.pill.violation{background:#fee4e2;color:#b42318}.pill.warning{background:#fef0c7;color:#b54708}.pill.info{background:#e0f2fe;color:#075985}
.ai{white-space:pre-wrap;background:var(--card);border-left:4px solid ${color};padding:12px 16px;border-radius:4px}
.note{font-size:12px;color:var(--muted);margin-top:24px}
</style></head><body>
<h1>Cookie consent check — ${esc(cfg.name || r.site)}</h1>
<div class="muted">${esc(r.url)} · scenario: <b>${esc(r.scenario)}</b> · ${esc(r.startedAt)} · prepared by Lot 22 Media</div>
<p><span class="status">${s.status}</span></p>
<div class="grid">
<div class="k"><span class="muted">Banner</span><b>${s.bannerFound ? esc(s.cmp) : 'Not found'}</b></div>
<div class="k"><span class="muted">Decline clicked</span><b>${s.declined ? 'Yes' : 'No'}</b></div>
<div class="k"><span class="muted">Violations after decline</span><b>${s.postDeclineViolations}</b></div>
<div class="k"><span class="muted">Violations before any choice</span><b>${s.preConsentViolations}</b></div>
<div class="k"><span class="muted">Items to review</span><b>${s.warnings}</b></div>
</div>
${s.vendorsLeaking.length ? `<p><b>Still tracking after Decline:</b> ${s.vendorsLeaking.map(esc).join(', ')}</p>` : ''}
${r.aiSummary ? `<h2>Summary</h2><div class="ai">${esc(r.aiSummary)}</div>` : ''}
${r.diff ? `<h2>Change since ${esc(r.diff.previousRun.slice(0, 10))}</h2><p><b>New:</b> ${r.diff.newViolations.map(esc).join('; ') || 'none'}<br><b>Resolved:</b> ${r.diff.resolved.map(esc).join('; ') || 'none'}</p>` : ''}
<h2>Consent state recorded by the site</h2>
<p>Right after the choice: <code>${esc(JSON.stringify(r.afterChoice?.consentState))}</code></p>
<h2>Findings</h2>
<table><thead><tr><th>Severity</th><th>Phase</th><th>Type</th><th>Vendor</th><th>Item</th><th>Where</th><th>Detail</th></tr></thead><tbody>${rows(sorted) || '<tr><td colspan=7>No findings.</td></tr>'}</tbody></table>
<h2>Third-party hosts contacted after Decline</h2>
<table><thead><tr><th>Host</th><th>Requests</th></tr></thead><tbody>${r.thirdPartyHosts.map(([h, n]) => `<tr><td>${esc(h)}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan=2>None</td></tr>'}</tbody></table>
<h2>Pages tested</h2><ul>${r.pages.map(p => `<li>${esc(p.path)}${p.bannerReappeared ? ' — <b>banner re-appeared (choice not remembered)</b>' : ''}</li>`).join('')}</ul>
${r.errors.length ? `<h2>Errors</h2><ul>${r.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
<p class="note">Automated technical test from one location (${esc(cfg.locationLabel || 'runner location')}). Banner behavior can vary by visitor region. "Violation" means a known advertising/analytics cookie, storage key, or tracking hit was observed after the visitor declined; it is technical evidence, not a legal determination. Screenshots and a full network log (network.har) are stored alongside this report.</p>
</body></html>`;
}
module.exports = { renderHtml };
