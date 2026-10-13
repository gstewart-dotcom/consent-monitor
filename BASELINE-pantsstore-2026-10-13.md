# Pants Store — Manual Consent Baseline (Oct 13, 2026)

Test method: Claude's built-in browser. Visitor region detected by Shopify: USAL (Alabama). Steps: load the homepage, click **Decline** on the Shopify banner, then visit a collection page, a product page and the cart.

**Result: FAIL**

| Item | Before choice | After Decline | Source |
|---|---|---|---|
| `_ga`, `_gid` cookies (Google Analytics) | not seen | **set on collection, product, cart** | Third-party GTM app (`gtmniddocks.herokuapp.com`, `getgoogletagmanager.com`) loading `gtm.js?id=undefined` + legacy `analytics.js` |
| Klaviyo onsite JS + `a.klaviyo.com/onsite/track-analytics` | loaded / fired | JS still loads | Klaviyo theme embed |
| Mailchimp connected-site script (`chimpstatic.com`) | — | loads | Mailchimp app |
| AudioEye analytics beacon | fires | fires | AudioEye |
| Shopify-managed pixels (Meta, GA4 via channels) | no hits seen in main frame | no hits seen | Sandboxed; confirm with automated run |

Shopify recorded the choice correctly: `analytics: no, marketing: no, preferences: no`.

The banner says Pants Store "will not use cookies or other technologies for these purposes unless you accept them." The GA cookies contradict that.

## Recommended fixes (priority order)
1. **Remove or reconfigure the third-party GTM app.** Its container ID and tracking ID are both `undefined`, so it is likely sending no useful data while still setting GA cookies. Run GA4 and Google Ads through Shopify's Google & YouTube channel (which respects consent), or use a GTM setup that uses Consent Mode v2 with the Shopify Customer Privacy API.
2. **Klaviyo:** turn on Klaviyo's consent handling for Shopify, or delay onsite tracking until marketing consent is given. Keep signup forms working.
3. **Mailchimp / AudioEye:** check whether each vendor's script is still needed and how it should be classified. Remove Mailchimp if Klaviyo is the active email platform.
4. Re-run the automated monitor after the fixes and keep the weekly schedule going.

*Technical evidence only — not a legal determination.*
