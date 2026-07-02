# BidVoice — Sprint Implementation Package
### Eden Intake & Voice · V1
*Status: Final · Supersedes partial specs for this scope. Transcribed to the repo from the founder's
canonical PDF. Canonical references: `eden-intake-v5.jsx` (NOT in repo), `eden-intake-final-spec.md`,
`eden-voice-spec.md`, `eden-experience-guide.md` (in repo as `eden-experience-guide.md`),
`bidvoice-v1-blueprint.md`. Deltas from `exec-review-response.md` are applied at the end.*

## 1. Executive summary
Ships the emotional core of BidVoice: the Job Intake screen rebuilt as a conversation with Eden, and
Eden's voice as a core identity feature. The contractor talks; Eden acknowledges, asks at most one smart
question (plus one setup question on the first job), builds the estimate visibly, and hands it over.
Context-aware (first / returning / mid-job / quiet), speaks only at defined moments in lines <8 words,
interruptible in <100ms, degrades to text on any audio failure. The first job replaces setup forms.
**North-star metric: time from signup to first reviewed estimate.**

## 2. Deliverables
1. `EdenOrb` shared component (canvas renderer, 7 states + speaking modulation, 3 sizes).
2. Intake screen with full state machine and four awareness contexts.
3. Voice engine (`speak/stop/pickVoice`) behind a replaceable interface, with declarative moment-map
   dispatcher.
4. Conversational first-run setup (price-book questions inside the first build).
5. Offline-first voice capture (IndexedDB queue, retry).
6. Voice settings (on/off, voice picker, pace, headphones-only) **persisted to profile.**
7. Server state for awareness: `hasCompletedIntake`, `lastActivityAt`, `lastSpokenAt`,
   `sessionSpokenCount`, `lastSeenUpdateIds`.
8. Analytics events (§8 list).
9. *(delta)* Numeric-ambiguity routing in the parse step.
10. *(delta)* Tappable transcript from review with correction re-pricing.
11. *(delta)* Capture audio constraints + noise fixture suite.
12. *(delta)* ApprovalGate CI invariant rule.

## 4. UX flow
State machine (single reducer): `ready → listening → thinking → followup → [setup: first job only] →
building → review`.
- **Ready-context resolution (server state):** `first` = `!hasCompletedIntake`; `midjob` = estimate in
  draft; `quiet` = reopened <4h since `lastActivityAt` with nothing new; else `returning`.
- **Transitions:** ready→listening orb tap · listening→thinking orb tap or 20s silence auto-advance (8s:
  no copy change) · thinking→followup ≤1.5s perceived; skip to building/setup if no gaps · followup: 1
  question happy path, hard cap 3 · setup: only if price book lacks a required input; max 1/job; persists
  forever · building: checklist maps to real pipeline stages · review → estimate screen.
- **Followup selection order** *(delta)*: ambiguous figures first, then price-impacting scope gaps; cap 3
  unchanged. Review → transcript → correct → re-price → review loop added.
- **Voice flow:** every spoken line dispatches from **one moment-map dispatcher** gated by: foreground +
  user-navigated surface, speech budget (≤3 non-intake moments/session, never 2 consecutive without user
  action), condition checks per moment. Mic capture starts on Eden's utterance `onend` (or immediately if
  voice off). Any tap/talk cancels audio <100ms → remaining text completes → action proceeds.

## 5. UI components
- `EdenOrb({state, speaking, level, size, onTap, buildProgress})` — canvas layers: base sphere gradient,
  4 orbiting light currents (composite `lighter`), 3 drifting filaments, vignette, specular; CSS ambient
  glow; listening ripple rings; building SVG progress ring. `ORB_PARAMS`/`SPEAK_PARAMS` tables in v5 are
  canonical. ≤40px: drop filaments, 2 currents, half energy. Reduced motion: static frame at t=4.
- `Beat` — staged line reveal (opacity+8px rise, 500ms), driven by utterance `onstart` when voice on,
  600ms timers otherwise, 1s watchdog fallback.
- Intake screen — single column, max-w 400px; header (B mark + "Eden · {state}" pill) → orb → Eden lines
  → contextual block (chips/checklist/review) → notes (hairline dividers only, no bordered cards) → "Type
  instead."
- Chips — pill buttons, neutral surface; one accent-tinted option max per group.
- Voice settings group under "Working with Eden."
- `Modal/Confirm`, `ApprovalGate` per blueprint (dependency, not rebuilt here).

