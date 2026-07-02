# Current Sprint — Eden Intake v1 · Consolidation & Engineering Plan

*Planning pass only — no code written. Purpose: merge the new Fable "Eden Intake / Voice"
specs into the existing BidVoice product without overloading or breaking what works.*

> **Sourcing honesty (read first).** Of the nine inputs you listed, **six are approved and
> already in this repo** and are consolidated below from their source docs. **Three are the
> new Fable specs and are NOT in the repo** — I do **not** have their text, so I have not
> invented them. For those three I document (a) the exact current code they would evolve, and
> (b) precisely what I need from you to consolidate them accurately. See **§Specs I still need**.

## Scope guardrails (what this sprint is and isn't)
**In:** voice/text job capture → structured intake → contractor approval → bid draft, offline-first,
Eden's voice + interaction behavior *for intake*, accessibility, and trust/approval gating.
**Out (per your instruction):** AI receptionist, website builder, CRM/calendar/payments roadmap
(except where a payment/deposit is a downstream consequence of an *approved* bid — noted, not built).

---

# PART A — Consolidated approved specs

## 1. BidVoice product vision — ✅ approved (in repo)
*Source: `docs/product-principles.md`, `docs/the-2035-employee.md`.*
- BidVoice is the **AI Construction Operating System**; **Eden** is the AI employee. Estimating is
  one of her jobs, not the category.
- Governing tests: **"Would a contractor tell another contractor about this?"** and **"Does every
  release remove work?"**
- Principles that bind intake: **Trust above everything** (never fabricate; "I don't know" is
  valid), **remove work** (fewer taps/decisions), **proactive**, **simplicity is a feature**,
  **daily use**, **long-term OS**.
- Defining line: *"Don't build the smartest AI in construction. Build the AI professionals trust
  with their reputation."*

## 2. Brand rules — ✅ approved (in repo)
*Source: `docs/brand-standard.md`, `docs/brand-steward.md`, `brand/BRAND.md`.*
- Platform **BidVoice** (one word), assistant **Eden**. Tagline: *"Your AI employee for
  contractors."* Positioning: *"BidVoice is the AI Construction Operating System."*
- Palette amber `#EE9B2E` / `#CF7F18`, ink `#1F252C`, paper `#F1EEE7`. Type: Archivo / IBM Plex
  Sans / IBM Plex Mono. **Protected** (propose before changing): B logo, names, positioning,
  tagline, palette, type. CI guard: `npm run brand-verify`.
- Every intake screen must pass the CBO test: *"did BidVoice become more valuable?"* and feel like
  one premium product.

## 3. Eden Constitution — ✅ approved (in repo)
*Source: `docs/bid-brain-interaction-constitution.md` (Parts I–XV).*
- The 5 behavioral laws + the state machine (READY/LISTENING/THINKING/RESPONDING) + honest visible
  work + the 10-law Personality Contract (Part XIV).
- **Law XV — No scripted greetings**: awareness, not scripts; silence is valid; never predictable.
- **Direct bearing on intake:** one thought then one question (never dump a list); every sentence
  moves the *work* forward; never ask what she already knows; honest progress phrases mapped to the
  real task; calm/competent voice; reduced-motion respected.

## 4. Job Intake v4 — 🟠 INCOMING (Fable spec, NOT in repo)
**I do not have the v4 spec text.** What exists today (the thing v4 evolves):
- **Client:** `runIntake()`/`scheduleIntake()` (debounced) → `POST /api/assist/intake` → returns
  `{intake:{fields, next_question, ready, …}}` stored in `CAP_INTAKE` (localStorage `bt_capintake`).
  Draft text in `CAP_DRAFT` (`bt_capdraft`). Renders an AI-extracted card (Client/Address/Scope/
  Materials/Timeline) + a single `next_question` + a "Not sure" escape (`capNotSure`).
