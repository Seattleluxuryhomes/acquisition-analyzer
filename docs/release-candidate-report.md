# BidVoice — Release Candidate Report
### V1 beta readiness · 2026-07-02 · Principal Engineer audit (3 adversarial reviews + constitutional-enforcement verification)

> **Method.** Three deep code audits (security/isolation, correctness/P0-P1, reliability/perf/
> maintainability) across `server.js`, all `src/*` modules, the front-end hot paths, CI, and
> deploy config — each booted a real server and reproduced findings. Plus direct verification of
> the 7 build-failing constitutional guards. Frozen docs were **not** changed. No Soul/Bible
> contradictions were found in the code.

---

## Overall beta readiness: **75%**

Strong, verified foundation — the constitution is enforced in CI, isolation/authz/crypto/money-
whitelist are solid, and the core capture→bid→proposal→e-sign path works. But there are **4 launch-
blocker P0s** (all small, contained fixes) and a cluster of **multi-device sync P1s** that real
contractors *will* hit. After the P0 fixes + the top sync P1s + your live device/payment/email
pass, this reaches ~90%+.

---

## Launch blockers (P0 — must fix before the first contractor)

| # | Defect | Where | Impact | Fix |
|---|--------|-------|--------|-----|
| P0-1 | **Deposit collection dead-ends** — `checkout_url` field never exists (`createPaymentRequest` returns `url`) | `server.js:1596` & `:1700` vs `payments.js:106-119` | Once Stripe Connect is live, sign → "Pay deposit" reloads/`/p/undefined`; homeowner can never pay; orphan pending payment_requests. Has never worked. | Use `reqObj.url` at both sites |
| P0-2 | **Every inbound website lead 500s when email is on** — `esc()` is undefined (`escHtml` exists) | `server.js:383,388` | Top of the money funnel: homeowner form submit fails, contractor gets no email, no funnel attribution, no AI follow-up | Rename `esc(`→`escHtml(` (2 lines) |
| P0-3 | **Missing photo/doc file crashes the process** — `createReadStream().pipe(res)` with no `error` handler | `server.js:930, 1049, 1352` | A dead `/pub/photo` link (crawler, post-redeploy) → uncaught exception → **all users down**, crash-loop | Copy the `stream.on("error", …)` from `server.js:886` to the 3 routes |
| P0-4 | **No process-level exception net** — no `unhandledRejection` / `uncaughtException` handler | `server.js` (boot) | One missed `.catch()` anywhere = whole process exits | Add both handlers (~6 lines): log+continue on rejection, log+exit on uncaught (Docker restarts) |

**Already fixed this session (were P1):**
- ✅ **Stored XSS** on the public `/c/:id` + `/f/:id` pages via unescaped contractor `logo` → gated on `/^data:image\//` + `esc()`. Verified neutralized.
- ✅ **`changeEmail`** now revokes other sessions (email = identity), matching its contract.

---

## P1 — fix within the beta window (real, but not day-one blockers)

| # | Defect | Where | Impact |
|---|--------|-------|--------|
| P1-1 | **Cross-account data bleed on a shared device** — `bt_jobs` is not user-keyed and not cleared on sign-out | `index.html:1669, 2290` | User B on A's browser sees A's jobs (customers, margins, private notes); A's `_dirty` jobs POST into B's account |
| P1-2 | **Stale offline push can un-sign a signed job** — `syncNow` PATCHes `status` unconditionally; no server newer-than check | `index.html:2353`, `jobs.js:171` | Offline edit of a sent job overwrites a customer signature back to `sent`; also silently drops a 2nd device's newer edit |
| P1-3 | **Deletions don't propagate; deleted jobs resurrect** — no sync branch to drop local non-dirty jobs absent from server | `index.html:2361` | A job deleted on one device lives forever on another and can POST itself back |
| P1-4 | **Photos/documents are not backed up** — Litestream replicates only the DB | `litestream.yml`, `DEPLOY.md` | A redeploy without the persistent volume silently loses all job photos, permit PDFs, signed contracts |
| P1-5 | **Offline clip queue head-of-line wedge** — a persistent 4xx on the oldest clip `break`s the drain forever; a 402 deletes the clip | `index.html:6924` | One bad/oversized clip blocks all newer captures; a capped user loses the recording permanently |
| P1-6 | **Kill mid-recording loses the audio** (AC8) — `mediaRecorder.start()` has no timeslice | `index.html:6993` | The airplane-mode promise only holds if they tapped Stop first |
| P1-7 | **Draws / change-orders never flip to `paid`** — `markPaid` has no caller | `draws.js`, `changeOrders.js` | `/d/:id` and `/co/:id` keep offering "Pay now" after payment |
| P1-8 | **No timeouts on outbound fetch** (Stripe/AI/Resend/QBO) | `billing.js`, `payments.js`, `assist.js`, `mail.js` | A hung provider holds a request ~5 min; worst case on `/p/:id/sign` (homeowner) and dashboard load |
| P1-9 | **No rate limiting on auth + lead webhook** | `server.js:242,269,285,1118` | Online password guessing; a leaked lead token → spam + billable AI-cost DoS |
| P1-10 | **5 founder-webhook events are malformed** — object passed as the `type` arg | `server.js:1218,1228,1282,1329,1338` | scope/draw/change-order events unparseable at the sink (observability loss) |
| P1-11 | **Cross-device settings clobber** — any settings change pushes the whole object | `index.html:2328` | A voice-pace toggle can revert company/logo/terms edited on another device |