## 6. Copy (exact strings — do not paraphrase; spoken column per voice guide)
| Moment | Screen | Spoken |
|---|---|---|
| First visit | `Morning/Afternoon/Evening, {firstName}.` · `I'm Eden.` · `Tell me about the job.` · `I'll take it from here.` · `Nothing goes anywhere until you approve it.` | First 4 lines only |
| Returning | `{daypart}, {firstName}.` · `What are we working on?` | Both |
| Mid-job | `We're still on {jobName}.` · `Want to finish the estimate?` — chips: `Finish estimate` / `New job` | Both lines |
| Quiet | — | — |
| Listening | `I'm listening.` (+ first job: `Tap when you're done.`) | "I'm listening." first job only |
| Thinking | `Got it.` | Same |
| Follow-up | The question (e.g. `Is the tile floor only, or floor plus shower walls?`) — chips + `Answer out loud` | The question |
| Setup | `One more —` · `{question}` · `I'll remember it.` — chips + `Type it` | "One more — {question}" |
| Building | `On it.` · `Scope organized` / `Materials priced` / `Labor calculated` / `Estimate ready` | "On it." |
| Review | `{Client} · {Job} · {$total} · {n} line items` · first job: `Nothing goes anywhere until you approve it.` — `Review estimate` / `Make changes` | "Estimate's ready." |
| Edit learned | toast: `Got it — ${rate}/hr for {trade} from now on.` (undo) | "Got it — {rate} an hour from now on." |
| Proposal ready | `Proposal's ready when you are.` | Same |
| Sent | `Sent.` | Same |
| Update (on open) | fact line | Top update only: "They accepted." / "Payment came in." / "{day}'s {task} conflicts with the {event}." |
| Offline | `Saved. I'll get to work as soon as we're back online.` | "We lost signal — your notes are safe." |
| Labels | `Project notes` · `Here's what I heard` · `● Live` · `Type instead` | Never |

*(delta copy)*: follow-up template `Did you say {value} {unit}?` (chips: `{value}` / `{alternate}` / `Let
me re-say it`); toast `Updated — {n} lines re-priced.` Spoken: the ambiguity question only.

**Never spoken:** numbers, dates, addresses, trust line, legal, recaps, narration of user actions, errors
the screen explains, anything while user talks/types, anything from background events.

## 7. Motion & animation
One curve: `cubic-bezier(.2,.7,.2,1)`. Content fade-up 450ms/8px. Beats 600ms apart (timer mode). Orb
param easing 5%/frame; tap flare decay ×0.92/frame. Listening scale 1 + level×0.06 @130ms ease-out;
ripples 1.8s, second offset 0.9s. Build ring 600ms/step; checklist ticks 700ms apart. Speaking
modulation: pulse 0.09 @1.5Hz, energy 0.78, blended/released at 5%/frame. First spoken word <400ms after
trigger; TTS rate 1.15× default. Reduced motion: static orb frame, no ripples, fades only.

## 8. Acceptance criteria
1. Fresh account → spoken job → reviewed estimate: zero forms, ≤2 questions.
2. "I'm Eden." renders/speaks exactly once per account lifetime; "I'm listening." only during first job.
3. Quiet context: no text, no audio; screen fully functional.
4. Trust line appears exactly twice per account, never spoken.
5. Orb states distinguishable blind; 60fps mid-range mobile; static under reduced motion.
6. No "Recording/Transcript/Processing" strings or mic glyph (except permission-denied fix message).
7. Thinking ≤1.5s to first response; line items stream; zero spinners.
8. Airplane mode: record → kill app → restore → estimate arrives.
9. Voice off: behavior identical to text-only timings.
10. TTS blocked/absent: text arrives on timers; no workflow break.
11. Tap mid-sentence: audio stops <100ms, queue empty, action executes.
12. Eden's speech never appears in Project notes.
13. Backgrounded client acceptance: zero audio until briefing opened, then exactly one line.
14. Three app opens in one hour: greeting speaks at most once.
15. Fourth speak-worthy moment in a session: silent.
16. Every spoken string in codebase appears verbatim in §6; **one speech dispatch site** (grep-verifiable).
17. Learned rate applies to next same-trade job; toast undo reverts it.
18. **Settings persist to profile across devices**; headphones-only mode never routes to loudspeaker.
19. Events fire: `time_to_first_estimate_ms`, `intake_started/completed(voice|text)`,
    `followup_asked/answered`, `setup_question_answered`, `rate_learned`, `offline_capture_used`,
    `voice_interrupted`, `voice_disabled`, `mic_denied`, `type_fallback_used`, `review_opened`.