- **Server:** `assistIntake()` in `src/assist.js` (one thought / one question already modeled).
- **Gap to close in v4 (needs your spec):** field schema, question ordering/branching, "ready"
  criteria, trade-pack coupling, how v4 differs from today's single-`next_question` loop.
- **What I need:** the v4 field list, the state machine, and the "done/ready" definition (see
  §Specs I still need).

## 5. Eden Voice V1 — 🟠 INCOMING (Fable spec, NOT in repo)
**I do not have the Voice V1 spec text.** What exists today:
- `VOICE_PROFILES` (rate/pitch/tone), `bbPickVoice(lang)` (scores device voices; prefers clean
  en-US female, penalizes accented), `bbSpeak(text,{full,onEnd})` via Web Speech, calm rate
  (~1.10–1.17), bilingual EN⇄ES, a Settings voice picker, barge-in, VAD auto-stop.
- **Known limit:** browser TTS can't do a true accent or fine inter-sentence timing; a real
  "premium voice" needs cloud TTS (out of current scope unless V1 requires it).
- **What I need:** does Voice V1 mandate cloud TTS, specific persona/latency targets, or new
  spoken-intake behaviors beyond what the Constitution already governs?

## 6. Offline-first capture requirements — ✅ approved (hard rules) + current impl
*Source: `CLAUDE.md` Hard Rules #3, #1; current code.*
- **Rule:** capture (voice/text/photos) **works offline and syncs later**; the app still builds
  bids by hand if AI is down; the AI key never reaches the browser (all AI via `/api/*`).
- **Today:** drafts/intake persist in `localStorage`; a service worker (`public/sw.js`, network-first
  for pages) enables offline launch; `/api/*` never cached. Photos capture locally.
- **Gap:** there is **no durable offline queue** for intake/AI calls made while offline — they fail
  and rely on the user retrying. v4 likely needs an explicit **capture-now / process-when-online**
  queue. (Flagged as a risk + a build item below.)

