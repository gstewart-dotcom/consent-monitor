// Optional plain-English executive summary written by Claude.
// Enabled only when ANTHROPIC_API_KEY and ANTHROPIC_MODEL are both set (e.g. as GitHub secrets/vars).
async function aiSummary(result) {
  const key = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!key || !model) return null;
  const compact = {
    site: result.url, scenario: result.scenario, summary: result.summary, banner: result.banner, diff: result.diff,
    findings: result.findings.filter(f => f.severity !== 'info').map(({ key, sample, ...f }) => f).slice(0, 80),
    thirdPartyHosts: result.thirdPartyHosts.slice(0, 40),
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: 900,
      system: 'You are a marketing-technology compliance analyst at a digital agency. Write for a client account manager. Be factual, do not give legal conclusions, and only state what the data shows.',
      messages: [{ role: 'user', content: `Summarize this automated cookie-consent test in under 200 words: 1) one-line verdict, 2) what is still tracking after the visitor declined and the likely source (app, tag manager, theme code), 3) changes since last run, 4) the top 3 fixes in priority order.\n\n${JSON.stringify(compact)}` }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return (data.content || []).map(c => c.text || '').join('').trim();
}
module.exports = { aiSummary };
