// Classification rules for cookies, storage keys, and network requests.
// severity: "violation" = should never fire/set after Decline
//           "warning"   = needs human review (may be legitimate depending on config)
//           "info"      = expected / consent-aware behavior

// ---------- COOKIES ----------
// Exact names or regexes. Anything not matched and not allowlisted is "unknown" (warning).
const COOKIE_RULES = [
  // Google Analytics / Ads
  { re: /^_ga$/, vendor: 'Google Analytics', category: 'analytics' },
  { re: /^_ga_[A-Z0-9]+$/, vendor: 'Google Analytics 4', category: 'analytics' },
  { re: /^_gid$/, vendor: 'Google Analytics', category: 'analytics' },
  { re: /^_gat/, vendor: 'Google Analytics', category: 'analytics' },
  { re: /^_gcl_(au|aw|dc|gb|gf|ha)$/, vendor: 'Google Ads', category: 'advertising' },
  { re: /^(IDE|DSID|test_cookie|NID|__gads|__gpi)$/, vendor: 'Google Ads / DoubleClick', category: 'advertising' },
  // Meta
  { re: /^_fbp$/, vendor: 'Meta Pixel', category: 'advertising' },
  { re: /^_fbc$/, vendor: 'Meta Pixel', category: 'advertising' },
  { re: /^fr$/, vendor: 'Meta', category: 'advertising' },
  // TikTok
  { re: /^_ttp$/, vendor: 'TikTok Pixel', category: 'advertising' },
  { re: /^ttcsid/, vendor: 'TikTok Pixel', category: 'advertising' },
  { re: /^tt_(appInfo|sessionId|pixel_session_index)$/, vendor: 'TikTok Pixel', category: 'advertising' },
  // Pinterest
  { re: /^_pin_unauth$/, vendor: 'Pinterest Tag', category: 'advertising' },
  { re: /^_pinterest_ct/, vendor: 'Pinterest Tag', category: 'advertising' },
  { re: /^_epik$/, vendor: 'Pinterest Tag', category: 'advertising' },
  // Microsoft
  { re: /^_uet(sid|vid)$/, vendor: 'Microsoft Ads (UET)', category: 'advertising' },
  { re: /^MUID$/, vendor: 'Microsoft', category: 'advertising' },
  { re: /^_clck$|^_clsk$|^CLID$/, vendor: 'Microsoft Clarity', category: 'analytics' },
  // Snap / Reddit / X / LinkedIn
  { re: /^_scid/, vendor: 'Snap Pixel', category: 'advertising' },
  { re: /^_rdt_uuid$/, vendor: 'Reddit Pixel', category: 'advertising' },
  { re: /^(personalization_id|muc_ads|guest_id)$/, vendor: 'X (Twitter)', category: 'advertising' },
  { re: /^(li_sugr|bcookie|lidc|UserMatchHistory|AnalyticsSyncHistory)$/, vendor: 'LinkedIn', category: 'advertising' },
  // Email / SMS / CRM
  { re: /^__kla_id$/, vendor: 'Klaviyo', category: 'marketing' },
  { re: /^__attentive/, vendor: 'Attentive', category: 'marketing' },
  { re: /^(hubspotutk|__hstc|__hssc|__hssrc)$/, vendor: 'HubSpot', category: 'marketing' },
  { re: /^_hj/, vendor: 'Hotjar', category: 'analytics' },
  { re: /^ajs_/, vendor: 'Segment', category: 'analytics' },
  { re: /^_privy/, vendor: 'Privy', category: 'marketing' },
  { re: /^__ssid$|^_sp_/, vendor: 'Snowplow / misc', category: 'analytics' },
  { re: /^cto_/, vendor: 'Criteo', category: 'advertising' },
  { re: /^(TDID|TDCPM)$/, vendor: 'The Trade Desk', category: 'advertising' },
  { re: /^_yotpo|^yotpo/, vendor: 'Yotpo', category: 'marketing' },
  { re: /^_gorgias/, vendor: 'Gorgias', category: 'functional' },
  // Shopify analytics / marketing cookies (Shopify classifies these as non-essential)
  { re: /^_shopify_(y|s|sa_t|sa_p)$/, vendor: 'Shopify Analytics', category: 'analytics' },
  { re: /^_shopify_analytics$/, vendor: 'Shopify Analytics', category: 'analytics' },
  { re: /^_shopify_marketing$/, vendor: 'Shopify Marketing', category: 'advertising' },
  { re: /^(_orig_referrer|_landing_page)$/, vendor: 'Shopify Analytics', category: 'analytics' },
  { re: /^_[ys]$/, vendor: 'Shopify Analytics (legacy)', category: 'analytics' },
];

