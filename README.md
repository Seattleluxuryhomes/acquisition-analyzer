# Bidtranslator — Phase 1 (hosted core)

A field notebook + bilingual bid builder for small contractors. Capture a job
conversation (voice/text), translate + structure it into a bid draft, price it
privately, and send a clean client proposal PDF — with accounts, cloud sync, and
offline capture.

Built from the tested prototype (`bidtranslator-app.html`) per the handoff spec.
The UI and flow are kept; persistence moved to a real backend and the AI call
moved server-side.

## Stack

- **Backend:** Node 22 + Express, `node:sqlite` (built-in — no native build), `pdfkit`.
- **Auth:** scrypt-hashed passwords + opaque server-side session tokens (`node:crypto`).
- **AI:** server-side proxy to Anthropic at `POST /api/assist/build` — the key never reaches the browser.
- **Billing:** Stripe subscriptions (Checkout + customer portal + webhooks) via `fetch` — no SDK dependency. Optional: off by default, app runs fully without it.
- **Front end:** the prototype's HTML/CSS/JS, refactored onto an offline-first sync layer.

No third-party account is required to run it. (This is "Path B" from the build
spec; the REST surface matches the spec, so it could be swapped to Supabase later.)

## Run it

```bash
cd bidtranslator
npm install
cp .env.example .env        # then add your ANTHROPIC_API_KEY and a BT_SIGNING_SECRET
npm start                   # http://localhost:4000
```

Without `ANTHROPIC_API_KEY` the app still runs — the AI "Build the bid draft"
step returns a clear error and the contractor builds the bid by hand (the app
never blocks on the AI).

### Environment

| Var | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | for AI build | Server-side translate/structure. Omit and the app degrades to manual entry. |
| `BT_SIGNING_SECRET` | in production | Signs private photo URLs. Set a long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). |
| `BT_AI_MODEL` | no | Defaults to `claude-sonnet-4-6`. |
| `BT_AI_MONTHLY_CAP` | no | Per-user monthly AI-build cap (default 200). |
| `BT_PORT` | no | Default 4000. |
| `BT_DATA_DIR` | no | Where the SQLite db + photos live (default `./data`). |
| `STRIPE_SECRET_KEY` | for billing | Enables subscriptions. Omit and billing is off (every user has full access). |
| `STRIPE_PRICE_ID` | for billing | The recurring monthly Price object in Stripe. |
| `STRIPE_WEBHOOK_SECRET` | for billing | Signing secret for the `/api/billing/webhook` endpoint. |
| `BT_TRIAL_DAYS` | no | Free-trial length on signup (default 14). |
| `BT_PUBLIC_URL` | for billing | Base URL for Stripe success/return links (e.g. your hosted domain). |

## API

```
POST   /api/auth/signup | signin | signout | reset
GET    /api/me            PATCH /api/me                  settings
GET    /api/jobs          POST /api/jobs
GET    /api/jobs/:id      PATCH /api/jobs/:id            DELETE /api/jobs/:id
POST   /api/jobs/:id/photos        GET .../photos/:pid (signed)   DELETE .../photos/:pid
POST   /api/assist/build           AI translate + structure
GET    /api/jobs/:id/pdf           server-rendered client proposal
GET    /api/billing/status         subscription/trial state
POST   /api/billing/checkout       -> Stripe Checkout URL
POST   /api/billing/portal         -> Stripe customer-portal URL
POST   /api/billing/webhook        Stripe events (raw body, signature-verified)
```

## Payments / subscriptions

Contractor subscription is the revenue model (per the founder brief). Implemented
with Stripe and **off by default** — set the `STRIPE_*` vars to turn it on.

- **Free trial → paywall.** New signups get a 14-day trial (`BT_TRIAL_DAYS`). During
  the trial the app is fully usable, so onboarding can end in a real sent bid.