- *(delta 20–25)*: **20** ambiguous-figure test — a low-confidence quantity becomes the follow-up
  question; no estimate line ever contains an unverified low-confidence number. **21** "Here's what I
  heard" opens the full transcript in ≤1 tap; correcting a quantity updates affected line items. **22**
  capture uses `noiseSuppression`/`echoCancellation`/`autoGainControl`; transcript usable on 70dB
  construction-noise fixtures. **23** full happy path completable with one thumb, zero keyboard. **24**
  **P50 signup → first reviewed estimate ≤ 3 minutes** (`time_to_first_estimate_ms`). **25** static
  invariant check: every outbound send call site is wrapped by ApprovalGate (build-failing CI rule).

## 9. Files likely affected (map to actual repo; adjust paths, keep boundaries)
`components/eden/EdenOrb.tsx` (new), `components/eden/Beat.tsx` (new), `features/intake/IntakeScreen.tsx`,
`features/intake/intakeMachine.ts` (rewrite), `features/intake/capture/offlineQueue.ts` (new),
`voice/engine.ts`, `voice/pickVoice.ts`, `voice/momentMap.ts`, `voice/dispatcher.ts` (new),
`settings/WorkingWithEden.tsx`, `api/user` (awareness fields), `api/priceBook` (learned rates),
`api/updates` (`lastSeenUpdateIds`), string/i18n layer, analytics module, token file. *(delta files)*:
`features/intake/parse/ambiguity.ts`, `features/review/TranscriptSheet.tsx`, `capture/constraints.ts`,
`ci/approval-gate-invariant` rule, `fixtures/audio/construction-noise/*`.

## 10. Implementation order
1. Tokens + EdenOrb + Beat. 2. Intake state machine + screen, text-only, awareness contexts (server
fields first). 3. Offline capture queue. 4. Conversational setup + price-book learning. 5. Voice engine +
moment-map dispatcher + settings (voice-off parity verified first). 6. Estimate-ready/proposal-ready/
update moments wired to dispatcher. 7. Analytics + acceptance test pass. *(deltas)*: ambiguity routing
lands with step 2; transcript-from-review with step 6→7; capture constraints with step 3; CI rule
immediately.

## 12. What NOT to change
Brand: B logo, orange token, typography, navigation. Orb renderer material/motion grammar. State machine
order. §6 strings. Spoken moment map and never-spoken list. Speech budget. Interruption contract.
Once-ever lines. Two-Eden-mentions-per-screen ceiling. Hairline-only intake chrome. Voice registers (Eden
first person; BidVoice third person; never mixed in one block). *(delta)* The constitutional invariants:
**no autonomous outbound communication, ever; contractor sign-off precedes any dollar or word leaving the
system.**

## 13. Safe to defer
Server-side custom Eden voice (keep the `speak()` interface). Free-form spoken replies beyond "Answer out
loud." Client-facing voice/chat. Location triggers. Open-ended instruction parsing. Multi-question
conversational threads. Per-moment voice toggles. *(delta)* Photo ingestion, pattern-learning defaults,
live material pricing — V2, not partially implemented. **Do not partially implement any of these.**

## 14. Governing instruction (verbatim)
"Where existing repo specs (Eden Constitution, brand-standard, trust-architecture) conflict with this
package, **list the conflict and stop; do not resolve it yourself.**" Memory in spoken lines may only
shorten interactions. Build voice behind the `speak()` interface with one dispatcher. Ship nothing
failing §8.

## Should this ship?
🟡 **Ship with known limitations — acceptable for beta.** Intake, awareness contexts, offline capture,
and copy are production-grade as specified. The limitation is voice: browser TTS quality is
device-dependent; the design degrades correctly (scoring picker, silence over bad voice, full text
parity), but "Eden sounds robotic" on some Android devices is a real brand risk. Ship voice behind the
toggle, instrument `voice_disabled`, treat the server-side custom voice as the graduation criterion to
🟢. **If beta shows >20% of voice-on users disabling it, default voice to off until the custom voice
lands.**