---

## Security concerns

- **Isolation/authz: clean.** Every owned-resource route scopes by `user_id`; `requireAdmin` on all `/api/admin/*`; public links use unguessable 72-bit ids + HMAC-signed expiring file URLs (timing-safe); Stripe webhook is HMAC-verified + replay-guarded + idempotent; scrypt+salt passwords, single-use expiring tokens, sessions revoked on password/reset/deactivate/delete.
- **Fixed:** the one stored-XSS hole (contractor logo).
- **Hardening to add (P2):** baseline security headers (CSP/X-Frame-Options/X-Content-Type-Options — HSTS already present); SKU-image write happens before the ownership check and embeds the raw route param in the filename (sanitize + reorder); log Stripe-webhook + mail failures (currently silent).
- **Config-critical:** `BT_SIGNING_SECRET` **must** be set in prod — the dev fallback is derived from `HOSTNAME`, is forgeable, and rotates on every restart (breaking already-sent signed links). Consider a boot hard-warning when unset.

## Performance concerns (at 10–15-user beta scale)

- Nothing blocks the beta. Event-loop blocks (sync SQLite, 8–16 MB `writeFileSync` uploads, PDF photo `readFileSync`, sync scrypt) are brief and fine at this scale — revisit before ~100 users.
- **Watch, don't optimize yet:** the `event` table is unbounded (a `page_view` per navigation); the founder dashboard scans it (`betaMetrics`, `wonValueFor`) — admin-only, years of headroom, add pruning at ~1M rows.
- Front-end `persist()` is unguarded against the ~5 MB localStorage quota; 2–3 queued offline **photos** (base64 in `JOBS`) can overflow it and throw (audio uses IndexedDB correctly). Wrap + toast (P2).

## Technical debt — defer until after beta

- Dead code: `resetEmailHtml`, `onboardEmailHtml` (superseded by `emails.js`); `aiIdentitySeg()` + `AI_IDENTITIES`/`setAiIdentity` (Name-Trial retired — guarded dead, safe to delete).
- Duplication: extract one `stripeFetch()` (billing+payments) and one `anthropicJson()` (~8 blocks in `assist.js`) — also the natural home for the P1-8 timeout + failure logging.
- Consolidate `leadEmailHtml/Text` into `emails.js` (kills the P0-2 bug class permanently).
- ~30 sync routes aren't `wrap()`-ed → default text (not JSON) error on throw (cosmetic; Express catches sync throws).
- AI monthly-cap accounting is a stale read-modify-write (undercounts under concurrency) — fine at a 2000/mo cap.

---

## Production configuration required

