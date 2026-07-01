# BidVoice.ai — Launch Readiness Checklist (ranked by impact)

*Mission: Deploy. Demo. Onboard. Learn. The code is launch-ready and fully rebranded; the remaining
items are infrastructure + live verification only you can do (registrar/host/DNS/env). Ranked so you
can go top-to-bottom.*

## ✅ Done (code-side, on the branch — merge to ship)
- Full rebrand: BidVoice (platform) · Eden (employee) · tagline · **B logo unchanged**. Wordmark,
  meta/SEO, OG/Twitter, manifest, sitemap, robots, emails, landing pages (EN+ES), guide page,
  contractor sites, service worker — all BidVoice. `npm run brand-check` guards against regressions.
- New `og.png` (Meet Eden). Photo-link expiry bug fixed. Domain-aware public URLs via `BT_PUBLIC_URL`.

---

## 🔴 P0 — Blocks launch (nobody can sign up until these are true)
1. **Deploy the branch.** Merge PR to `main` and deploy on the **correct** Hyperlift instance —
   then **delete the duplicate** so DNS can't hit a stale app.
2. **Persistent volume + backup.** Confirm `/app/data` is mounted (DB + photos). **Back it up before
   deploy** — the release runs an additive migration on the live `job` table.
3. **DNS (GoDaddy → Hyperlift).** Point `bidvoice.ai` + `www` at the app; keep `bidtranslator.com`
   pointed too (it will 301-redirect). No domain transfer needed.
4. **Env vars (Hyperlift):** `BT_PUBLIC_URL=https://bidvoice.ai`, `BT_CANONICAL_HOST=bidvoice.ai`,
   `BT_SIGNING_SECRET` set. Provision HTTPS (set `BT_FORCE_HTTPS=0` only while the cert is issuing).
5. **`ANTHROPIC_API_KEY` set.** Eden *is* the product — without it, the AI build/chat fall back to
   generic replies and the demo loses its magic. (Signup/manual bids still work; the pitch doesn't.)
6. **Email deliverability.** Verify `bidvoice.ai` in Resend and set
   `BT_MAIL_FROM="BidVoice <no-reply@bidvoice.ai>"`. Otherwise password-reset and invite emails send
   from the shared `resend.dev` test sender (poor deliverability / may land in spam).

## 🟠 P1 — Verify live before you invite anyone (smoke-test the funnel)
7. `https://bidvoice.ai/api/health` → `{"ok":true,"ai":true,...}`.
8. **End-to-end on a real phone:** sign up → speak a job → Eden builds the estimate → send proposal →
   open the client link (must be `bidvoice.ai`) → e-sign → pay deposit. Confirm the **PDF and share
   link use bidvoice.ai** and photos load.
9. **Emails:** trigger password-reset and an account invite — they arrive and their links point to
   `bidvoice.ai`.
10. **Redirect:** hitting `bidtranslator.com` 301s to `bidvoice.ai` (one canonical URL).
11. **Re-scrape OG:** run the URL through Facebook Sharing Debugger + LinkedIn Post Inspector so they
    fetch the new `og.png` (they cache aggressively).
12. **PWA install:** Add to Home Screen shows **BidVoice** + the B icon; launches full-screen.

## 🟡 P2 — Strongly recommended before a wider push (not a hard blocker)
13. **On-device voice pass** (iOS Safari + Android Chrome, installed PWA): mic permission → record →
    transcribe → Eden replies out loud; confirm graceful fallback to typing when denied. This is the
    one thing that can't be verified from a server.
14. **Stripe keys** only if you're charging at launch; free-start needs none.
15. **`og.png` in Archivo** (brand font) — current candidate uses a clean system fallback; cosmetic.

## Not blockers (deferred, by direction)
- Feature freeze until real users. Eden humanization continues only when it doesn't delay launch.
- Timeline wiring / proactivity / anticipation ledger — Version 2, driven by real contractor feedback.

---

### The mission after launch
Put it in front of 3–5 contractors, watch one full job each, and let their words reorder this backlog.
**Evidence, not guesses.**
