# Milestone — Conversation First (in-place Bid Brain overlay) — scope, for approval

> **Vision:** the contractor talks to Bid Brain as an omnipresent AI teammate.
> Conversation is the interface; the form is just a live picture of what Bid Brain
> understands. **Bid Brain never navigates to another page** — it expands *in place*
> as a floating conversational overlay over the current screen (think ChatGPT Voice /
> Siri / Dynamic Island), so the user feels they're talking to a teammate, not
> opening a feature.
> **Success metric:** a contractor completes an estimate primarily by talking, in a
> single overlay, with far fewer taps than the form — and never leaves their screen.
> **Status:** scope only. No code until approved.

## Core principle: in place, never navigate
- Tapping 🧠 Bid Brain **expands a floating panel over the current screen** (the
  screen stays visible behind a light dim). It does **not** route to a page.
- The **entire conversation + live estimate runs inside that overlay.** Today's
  panel already overlays (built in the Companion) and the brain animates in place;
  the change is to keep *everything* — talk, follow-ups, the building estimate — in
  the overlay instead of jumping to the capture screen.
- **Context-aware:** the overlay adapts to where you are — on Jobs it knows you're
  in jobs; on Schedule, the calendar; inside Estimate #2034, *that* estimate. The
  conversation starts from context (we already pass `state.view` + `state.jobId`).

## The key insight: the backbone is already built
`assistIntake` (src/assist.js) already returns, from the spoken transcript:
- a **checklist** of `{label, value, status: captured | missing | unsure}` —
  customer, address, trade, materials, labor, etc.
- the **next question** to ask, and a **`ready`** flag.
The client already renders that checklist and **speaks** the next question (TTS).

So Conversation First = **reshape this into a flowing chat with live progress and
minimal taps** — reuse, not rebuild. Your *"✓ Customer identified · ✓ Address
found · ✓ Trade detected · ✓ Materials recognized · ✓ Labor updating"* **is the
checklist statuses**, rendered as a live checkmark feed.

## The experience (all in one overlay, over the current screen)
1. On the dashboard (or any screen), tap 🧠 Bid Brain → a panel **slides up from the
   brain**; the dashboard stays visible behind it.
2. Bid Brain greets from context: *"Hi Ben. How can I help?"* (or, on an estimate,
   *"We're on Estimate #2034 — what should I change?"*). Buttons: 🎤 Speak · ⌨️ Type.
3. Contractor speaks: *"Create a fence estimate."* A **conversation thread** appears
   in the overlay (You: … / 🧠: …) and a **live progress feed** fills in:
   ✓ Customer → ✓ Address → ✓ Trade → ✓ Materials → ✓ Labor (captured items check off).
4. Missing info → Bid Brain **asks the next question** ("Who's the customer?") out
   loud and in the thread. Contractor answers naturally — **still in the overlay.**
5. The **estimate assembles live** in the overlay; at `ready`, Bid Brain offers to
   open the full editable bid (the *only* time it navigates — and only on request).
6. No "press record again," no page-hop. The mic just means *Bid Brain is listening.*

## Reusable components (reuse, don't rebuild)
| Need | Reuse |
|---|---|
| Listen + extract scope | `assistIntake` + the trade brains |
| Live progress feed | the intake **checklist** (captured/missing/unsure) |
| AI follow-up questions | intake `next_question` (already spoken via TTS) |
| Speak questions | existing `speakQuestion` / TTS |
| Build the priced estimate | `assistBuild` + price book |
| Voice capture / transcription | central mic + Whisper path |
| Surface + memory | Bid Brain panel + memory (M1) |

## Phasing (reliability first — the honest CTO call)
### Phase 1 — Conversational flow (buildable now, reliable)
- Bid Brain opens with a greeting and runs the existing estimator as a **chat**:
  you talk → live checkmark feed updates → it speaks the next question → you answer
  with **one tap** (or it auto-listens right after it finishes speaking).
- Reshapes the capture screen from "recorder + form" into "conversation + live
  understanding." The form fields remain underneath as the live representation.
- Removes the "record again" feeling by **auto-advancing** turns.

### Phase 2 — Fully hands-free (the moonshot — flagged honestly)
- After Bid Brain speaks a question, **auto-restart listening** with silence-based
  turn-taking → finish an entire estimate **without touching the screen.**
- **Hard + device-dependent:** iOS Safari can't run continuous `webkitSpeechRecognition`;
  a Whisper loop needs auto-restart + voice-activity detection + battery care.
  Ships with **graceful fallback** — if hands-free falters, Phase 1's tap-to-answer
  still works. We never ship a flaky always-on mic that frustrates.

## Live "AI is working" states
Drive the Bid Brain states from real events as the conversation runs:
listening (green) while you talk → thinking (orange) on each intake call →
working (gold) while building/pricing → speaking (purple) when it asks a question.
(This is also where M2's six states finally come alive on real events.)

## Database changes
- None required for Phase 1. Memory may later learn conversation preferences
  (verbosity, preferred questions) — new keys, no schema change.

## Architecture (in-place overlay)
- The conversation runs **inside the existing Bid Brain overlay** (`bbPanel` + scrim),
  never the capture page. The overlay holds: a **conversation thread**, the **live
  checkmark feed** (intake checklist), and the **assembling estimate**.
- Capture in place: the mic records from the overlay (Whisper path), accumulating a
  running transcript; each turn re-runs `assistIntake(transcript, trade)` to update
  the checklist + next question. No `#capText` page dependency — the overlay owns
  the transcript.
- Context in: seed the conversation from `state.view`/`state.jobId` (on a job → that
  estimate; on schedule → calendar intent). `bbContextPrompt` already exists; expand it.
- The only navigation is **on request** at the end ("open the full bid") → existing job screen.
- Bid Brain states drive off live events: listening (talk) → thinking (intake) →
  working (build) → speaking (asks a question).

## Build plan (after approval, on `claude/conversation-first`)
1. Turn the overlay panel into a **conversation surface**: context greeting, thread,
   live checkmark feed (bound to the intake checklist), Speak/Type.
2. In-overlay capture: record → transcript → `assistIntake` → update feed + speak the
   next question → answer (one tap, or auto-listen) → repeat. Never leaves the overlay.
3. Wire Bid Brain's six states to these live events.
4. Live-assemble the estimate in the overlay; at `ready`, offer "open full bid"
   (the only navigation), handing to the existing priced-estimate flow.
5. Verify a full estimate completes by conversation, in place, with minimal taps.
   Preview before merge.
6. (Phase 2 hands-free scoped separately once Phase 1 is production-ready.)

## Already shipped toward this
- The redundant floating **Record** button is removed (the central mic is enough).
- Bid Brain Companion + memory are live — the surface this conversation runs in.

## What we will NOT do
- No flaky always-on listening shipped as the only path — reliable turn-based first.
- No rebuilding the estimator AI — it already extracts the checklist + questions.
- No new form; the form becomes the live readout of the conversation.