**Launch-required:**
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` (your chosen price), `STRIPE_WEBHOOK_SECRET`; enable webhook events incl. **`invoice.paid`** (referral month-two) + the subscription + checkout events.
- `RESEND_API_KEY` **and a verified-domain `BT_MAIL_FROM`** (the default `onboarding@resend.dev` only delivers to your own Resend account).
- `ANTHROPIC_API_KEY` (bid build), `OPENAI_API_KEY` (Whisper voice + room visualize).
- **`BT_SIGNING_SECRET`** — a long random string (security-critical; see above).
- **Persistent volume at `BT_DATA_DIR`** (`/app/data`) for the DB + `photos/` — non-optional (P1-4).
- `BT_ADMIN_EMAIL` (unlocks the founder dashboard incl. the new `mail` diagnostic + beta metrics).

**Recommended:** `BT_FORCE_HTTPS=1`, `BT_CANONICAL_HOST`, `BT_PUBLIC_URL`, `BT_BASE_PRICE` (display fallback).
**Optional (degrade gracefully if unset):** QuickBooks (`QBO_*`), FollowUpBoss (`FOLLOWUPBOSS_*`), analytics sinks (`POSTHOG_KEY`/`MIXPANEL_TOKEN`/`SEGMENT_WRITE_KEY`), prospecting, `BT_SETUP_FEE`/`STRIPE_SETUP_PRICE_ID`.

## Remaining external dependencies

| Dependency | For | Status |
|---|---|---|
| **Stripe** (platform + Connect) | subscriptions, deposits | keys + webhook events needed; **P0-1 blocks deposits until fixed** |
| **Resend** | password reset, verification, signed-agreement delivery, lead emails | key + verified domain needed; **P0-2 blocks lead emails until fixed** |
| **Anthropic** | bid build / intake | key needed for the killer moment |
| **OpenAI (Whisper)** | universal voice (esp. iPhone), room visualize | key needed for voice on iOS |
| **Telephony** | — | **not needed for V1** (Eden Front Office is a future tier) |
| **QuickBooks / FollowUpBoss** | sync / founder CRM | optional |

---

## Beta test checklist (mechanical — see also `docs/launch-readiness-checklist.md`)
- [ ] All P0-1…P0-4 fixed; `npm run verify` green; CI (Quality workflow) green.
- [ ] Prod env set per above; `/api/admin/overview.mail` shows `mail_configured:true, using_default_sender:false`.
- [ ] Persistent volume mounted; a redeploy preserves a test job's photo.
- [ ] Stripe test-mode: subscribe → first invoice; a $1 deposit checkout completes → webhook flips it `paid`.
- [ ] Forgot-password email arrives on a real device.
- [ ] Founder dashboard shows beta metrics populating (`time_to_first_estimate`, voice-disable, etc.).

## Manual tests that cannot be automated (yours — need a real device/keys)
1. **The killer moment:** fresh account → *spoken* job in a noisy environment → reviewed estimate, on a real phone, sound on, timed. (AC1/AC24 — the one existential unknown.)
2. **Voice on iPhone Safari** (Whisper path) + in-app-browser failure messaging.
3. **Airplane-mode kill test** (AC8): record → kill app → restore signal → estimate arrives.
4. **<100 ms interruption** (AC11): tap mid-speech, audio stops, action proceeds.
5. **Real deposit** on a live card (after P0-1) → money in the contractor's Stripe.
6. **PWA install** + offline launch on iPhone + Android; **60fps orb** / reduced-motion.
7. **Two-device / shared-device** behavior (exercises P1-1…P1-3, P1-11 in the wild).

## Risks only real contractor usage can validate
- Whether 40 seconds of truck-cab speech (accents, wind, gloves, half-sentences) parses into a credible number in <3 min — **the make-or-break unknown**; everything else is downstream of this.
- Whether $199 reads as "an employee" or "an expensive app" (WTP).
- Whether contractors trust the estimate enough to send without heavy editing (the approval-without-reading signal is now instrumented).
- Whether voice gets used at all in the field or disabled (>20% disable → default off).
- Whether the offline/multi-device reality surfaces sync corruption the P1 fixes didn't anticipate.

---

## Recommended launch date
- **P0 fixes: ~1 day** (all small/contained). **Top sync P1s (P1-1…P1-3): ~1–2 days.**
- Then **your live device + payment + email pass** (the manual tests above).
- **First contractor realistically ~3–5 days out** (target **~July 7–9**), gated on the killer-moment test passing on a real phone — not on more development.

## Top 5 to watch in the first 30 days
1. **`time_to_first_estimate` P50** — is the spoken-job → estimate moment actually <3 min in the field?
2. **Crash/error logs** — after P0-3/P0-4, is anything still taking the process down? (watch `/api/admin` + host logs)
3. **Payment completion** — after P0-1, do deposits actually move money end-to-end?
4. **Voice-disable rate** — trending toward the >20% "default voice off" line?
5. **Multi-device data integrity** — are jobs ever lost, duplicated, or un-signed in real use (P1-1…P1-3)?
