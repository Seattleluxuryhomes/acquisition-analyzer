# BidVoice — Master Product Specification
### The single, living source of truth. Every AI and developer reads this first.

> **Status:** v0.1 skeleton (planning pass — no product code changed).
> **How to use:** this is canonical. When a decision conflicts with a deep doc, *this* wins and the
> deep doc gets updated. Deep docs (Constitution, trust-architecture, brand-standard, etc.) are
> **reference appendices** for full detail — the canonical rules are stated here.
> **Do not reconstruct specs from memory.** Sections marked 🔴 AWAITING PASTE are empty until the
> founder provides the Fable source; they must not be filled from inference.

## Changelog
| Version | Date | Change | By |
|---|---|---|---|
| v0.1 | 2026-07-02 | Skeleton created; approved in-repo specs consolidated; Fable sections stubbed | Claude |
| v0.2 | 2026-07-02 | Eden Voice V1 (greeting amendment + speech-budget dispatcher) shipped; Law XV amended (contextual greetings allowed under strict conditions). See `docs/specs/eden-experience-guide.md`. | Claude |
| v0.3 | 2026-07-02 | Launch Readiness Sprint shipped: email verification, change email, deactivate/delete account, public-email-after-verify, Stripe-fee + setup-fee transparency, Publish-Website "coming soon", desktop mobile-prompt hide. See `docs/launch-readiness-sprint.md`. | Claude |

## Table of contents
1. Vision · 2. Brand · 3. Eden (identity + Constitution) · 4. Voice · 5. Intake · 6. UX ·
7. Acceptance criteria · 8. Future roadmap · 9. Non-negotiables (preserve) · Appendix: reference docs

---

## 1. Vision — ✅ approved (from `product-principles.md`, `the-2035-employee.md`)
- BidVoice is the **AI Construction Operating System**; **Eden** is the AI employee. Estimating is
  one of her jobs, not the category.
- Governing tests: **"Would a contractor tell another contractor about this?"** · **"Does every
  release remove work?"**
- Principles: **Trust above everything** (never fabricate; "I don't know" is valid) · remove work ·
  proactive · simplicity is a feature · daily use · long-term OS · challenge each other.
- Defining line: *"Don't build the smartest AI in construction. Build the AI professionals trust
  with their reputation."*

## 2. Brand — ✅ approved (from `brand-standard.md`, `brand-steward.md`, `brand/BRAND.md`)
- Platform **BidVoice** (one word) · assistant **Eden** · tagline *"Your AI employee for
  contractors."* · positioning *"BidVoice is the AI Construction Operating System."*
- Palette amber `#EE9B2E` / `#CF7F18`, ink `#1F252C`, paper `#F1EEE7`. Type: Archivo · IBM Plex
  Sans · IBM Plex Mono.
- **Protected (propose before changing):** B logo, names, positioning, tagline, palette, type.
- CI guard: `npm run brand-verify`. CBO test on every change: *"did BidVoice become more valuable?"*

## 3. Eden — identity + Constitution — ✅ approved (from `bid-brain-interaction-constitution.md`)
- Named AI employee; feminine default voice; identity is config-driven (Name Trial System).
- The 5 behavioral laws + state machine (READY/LISTENING/THINKING/RESPONDING) + honest visible work
  + the 10-law Personality Contract (Part XIV).
- **Law XV — No scripted greetings (amended 2026-07-02):** awareness, not scripts; silence is
  valid; never predictable. **Amendment (founder-approved):** Eden *may* use a contextual greeting
  ("Morning, Ben.") but **only** on the first arrival of the day or after a meaningful (4h+) absence,
  at most once per day, never on a quick reopen, never as scripted filler. The principle stands —
  awareness beats routine; nothing meaningful to say → she says nothing.
- Bearing on intake/voice: one thought → one question (never dump a list); every sentence moves the
  *work* forward; never ask what she already knows; calm/competent; reduced-motion respected.
- *Full text: Appendix → `docs/bid-brain-interaction-constitution.md` (canonical rules mirrored here).*