// Strictly-necessary / consent-storage cookies that are expected after Decline.
// Sites can extend this via config `allowCookies`.
const DEFAULT_ALLOW_COOKIES = [
  // Consent state itself
  /^_tracking_consent$/, /^_cmp_a$/, /^OptanonConsent$/, /^OptanonAlertBoxClosed$/,
  /^CookieConsent$/, /^cookieyes-consent$/, /^cookieconsent_status$/, /^termly/,
  /^_osano/, /^osano_consentmanager/, /^didomi_token$/, /^euconsent/, /^_pandectes/i,
  /^consentmo/i, /^cmplz_/,
  // Shopify essential
  /^_shopify_essential$/, /^cart$/, /^cart_(ts|sig|ver|currency)$/, /^secure_customer_sig$/,
  /^_secure_session_id$/, /^localization$/, /^keep_alive$/, /^_shopify_country$/,
  /^shopify_pay_redirect$/, /^_ab$/, /^_shopify_tm$/, /^_shopify_tw$/, /^_storefront_u$/,
  /^receive-cookie-deprecation$/, /^_cfuvid$/, /^__cf_bm$/, /^cf_clearance$/,
  // Common payment / localization helpers seen on Shopify stores
  /^language$/, /^ledgerCurrency$/, /^apay-session-set$/,
];

// ---------- STORAGE ----------
const STORAGE_RULES = [
  { re: /^_gcl_ls$/, vendor: 'Google Ads', category: 'advertising' },
  { re: /^tt_/, vendor: 'TikTok Pixel', category: 'advertising' },
  { re: /^_fbp|^fbq/, vendor: 'Meta Pixel', category: 'advertising' },
  { re: /^__kla/, vendor: 'Klaviyo', category: 'marketing' },
  { re: /^_hj/, vendor: 'Hotjar', category: 'analytics' },
  { re: /^_clck|^_clsk/, vendor: 'Microsoft Clarity', category: 'analytics' },
  { re: /^_pin/, vendor: 'Pinterest Tag', category: 'advertising' },
  { re: /^_uet/, vendor: 'Microsoft Ads (UET)', category: 'advertising' },
  { re: /^_rdt/, vendor: 'Reddit Pixel', category: 'advertising' },
  { re: /^_scid|^_sctr/, vendor: 'Snap Pixel', category: 'advertising' },
];

// ---------- NETWORK ----------
// `kind: 'beacon'` = data being sent (a hit). `kind: 'script'` = library loaded (warning only).
const REQUEST_RULES = [
  // Google Analytics 4 / UA hits — consent-mode aware (see evaluateGoogle)
  { test: u => /google-analytics\.com\/(g|j|r)\/collect|google-analytics\.com\/collect|analytics\.google\.com\/g\/collect/.test(u), vendor: 'Google Analytics', kind: 'beacon', google: true },
  { test: u => /googletagmanager\.com\/gtag\/js|googletagmanager\.com\/gtm\.js/.test(u), vendor: 'Google Tag', kind: 'script' },
  { test: u => /googleads\.g\.doubleclick\.net\/pagead|google\.com\/pagead\/1p-|googleadservices\.com\/pagead\/conversion|\.doubleclick\.net\/(activity|ddm)/.test(u), vendor: 'Google Ads', kind: 'beacon', google: true },
  // Meta
  { test: u => /facebook\.com\/tr[/?]/.test(u), vendor: 'Meta Pixel', kind: 'beacon' },
  { test: u => /connect\.facebook\.net\/.*\/fbevents\.js|connect\.facebook\.net\/signals/.test(u), vendor: 'Meta Pixel', kind: 'script' },
  // TikTok
  { test: u => /analytics\.tiktok\.com\/api\/v2\/(pixel|monitor)/.test(u), vendor: 'TikTok Pixel', kind: 'beacon' },
  { test: u => /analytics\.tiktok\.com\/i18n\/pixel/.test(u), vendor: 'TikTok Pixel', kind: 'script' },
  // Pinterest
  { test: u => /ct\.pinterest\.com\/(v3|user)/.test(u), vendor: 'Pinterest Tag', kind: 'beacon' },
  { test: u => /s\.pinimg\.com\/ct\/core\.js/.test(u), vendor: 'Pinterest Tag', kind: 'script' },
  // Microsoft
  { test: u => /bat\.bing\.com\/action/.test(u), vendor: 'Microsoft Ads (UET)', kind: 'beacon' },
  { test: u => /bat\.bing\.com\/bat\.js/.test(u), vendor: 'Microsoft Ads (UET)', kind: 'script' },
  { test: u => /\.clarity\.ms\/collect/.test(u), vendor: 'Microsoft Clarity', kind: 'beacon' },
  // Snap / Reddit / X / LinkedIn / Criteo / TTD
  { test: u => /tr\.snapchat\.com|tr-shadow\.snapchat\.com/.test(u), vendor: 'Snap Pixel', kind: 'beacon' },
  { test: u => /alb\.reddit\.com\/rp\.gif|pixel-config\.reddit\.com/.test(u), vendor: 'Reddit Pixel', kind: 'beacon' },
  { test: u => /analytics\.twitter\.com|t\.co\/i\/adsct|ads-twitter\.com\/uwt/.test(u), vendor: 'X (Twitter) Pixel', kind: 'beacon' },
  { test: u => /px\.ads\.linkedin\.com|snap\.licdn\.com/.test(u), vendor: 'LinkedIn Insight', kind: 'beacon' },
  { test: u => /\.criteo\.(com|net)/.test(u), vendor: 'Criteo', kind: 'beacon' },
  { test: u => /\.adsrvr\.org/.test(u), vendor: 'The Trade Desk', kind: 'beacon' },
  // Session replay / heatmaps
  { test: u => /\.hotjar\.(com|io)/.test(u), vendor: 'Hotjar', kind: 'beacon' },
  { test: u => /\.fullstory\.com\/rec/.test(u), vendor: 'FullStory', kind: 'beacon' },
  // Email/SMS
  { test: u => /a\.klaviyo\.com\/(api\/(track|identify|onsite|client\/events)|client\/)/.test(u), vendor: 'Klaviyo', kind: 'beacon' },
  { test: u => /\.attn\.tv|attentivemobile\.com/.test(u), vendor: 'Attentive', kind: 'beacon' },
  { test: u => /google-analytics\.com\/analytics\.js|google-analytics\.com\/ga\.js/.test(u), vendor: 'Google Universal Analytics (legacy)', kind: 'script' },
  { test: u => /gtmniddocks|getgoogletagmanager\.com/.test(u), vendor: 'GTM Shopify app (third-party)', kind: 'script' },
  { test: u => /chimpstatic\.com\/mcjs-connected|list-manage\.com/.test(u), vendor: 'Mailchimp', kind: 'script' },
  { test: u => /a\.klaviyo\.com\/onsite\/track-analytics/.test(u), vendor: 'Klaviyo', kind: 'review', note: 'Klaviyo onsite analytics call; confirm it is form telemetry only and not visitor tracking' },
  { test: u => /analytics\.audioeye\.com/.test(u), vendor: 'AudioEye', kind: 'review', note: 'Accessibility vendor usage analytics; confirm classification with vendor DPA' },
  { test: u => /static\.klaviyo\.com\/onsite\/js\/.*klaviyo\.js/.test(u), vendor: 'Klaviyo', kind: 'script' },
  // Shopify first-party analytics ("monorail"/trekkie). Shopify gates these on consent,
  // so firing after Decline is worth reviewing but often carries consent flags.
  { test: u => /monorail-edge\.shopifysvc\.com|\/\.well-known\/shopify\/monorail/.test(u), vendor: 'Shopify Analytics (monorail)', kind: 'shopify' },
];

