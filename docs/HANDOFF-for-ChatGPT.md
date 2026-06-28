# Bidtranslator — Engineering & Product Handoff

**Prepared for:** ChatGPT, joining as strategic product advisor
**Prepared by:** Claude (engineering co-pilot on this codebase)
**Date:** 2026-06-28
**Repo:** `seattleluxuryhomes/acquisition-analyzer` (the app lives at the repo root; the repo name is historical)
**Live:** https://bidtranslator.com
**Active dev branch:** `claude/finish-building-tkauur`

> Read this top to bottom before advising. A recurring theme below is the line
> between **BUILT** (shipping in code), **DESIGNED** (agreed in principle, not yet
> coded), and **CONSIDERED/REJECTED**. Honor that distinction — a lot of exciting
> strategy from recent sessions is DESIGNED, not BUILT.

---

## 1. Executive Summary

**What Bidtranslator is today.** A mobile-first, **voice-first** web app that lets a
small contractor capture a job by talking (or typing), and turns that into a
clean, priced, professional **bid/proposal** — translated into the client's
language — that the client can read, **sign**, and **pay a deposit on** from their
own phone. It is a working, deployed SaaS, not a prototype.

**The problem it solves.** Small residential contractors (the first target is
bilingual remodelers) lose hours writing bids after-hours, lose jobs to slow
turnaround, miscommunicate across a language barrier with clients and crews, and
chase deposits. Bidtranslator collapses "talk the job → priced bid → signed →
deposit collected" into minutes, on a phone, in two languages.

**Stage.** Post-MVP, **live in production** on a real domain with SSL, persistence,
and the full capture→bid→sign→pay loop working. It has paying-infrastructure wired
(Stripe subscription billing + Stripe Connect payments) and has processed at least
a $1 test deposit. It is **pre–real-user-traction**: the immediate goal is getting
it in front of the first real contractors. Billing/AI/email are all **env-gated and
optional**, so the app runs fully even with every integration switched off.

