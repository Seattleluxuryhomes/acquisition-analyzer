# Canonical Domain Audit & Migration Plan

**Date:** 2026-07-02 · **Scope:** every place a domain/URL is emitted, across code, config,
SEO surfaces, email, money, and callbacks. **Goal:** one canonical origin so Google (and
Stripe, and email clients) treat BidVoice as **one** site — no split authority, no
duplicate indexing.

---

## Recommendation: one canonical origin — `https://bidvoice.ai`

This is **not an assumption** — it's the already-finalized brand canon:
- `docs/BIDVOICE_MASTER_SPEC.md`: *"domain **bidvoice.ai**. Retired forever (never
  user-facing): Bidtranslator."*
- `docs/brand-standard.md`: *Domain → **bidvoice.ai**.*
- `scripts/brand-check.mjs` **fails CI** if `bidtranslator.com` reaches any `public/`/`src/`
  file — the code is already held to bidvoice.ai.

What is **not yet done** is the *deployment* cutover: the live site still runs on the
retired `bidtranslator.com` (per `docs/PROJECT-STATE.md`, SSL task #1). So this is a
**migration**, and it's mostly configuration + DNS, not code.

### The three-way split to collapse
| Variant | Verdict |
|---|---|
| `bidtranslator.com` | **Retired.** 301 → `bidvoice.ai`. Keep the registration (so the redirect lives), never serve content from it. |
| `app.bidvoice.ai` | **Do NOT introduce.** The app is a *single* Express server that serves the marketing pages **and** the app from one origin. Splitting the app onto a subdomain would fracture authority and buys nothing. |
| `www.bidvoice.ai` | 301 → apex `bidvoice.ai` (pick apex as canonical; `BT_CANONICAL_HOST` enforces it). |

**One canonical host: the apex `bidvoice.ai`.** Marketing + app + `/guide` all live there.
Per-contractor sites live at `<slug>.bidvoice.ai` (intentional wildcard, separate site
entities — not part of the apex's authority and fine to keep).

---

## How URLs are generated (the good news)

The app is already **name-agnostic** — three env knobs drive every generated link:

| Knob | Controls | Default in code |
|---|---|---|
| `BT_PUBLIC_URL` | **Every generated link** — email, proposal `/p/`, share `/c/ /d/ /co/ /s/`, Stripe success/cancel/return, Connect onboarding, QBO callback, lead webhook | falls back to the request host if unset |
| `BT_CANONICAL_HOST` | 301-redirect any other host → this one (`server.js`) | unset (no redirect) |
| `BT_SITE_DOMAIN` | contractor site subdomains `<slug>.<domain>` | `bidvoice.ai` |

**Consequence:** once `BT_PUBLIC_URL=https://bidvoice.ai` and `BT_CANONICAL_HOST=bidvoice.ai`
are set in production, **all dynamic links are correct automatically.** No code change is
needed for those. The static/hardcoded references below are what remain.

---

## Full inventory — every place a domain appears

### A. Runtime code & SEO surfaces (deployed) — **already `bidvoice.ai` or env-driven ✓**
These ship to users and are already correct; listed so the audit is complete and to re-verify.

| Location | Domain surface | State |
|---|---|---|
| `server.js` `baseUrl()` | all generated links | ✅ env-driven (`BT_PUBLIC_URL`) |
| `server.js` canonical redirect | host/HTTPS canonicalization | ✅ **now 301** (was 307 — fixed, see below) |
| `src/emails.js` | email links + logo base, `support@bidvoice.ai` | ✅ base passed in; default `bidvoice.ai` |
| `src/legal.js` | `support@ / privacy@ / legal@bidvoice.ai` | ✅ |
| `src/auth.js` | `support@bidvoice.ai` copy | ✅ |
| `src/contractorSite.js` | "powered by" → `bidvoice.ai`; `GeneralContractor` JSON-LD | ✅ |
| `src/guidePage.js` | `<canonical>`, `og:url`, HowTo/FAQ JSON-LD | ✅ built from `baseUrl` |
| `public/index.html` | `og:url`, `og:image`, `twitter:image` → `bidvoice.ai/og.png` | ✅ (`og.png` present) |
| `public/landing.html` / `landing-es.html` | `og:url`, `twitter:image`, **hreflang** alternates | ✅ `bidvoice.ai` |
| `public/robots.txt` | `Sitemap:` → `bidvoice.ai/sitemap.xml` | ✅ |
| `public/sitemap.xml` | all `<loc>` (`/`, landings, `/guide`) | ✅ `bidvoice.ai` |
| `public/contractor-site-template.html` | "powered by" link | ✅ |
| `public/manifest.json`, `sw.js` reg | `start_url`/`scope` **relative** | ✅ domain-agnostic |

### B. Configuration / deploy — **MUST be set/changed to migrate**
| Location | Now | Required |
|---|---|---|
| **Hyperlift env** `BT_PUBLIC_URL` | (live: bidtranslator.com) | `https://bidvoice.ai` |
| **Hyperlift env** `BT_CANONICAL_HOST` | unset | `bidvoice.ai` |
| **Hyperlift env** `BT_SITE_DOMAIN` | default | `bidvoice.ai` (explicit) |
| **Hyperlift env** `BT_FORCE_HTTPS` | — | `1` (once cert issued) |
| **DNS** | bidtranslator.com → app | `bidvoice.ai` + `www` → app; **`bidtranslator.com` 301 → `bidvoice.ai`** |
| **Resend** sending domain + `BT_MAIL_FROM` | test `resend.dev` | verify `bidvoice.ai`, `BT_MAIL_FROM="BidVoice <no-reply@bidvoice.ai>"` |
| **Stripe** webhook endpoint | bidtranslator.com | `https://bidvoice.ai/api/billing/webhook` |
| **Stripe Connect / QBO / FollowUpBoss** return + callback URLs | derived | auto-correct once `BT_PUBLIC_URL` is set (verify in each dashboard) |
| `.env.example` | ~~`app.bidtranslator.com`~~ | ✅ **fixed** → `bidvoice.ai` example |
| `DEPLOY.md` env table + title | ~~bidtranslator.com~~ | ✅ **fixed** → `bidvoice.ai` + pointer here |

### C. Docs & fixtures — stale references (cosmetic / historical, non-blocking)
Not user-facing, don't affect production; update for accuracy when convenient. **None block
the migration.**
- `docs/PROJECT-STATE.md`, `docs/HANDOFF-for-ChatGPT.md`, `docs/MARKETING-BRIEF-for-ChatGPT.md`,
  `docs/Bidtranslator-Founder-Brief.md`, `docs/release-testing-checklist.md` — narrative
  "Live: bidtranslator.com" (point-in-time snapshots; leave or refresh).
- `docs/ECOSYSTEM-ROADMAP.md` — frames `*.bidvoice.ai` vs `*.bidtranslator.com` as an open
  question; **this audit closes it → `bidvoice.ai`.**
- `scripts/build-demo.mjs` + `docs/Bidtranslator-Demo.html` — demo fixture uses
  `demo@bidtranslator.com` (offline demo, not the deployed app).
- `docs/launch-checklist.md` — already correct (`bidvoice.ai`, `BT_CANONICAL_HOST`); it's
  the authoritative operational runbook (supersedes the older Spaceship framing in `DEPLOY.md`).

---

## Code fixes made in this change
1. **Canonical redirect `307 → 301`** (`server.js`). A 307 is *temporary* — search engines
   keep the old host indexed and **split the authority**, which is the exact problem this
   task exists to prevent. 301 is permanent and consolidates ranking onto `bidvoice.ai`.
   Cross-origin hits here are GET (crawlers, old links, address bar); Stripe/webhooks target
   the canonical host directly, so nothing method-sensitive bounces through this hop.
2. **`.env.example`** — example `BT_PUBLIC_URL` corrected to `bidvoice.ai`, plus documented
   `BT_CANONICAL_HOST` / `BT_SITE_DOMAIN`.
3. **`DEPLOY.md`** — title + env table corrected to `bidvoice.ai`; banner points here.

No user-facing runtime behavior changes (redirect status is the only wire-visible change,
and it's strictly more correct).

---

## Migration runbook (ordered — do it in this sequence)

1. **DNS:** point `bidvoice.ai` + `www.bidvoice.ai` at the Hyperlift app. Provision TLS
   (leave `BT_FORCE_HTTPS=0` only while the cert is issuing, then set `1`).
2. **Env:** set `BT_PUBLIC_URL=https://bidvoice.ai`, `BT_CANONICAL_HOST=bidvoice.ai`,
   `BT_SITE_DOMAIN=bidvoice.ai`, `BT_SIGNING_SECRET` (already set), redeploy.
3. **Old domain redirect:** configure `bidtranslator.com` (and `www`) to **301** →
   `https://bidvoice.ai` at the DNS/host layer. (If it still points at the app, the app's
   `BT_CANONICAL_HOST` 301 now handles it — but a host-layer redirect is cleaner and doesn't
   depend on the app.)
4. **Resend:** verify the `bidvoice.ai` sending domain; set
   `BT_MAIL_FROM="BidVoice <no-reply@bidvoice.ai>"`. Send yourself a password-reset to confirm.
5. **Stripe:** update the webhook endpoint to `https://bidvoice.ai/api/billing/webhook`
   (new signing secret → `STRIPE_WEBHOOK_SECRET`); confirm Connect/Portal return URLs resolve.
6. **Search Console:** add `bidvoice.ai`, submit `https://bidvoice.ai/sitemap.xml`, and use
   the **Change of Address** tool from `bidtranslator.com` → `bidvoice.ai` if that property
   was verified.

## Post-cutover verification checklist
- [ ] `https://bidtranslator.com/anything` → **301** → `https://bidvoice.ai/anything`.
- [ ] `http://bidvoice.ai` and `www.bidvoice.ai` → **301** → `https://bidvoice.ai`.
- [ ] `https://bidvoice.ai/api/health` → `{"ok":true,...}` (never redirected).
- [ ] A sent proposal link, PDF footer, and **deposit payment** link all read `bidvoice.ai`.
- [ ] Password-reset + verification emails arrive, links are `bidvoice.ai`, sender is your domain.
- [ ] `view-source` on `/`, `/landing.html`, `/guide`: `og:url` + `<canonical>` = `bidvoice.ai`.
- [ ] `robots.txt` + `sitemap.xml` reachable at `bidvoice.ai`; sitemap lists `/guide`.
- [ ] A contractor "Publish Website" produces `<slug>.bidvoice.ai`.
- [ ] `npm run brand-check` green (guards against `bidtranslator.com` regressions).

## Rollback
The change is config-only: revert env `BT_PUBLIC_URL`/`BT_CANONICAL_HOST` and DNS to the
prior host. No data migration, no schema change. (The 301 will be cached by browsers —
prefer fixing forward over relying on rollback once the 301 is public.)

---

## Open decision for the founder (not assumed)
- **Apex vs `www`** as the canonical: this plan picks the **apex** `bidvoice.ai`. If you
  prefer `www.bidvoice.ai` as canonical (some CDNs favor it), flip `BT_CANONICAL_HOST` and
  the hardcoded `og:url`/sitemap/hreflang values accordingly — say the word and I'll switch
  them in one pass. Everything else in this plan is independent of that choice.