## 7. ApprovalGate rules — 🟠 INCOMING (Fable) — maps to ✅ Trust Gate (in repo)
**Strong news:** the concept is already specified as the **"Trust Gate"** in
`docs/trust-architecture.md` — *"the contractor reviews-and-stamps before a bid is sent; BidVoice
never signs; nothing consequential auto-commits."* Approved, aligned principles already present:
- Every value shows **AI-suggested vs human-verified**; AI guesses never silently become "data".
- **AI prices are placeholders; the contractor sets the real numbers** (Hard Rule #7).
- Append-only provenance (the Customer Timeline / `timeline-schema.md`) records suggestion →
  assumption → human override.
- **What I need from the Fable "ApprovalGate":** the concrete gate points (which actions require an
  explicit approve step), the UI contract (how "approve" looks/feels), and whether it's a single
  gate before "send" or per-field confirmation. Then I reconcile it with the Trust Gate doc.

## 8. Accessibility requirements — 🟡 partial (in Constitution) + gaps
*Source: Constitution + current code.*
- Honored today: `prefers-reduced-motion` (orb/animations pause), some `aria-label`s, large tap
  targets, offline resilience, high-contrast amber/ink.
- **Gaps to spec for intake:** screen-reader labeling of the live intake card + `next_question`
  (ARIA live region), focus management on state changes, color-contrast audit of the capture
  screen, keyboard path for the voice-first flow, captions/text-equivalent for spoken prompts
  (critical for a voice product), and a documented target (e.g., WCAG 2.1 AA).
- **What I need:** confirm the accessibility bar (AA?) and whether Fable's spec adds specifics.

## 9. What MUST be preserved from the existing product — ✅ hard constraints
Non-negotiable (from `CLAUDE.md` Hard Rules + working features):
1. AI provider key never reaches the browser (all AI via `/api/assist/*`, `/api/brain/*`).
2. `margin` + `notes` stay private (never in client view/PDF; enforced in `src/proposal.js`).
3. Capture works **offline**, syncs later.
4. The app still builds bids **by hand** if AI is down.
5. Per-user data isolation; ownership checked on every endpoint.
6. Photos/PDFs private — signed, expiring URLs only.
7. **AI prices are placeholders; the contractor sets real numbers.**
8. Consent/terms are placeholder pending legal review.
9. Working flows that intake feeds must keep working: capture → **bid draft** → proposal → e-sign →
   deposit; the neural orb + Law XV awareness; bilingual proposals; trade-intelligence packs.

---

# PART B — Engineering assessment

## Current state of the existing code
- **Single-file SPA** `public/index.html` (~350KB inline vanilla JS). Intake lives here:
  `CAP_DRAFT`/`CAP_INTAKE`, `runIntake`/`scheduleIntake`, capture screen render, `capNotSure`.
- **Server:** `server.js` (Express, `node:sqlite`) + `src/assist.js` (`assistIntake`, `assistBuild`,
  `bidBrainChat`) — the only path to AI; key server-side.
- **Voice:** `VOICE_PROFILES`, `bbPickVoice`, `bbSpeak` in `public/index.html`.
- **Offline:** `localStorage` persistence + `public/sw.js`; **no durable AI/intake queue**.
- **Trust/approval:** partially present — placeholder-price discipline, private margin/notes,
  append-only timeline (`timeline-schema.md`); **no single named "ApprovalGate" component** yet.
- **State:** all on branch `claude/finish-building-tkauur` (unmerged); prod is a stale build.

## Files likely affected
- `public/index.html` — capture/intake UI, voice, ApprovalGate UI, offline queue, a11y (biggest risk
  surface; it's one giant file).
- `src/assist.js` — `assistIntake` schema/branching for v4; any voice-server changes.
- `server.js` — intake endpoint contract; approval/commit endpoints if gate is server-enforced.
- `src/db.js` — new columns/tables only if v4 persists structured intake or approval provenance.
- `src/proposal.js` / `timeline-schema` — if ApprovalGate writes provenance to the timeline.
- `public/sw.js` — only if the offline queue needs SW support (prefer app-layer queue first).
- Docs: this file + `trust-architecture.md` (reconcile ApprovalGate) + Constitution (if voice adds laws).

## Risks
1. **Monolith risk:** `index.html` is one 350KB file — large intake changes risk regressions in the
   orb, capture, and proposal flows. Mitigate: small, isolated edits + render-verify + parse checks.
2. **Missing specs:** building v4/VoiceV1/ApprovalGate without the Fable text = guessing = rework.
   **Highest risk. Mitigate by getting the specs before coding those three.**
3. **Offline queue is genuinely new** (not just a tweak) — real complexity (idempotency, retries,
   conflict, ordering). Risk of breaking the "works offline" rule if done half-way.
4. **Trust/approval regressions** could let an AI number reach a client unverified — a
   brand-and-legal risk (violates Hard Rule #7). Must be gated + tested.
5. **Stale deploy** means none of this is testable by real users until deploy — verification stays
   internal (parse/boot/render) until the branch ships.
6. **Voice V1 → cloud TTS** (if required) adds a vendor, cost, latency, and key-management surface —
   scope-expanding; confirm before committing.

## Dependencies
- **Blocking:** the three Fable specs (Intake v4 fields/flow, Voice V1 targets, ApprovalGate points).
- Deploy pipeline (to test with real users) + a working `ANTHROPIC_API_KEY` (currently the live
  outage — intake AI can't be validated in prod until Eden's key/credits are restored).
- Trade-intelligence packs (intake couples to trade) — already in repo.

## Proposed implementation order (once specs are in)
1. **Lock the intake contract** (v4 field schema + `ready` definition) in `assistIntake` — pure
   server + a versioned response shape. Lowest risk, unblocks everything.
2. **ApprovalGate as an explicit, testable component** — reconcile with Trust Gate; one clear
   "review & approve before it leaves you" step; provenance to timeline. Trust first.
3. **Offline-first capture queue** — durable local queue for capture + deferred AI processing;
   honors "capture works offline." Isolated module.
4. **Intake UI v4** on top of the locked contract — one-thought/one-question, live card, a11y.
5. **Eden Voice V1** deltas (only what the spec adds beyond today's voice) — last, since current
   voice already works.
6. **Accessibility pass** across the capture flow (ARIA live, focus, contrast, captions).

## Acceptance criteria (draft — refine against the specs)
- **Trust:** no AI number reaches a client without an explicit human approve; every field shows
  AI-suggested vs verified; margin/notes never leak. (Automated + manual check.)
- **Offline:** airplane-mode → capture a job (voice/text/photo) → it persists → reconnect → it
  processes and lands in a draft, exactly once (no dup, no loss).
- **Intake v4:** given a spoken/typed job, Eden asks one relevant question at a time, reaches
  `ready` per the v4 definition, and produces a correct structured draft.
- **Voice V1:** meets the spec's persona/latency targets; bilingual; barge-in; reduced-motion.
- **A11y:** capture flow usable by keyboard + screen reader; spoken prompts have text equivalents;
  contrast meets the agreed bar (AA).
- **Preservation:** all Hard Rules pass; existing capture→proposal→e-sign→deposit still works;
  `brand-verify` clean; app parses/boots.

## What I recommend building NOW vs DEFERRING
**Build now (low-risk, unblocks, or pure trust value):**
- Reconcile **ApprovalGate ↔ Trust Gate** into one spec section (doc; then a small, isolated UI
  component). Trust is the moat and the least likely to churn.
- **Lock the intake response contract** (versioned) so client + server stop drifting.
- **Offline capture queue** design (it's needed regardless of v4 details).

**Defer until the Fable specs are in hand:**
- Intake **v4 field/flow** UI (needs the schema — building now = rework).
- **Voice V1** changes, *especially cloud TTS* (confirm it's actually required; current voice is
  acceptable for launch).
- Any accessibility target beyond the current baseline until the bar is confirmed.

---

# PART C — Final engineering recommendation

**Do not start coding the three Fable items yet.** The single biggest risk is building
`Intake v4`, `Voice V1`, and `ApprovalGate` from inference — that guarantees rework and risks the
trust rules. The approved specs (vision, brand, Constitution, offline rules, preservation list) are
consolidated above and ready.

**My recommendation, in order:**
1. **Send me the three Fable specs** (or point me to them): Job Intake v4, Eden Voice V1,
   ApprovalGate. I'll fold them into this doc and turn the draft acceptance criteria into exact ones.
2. **Meanwhile, I can safely do the trust-first, spec-independent work:** reconcile ApprovalGate with
   the existing Trust Gate, lock the intake response contract, and design the offline capture queue —
   none of which risk what works, and all of which the specs will need anyway.
3. **Restore Eden's live key/credits** (the current outage) so intake AI is testable end-to-end.
4. **Keep it small:** because `index.html` is a monolith, every intake change ships as an isolated,
   parse-checked, render-verified edit — no big-bang rewrite.

## Specs I still need from you (blocking the three Fable items)
- **Job Intake v4:** the field schema, question order/branching, the "ready/done" definition, and how
  it differs from today's single-`next_question` loop.
- **Eden Voice V1:** persona + latency targets; does it require **cloud TTS**; any spoken-intake
  behaviors beyond the Constitution.
- **ApprovalGate:** the exact gate points (which actions need approval), the approve-UI contract, and
  single-gate-before-send vs per-field confirmation.
- **Accessibility bar:** confirm target (WCAG 2.1 **AA**?) and any Fable-specific requirements.

Once those land, I'll update this doc, propose the exact file diffs, and only then start coding —
smallest, trust-first slice first.
