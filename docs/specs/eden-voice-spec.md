# Eden's Voice — Specification (V1 Core)
### Voice is Eden's personality. The orb is her presence. They keep time together.

This supersedes the "voice deferred" line in prior specs. Voice ships in V1. Reference build: `eden-intake-v5.jsx` — working TTS, speaking orb, interruption, settings, fallback.

## 1. Character

Eden sounds like a capable project coordinator who respects the contractor's time: warm, calm, clear, confident, en-US, ~1.15× pace. Never a receptionist, phone tree, narrator, or chatbot. The test for every spoken line: would a good employee say this out loud, in this many words, right now? If not, it stays on screen or stays unsaid.

## 2. When Eden speaks — the complete list

Voice fires at exactly these moments and no others in V1:

| Moment | Spoken | Notes |
|---|---|---|
| First introduction | "Morning, Ben." / "I'm Eden." / "Tell me about the job." / "I'll take it from here." | Once per account, ever |
| Returning greeting | "Morning, Ben." / "What are we working on?" | Skipped in quiet context |
| Mid-job greeting | "We're still on Henderson." / "Want to finish the estimate?" | |
| Listening start | "I'm listening." | First job only, then retired |
| Acknowledgment | "Got it." | |
| Follow-up question | The question itself | Highest-value voice moment — the contractor may not be looking |
| Setup question (first job) | "One more — what do you get per hour for tile?" | |
| Build start | "On it." | |
| Estimate ready | "Estimate's ready." | |
| Proposal ready / important job update | One short factual line | Briefing surface, same rules |

**What is never spoken:** the trust line (read aloud it becomes a disclaimer; on screen it's a promise), dollar amounts and line-item counts (numbers are read, not heard — TTS mangles them and the screen already shows them), labels, errors that the screen explains, and anything in the quiet context. Spoken lines are a *subset* of screen text, ≤ 8 words except questions.

## 3. Behavior rules (implemented in v5)

1. Never speaks because the app opened — quiet context is silent in both channels.
2. Text always renders, voice accompanies; audio failure of any kind degrades silently to text.
3. Tap the orb while she's speaking → speech cancels instantly, remaining text completes immediately, and the tap's action proceeds. She never finishes a sentence at the user.
4. Any state transition cancels speech before the next line queues.
5. Beats: when voice is on, text lines reveal on utterance `onstart` — words appear as she says them. When off/unavailable, 600ms timers. A 1s watchdog detects an engine that never starts and hands beats back to timers.
6. Listening + speaking never overlap: mic capture begins after her utterance ends (v5's "I'm listening." precedes simulated capture; production must gate `MediaRecorder.start()` on utterance end or use AEC) so Eden never transcribes herself.
7. Voice is optional: Settings → "Eden's voice" On/Off, voice picker, pace (0.9–1.3×, default 1.15×). Persist all three to the user profile, not device storage.

## 4. Voice selection

Browser TTS quality varies wildly; selection is scored, not defaulted (see `pickVoice` in v5): prefer en-US; boost neural/natural voices (Edge "Aria/Jenny Natural"), Apple's Samantha/Ava/Allison, "Google US English"; penalize known-robotic voices (Zira, David, Fred, compact variants). If nothing scores acceptably, the correct behavior is text-only, not a bad voice — a robotic Eden costs more trust than a silent one. Long-term note for the roadmap: a single custom TTS voice (server-side, e.g. a licensed neural voice) is how Eden's voice becomes as recognizable as the orb; browser TTS is the V1 bridge, so keep the engine behind an interface (`speak(lines, opts)`) that a server voice can replace without touching call sites.

## 5. Orb ↔ voice connection

Speaking is an orb *modulation*, not an eighth screen state: `SPEAK_PARAMS` (livelier pulse at 1.5Hz, energy 0.78) blends over the current state's params at the same 5%/frame easing, and releases when the utterance ends. The status pill shows "Eden · Speaking" during audio. Result: the light moves when she talks, settles when she stops — presence and personality reading as one.

## 6. Instructions for Claude Code

**Build**
- `voice/engine.ts`: `speak(lines: string[], {voice, rate, onBeat, onDone}): boolean`, `stop()`, `pickVoice(voices)` — port from v5. All call sites must tolerate `false` (unavailable) and proceed with timers. Wrap every speechSynthesis call in try/catch; an exception must never reach the workflow.
- Extend `EdenOrb` with `speaking: boolean` prop and `SPEAK_PARAMS` blend (v5 is canonical).
- Voice script map keyed by moment (Section 2 table is the source of truth; strings verbatim).
- Settings: "Eden's voice" toggle + voice select (en filtered, cleaned display names) + pace slider; persist `{voiceOn, voiceName, rate}` to user profile; hydrate before first greeting.
- Interruption path: orb tap → `stop()` → `setBeat(final)` → proceed with tap action, in that order, synchronously.
- Mic gating: listening capture starts on the "I'm listening." utterance's `onend` (or immediately if voice off/unavailable).

**Acceptance criteria**
- Voice off: product is byte-identical in behavior to v4 timings.
- Voice on, TTS blocked by autoplay policy or missing voices: all text arrives via timers within normal timing; no console-visible workflow break.
- Tap mid-sentence: audio stops <100ms, action executes, no orphaned utterances in the queue.
- No moment outside the Section 2 table produces audio (grep call sites against the script map).
- "I'm Eden." is spoken at most once per account lifetime; "I'm listening." at most during the first job.
- Eden's own speech never appears in the transcript (record with voice on; verify Project notes contain only the contractor's words).
- Numbers and the trust line are never audible.
- Settings persist across devices via profile.

**Do not change:** the Section 2 moment list without a spec update; screen-text strings (voice reads them or a shorter subset, never a longer paraphrase); the interruption contract; the silence rules.

**Defer (still):** server-side custom voice (build behind the interface above); Eden hearing and answering free-form speech replies to her questions beyond the existing "Answer out loud" capture; client-facing voice. 