function classifyCookie(name, extraAllow = []) {
  const allow = [...DEFAULT_ALLOW_COOKIES, ...extraAllow.map(s => new RegExp(s))];
  for (const r of COOKIE_RULES) if (r.re.test(name)) return { vendor: r.vendor, category: r.category, severity: 'violation' };
  if (allow.some(re => re.test(name))) return { vendor: 'Necessary / consent', category: 'necessary', severity: 'info' };
  return { vendor: 'Unknown', category: 'unknown', severity: 'warning' };
}

function classifyStorageKey(key) {
  for (const r of STORAGE_RULES) if (r.re.test(key)) return { vendor: r.vendor, category: r.category, severity: 'violation' };
  return null;
}

// Google Consent Mode: gcs=G1xy  x=ad_storage y=analytics_storage (1 granted, 0 denied)
function evaluateGoogle(url) {
  let gcs = null;
  try { gcs = new URL(url).searchParams.get('gcs'); } catch {}
  if (!gcs) return { severity: 'violation', note: 'No consent-mode signal (gcs) on Google hit — likely firing without consent gating' };
  if (/^G1(0|-)(0|-)$/.test(gcs)) return { severity: 'info', note: `Consent Mode cookieless ping (gcs=${gcs}: storage denied). Expected with Advanced Consent Mode; confirm with counsel this is acceptable.` };
  return { severity: 'violation', note: `Google hit reports consent GRANTED (gcs=${gcs}) after Decline` };
}

function classifyRequest(url) {
  for (const r of REQUEST_RULES) {
    if (!r.test(url)) continue;
    if (r.kind === 'script') return { vendor: r.vendor, kind: 'script', severity: 'warning', note: 'Tracking library loaded (no hit observed from this request itself)' };
    if (r.kind === 'review') return { vendor: r.vendor, kind: 'beacon', severity: 'warning', note: r.note };
    if (r.kind === 'shopify') return { vendor: r.vendor, kind: 'beacon', severity: 'warning', note: 'Shopify first-party analytics event; check payload consent flags' };
    if (r.google) return { vendor: r.vendor, kind: 'beacon', ...evaluateGoogle(url) };
    return { vendor: r.vendor, kind: 'beacon', severity: 'violation', note: 'Tracking hit sent after Decline' };
  }
  return null;
}

module.exports = { classifyCookie, classifyStorageKey, classifyRequest };
