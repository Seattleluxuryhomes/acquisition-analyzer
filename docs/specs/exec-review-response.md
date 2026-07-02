# BidVoice — Response to Executive Product Review
### Triage against the established vision · Spec deltas · Updated implementation package
*Transcribed to the repo from the founder's canonical PDF. Applies deltas to
`sprint-package-eden-intake-voice.md`.*

**Overall read:** the review independently converges on the core philosophy — its verdict ("AI as
copilot, contractor as undisputed captain," nothing leaves without one-tap sign-off) is the ApprovalGate
and the trust line, already P0. Convergence is validation, not new work.

## 1. Adopt immediately (V1)
- **Numeric ambiguity → follow-up, never a guess** *(outranks all other adds)*. When ASR confidence on a
  figure is low, that figure becomes the follow-up question ("Did you say fifteen hundred square feet?"
  with chips). **An estimate must never contain an unverified ambiguous number.**
- **Transcript always reachable from review.** "Here's what I heard" expands to the full Project-notes
  transcript, tap-to-correct.
- **Noise-robust capture, the cheap way first.** `noiseSuppression: true, echoCancellation: true,
  autoGainControl: true` on `getUserMedia`; require a noise-robust server ASR; add construction-noise
  audio fixtures to the test suite. (Custom DSP only if field data proves these insufficient.)
- **One-thumb, gloves-on operability** as an explicit AC — full happy path with one thumb, no keyboard.
- **TTV tightened to 3 minutes.** North star: **signup → first reviewed estimate ≤3 minutes at P50.**
- **No-autonomous-outbound as a permanent, tested invariant** — every outbound send call site sits
  behind ApprovalGate, grep/CI-verifiable, build-failing, forever.
- **"AI employee" flat pricing framing** — anchored against a fraction of a human coordinator's salary.
  Specific tiers/numbers are a founder decision.

## 2. V2 (fast follow — protected launch scope)
- **Photo ingestion** (strongest missing feature; first in line after launch): a quiet "Add photos"
  affordance during listening (max 5), parsed alongside audio, referenced in "Here's what I heard." Must
  not add a step to the voice-only path.
- **Pattern learning (the "Eden Memo" escalation):** detecting repeated overrides and proposing a new
  default — as a screen toast in Eden's register ("Make 22% your masonry default?" · Yes / Keep asking),
  ≤8 words, consent-before-change, screen-only (obeys the speech budget). Needs history first.
- **Live local material pricing** — high value, dependency-heavy; V2+. Start partnership conversations
  now (integration lead time is the constraint).

## 3. Reject, and why
- **Split-screen transcript/table UI** — fails one-handed phone use in glare and doubles on-screen UI.
  Deliver the same verifiability sequentially (notes → parsed view → tap-back from review).
- **Removing CRM/Calendar** — architecture is locked by the founder. Adopt the spirit (no CRM/calendar
  *expansion* in V1), reject the removal.
- **The review's proactive-memory copy style** ("I noticed you prefer a 22% margin… I've updated your
  profile…" — 24 words, updates without asking) — violates the ≤8-word rule, memory-subtracts, and
  consent-before-change. The *mechanism* is adopted (V2); the *voice* is ours.
- **Custom noise-gating DSP as the V1 approach** — solution-first for a problem robust ASR + platform
  flags likely solve.

## 4. Changes to the product specification
1. Intake: low-confidence numerals route to `followup`; followup priority = (a) ambiguous figures, (b)
   price-impacting scope gaps; hard cap of 3 unchanged.
2. Review screen: "Here's what I heard" tappable → full transcript, inline-correctable; corrections
   re-run affected line items.
3. Capture: `getUserMedia` audio constraints mandated; ASR must pass the construction-noise fixture suite.
4. Blueprint north star: 5 minutes → **3 minutes (P50)**.
5. **Constitutional invariants (new blueprint section):** no autonomous outbound communication, ever;
   contractor sign-off precedes any dollar or word leaving the system.
6. Pricing page: flat "AI employee" framing, anchored against part-time estimator cost.
7. Roadmap: photo ingestion + pattern learning = V2; material-price integration = V2+.

## 5. New acceptance criteria (append to sprint package §8 as 20–25)
20. Ambiguous-figure test → the figure becomes the follow-up; no estimate line contains an unverified
    low-confidence number. 21. "Here's what I heard" opens the transcript in ≤1 tap; correcting a quantity
    updates line items. 22. Capture uses the three audio constraints; transcript usable on 70dB
    construction-noise fixtures. 23. Full happy path with one thumb, zero keyboard. 24. P50 signup → first
    reviewed estimate ≤3 min. 25. Static invariant: every outbound send call site wrapped by ApprovalGate
    (build-failing CI rule).

## 6. Delta to `sprint-package-eden-intake-voice.md`
§2 Deliverables +（9)–(12); §4 UX flow (ambiguity-first followup order + transcript-correct-reprice
loop); §6 Copy (ambiguity follow-up + re-priced toast); §8 append 20–25; §9 Files (`ambiguity.ts`,
`TranscriptSheet.tsx`, `constraints.ts`, CI rule, noise fixtures); §10 order; §11 Risks (ASR confidence
variance; over-flagging vs the 3-question cap); §12 add the constitutional invariants; §13 add photo
ingestion / pattern learning / live pricing as V2.

**Should this ship?** remains 🟡 with the same voice-quality limitation and graduation criteria; the
trust posture is strengthened, not newly at risk.