- **What the paywall gates.** After the trial ends without an active subscription,
  *existing jobs stay viewable and editable*, but **creating a new job, running the
  AI build, and exporting/sending the PDF** return `402 SUBSCRIPTION_REQUIRED`. The
  front end catches that and shows a subscribe screen.
- **Entitlement** = billing-not-configured, OR an `active`/`trialing` Stripe
  subscription, OR still inside the local trial window. Enforced server-side via
  `requireEntitled` on the gated routes — not just in the UI.
- **Checkout & management.** `POST /api/billing/checkout` opens Stripe Checkout;
  `POST /api/billing/portal` opens Stripe's customer portal (update card, cancel).
- **Webhooks.** `POST /api/billing/webhook` verifies the Stripe signature with
  `node:crypto` (HMAC-SHA256, 5-min replay window) and syncs subscription status.

**To wire it up in Stripe:** create a recurring Price → put its id in `STRIPE_PRICE_ID`;
add a webhook endpoint pointing at `…/api/billing/webhook` subscribed to
`checkout.session.completed` and `customer.subscription.*`, and put its signing
secret in `STRIPE_WEBHOOK_SECRET`. The monthly amount lives in Stripe, not the code.

## How the hard rules are enforced

1. **AI key server-side only** — `src/assist.js` holds the key; the browser calls `/api/assist/build`. The prototype's browser-side `aiExtract()` is gone.
2. **`margin`/`notes` never client-facing** — both the in-app client view and the PDF go through `src/proposal.js` `buildProposal()`, which whitelists fields. The PDF is rendered server-side from that output. (Verified: the rendered PDF contains the total and scope but not the margin or private notes.)
3. **Offline capture + sync** — every capture/edit writes to `localStorage` first (instant, works with no network) and syncs when online; last-write-wins by `updated_at`. Photos captured offline queue locally and upload on reconnect.
4. **Works if AI is down** — `/assist/build` failure (or missing key) surfaces a clear message and the job is still created for manual entry.
5. **Per-user isolation** — every job/photo/PDF query is scoped to the owner; cross-user access returns 404.
6. **Private files** — photos live outside the web root and are served only via HMAC-signed, expiring URLs (tampered/missing signatures → 403).
7. **AI prices are placeholders** — the Build tab states it; the contractor sets real numbers.
8. **Consent/terms text is placeholder** — flagged in-app; needs legal review before launch.

## Phase 1 acceptance criteria → where it's met

- Sign up / sign in on a second device, see the same jobs → auth + `GET /api/jobs` sync (verified).
- Capture offline (voice/text), syncs when back online → offline-first store in `public/index.html`.
- AI build translates + structures; falls back to manual → `/assist/build` + `buildFromConversation()`.
- Edit lines (fixed/hourly), who-furnishes, private margin, upgrades → Build tab.
- Client view + PDF show only client-facing data with business header + estimate/validity footer → `buildProposal()` + `src/pdf.js`.
- Photos attach and survive refresh/device switch → `photo` table + signed URLs + `refreshJob()`.
- No user can access another user's data → ownership checks on every endpoint (verified).

## Not in this build (later phases, per spec)

Contractor logo on the proposal, "sent" snapshot/versioning, client-language
proposal, saved reusable rates, e-signature, standby-cost clause, product links,
and any marketplace features.

## Layout

```
bidtranslator/
  server.js            Express app + routes
  src/
    db.js              SQLite schema
    auth.js            signup/signin/sessions (scrypt)
    jobs.js            job CRUD + ownership
    assist.js          server-side AI proxy (rate limit, validation, caps)
    proposal.js        buildProposal() — the client-facing whitelist
    pdf.js             server-rendered proposal PDF
    files.js           signed expiring photo URLs
    billing.js         Stripe subscriptions + trial/entitlement gating
  public/index.html    the app (offline-first front end)
  scripts/build-demo.mjs  regenerates the offline demo from public/index.html
  docs/                build spec, founder brief, rules, prototype, clickable demo, sample PDF
```
