# Lot 22 Consent Monitor

A weekly automated test that checks whether tracking actually stops after a visitor clicks **Decline** on a site's cookie banner.

## What each run does

1. Opens a brand-new headless Chrome session, so there are no prior cookies.
2. Loads the homepage and records cookies, storage and tracker requests **before any choice is made**.
3. Finds the consent banner and clicks Decline. It knows the selectors for Shopify, OneTrust, Cookiebot, CookieYes, Complianz, Osano, Termly, Didomi, Iubenda and Pandectes, and falls back to matching button text on other banners.
4. Browses the configured pages, plus one collection, one product and one content page that it finds automatically.
5. Flags the following:
   - **Violation:** a known ad or analytics cookie, a known ad or analytics storage key, or a tracking hit (GA, Google Ads, Meta, TikTok, Pinterest, Bing, Clarity, Snap, Reddit, LinkedIn, Klaviyo, Hotjar and others) observed after Decline.
   - **Warning:** a tracking library loaded without a hit, an unknown cookie, or a vendor whose classification needs a human decision.
   - **Info:** the consent cookie itself, essential Shopify cookies, and Google Consent Mode cookieless pings (`gcs=G100`).
6. Runs a second scenario with **Global Privacy Control** turned on (`Sec-GPC: 1`).
7. Saves an HTML report, a JSON report, screenshots and a network HAR file. It compares the results with last week's run, lists new and resolved items, and fails the GitHub job if anything leaks. GitHub then emails the repo owner.

## One-time setup (about 10 minutes)

1. Create a **private** GitHub repo, for example `lot22/consent-monitor`, and push this folder to it.
2. Go to **Settings → Actions → General → Workflow permissions** and choose **Read and write**. This lets the job commit the report history back to the repo.
3. Optional settings, under **Settings → Secrets and variables → Actions**:
   - Secret `SLACK_WEBHOOK_URL` posts a weekly pass/fail message to Slack.
   - Secret `ANTHROPIC_API_KEY` plus a variable `ANTHROPIC_MODEL` (a current Claude model ID from docs.claude.com) adds a plain-English summary to each report.
   - Secret `EU_PROXY_URL` lets you test from the EU. Set `"proxyEnv": "EU_PROXY_URL"` on a site to use it.
4. Go to **Actions → Weekly consent check → Run workflow** to run it once now. After that it runs every Monday at 8:17 AM Central.

Reports appear in `reports/<site>/<date>/<scenario>/report.html`, and each run's full evidence bundle is attached to the run as a downloadable artifact.

## Adding a client

Add an entry to `config/sites.json`:

```json
{ "id": "client-slug", "name": "Client Name", "url": "https://client.com/",
  "scenarios": ["decline", "gpc"], "pages": ["/contact", "/services"],
  "allowCookies": ["^some_necessary_cookie$"] }
```

## Run locally

```bash
npm install && npx playwright install chromium
npm test                                  # self-test against a fake leaky store
node src/audit.js --site pants-store      # real run
```

## Limits

- Results apply to the runner's location. GitHub's runners are in the US, so a banner that only appears in certain regions may behave differently elsewhere.
- Sites with aggressive bot protection may block headless browsers. If that happens, the report shows ERROR.
- This is technical evidence, not a legal opinion. Agree with the client's counsel which items count as "necessary."