## 4. Voice — 🔴 AWAITING PASTE (`eden-voice-spec.md`)
*The Fable Voice V1 spec has not been provided. Do not fill from memory.*
**Current implementation (for the comparison, not the spec):** `VOICE_PROFILES`, `bbPickVoice`
(scores device voices; prefers clean en-US female), `bbSpeak`, calm rate ~1.10–1.17, bilingual
EN⇄ES, Settings voice picker, barge-in, VAD auto-stop. Known limit: browser TTS ≠ true accent /
fine timing (cloud TTS would be needed if the spec requires it).
> **Paste `eden-voice-spec.md` content here, verbatim.**

## 5. Intake — 🔴 AWAITING PASTE (`eden-intake-final-spec.md` + `eden-intake-v5.jsx`)
*The Fable Intake spec + reference component have not been provided. Do not fill from memory.*
**Current implementation (for the comparison, not the spec):** client `runIntake`/`scheduleIntake`
→ `POST /api/assist/intake` → `{intake:{fields, next_question, ready}}` in `CAP_INTAKE`; draft in
`CAP_DRAFT`; AI-extracted card + single `next_question` + `capNotSure`. Server: `assistIntake` in
`src/assist.js`.
> **Paste `eden-intake-final-spec.md` here, verbatim. `eden-intake-v5.jsx` stays a code file at
> `docs/specs/eden-intake-v5.jsx` — this section summarizes + links to it.**

## 6. UX — 🔴 AWAITING PASTE (`eden-experience-guide.md`)
*The Fable experience guide has not been provided. Do not fill from memory.*
**Current baseline:** neural orb + Law XV awareness; voice-first capture; offline persistence;
premium login; branded emails/legal pages; accessibility baseline (reduced-motion, some ARIA, large
tap targets, high contrast).
> **Paste `eden-experience-guide.md` content here, verbatim.**

## 7. Acceptance criteria — 🟡 draft (finalize once §4–6 + blueprint are in)
Trust: no AI number reaches a client without explicit human approval; AI-suggested vs verified always
shown; margin/notes never leak. · Offline: capture (voice/text/photo) survives airplane mode and
processes once on reconnect (no dup/loss). · Intake: one-question-at-a-time to `ready` per spec. ·
Voice: meets spec persona/latency; bilingual; barge-in; reduced-motion. · A11y: keyboard + screen
reader through capture; spoken prompts have text equivalents; contrast meets agreed bar. ·
Preservation: all §9 non-negotiables pass; `brand-verify` clean; app parses/boots.

## 8. Future roadmap — 🔴 AWAITING PASTE (`bidvoice-v1-blueprint.md`)
*The Fable v1 blueprint has not been provided. Do not fill from memory.*
> **Paste `bidvoice-v1-blueprint.md` content here, verbatim.** (Per scope: excludes AI receptionist,
> website builder, CRM/calendar/payments except where they consequence an approved bid.)

## 9. Non-negotiables — ✅ MUST preserve (from `CLAUDE.md` Hard Rules + working flows)
1. AI key never reaches the browser (all AI via `/api/*`). 2. `margin`/`notes` private (never in
client view/PDF). 3. Capture works offline, syncs later. 4. App builds bids by hand if AI is down.
5. Per-user isolation; ownership on every endpoint. 6. Photos/PDFs private (signed, expiring URLs).
7. **AI prices are placeholders; the contractor sets real numbers.** 8. Consent/terms placeholder →
legal review. 9. Working flow preserved: capture → **bid draft** → proposal → e-sign → deposit; orb
+ Law XV; bilingual proposals; trade-intelligence packs.

---

## Appendix — reference docs (deep detail; master is canonical)
Eden Constitution `docs/bid-brain-interaction-constitution.md` · Trust architecture (≈ ApprovalGate)
`docs/trust-architecture.md` · Brand `docs/brand-standard.md`, `brand/BRAND.md` · Vision
`docs/product-principles.md`, `docs/the-2035-employee.md` · Trade packs `docs/trade-intelligence-packs.md`
· Timeline `docs/timeline-schema.md` · Current sprint plan `docs/current-sprint-eden-intake-v1.md` ·
Intake reference component (Fable) `docs/specs/eden-intake-v5.jsx` (pending).

## Specs still needed from founder (blocking §4, §5, §6, §8)
`eden-intake-final-spec.md` · `eden-voice-spec.md` · `bidvoice-v1-blueprint.md` ·
`eden-experience-guide.md` · `eden-intake-v5.jsx`. Paste each verbatim; I slot it into its section.
