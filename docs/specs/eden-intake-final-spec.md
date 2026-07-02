# BidVoice — Job Intake, Final Spec (v4)
### The emotional core of the product · Implementation-ready

*Transcribed to the repo from the founder's canonical PDF (`eden-intake-final-spec`). Reference build:
`eden-intake-v4.jsx` (NOT in repo). This supersedes v3 for this screen. Everything else in
`bidvoice-v1-blueprint.md` stands.*

## What changed and why
- **Words cut ~35%.** Every explanation is gone ("Take your time," "Talk the way you'd brief your
  estimator," "Organizing the details," "This takes me about a minute" — deleted). The status pill
  carries state; Eden's lines carry only trust, clarity, or momentum. Thinking is now one word: "Got it."
- **Eden is aware, not scripted.** Four contexts drive the ready state:
  - **First visit:** "Morning, Ben." / "I'm Eden." / "Tell me about the job." / "I'll take it from
    here." + one quiet trust line.
  - **Returning:** "Morning, Ben." / "What are we working on?"
  - **Mid-job:** "We're still on Henderson." / "Want to finish the estimate?" + two chips.
  - **Quiet** (reopened within the same working session): the orb, nothing else. *The best employee
    doesn't talk because the room opened.*
- She introduces herself **exactly once per account, ever.**
- **The first job is the onboarding.** After the scope follow-up, first-visit flow asks one setup
  question in the same conversational form — "One more — what do you get per hour for tile?" — chips
  plus "Type it," closed with "I'll remember it." Persisted to the price book, never asked again. **No
  setup precedes value.**
- **The killer moment is paced for it.** Talk ~40s → "Got it." at 1.4s → one smart question → build
  steps at 700ms → "$18,450." Total Eden-side latency budget for the demo path: **under 6 seconds of
  visible work.** Trust line appears twice ever — first greeting and first review — then retires.

## Components to build
1. **EdenOrb** — port the canvas renderer from `eden-intake-v4.jsx` verbatim. Props: `state` (7 states),
   `level` (0–1 mic amplitude), `onTap`, `buildProgress` (0–1). The `ORB_PARAMS` table in the file is
   canonical — states distinguished by internal current speed, energy, pulse rhythm, filament
   brightness, eased at 5%/frame so transitions read as one mind changing activity. Tap sets a flare
   (decay ×0.92/frame): the acknowledgment nod. DPR capped at 2. `prefers-reduced-motion`: render one
   static frame at t=4, disable ripples.
2. **Beat** — staged line reveal. Opacity 0→1 + translateY 8px→0, 500ms, lines land 600ms apart
   starting at 250ms. Used for all Eden speech.
3. **Intake screen** — single column, max-width 400, order: header (B mark + "Eden · {state}" pill) →
   orb → Eden's lines → contextual block (chips / checklist / review) → notes → "Type instead." No
   bordered cards; hairline dividers (`#1C1C22`) only.

## States & transitions
`ready → listening → thinking → followup → [setup, first job only] → building → review`
- `ready→listening`: orb tap. `listening→thinking`: orb tap, or 20s silence auto-advance (8s: no copy
  change — the orb keeps listening; do not nag).
- `thinking→followup`: parse complete, target ≤1.5s perceived; if no gaps, straight to building (or
  setup on first job).
- `followup`: max 1 question on the happy path, hard cap 3; chips + "Answer out loud."
- `setup`: fires only for pricing inputs the estimate genuinely requires and the price book lacks; one
  per job max; answer persists; never repeats.
- `building`: checklist ticks at 700ms intervals; real progress events replace timers in production —
  checklist items map to actual pipeline stages.
- `review`: total, job label, line count, Review estimate primary, Make changes secondary.
- **Context resolution for `ready`:** `first` = no completed intake on account; `midjob` = an estimate
  in draft; `quiet` = screen reopened <4h after last activity with nothing new to say; else `returning`.

## Copy (exact strings — do not paraphrase)
- **First visit:** `Morning|Afternoon|Evening, {firstName}.` / `I'm Eden.` / `Tell me about the job.` /
  `I'll take it from here.` / `Nothing goes anywhere until you approve it.`
- **Returning:** `{daypart}, {firstName}.` / `What are we working on?`
- **Mid-job:** `We're still on {jobName}.` / `Want to finish the estimate?` — chips `Finish estimate` /
  `New job`.
- **Quiet:** no strings.
- **Listening:** `I'm listening.` (+ first job only: `Tap when you're done.`)
- **Thinking:** `Got it.`
- **Follow-up:** the question, plain, referencing the contractor's own words. **Setup:** `One more —` /
  question / `I'll remember it.`
- **Building:** `On it.` + `Scope organized` / `Materials priced` / `Labor calculated` / `Estimate ready`.
- **Review:** `{Client} · {Job}` / `{$total}` / `{n} line items` / first job only: `Nothing goes
  anywhere until you approve it.`
- **Labels:** `Project notes` (live), `Here's what I heard` (organized), `● Live`, `Type instead`.

## Motion rules
One curve everywhere: `cubic-bezier(.2,.7,.2,1)`. Content transitions 450ms fade-up (8px). Speech beats
600ms apart. Orb param easing 5%/frame. Build ring 600ms per advance. Listening orb scale = 1 +
level×0.06 at 130ms ease-out. Nothing else animates.

## Acceptance criteria
- Fresh account → spoken job → reviewed estimate with zero forms and ≤2 questions (1 scope + 1 setup).
- "I'm Eden." renders exactly once per account lifetime.
- Quiet context renders no Eden copy; screen remains fully functional.
- Trust line appears exactly twice per account, then never.
- Orb: six behaviors distinguishable blind; 60fps mid-range mobile; static under reduced motion.
- No word "Recording," "Transcript," "Processing," or mic glyph anywhere (mic glyph permitted solely
  inside the permission-denied fix message).
- Perceived latency: thinking ≤1.5s to first response; line items stream, never a spinner.
- Airplane-mode capture survives app kill and syncs on reconnect.

## Do not change
The orb renderer's material and motion grammar. The B mark and pill header. The state machine order.
The exact strings above. The two-mentions-of-Eden ceiling. The hairline-only chrome.

## Preserve from prior specs
Offline-first capture (blueprint §Phase 1.5), ApprovalGate on anything outbound, voice-register rule
(Eden first person; BidVoice third person), analytics events, accessibility (aria-live state
announcements, 44px targets, static reduced-motion frame).

## Defer (not this screen, not V1)
Eden speaking aloud *(NOTE: superseded — `eden-voice-spec.md` moves voice into V1)*; multi-question
conversational threads; client-visible Eden; location triggers; open-ended instruction parsing.
Deliberate deferrals — do not partially implement.