**Current vision (where the founder is steering).** Beyond a bid tool, the vision
is a **network/coordination layer for the trades** — "the Facebook of building."
A GC captures a job once and dispatches scope (with photos, in the sub's language)
to his crew; subs join free, and convert to paying when they want to bid their own
work; the graph spreads along real working relationships; money (deposits,
payments) flows through the rails. Monetize the transaction layer, give the
coordination away to win the network. **This vision is DESIGNED, not BUILT** (see
§9, §12).

**The 8 hard rules (from `CLAUDE.md`) — these are inviolable constraints:**
1. The AI provider key never reaches the browser — all AI goes through `/api/assist/build`.
2. `margin` and `notes` are private — never in the client view or PDF (enforced server-side in `src/proposal.js` `buildProposal()`).
3. Capture (voice/text/photos) works offline and syncs later.
4. The app still builds bids by hand if the AI step is down.
5. Each user can access only their own data — ownership checked on every endpoint.
6. Photos/PDFs are private — signed, expiring URLs only.
7. AI prices are placeholders; the contractor sets real numbers.
8. Consent/terms text is placeholder — needs legal review before launch.

---

## 2. Features Already Built

> All of the following are **BUILT and shipping** unless explicitly noted.

### 2.1 Voice-first job capture
- **Purpose:** A contractor opens the app, taps the mic, and describes the job out loud. No typing.
- **Implementation:** Two voice paths. (a) **Universal/server path** — the browser records audio (`MediaRecorder`) and POSTs to `/api/assist/transcribe`, transcribed by **OpenAI Whisper** (`OPENAI_API_KEY`). This is the primary path and the **only** one that works on iPhone Safari. (b) **Fallback** — the browser's live Web Speech API (Chrome/Android) when Whisper isn't configured. As the contractor talks, a lightweight **intake** call (`/api/assist/intake`) extracts structured fields (client, address, scope, materials, labor, timeline, follow-up questions) and auto-names the job.
- **Status:** Working. The capture screen is a persistent "AI notepad" whose draft survives re-renders/navigation (localStorage) so a dictation can't be wiped.
- **Missing:** Nothing critical. Whisper costs ~$0.006/min (acceptable).

### 2.2 AI bid build (translate + structure + price)
- **Purpose:** Turn the captured conversation into a structured, priced bid draft in the client's language.
- **Implementation:** `POST /api/assist/build` → `src/assist.js` → **Anthropic** (`ANTHROPIC_API_KEY`, model `claude-sonnet-4-6` by default, override via `BT_AI_MODEL`). Returns strict JSON: `translation`, `summary`, a contractor-only `brief`, `lines[]` (fixed/hourly/unit), `assumptions`, `exclusions`, `upgrades`. Output is sanitized/clamped server-side. The contractor's **price book** is fed in so the AI uses their real items/prices.
- **Status:** Working in production.
- **Missing:** Image inputs (photos/plans) are not yet sent to the build call (see Trades, §2.3).

### 2.3 Per-trade estimator "brains" — **BUILT TODAY, UNTESTED AGAINST LIVE AI**
- **Purpose:** Make the AI estimate like a specific trade (windows, roofing, etc.) instead of generically, so quantities are derived and line items are trade-correct.
- **Implementation:** `src/trades.js` — a library of **16 trades** (windows, roofing, siding, gutters, painting, flooring, concrete, fencing, decking, drywall, doors, insulation, kitchen-remodel, bathroom-remodel, landscaping, framing). Each carries (a) a domain **prompt/brain** (takeoff method, derived quantities, standard assumptions/exclusions) injected into the build system prompt as a `TRADE FOCUS` block, and (b) an `inputs` checklist of what to capture. `GET /api/trades` exposes the list; the capture screen has a **trade picker** with a "what to also capture" hint; the selected trade is threaded through `newJobFromForm → makeLocalJob → /api/assist/build`. Windows = classify each opening to the nearest standard-size SKU from photos + a reference dimension (or read the plans). Roofing = price by squares with pitch multipliers, derive starter/ridge/drip/valley from linear feet, tear-off + steep surcharges.
- **Status:** Code complete, server boots, `/api/trades` verified end-to-end with auth, all script blocks validated. **The live AI output has NOT been exercised** because no `ANTHROPIC_API_KEY` exists in the local/dev environment — it must be smoke-tested on the live server.
- **Missing:** Photo/plan ingestion into the build call (the brains are written to use it; the pipe isn't connected yet). Field-measure-before-order is intentionally required for windows (hard rule #7).

### 2.4 Private estimating (margin, notes, line items)
- **Purpose:** Contractor sets real prices and a private margin; client never sees cost/margin/notes.
- **Implementation:** Job stores `lines`, `upgrades`, `assumptions`, `exclusions` as JSON columns, plus **private** `margin` and `notes`. `src/proposal.js` `buildProposal()` **whitelists** client-facing fields, so margin/notes are structurally incapable of leaking (hard rule #2). Client-furnished line items display but add $0 to the total.
- **Status:** Working. This is a load-bearing safety invariant — do not bypass it.

### 2.5 Price book (SKUs)
- **Purpose:** Reusable per-contractor catalog of materials/labor with units and prices.
- **Implementation:** `src/skus.js` + `sku` table. SKUs are uploaded by **paste, CSV, or a photo of a supplier price sheet** and organized by AI (`/api/skus/parse` → Anthropic, with image vision). Each SKU optionally has a private material **photo**. SKUs drop into bids as line items and feed the AI build.
- **Status:** Working. Up to ~400 items parsed per upload; ~150 fed to the build prompt (token budget).

### 2.6 "See it in their kitchen" (AI visualization)
- **Purpose:** Render a price-book material (e.g. a quartz slab) onto a photo of the client's actual room.
- **Implementation:** `/api/jobs/:id/visualize` → `src/assist.js` `visualizeRoom()` → **OpenAI `gpt-image-1`** edits (same `OPENAI_API_KEY` as Whisper). The SKU's own photo is passed as a style reference; output PNG is added to the bid.
- **Status:** Working, env-gated, pay-per-image.

### 2.7 Client proposal (in-app view, shared link, PDF)
- **Purpose:** A clean, professional, bilingual proposal the homeowner can read.
- **Implementation:** Three surfaces, all built from `buildProposal()`: the in-app **Client view** tab, a **public shared page** (`GET /p/:id`, `src/proposalHtml.js`), and a **PDF** (`src/pdf.js`, pdfkit — no headless browser). Includes a **Terms & Protections** section (warranty, change orders, allowances, unforeseen conditions, permits, payment schedule) with a sensible default template the contractor can edit/disable.
- **Status:** Working. Sample PDF in `docs/Reyes-Bathroom-Proposal-sample.pdf`.

### 2.8 E-signature + acceptance
- **Purpose:** Homeowner signs and accepts the proposal on their phone.
- **Implementation:** `src/signatures.js` + `signature` table. Captures the inked PNG, signer name, **signer email**, accepted total, IP, user-agent, timestamp. Routes: `/p/:id/sign`, `/p/:id/accept`, `/p/:id/accept-and-pay`. On signing, a **signed agreement PDF** is delivered (emailed to client + optionally attached to the QuickBooks estimate). It is a **lightweight approval record, not a full legal e-sign platform** (consent text is placeholder — hard rule #8).
- **Status:** Working.

### 2.9 Get-paid: deposits via Stripe Connect
- **Purpose:** Collect a deposit from the homeowner, paid directly to the contractor.
- **Implementation:** `src/payments.js` + `payment_request` table. Each contractor onboards their **own** Stripe Express account; charges are made on that account so **the platform never holds funds**. The homeowner pays a deposit (default 25%, `deposit_pct`) by card at acceptance. Routes under `/api/payments/*` and `/p/:id/accept-and-pay`, `/pay/done`.
- **Status:** Working; a $1 test deposit has flowed and shown on the dashboard.

### 2.10 Subscription billing (the SaaS paywall)
- **Purpose:** Monetize the contractor's use of the app.
- **Implementation:** `src/billing.js` — Stripe Checkout + customer portal + webhooks via `fetch` (no SDK). Card-free **in-app trial** (`trial_ends_at`, default 14 days), then a paywall on paid features (`requireEntitled` → HTTP 402). Supports an optional **one-time setup fee** (`STRIPE_SETUP_PRICE_ID`, `setup_fee_paid` column) and promotion codes. **Entirely optional**: with no `STRIPE_SECRET_KEY`, every user is fully entitled.
- **Status:** Working. **Note:** the *pricing model* is mid-decision (see §7.10, §9) — the code supports a setup fee, but the founder is leaning toward **$0 setup + $49/mo**, which is DESIGNED not yet enforced.

### 2.11 QuickBooks Online sync
- **Purpose:** Signed bids / paid deposits land in the contractor's books automatically.
- **Implementation:** `src/quickbooks.js` — per-contractor **OAuth2** (each contractor connects their own QBO company). Paid payments sync as Sales Receipts; the signed PDF can attach to the Estimate (`Attachable`/`/upload`). Tokens server-only. Routes `/api/quickbooks/*`. Optional/env-gated (`QBO_CLIENT_ID/SECRET`, `QBO_ENVIRONMENT`).
- **Status:** Working in sandbox; production requires `QBO_ENVIRONMENT=production` (on the founder's to-do).

### 2.12 Accounts, auth, password reset
- **Implementation:** `src/auth.js` — scrypt-hashed passwords + **opaque server-side session tokens** (revocable, no JWT). Single-use **sha256 password-reset token** (1-hr TTL, revokes all sessions) with forgot/reset flow (`/api/auth/reset`, `/api/auth/reset-confirm`) and matching in-app UI.
- **Status:** Working. Reset emails go out via Resend when configured.

### 2.13 Transactional email (Resend)
- **Implementation:** `src/mail.js` — Resend HTTP API, env-gated (`RESEND_API_KEY`, `BT_MAIL_FROM`). Powers forgot-password and auto-emailing the signed agreement PDF.
- **Status:** Code built; **needs `RESEND_API_KEY` set in production** (on the founder's to-do). Degrades gracefully when unset.

### 2.14 Leads funnel
- **Implementation:** `src/leads.js` + `lead` table. Inbound contractor leads (website forms, ads, social, CSV, manual) at the top of the Lead → Job → Bid → Payment funnel. Per-user **inbound webhook token** (`/api/inbound/leads`) for n8n/form integrations.
- **Status:** Working.

### 2.15 Schedule / calendar
- **Implementation:** Jobs carry `scheduled_date` + optional `scheduled_time`; `viewSchedule` renders an agenda. Job `address` drives Maps/Directions/Street-View links.
- **Status:** Working (lightweight).

### 2.16 Founder analytics dashboard
- **Implementation:** `src/analytics.js` + `event` table (single write sink, ready to fan out to Mixpanel/PostHog/Segment later). Admin routes (`/api/admin/*`) gated by `BT_ADMIN_EMAIL` power a private **Founder** tab: contractors, active 7d, onboarded, bids created/sent/accepted, deposits paid, pipeline won, active subs, a funnel with biggest drop-off, per-contractor metrics, and feature adoption. The founder's own account is excluded from contractor metrics.
- **Status:** Working. **This is private to the founder — it is NOT a shareable/contractor feature.**

### 2.17 Follow Up Boss (founder CRM)
- **Implementation:** `src/followupboss.js` — on signup, pushes each contractor into the **founder's** Follow Up Boss as a person, sourced/tagged "Bidtranslator" to stay separate from the founder's real-estate pipeline, with lifecycle notes (onboarded, accepted, deposit, subscribed). Env-gated (`FOLLOWUPBOSS_API_KEY`).
- **Status:** Working, optional.

### 2.18 Confirmation webhook fan-out
- **Implementation:** `src/notify.js` — on key proposal events, optionally POSTs JSON to `BT_NOTIFY_WEBHOOK` (route to email/SMS/CRM via Zapier/Make). No SMS provider is wired directly.
- **Status:** Working seam; SMS itself is not built.

### 2.19 PWA (installable app)
- **Implementation:** `public/manifest.json` + `public/sw.js` (network-first nav, cache-first assets, never caches `/api` or `/p`) + install nudge. "Add to home screen."
- **Status:** Working.

### 2.20 Marketing surfaces
- **Implementation:** `public/landing.html` (EN) and `public/landing-es.html` (ES, **built today**) — full marketing pages with an **interactive browser-speech voice demo**, WhatsApp links, OG/Twitter cards (`og.png`), `robots.txt`, `sitemap.xml`, EN/ES hreflang + language switcher. Positioning: "Talk the job. Estimate in their language. Deposit today."
- **Status:** EN live; ES committed on the dev branch, **not yet deployed to `main`**.

### 2.21 WhatsApp layer
- **Implementation:** Bid-sharing via WhatsApp; per-contractor WhatsApp number in Settings (falls back to phone); landing "Chat on WhatsApp" (wa.me/12067142694).
- **Status:** Working (share + links). A WhatsApp *bot* (Meta API) is NOT built.

---

## 3. User Interface

Single-page app in `public/index.html` (~256 KB, vanilla JS, no framework), rendered
by a `render()`/`go(view)` router. Mobile-first; a bottom action area + a "More"
sheet drive navigation. Brand palette: ink/paper/amber/blue, IBM Plex + Archivo/
Inter type. Major screens (each a `view*()` function):

- **Auth (`viewAuth`)** — **voice-first hero**: a big mic and "record a job" framing on the sign-in/sign-up screen, plus forgot/reset modes. The login is intentionally about voice, not a boring form.
- **Dashboard / Home (`viewHome`)** — the job list as a **to-do list**: each job shows its stage and the single most useful **next action** (Finish & send / Awaiting client / Collect deposit / Schedule), opening the job to the right tab. Entry points to New bid (voice/type), Leads, Schedule, Settings, More.
- **Capture / New Job (`viewCapture`)** — the voice-first heart: mic, live "what you said" transcript, photo add, **trade picker** (new), live AI **intake card** (client/address/scope/materials/timeline) + follow-up questions, then "Continue to bid draft."
- **Job (`viewJob`)** — three tabs: **AI Notepad** (the captured/translated conversation + contractor brief), **Build the bid** (private estimating: line items, margin, price book picker, trade-template starter checklists, "See it in their kitchen", totals with cost/margin/profit), **Client view** (the clean proposal as the homeowner sees it).
- **Leads (`viewLeads`)** — inbound lead list/management, import, webhook token.
- **Price book / Catalog (`viewCatalog`)** — SKU catalog, AI upload (paste/CSV/photo), per-SKU photo.
- **Schedule (`viewSchedule`)** — agenda of scheduled jobs.
- **Settings (`viewSettings`)** — company profile, logo, languages (you/client), tax rate/region, deposit %, Terms text, WhatsApp number, and integration connect buttons (Stripe billing, Stripe Connect payments, QuickBooks).
- **Why Bidtranslator (`viewWhy`)** — in-app value/benefits explainer.
- **Paywall (`viewPaywall`)** — shown when a non-entitled user hits a paid action (402).
- **Founder/Admin (`viewAdmin`)** — private analytics (hidden unless `BT_ADMIN_EMAIL`).

**Public (no-app) surfaces:** the shared proposal page `/p/:id` (read, sign, pay) and
`/pay/done`. **Payments/signing happen on the homeowner's phone with no account.**

**Layout & mobile:** designed phone-first; installable PWA; offline capture with
later sync; client proposal is responsive HTML + downloadable PDF.

*(No screenshots embedded here — render `public/index.html` locally or visit
bidtranslator.com. The landing page screenshot and proposal sample PDF are in `docs/`.)*

---

## 4. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| **Runtime** | Node.js ≥ 22 | ESM (`"type":"module"`) |
| **Backend** | Express ^4.19 | The ONLY framework dep |
| **Database** | `node:sqlite` (`DatabaseSync`) | **Built-in** — no native build, no ORM. WAL mode, FKs on. |
| **PDF** | pdfkit ^0.15 | Pure JS, no headless browser |
| **Frontend** | Vanilla HTML/CSS/JS | Single `public/index.html`, no framework, no build step |
| **Auth** | `node:crypto` scrypt + opaque session tokens | No JWT, no auth library |
| **AI (text/vision)** | **Anthropic** Claude (`claude-sonnet-4-6` default) | Build, intake, SKU parsing |
| **Voice** | **OpenAI Whisper** (`whisper-1`) | Server transcription; Web Speech API fallback |
| **Image gen** | **OpenAI `gpt-image-1`** | "See it in their kitchen" |
| **Billing** | **Stripe** (Checkout, Portal, Webhooks) via `fetch` | No Stripe SDK |
| **Payments** | **Stripe Connect** (Express accounts) | Direct charges; platform holds no funds |
| **Accounting** | **QuickBooks Online** OAuth2 via `fetch` | Per-contractor |
| **Email** | **Resend** HTTP API | Env-gated |
| **CRM** | **Follow Up Boss** API | Founder-level |
| **Maps** | Deep links to Google/Apple Maps | No SDK; address-driven links |
| **File storage** | Local disk under `BT_DATA_DIR` (`/app/data`) behind **signed HMAC URLs** | `src/files.js` |
| **Analytics** | Own `event` table | Fan-out seam to Mixpanel/PostHog/Segment |
| **Hosting** | **Starlight Hyperlift** (Spaceship), Docker from GitHub `main` | `Dockerfile` at repo root |
| **Persistence/backup** | **Litestream → Cloudflare R2** (S3-compatible) + `/app/data` volume | `litestream.yml`, `docker-entrypoint.sh` restore-on-boot |
| **Domain/SSL** | bidtranslator.com, Spaceship nameservers, auto-HTTPS | Live |

**Dependency philosophy:** radically minimal — **two npm dependencies** (express,
pdfkit). Everything else (SQLite, crypto, fetch) is the Node standard library.
Every paid integration is **optional and env-gated**; the app runs fully with all of
them off.

---

## 5. Integrations

| Integration | Purpose | Status |
|---|---|---|
| **Anthropic Claude** | Bid build, intake, SKU parsing, trade brains | ✅ Built, live |
| **OpenAI Whisper** | Voice transcription (esp. iPhone) | ✅ Built, live |
| **OpenAI gpt-image-1** | Room visualization | ✅ Built |
| **Stripe Billing** | SaaS subscription + trial + setup fee | ✅ Built (pricing model mid-decision) |
| **Stripe Connect** | Contractor collects homeowner deposits | ✅ Built, $1 verified |
| **QuickBooks Online** | Sync paid deposits / attach signed PDF | ✅ Built (sandbox; flip to production pending) |
| **Resend (email)** | Reset + signed-PDF delivery | ✅ Built; ⚠️ needs `RESEND_API_KEY` in prod |
| **Follow Up Boss** | Founder's contractor CRM | ✅ Built, optional |
| **WhatsApp** | Bid sharing + per-contractor number + landing CTA | ✅ Links built; bot ❌ not built |
| **Notify webhook** | Fan-out proposal events to email/SMS/CRM | ✅ Seam built |
| **Inbound lead webhook** | n8n/forms → leads | ✅ Built |
| **Google/Apple Maps** | Directions/Street View from job address | ✅ Deep links |
| **Litestream / Cloudflare R2** | SQLite durability/backup | ✅ Built, live |
| **Calendar (Google/iCal)** | True calendar sync | ❌ Planned (only internal schedule today) |
| **SMS provider (Twilio etc.)** | Native SMS | ❌ Not built (webhook seam only) |
| **Referral / Team-subs / Onboarding-invite** | Growth engine | 🟡 DESIGNED, not built (see §9) |

---

## 6. Architecture

**Shape:** A classic server-rendered-shell + JSON-API SPA. Express serves static
`public/` and a REST API; `public/index.html` is a self-contained offline-first
client that syncs to the API. No build step anywhere.

**Folder structure:**
```
server.js            Express app + ALL routes (~1.3k lines)
src/
  db.js              SQLite schema + migrations (ensureColumns self-heal)
  auth.js            accounts, scrypt, sessions, password reset
  jobs.js            job CRUD (owner-scoped; JSON columns hydrated)
  assist.js          AI proxy: build, intake, transcribe, visualize, SKU parse
  trades.js          16 per-trade estimator brains (NEW)
  skus.js            price book CRUD
  leads.js           inbound leads + webhook token
  proposal.js        buildProposal() — the client-facing whitelist (hard rule #2)
  proposalHtml.js    public shared proposal page
  pdf.js             client PDF (pdfkit)
  signatures.js      e-sign approval record
  billing.js         Stripe subscriptions
  payments.js        Stripe Connect (get paid)
  quickbooks.js      QBO OAuth + sync
  mail.js            Resend email
  notify.js          confirmation webhook fan-out
  followupboss.js    founder CRM push
  files.js           signed/expiring private file URLs
  analytics.js       event sink + (future) fan-out
public/
  index.html         the entire SPA (vanilla)
  landing.html / landing-es.html   marketing (EN/ES)
  manifest.json, sw.js, og.png, robots.txt, sitemap.xml
docs/                build spec, founder brief, prototype, sample PDF, this handoff
scripts/build-demo.mjs   regenerates the offline clickable demo
Dockerfile, docker-entrypoint.sh, litestream.yml   deploy
```

**Database (SQLite) — tables:** `user`, `session`, `job`, `photo`,
`payment_request`, `interest`, `event`, `signature`, `sku`, `lead`. Jobs store
`lines/upgrades/assumptions/exclusions/brief` as **JSON columns** (acceptable at
this scale); photos get their own table + on-disk files behind signed URLs. Schema
evolves via an idempotent `ensureColumns()` migration helper (additive ALTERs) —
this is how the table has grown to include billing, Connect, QBO, tax, terms,
reset-token, WhatsApp, etc. columns without a migration framework.

**State management (client):** module-scoped globals in `index.html` hydrated at
boot — `TOKEN`, `USER`, `SETTINGS`, `JOBS`, `BILLING`, `PAYMENTS`, `QBO`, `NOTIFS`,
feature flags (`AI_BUILD`, `AI_TRANSCRIBE`, `AI_VISUALIZE`), and the persistent
`CAP_DRAFT`/`CAP_INTAKE` capture buffer (localStorage-backed). Offline-first: jobs
live locally and sync.

**API flow (representative):** capture → `/api/assist/transcribe` (voice) +
`/api/assist/intake` (live fields) → `/api/assist/build` (priced draft, with trade
+ price book) → job saved via `/api/jobs` → share `/api/jobs/:id/share` → homeowner
opens `/p/:id` → `/p/:id/sign` + `/p/:id/accept-and-pay` → webhooks update status →
QBO sync + signed-PDF email. Billing gates paid actions via `requireEntitled` (402).

**Security:**
- AI/Stripe/QBO keys are **server-only** (hard rule #1).
- **Ownership enforced on every endpoint** (hard rule #5).
- Private files only via **signed, expiring HMAC URLs** (`BT_SIGNING_SECRET`, hard rule #6).
- `margin`/`notes` cannot reach client surfaces (whitelist in `buildProposal()`, hard rule #2).
- scrypt passwords; opaque, revocable server-side sessions; single-use reset tokens.
- Stripe webhook signatures verified (`STRIPE_WEBHOOK_SECRET`); replay-guarded.
- Stripe Connect means **the platform never custodies funds** (big regulatory simplifier).

---

## 7. Product Decisions (made, with rationale & alternatives)

**7.1 `node:sqlite` over Postgres/Supabase.** Chosen for zero-ops, single-file
durability, no native build. The REST surface matches the original build spec's
"Path B," so it can be swapped to Supabase/Postgres later if scale demands.
Trade-off: single-node, no managed HA — mitigated by Litestream→R2.

**7.2 No frontend framework.** The UI was carried over from a *tested* HTML/CSS/JS
prototype; rewriting in React would have risked the validated UX for no user-facing
gain and added a build step. Trade-off: one large `index.html` (maintainability
cost, see §10).

**7.3 Two npm dependencies only.** Everything via Node stdlib + `fetch`. Fewer
supply-chain risks, trivial deploys, no SDK churn. Trade-off: more hand-written
integration code (Stripe/QBO/Resend done by hand).

**7.4 Every integration optional + env-gated.** The app must run with all keys off
(hard rules #1/#4). This makes local dev, demos, and graceful degradation trivial,
and means a failed integration never bricks the core loop.

**7.5 Server-side AI only.** Non-negotiable (hard rule #1) — protects the key and
lets the app fall back to manual bidding (hard rule #4).

**7.6 Stripe Connect for payments.** So the contractor is paid directly and the
platform never holds money — avoids money-transmitter complexity. Alternative
(platform-holds-then-pays-out) was rejected for regulatory/escrow burden.

**7.7 `buildProposal()` whitelist as the privacy boundary.** Rather than trusting
each surface to hide margin/notes, ONE function emits client data and physically
omits private fields. Alternative (filter per-view) was rejected as leak-prone.

**7.8 AI prices are placeholders (hard rule #7).** The contractor always sets real
numbers; for windows, photo-derived sizes are explicitly "field-verify before
ordering." This is honesty-by-design and protects against bad orders — keep it.

**7.9 Freemium: manual bidding free, AI/payments/QuickBooks gated.** Decision made
this session — "so we can say it's a free app." Manual bid-building never blocks;
the trial then paywall covers AI + premium. Reflected in the 402 copy ("Building
and sending bids by hand stays free").

**7.10 Pricing model — DECIDED IN PRINCIPLE, NOT YET ENFORCED IN CODE.**
After debate, the founder is landing on: **$0 setup fee, $49/month**, a free trial
first, and a **referral credit that reduces the monthly toward $0** ("bring a
paying sub, knock $10 off; five paying subs → free"), plus a **founder rate-lock**
(early adopters keep the launch price forever). "Free for life for founders" was
**CONSIDERED and REJECTED** in favor of the earnable credit (permanent liability
with no upside vs. a self-funding, churn-correcting discount). A $299/$500 setup
fee was **CONSIDERED and REJECTED** for default signups (friction kills the viral
sub→GC conversion) — though an *optional concierge onboarding* upsell is on the
table. **Code today still supports a setup fee and a flat monthly; the credit/
rate-lock logic is not built.**

**7.11 Keep the 16-variable Hyperlift instance.** A second Hyperlift app got created
during deployment; the live, fully-configured one (16 env vars incl. Litestream/
Stripe/QBO) is canonical. The duplicate 5-var instance should be deleted (open
task). Lesson: the code was identical between them; the difference was *config*.

**7.12 SEO deprioritized.** Long-tail SEO for "voice bid contractor" was discussed
and consciously **deferred** — first real users matter more than ranking at this
stage. `sitemap.xml`/`robots.txt`/landing pages exist as a foundation.

**7.13 Hold deploys while the founder is working live.** Pushing to `main` triggers
a Hyperlift redeploy (~brief 503). Convention: build/test on the dev branch, deploy
only on the founder's explicit "deploy."

---

## 8. UX Improvements Already Completed

- **Voice-first everything** — the login/landing and New Job screen lead with the mic, not a form. Why: the product's magic and the contractor's reality is talking, not typing.
- **Persistent capture "notepad"** — the dictation draft survives navigation/re-render (localStorage). Why: a real bug wiped a dictated address when the mic was re-tapped; the capture buffer now can't be lost, and the New-bid button confirms before clearing.
- **Dashboard as a to-do list** — each job surfaces its single best next action and opens to the right tab. Why: contractors want "what do I do next," not a passive list.
- **Live intake while talking** — fields + follow-up questions populate as the contractor speaks, with an auto-generated project name. Why: removes form-filling and shows the AI "understands."
- **Trade picker with "what to capture" hints** (today) — tells the contractor exactly what to measure/photograph per trade. Why: better inputs → tighter AI estimate, and it teaches the workflow.
- **Terms & Protections on every bid** — default professional clauses, editable. Why: protects the contractor (change orders, allowances, unforeseen conditions) and looks pro.
- **Installable PWA + install nudge.** Why: "the most important button on their phone."
- **Signed-PDF auto-delivery to the client + QBO attach.** Why: closes the loop without manual steps.
- **Spanish landing page + EN/ES switcher + interactive voice demo** (today). Why: enables language-targeted ad funnels to Spanish-speaking contractors.
- **WhatsApp share + per-contractor number.** Why: WhatsApp is how this audience actually communicates.
- **Real Stripe prices in paywall copy** — the page shows the actual charge, never a promised fee that isn't charged.

---

## 9. Current Roadmap

### High priority (do next)
1. **Smoke-test the trade brains against live AI** (no local key — must run on prod). Confirm windows/roofing produce sane drafts before pitching window contractors.
2. **Set `RESEND_API_KEY`** in prod → unlocks reset + signed-PDF email fully.
3. **Flip QuickBooks to `QBO_ENVIRONMENT=production`.**
4. **Delete the duplicate 5-var Hyperlift instance** (task #4).
5. **Deploy the dev branch** (Spanish landing + trade brains + WhatsApp batch) to `main`.
6. **Live end-to-end verification** (share links, persistence, voice on a real phone) — task #8.
7. **Concierge onboarding ("Onboard a contractor")** — DESIGNED: founder enters a contractor's email/company/trade → creates the account → optionally seeds a sample window bid → emails a secure "set your password & get started" link (reuse the reset-token + Resend primitive). Show the link to copy/send as a fallback until Resend is on.

### Medium priority
8. **Founder sales pipeline + 5-part behavior-triggered follow-up** — DESIGNED. Load prospect contractors, track status (Invited → Activated → Built → Sent → Subscribed), fire the right nudge based on what they actually did in-app (a follow-up engine a generic CRM can't match). The 5-message sequence copy is already written. Keep it **separate from the founder's real-estate Follow Up Boss** (separate login/account).
9. **Pricing model implementation** — enforce $0 setup + $49/mo, build the **referral credit** ledger (−$10/paying sub → $0) and the **founder rate-lock**.
10. **Photo/plan ingestion into the AI build** — wire job photos (and uploaded plans/window schedules) into `/api/assist/build` so the trade brains can actually see them.

### Future ideas (the big vision)
11. **Team/Subs + scope-of-work dispatch (the network engine)** — task #11, DESIGNED. A "Team/Subs" section (above Price book): GC adds a sub (name, phone, trade, **language**); an invite link auto-fires (reuse WhatsApp/SMS). The sub gets a **free seat** to *receive* scope of work (voice-captured scope + photos + scoped "access," in their language) and tap to **accept** (a record for change-order protection) — but **cannot create their own bids without paying** (existing paywall). When a sub upgrades, they become a GC who adds their own subs → self-replicating growth loop. Privacy: sub sees scope, never margin (reuse `buildProposal()` strip). This is the "Facebook of building" wedge.
12. **Referral program** — task #10, DESIGNED. "Invite — get a month free" as a single item under the More menu (reuse the share sheet). Reward triggers on the referee *paying* (abuse-proof).
13. **Native SMS, real calendar sync, WhatsApp bot (Meta API), analytics fan-out.**

---

## 10. Technical Debt

**Should be improved:**
- **`public/index.html` is a single ~256 KB / ~3,000-line file.** It works and the UX is validated, but it's the biggest maintainability risk. If/when it hurts, split into ES modules (still no framework needed) — but only when the pain is real, and never at the cost of the validated UX or the no-build-step simplicity.
- **`server.js` holds all ~70 routes** (~1.3k lines). Could split into route modules. Low urgency.
- **No automated tests.** Verification today is manual + syntax/boot checks. The privacy invariant (margin/notes never leak) and the billing entitlement logic are the two places worth a small test harness first.
- **Client `TRADE_PICK` list duplicates server `trades.js` labels.** Presentation-only drift risk; acceptable for now (could be fed by `/api/trades` at boot).

**Should NOT be touched (load-bearing — change with extreme care):**
- `buildProposal()` privacy whitelist (hard rule #2).
- Signed-URL HMAC scheme (`src/files.js`, hard rule #6).
- Server-only AI key path (hard rule #1) and the manual-bid fallback (hard rule #4).
- The env-gated/optional pattern for every integration.
- Stripe webhook verification + Connect "platform holds no funds" model.
- `ensureColumns()` additive-migration discipline (never drop/rename in place).

**Should eventually be refactored:** the front-end into modules; routes into files;
add a thin integration-test layer around money + privacy.

---

## 11. Known Bugs / Risks / Edge Cases

- **Trade brains unverified against live AI** — the single most important thing to test before relying on them in a pitch. (No bug observed; simply untested.)
- **Window sizing from photos is inherently approximate** — by design requires a field measure before ordering (not a bug; must stay framed that way to avoid bad orders).
- **AI rate/monthly caps can 429 under heavy testing** — `BT_AI_RATE_MAX` (per-60s) and `BT_AI_MONTHLY_CAP` (per-user/month) were raised during testing; tune for real load.
- **Email/QBO-production/Resend depend on env vars** not yet all set in prod — features degrade silently until configured (by design, but track it).
- **Single-node SQLite** — durability rests on Litestream→R2 + the `/app/data` volume; a misconfigured volume on a new Hyperlift instance = data loss (this exact confusion happened once with the duplicate instance).
- **Consent/terms copy is placeholder** (hard rule #8) — needs legal review before real launch; the e-sign is an approval record, not a certified e-signature.
- **No automated tests** → regressions in privacy/billing would be caught only by manual review.
- **Resolved this session:** voice "No audio to transcribe" (the `audio/webm;codecs=opus` MIME regex in `transcribeAudio`); the capture-clear bug; the SSL/port/persistence/deploy issues.

---

## 12. Product Vision (30 / 90 / 365 days)

**30 days — prove the single-contractor loop.** Live, verified, in the hands of the
first few real contractors (starting with a window contractor via concierge
onboarding). RESEND + QBO-prod on. Trade brains validated. Spanish ad funnel
pointed at `landing-es.html`. Goal: a real contractor talks a job, sends a bilingual
bid, and collects a deposit — and tells you it saved him time. Instrument the funnel
(`event` table) to see where they stall.

**90 days — turn on the crew loop.** Ship Team/Subs + scope dispatch and the
referral credit. Get *one* GC to pull his subs on (free seats), and watch the graph
take its first hop. Implement the $0-setup/$49 + credit pricing and the founder
rate-lock. Stand up the founder sales pipeline with behavior-triggered follow-ups so
acquisition is systematic, not ad hoc.

**1 year — become the rails.** If the crew loop turns, lean into "the Facebook of
building": coordination is free and viral; money (deposits, payments, payroll-ish
flows) runs through the platform; that's where the durable business is (a payments/
network business, closer to Toast/ServiceTitan-for-the-one-truck-guy than a bid
tool). Expand the trade-brain library into a moat (every onboarded contractor
sharpens their trade's estimator). Harden infra (consider Postgres if scale demands)
and add the test layer before the surface area gets too big to hand-verify.

---

## 13. Competitor Analysis

**Named competitor:** **Guild Assist** (AI assistant for contractors).
**Category competitors:** Jobber, Housecall Pro, ServiceTitan (field-service/CRM
suites), Joist / JobFLEX (mobile estimate apps), Buildxact/Knowify (estimating).

**Where we win:**
- **Voice-first capture** — talk the job; almost everyone else is forms.
- **Bilingual by default** — bid in the client's language *and* dispatch to the sub in his language. The translation is core, not a bolt-on. Huge for the bilingual-remodeler wedge.
- **Deposit-on-the-spot** — sign + pay a deposit on the homeowner's phone, money direct to the contractor (Connect). Many tools stop at "send estimate."
- **Price/positioning** — aiming dramatically cheaper than ServiceTitan/Jobber/Housecall, "cheap enough everybody uses it," for the one-truck operator nobody builds for.
- **The crew/network model (coming)** — free sub seats + scope dispatch is a distribution mechanism the incumbents don't have.
- **Radical simplicity / no-bloat** — a contractor can be productive in minutes.

**Where we're behind (today):**
- **Breadth** — no deep scheduling/dispatch, time-tracking, full CRM, inventory, or job-costing suite. We're a sharp wedge, not a platform (yet).
- **Native mobile apps** — we're a PWA; incumbents have App/Play Store presence (we're "getting ready" for stores).
- **Brand/trust/reviews** — zero brand equity vs. established players.
- **Integrations breadth** — we have QBO + Stripe; incumbents integrate widely.
- **Maturity/testing** — small, fast-moving codebase with no test suite vs. mature products.

**Strategy implication:** don't try to out-feature the suites. Win the wedge (voice
+ bilingual + instant deposit) for the underserved one-truck/bilingual contractor,
then expand *outward via the crew network*, not by cloning ServiceTitan.

---

## 14. Lessons Learned

**If starting today from this codebase, what I'd do the same:** the minimal-deps,
no-build, env-gated-everything architecture has been a force multiplier — fast
deploys, trivial local dev, graceful degradation, and a privacy model that's
*structurally* safe. Keep it.

**What I'd consider doing differently:** introduce a tiny test harness *early*
around the two money/privacy invariants (margin/notes leak; billing entitlement),
and consider splitting `index.html` into ES modules *before* it crossed ~2k lines.
Both are now mild debt rather than crises.

**Advice before any major change:**
- Re-read the 8 hard rules; several are enforced *structurally* (whitelist, signed
  URLs, server-only keys). Don't route around them for convenience.
- Respect the **BUILT vs DESIGNED** line. Much of the recent excitement (subs,
  referral, pricing credit, onboarding, follow-up) is *agreed design, not code*.
- Don't add a framework or a build step casually — the no-build simplicity is a
  feature, and the UX is already validated.
- Deploys hit `main` → live redeploy. Stage on the dev branch; deploy deliberately.
- Keep integrations optional/env-gated; never make the core loop depend on a key.

---

## 15. Recommendations for ChatGPT

ChatGPT — welcome. Here's what will make your advice land:

**What to know before advising:**
- This is a **live, lean, deployed** product with a tiny, deliberate stack (Express +
  `node:sqlite` + pdfkit, two npm deps, no build step). It is **not** a greenfield —
  respect what exists.
- There is a hard line between **BUILT** (in code), **DESIGNED** (agreed, not coded),
  and **REJECTED**. §2/§5 mark it carefully. The founder is mid-stride on a big
  network vision; most of it is *designed*, not shipped. Advise accordingly — don't
  assume the subs/referral/pricing-credit features exist.
- The audience is **small bilingual residential contractors**; the wedge is **voice +
  bilingual + instant deposit**; the moat-to-be is the **crew network** + a growing
  **trade-estimator library**.

**Architectural decisions to preserve (do not casually overturn):**
1. **Server-only AI/secret keys** + the **manual-bid fallback** (hard rules #1/#4).
2. The **`buildProposal()` whitelist** as the single client-data boundary (#2) — margin/notes must never leak.
3. **Signed/expiring HMAC file URLs** (#6).
4. **Ownership checks on every endpoint** (#5).
5. **Stripe Connect "platform holds no funds."**
6. **Every integration optional + env-gated.**
7. **No build step / minimal deps** — a deliberate strength, not an oversight.
8. **Additive-only schema migrations** (`ensureColumns`).

**Mistakes to avoid:**
- Recommending a framework rewrite or a heavy build pipeline "for scale" — premature; the UX is validated and the simplicity is load-bearing.
- Treating designed-but-unbuilt features as done.
- Proposing the platform custody/escrow funds (regulatory landmine — Connect avoids it on purpose).
- Time-based drip CRMs when the product can do **behavior-triggered** follow-ups (it knows who logged in / built / sent).
- Over-monetizing entry (setup fees, high price) and starving the **network land-grab** — the thesis is win the graph cheap, monetize the transaction layer.

**Biggest opportunities (where I'd push):**
- The **crew/subs network** (free seat to receive scope, pay to bid) — the one feature that turns a tool into a moat.
- The **trade-estimator library** as compounding IP — windows/roofing are live in code today; each new trade + each contractor's price book makes the estimator smarter.
- **Bilingual GC↔sub dispatch** — translation isn't just for the homeowner; it's the wedge into the Spanish-speaking crews who *are* the subs.
- **Concierge onboarding + behavior-triggered follow-up** to convert the first contractors systematically.

**Where I'd most value your strategic input:**
1. **Pricing & the referral credit** — is "$0 setup, $49/mo, −$10 per paying sub → free, founder rate-lock" the right structure, or is there a cleaner model that still fuels the network land-grab? What are the failure modes?
2. **Sequencing the network features vs. core polish** — when exactly do you flip from "perfect the single-contractor loop" to "ship subs/referral"? What signal says "go"?
3. **The wedge-to-platform path** — how far to ride the voice+bilingual+deposit wedge before expanding, and in what order (scheduling? dispatch? payroll-ish flows?) without becoming bloated like the incumbents.
4. **Go-to-market for bilingual contractors** — language-targeted ad funnels (we built the Spanish landing page) + the concierge/sales-pipeline motion: what would you prioritize to land the first 50 paying contractors?
5. **Defensibility** — beyond the network effect, where's the durable moat, and what should we build now to deepen it?

The founder thinks like a co-founder and wants real opinions, not options lists —
when you have a view, state it and say why. Honor the hard rules, respect the
BUILT/DESIGNED line, and push on the network thesis.
