# Bidtranslator — Co-Founder Working Doc (internal)

**This is OUR source of truth.** Founder (Ben) + Claude. Living document — update it
as decisions are made and features ship. It exists so no context is lost between
sessions or after a context reset. (The outward-facing version is
`HANDOFF-for-ChatGPT.md`; this one is blunter, more operational, and includes the
ops/keys/founder-to-do that an advisor doesn't need.)

**Last updated:** 2026-06-28 · **Live:** https://bidtranslator.com · **Dev branch:** `claude/finish-building-tkauur`

---

## 0. Where we are in one paragraph

The app is **live and working** end-to-end: voice capture → AI bilingual priced bid
→ client signs + pays a deposit on their phone → QBO sync + signed PDF. Stack is
deliberately tiny (Express + `node:sqlite` + pdfkit, 2 deps, no build step), every
integration optional/env-gated. We are **pre-traction**: the next job is real
contractors, starting with a concierge-onboarded window contractor. Recently we've
been **designing the growth engine** (crew/subs network, referral, pricing,
onboarding, sales follow-up) — most of that is **agreed but NOT yet built**. Two
things shipped in the latest sessions: the **Spanish landing page** and the
**16 per-trade estimator brains**.

---

## 1. BUILT / DESIGNED / REJECTED ledger

> The single most important discipline: keep this honest.

### BUILT (in code, shipping)
- Voice capture (Whisper server path + Web Speech fallback) + live intake.
- AI bid build (Anthropic) — translate + structure + price, with price book.
- **Per-trade estimator brains** (`src/trades.js`, 16 trades) — *built, NOT yet tested against live AI.*
- Private estimating + `buildProposal()` margin/notes whitelist.
- Price book / SKUs (paste/CSV/photo, AI-organized, per-SKU photo).
- "See it in their kitchen" (gpt-image-1).
- Client proposal: in-app view + public `/p/:id` + PDF + Terms & Protections.
- E-signature + acceptance (+ signer email).
- Get-paid deposits (Stripe Connect, platform holds no funds) — $1 verified.
- Subscription billing (Stripe: trial → paywall; setup-fee support exists).
- QuickBooks Online sync (OAuth, sandbox; PDF attach).
- Accounts/auth (scrypt + opaque sessions) + password reset.
- Email (Resend) — code built, needs key in prod.
- Leads funnel + inbound webhook token.
- Schedule/calendar (lightweight) + Maps links.
- Founder analytics dashboard (`BT_ADMIN_EMAIL`).
- Follow Up Boss founder-CRM push.
- Notify webhook fan-out.
- PWA (installable).
- Marketing: `landing.html` (live) + `landing-es.html` (built + deployed).
- WhatsApp share + per-contractor number + landing CTA.
- **24 per-trade estimator brains** (`src/trades.js`) + capture trade picker — *deployed, but live AI output still un-smoke-tested.*
- **Team/Subs + scope-of-work dispatch** (the network engine, task #11) — add crew, invite, "Build your team" nudge, dispatch a job's scope to a sub (public bilingual page, work-only, accept loop). *Deployed; verified end-to-end incl. privacy.*

### DESIGNED (agreed, NOT built) — build-ready specs in §3
- Concierge onboarding ("Onboard a contractor" → account + sample bid + secure link).
- Founder sales pipeline + 5-part behavior-triggered follow-up (copy written, §4).
- Pricing model: $0 setup + $49/mo + referral credit → $0 + founder rate-lock.
- Referral program ("Invite — get a month free," reward on referee *paying*) — task #10, lives under More menu.
- Photo/plan ingestion into the AI build (so trade brains can see images).

### CONSIDERED & REJECTED (don't re-litigate without new info)
- **"Free for life" for founders** → rejected. Permanent liability, no upside once they stop referring, and it caps revenue from your most engaged users. Replaced by **earnable credit to $0** (self-funding, churn-correcting) + **rate-lock** (price protection, costs nothing).
- **$299 / $500 setup fee as default** → rejected. Friction kills the viral sub→GC conversion at the exact impulse moment. *Optional concierge onboarding upsell* is allowed; a wall is not.
- **Mixing contractor-sales into Ben's real-estate Follow Up Boss** → rejected. Separate login/account; better yet, run the sales pipeline *in-app* for behavior triggers.
- **A frontend framework / build step** → rejected. UX is validated; no-build simplicity is load-bearing.
- **Platform custody/escrow of funds** → rejected. Stripe Connect direct-charge avoids money-transmitter complexity.
- **SEO push now** → deferred. First users > rankings at this stage.
- **Renaming to "Bid Voice"** → rejected. Keep **Bidtranslator** (ownable/findable, says the bilingual benefit, $0 switching cost vs. rebuilding domain/assets/PWA). "Voice" lives in the *tagline*, not as a second brand.

---

## 2. Decisions log (with the "why")

1. **node:sqlite over Postgres** — zero-ops, single-file, no native build; REST surface is swappable later. Durability via Litestream→R2.
2. **2 npm deps, no build step** — supply-chain + deploy simplicity; integrations hand-written via `fetch`.
3. **Every integration optional/env-gated** — core loop never depends on a key; graceful degradation (hard rules #1/#4).
4. **Server-only AI** — protects the key, enables manual fallback.
5. **`buildProposal()` whitelist** — one client-data boundary; margin/notes can't leak.
6. **Stripe Connect, platform holds no funds** — regulatory simplicity.
7. **Freemium: manual bids free; AI/payments/QBO gated** — "it's a free app"; trial→paywall on premium.
8. **Pricing — DECIDED & BUILT: $0 setup, $50/mo base, −$10 per paying sub → free at 5, founder rate-lock.** (Base moved $49→$50 so the ladder is clean: $50/40/30/20/10/Free, exactly $10/step, exactly 5 to free.) `src/referrals.js` + paywall ladder + Stripe amount-off coupon. Config: `BT_BASE_PRICE=50`, `BT_REFERRAL_CREDIT=10`; the **Stripe Price must = $50** for the coupon to land right. Stripe coupon apply/sync needs live verification; the app-layer model is fully tested.
9. **Voice-first UI everywhere** — the mic is the hero on login + New Job.
10. **Keep the 16-var Hyperlift instance**; delete the duplicate 5-var one. Lesson: the difference was *config*, not code.
11. **Hold deploys while Ben works live** — pushing `main` = ~brief 503; stage on dev branch, deploy on explicit "deploy."
12. **The "Founder dashboard" is Ben's private analytics only** — never a shareable/contractor feature.
13. **Unit of growth = the crew, not the contractor** — the whole network thesis. GC → 5 subs → each sub becomes a GC. Win the graph cheap, monetize the transaction layer ("Facebook of building").

---

## 3. Build-ready specs for the DESIGNED features

### 3.1 Concierge onboarding — "Onboard a contractor" (founder-only)
- Reuse the password-reset token + Resend primitive. Flow: Ben enters email + company + trade → create user (no password) → set their trade → **optionally seed a sample window bid** (window brain + a sample SKU list) so their first login shows a real bid for *their* trade → generate reset/invite token → email a branded **"set your password & get started"** link **from Ben** (personal, not robotic).
- **Fallback when `RESEND_API_KEY` is off:** show Ben the invite link to copy/send by hand.
- Login method decided: **secure set-password link**, not an emailed password (safer *and* one-tap simpler for a non-tech contractor).

### 3.2 Team/Subs + scope dispatch (the network engine) — task #11 — BUILT (v1)
- New **Team/Subs** section, placed **above Price book** in the More menu.
- Add a sub: name, phone, **trade**, **language** (language drives the scope page chrome; full scope-text translation is a future AI enhancement).
- Adding the contact **auto-fires an invite link** (reuse WhatsApp/SMS share plumbing).
- **A sub has TWO free on-ramps (REVISED MODEL — Ben, 6/28):**
  1. **Just receive scope** — opens the dispatch link, sees the work + photos in their language, taps ACCEPT (a change-order-protection record). **No account needed** — the unguessable link is the grant. Free forever.
  2. **Sign up** — and they're a *normal contractor*: the **full trial** (AI bidding, payments — the whole package), then they fall to the **free manual version** (build by hand, no AI) when the trial ends, with AI/payments behind a subscription. Same as any signup.
- **No crippled "sub tier."** The old "subs can't bid" framing is REJECTED — letting the sub taste the full product on trial is what converts them. (This is already the live behavior: new signups get a trial; manual bidding is free; AI is gated by `requireEntitled`.)
- Sub subscribes → counts toward the GC's "5 paying subs → free" credit AND becomes a GC who adds their own subs (self-replicating loop).
- **Privacy:** the sub sees the WORK only — never margin/notes/prices (`buildScope()` whitelist, sibling of `buildProposal()` — hard rule #2). Verified end-to-end.
- **Future enhancements (not blocking):** per-sub AI translation of the scope TEXT (chrome is translated today); a logged-in sub dashboard of received jobs; tie the dispatch "joined" status to a real sub signup.

### 3.3 Referral program — task #10
- **One line under the More menu:** "Invite a contractor — get a month free." Tap → existing share sheet with personal link (`/?r=CODE`).
- New signup via link → first month free instantly (extend `trial_ends_at` +30d).
- Referrer earns the reward **only when their referee becomes a paying subscriber** (abuse-proof). Reward = a month credited (Stripe coupon/credit) or, in the credit model, a permanent −$10/mo while that sub stays paid.
- The subs **don't need to know** about the GC's reward — keep it invisible to them.

### 3.4 Pricing/credit implementation
- Enforce **$0 setup, $49/mo**. Build a **referral/sub credit ledger**: each *paying* sub a GC brings = −$10/mo on the GC's bill, floor $0 (five paying subs → free). Self-corrects when a sub churns. Add **founder rate-lock** (early adopters keep launch price forever — a flag on the user).
- Code today: `billing.js` supports a flat monthly + optional setup fee; the credit/rate-lock logic is NOT built.

### 3.5 Photo/plan ingestion into AI build
- Wire job photos (and uploaded plans/window schedules) into `/api/assist/build` so the trade brains can actually classify windows / read schedules. The brains are already written to use them.

---

## 4. The 5-part sales follow-up (copy — ready to use)

Keep **separate** from Ben's real-estate Follow Up Boss (separate login, e.g.
`acquisitions@benmortongroup`). Best home = the in-app founder pipeline so nudges
fire on **behavior** (logged in? built a bid? sent it?), which a CRM can't do. Send
**from Ben personally.**

1. **Welcome / "I built it for you"** (Day 0, on invite): *"I set you up on Bidtranslator and built you a sample window bid — took me 30 seconds by voice. Tap to see it: [link]. — Ben"*
2. **Nudge** (Day 2, not logged in): *"Did you get a chance to open the account I made you? That window bid's ready. One tap: [link]. Happy to hop on the phone for 5 min."*
3. **Proof** (Day 4, logged in, no bid built): *"Here's why I think you'll like it: talk the job, it writes the priced bid in your client's language, they sign and pay the deposit on their phone. Want me to build your first real one with you?"*
4. **Make-it-free** (Day 7): *"No risk — free to start, no card. And it pays for itself: bring your crew on and every sub knocks your bill down. Five subs and it's free. Want me to load your price list so it's bidding in your real numbers?"*
5. **Breakup / rate-lock last call** (Day 11–14): *"I'll stop bugging you — but I'm locking in founding contractors at [$X/mo for life], and that closes once the first seats are gone. Want in? If not, no hard feelings — account stays open whenever you're ready."*

---

## 5. Ops runbook & founder to-do

### Founder's personal to-do (env/ops — Ben's actions)
- [ ] Set **`RESEND_API_KEY`** + `BT_MAIL_FROM` in prod → unlocks reset + signed-PDF email.
- [ ] Set **`QBO_ENVIRONMENT=production`** (currently sandbox).
- [ ] **Delete the duplicate 5-var Hyperlift instance** (keep the 16-var one). [task #4]
- [ ] Live verification on a real phone: share links, persistence, voice. [task #8]
- [ ] Get it in front of the first real contractor (window contractor via concierge onboarding).

### Deploy convention
- Hyperlift auto-deploys from **`main`** → each deploy = ~brief 503. **Stage on the dev branch; merge to `main` only on Ben's explicit "deploy."** Pushing the dev branch is safe (no deploy).
- Commits: author `Claude <noreply@anthropic.com>`; include co-author + session trailers. Never put the model ID in any artifact.

### Key env vars (all optional/gated)
`ANTHROPIC_API_KEY` (+`BT_AI_MODEL`,`BT_AI_MONTHLY_CAP`,`BT_AI_RATE_MAX`) · `OPENAI_API_KEY`
(Whisper + gpt-image-1) · `STRIPE_SECRET_KEY`/`STRIPE_PRICE_ID`/`STRIPE_WEBHOOK_SECRET`
(+`STRIPE_SETUP_PRICE_ID`,`BT_TRIAL_DAYS`) · `BT_PUBLIC_URL` (share/return links — must be
`https://bidtranslator.com`) · `QBO_CLIENT_ID/SECRET/ENVIRONMENT` · `RESEND_API_KEY`/`BT_MAIL_FROM`
· `FOLLOWUPBOSS_API_KEY` · `BT_NOTIFY_WEBHOOK` · `BT_ADMIN_EMAIL` · `BT_SIGNING_SECRET` (long
random — signed URLs break on restart without it) · `LITESTREAM_*` (R2) · `BT_DATA_DIR=/app/data`.

### Gotchas / lessons
- **Voice "No audio to transcribe"** was a MIME regex rejecting `audio/webm;codecs=opus` — fixed in `transcribeAudio`.
- **Data loss risk:** a new Hyperlift instance without the `/app/data` volume = reset on redeploy (this bit us once).
- **AI 429s** under heavy testing → tune `BT_AI_RATE_MAX` / `BT_AI_MONTHLY_CAP`.
- **Share links broke** when `BT_PUBLIC_URL` was missing (used internal host).

---

## 6. Open questions for the founder (decisions pending)

1. **Trade picker scope** — keep all 24 trades, or trim to a focused set for the pitch? (Currently all 24 ship.)
2. **Pricing final** — confirm $49 (vs. $39 more aggressive), and the credit amount (−$10/sub → 5 = free), and whether founders also skip setup vs. just rate-lock.
3. **Sales pipeline home** — build the in-app founder pipeline (recommended, behavior-triggered) or run it in a separate Follow Up Boss login?
4. **Onboarding email voice** — confirmed "from Ben personally."
5. ~~Sub tier~~ — **RESOLVED (6/28):** a sub who signs up is a *normal contractor* — full trial (AI/payments), then free manual version (no AI) after, AI/payments behind subscription. PLUS receive-scope-via-link is free with no account. No crippled "sub tier." Already the live behavior.
6. **Sequencing** — the network engine (subs/scope dispatch) is now SHIPPED. Remaining sequencing call: when to build referral credit + pricing changes vs. keep perfecting the core loop. Go-signal still TBD (a happy contractor pulling in crew).

---

## 7. Task list (mirror of the live tracker)

- [x] SSL for bidtranslator.com
- [x] Data persistence (`/app/data` volume)
- [x] Deliver signed PDF to client after signing
- [ ] **Delete duplicate Hyperlift instance** (#4)
- [x] Email service (reset + signed-PDF email)
- [x] Voice-first login/landing
- [x] Terms & Protections on bids
- [ ] **Verify whole app live** (#8)
- [x] PWA installable
- [ ] **Referral program** (#10) — DESIGNED
- [ ] **Team/Subs + scope dispatch** (#11) — DESIGNED
- [ ] *(implied)* Concierge onboarding · Founder sales pipeline + follow-up · Pricing/credit impl · Photo/plan → build · Smoke-test trade brains live · Deploy dev branch to main

---

## 8. Next session — start here
1. Smoke-test the **trade brains** on the live server (needs `ANTHROPIC_API_KEY`) — run a window + a roofing bid, eyeball the draft.
2. If good, **deploy** the dev branch (Spanish landing + trades + WhatsApp batch) on Ben's go.
3. Build **concierge onboarding** (highest leverage for the window-contractor pitch).
4. Then the **founder sales pipeline + follow-up**, then **subs/referral/pricing** per the go signal.
