# Bid Brain — Milestone 1 Scope (for approval)

> **Product:** Bidtranslator (unchanged). **Feature name:** 🧠 Bid Brain — the
> contractor's AI inside Bidtranslator that knows their business and gets smarter
> every job. Also the marketing keyword ("comment Bid Brain").
> **Success metric (unchanged):** a contractor completes and sends a real estimate.
> Bid Brain is the on-ramp to that, not a parallel app.
> **Status:** scope only. No code until approved.

## Principles (the guardrails we agreed)
- Voice-first: the mic is the hero CTA on every state; typing is secondary.
- Real cards only — no card that doesn't reach a working feature today.
- Evolve the existing floating button (`recfab`), don't build a parallel screen.
- Reuse existing views/endpoints; no duplicate functionality.
- Per-contractor memory, isolated by `user_id` — never mixed between companies.

## 1. Greeting logic
Computed at open, top of the screen, in the contractor's language (EN/ES):
- **Time-of-day + name:** "Good {morning|afternoon|evening}, {first name or company}."
  (local time, client-side; falls back to "Welcome back.")
- **Live business pulse (real data, no fakery):**
  - **Active estimates** = jobs with bid lines, not yet sent.
  - **Follow-ups due today** = follow-up jobs/inbox items dated today.
  - **Awaiting signature** = proposals sent but not signed.
  - Each line only renders if its count > 0; if all zero → "Let's build your first
    estimate." (new-user state).
- **Primary prompt:** "What are we building today?" (not "How can I help you?").
- Source: one new read endpoint `GET /api/brain` returns `{greeting:{counts}, memory}`
  — aggregates existing tables; no client guesswork.

## 2. Card layout
Mic hero on top (big, centered, "Tap and talk"), then a 2-col grid of **real** cards:
| Card | Icon | Goes to (exists today) |
|---|---|---|
| Start Voice Estimate | 🎤 | capture/record flow (`micTap`/`viewCapture`) |
| Analyze Job Photos | 📸 | AI material scanner |
| Continue Last Estimate | 📋 | most-recent open job |
| Find Customer | 👥 | prospects/CRM search |
| Today's Follow-ups | 📅 | follow-ups filter (`showFollowups`) |
| Ask Bid Brain | 🧠 | conversational estimator / AI build |

**Deferred (NOT shown — no dead cards):** Scan Jobsite Video, Order Materials,
Renderings, Launch Marketing, Manage Crews. They appear only when real.

## 3. Navigation flow
1. Tap the floating 🧠 (evolved `recfab`) → Bid Brain screen.
2. Greeting + pulse render from `/api/brain`.
3. Mic (primary) → starts a voice estimate immediately (existing record path).
4. Any card → routes into its existing view (no new duplicate screens).
5. A small "or type" affordance under the mic for the typing minority.
6. Back returns to where they were. Bid Brain is a launcher overlay, not a tab swap.

## 4. AI memory architecture (Milestone 1 foundation)
Two layers — start small, real, and isolated:
- **Derived memory (no new storage):** computed from existing tables on read —
  top trades, typical markup (avg of accepted-bid margins), recent customers,
  preferred language. Immediate value, zero risk.
- **Captured memory (new, minimal):** table `memory(user_id, key, value, updated_at,
  UNIQUE(user_id,key))`, value = JSON. M1 writes a small starter set:
  `preferred_language`, `last_trade`, `recent_services` (rolling list),
  `typical_markup`. Every write scoped to `user_id` — never mixed.
- **Used in M1 to:** personalize the greeting, and **pre-select trade + language
  on a new estimate** from `last_trade`/`preferred_language` (a visible "it knows me"
  win that also speeds the core loop).
- **Explicitly deferred (captured later as data accrues):** proposal-style learning,
  supplier memory, labor-rate learning, voice-pattern/terminology. The table holds
  them with no schema change when we get there.

## 5. Existing feature mappings (reuse, don't rebuild)
- Voice estimate ← `micTap`/`startRecord`/`viewCapture` (already built).
- Photos ← AI material scanner (built).
- Continue ← jobs list / last open job (built).
- Customers ← prospects module (built).
- Follow-ups ← `showFollowups`/follow-up detection (built).
- Ask ← conversational estimator / `assistIntake` (built).
- Greeting counts ← jobs, signatures, inbox/follow-ups (existing tables).

## 6. Database changes
- **One new table:** `memory` (above), via `CREATE TABLE IF NOT EXISTS` — additive,
  safe on prod. Indexed on `user_id`.
- No changes to existing tables. No migrations that can break boot.

## 7. Future extensibility
- The Bid Brain screen becomes the control panel: new capabilities plug in as
  **cards** (only when real) and as **memory keys** (no schema churn).
- `/api/brain` is the single aggregation point — future signals (profitability,
  schedule, supplier POs) extend its payload without new screens.
- Memory graduates from derived → captured → predictive (pricing suggestions,
  lead-close likelihood) as data accrues — the foundation laid here supports all of it.

## 8. Build plan (after approval)
Small, on the `claude/bid-ai` branch, preview link before any deploy:
1. `memory` table + `/api/brain` read endpoint (greeting + memory).
2. Evolve `recfab` → opens Bid Brain; build the screen (greeting, mic hero, 6 cards).
3. Wire cards to existing views; pre-fill trade/language from memory on new estimate.
4. EN/ES throughout. Verify end-to-end (a real estimate still gets sent).
5. Preview → your approval → deploy.
