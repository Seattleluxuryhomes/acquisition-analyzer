# Eden Intake & Voice V1 — Retrofit Build Plan
### How the Fable V1 specs are implemented inside the existing BidVoice app

> **Founder decision (2026-07-02): RETROFIT.** Build the Fable **behavior, state machine, moment map, and
> exact copy** into the existing single-file vanilla-JS app (`public/index.html`), keeping the **protected
> paper palette** and the existing SVG orb. The Fable React/TS stack, dark `#08080A` surface, and `.jsx`
> prototypes are **reference for behavior/copy — not a mandate on stack or color.** Sources:
> `sprint-package-eden-intake-voice.md`, `eden-intake-final-spec.md`, `eden-voice-spec.md`,
> `bidvoice-v1-blueprint.md`, `bidvoice-cpo-audit.md`, `exec-review-response.md`.

## 0. Translation table — Fable spec → this repo
| Fable artifact | Retrofit target in the existing app |
|---|---|
| `components/eden/EdenOrb.tsx` (canvas, `ORB_PARAMS`) | **Keep the existing SVG orb** (`BB_SVG_INNER`); add the 7 intake states + speaking modulation as CSS/JS on it. Do **not** port the canvas renderer. |
| `components/eden/Beat.tsx` | A small staged-reveal helper for Eden's lines (opacity + 8px rise, 500ms; 600ms timers; utterance `onstart` when voice on). |
| `features/intake/IntakeScreen.tsx` + `intakeMachine.ts` | Rebuild the **capture screen** around a real reducer: `ready → listening → thinking → followup → [setup] → building → review`. Replaces today's stateless `runIntake` loop. |
| `features/intake/capture/offlineQueue.ts` | New client module: `MediaRecorder → IndexedDB → retry queue`. |
| `voice/engine.ts` + `pickVoice.ts` + `momentMap.ts` + `dispatcher.ts` | **Mostly shipped** as `bbSpeak`/`bbPickVoice`/`edenMaySpeakSync`. Refactor to a single declarative moment-map dispatcher + `speak()` interface; align to canonical strings. |
| `settings/WorkingWithEden.tsx` | Extend the existing "Working with Eden — Voice" settings group; **move persistence from localStorage to the user profile.** |
| Design tokens / dark `#08080A` | **Not adopted.** Keep the paper brand. |
| `login-handoff.jsx` theatrical handoff | Deferred sub-slice; the existing premium login stands for launch. |

## 1. Server state to add (awareness — do first, per sprint §11 risk)
On the `user`/settings model + `/api/me`: `has_completed_intake`, `last_activity_at`, `last_spoken_at`,
`session_spoken_count` (session-scoped, client-ok), `last_seen_update_ids`. Context resolution must be
**server-driven**, not client-guessed, so greetings never feel scripted.

## 2. Build order (adapted from sprint §10; each slice ships + verifies independently)
1. **Awareness server fields + `/api/me`** — the foundation; text-only.
2. **Intake state machine + capture-screen retrofit** (text-only), with the four contexts
   (`first/returning/midjob/quiet`), the exact copy strings, hairline layout in the *paper* brand, and the
   "Nothing goes anywhere until you approve it" trust line **twice per account**.
3. **Offline capture queue** (`MediaRecorder → IndexedDB → retry`) — the P0 trust item.
4. **Conversational first-run setup** — the one setup question inside the first build; persists to the
   price book; never re-asked.
5. **Voice moment-map dispatcher** — consolidate shipped Voice V1 into one dispatch site keyed to the
   canonical moment map + exact strings; **persist settings to profile**; verify voice-off parity first.
6. **Estimate review — edit-and-learn + streaming** — tap-to-expand reasoning; inline edit recalcs live
   and teaches ("Got it — $95/hr for tile from now on"); line items stream (no spinner).
7. **Numeric-ambiguity routing** (exec-review): low-confidence figure → the follow-up question; transcript
   reachable from review, tap-to-correct → re-price.
8. **Analytics + full §8 acceptance pass.**

## 3. The §14.4 corrections to my already-shipped code (fold in early — they're now canonical)
- **Delete = 30-day grace + export**, not immediate hard-delete (`bidvoice-v1-blueprint.md` §5): schedule
  deletion, offer jobs/estimates/contacts as CSV/PDF, then purge.
- **Zero `window.confirm/alert/prompt`** — replace the danger-zone `confirm()`/`prompt()` with an in-app
  `Modal`/`Confirm` (title states the consequence, verb-labeled buttons, Esc closes).
- **Voice settings → user profile** (cross-device), not device `localStorage` (voice spec §3, AC-18).
- **Dual email identities** — client-facing mail under the contractor's brand + reply-to, quiet "Sent via
  BidVoice"; system mail stays BidVoice.

## 4. Non-negotiables to confirm in every slice (sprint §14 mandate)
- **Mic gating:** capture starts on the "I'm listening." utterance `onend` (or immediately if voice off) —
  Eden never transcribes herself.
- **Offline kill-test:** record → kill app → restore signal → estimate arrives (AC 8).
- **<100ms interruption:** any tap/talk cancels audio, remaining text completes, action proceeds (AC 11).
- **Once-per-account flags:** "I'm Eden." once ever; "I'm listening." first job only; trust line exactly
  twice (AC 2, 4).
- **Speech budget:** ≤3 non-intake spoken moments/session, never twice without a user action, foreground
  only, **one grep-verifiable dispatch site** (AC 14–16).
- **No outbound without ApprovalGate** (constitutional invariant) + a build-failing CI grep of send sites.
- **Preserve** every shipped flow (capture→bid→proposal→e-sign→deposit, websites, payments, QuickBooks,
  referrals) and the paper brand; `brand-verify` clean; app parses/boots each slice.

## 5. Ship gate
Ship nothing failing sprint §8. Voice ships 🟡 behind the toggle; instrument `voice_disabled`; if >20% of
voice-on users disable it in beta, default voice off until a server voice lands. North-star metric:
**signup → first reviewed estimate ≤3 min P50** (`time_to_first_estimate_ms`).

## 6. Explicitly NOT in this retrofit
The dark surface / token file / React rewrite; the canvas orb port; client-facing Eden; location triggers;
open-ended NL instructions; server-side custom voice; photo ingestion / pattern learning / live material
pricing (all V2). Do not partially implement deferrals.
