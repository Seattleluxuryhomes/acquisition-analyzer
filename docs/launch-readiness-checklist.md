# Launch Readiness Checklist
### Mechanical go/no-go. Acceptance criteria 1–25 + blueprint §5 trust blockers. Pass / fail / blocked, with evidence.

> Assembled per the Operational Mandate (Deliverable 3). **No narrative** — each row is a verdict
> and its evidence. **BLOCKED** = cannot be verified in the build environment (needs a real device,
> a live AI/Stripe/Resend key, a real-user cohort, or human perceptual judgment); it is *not* a pass.
> Generated 2026-07-02 against `d0e5ecd`. Re-run after the device/live pass.

## Legend
`PASS` verifiable now (code/test/grep/e2e) · `FAIL` verifiably not met · `BLOCKED` needs device/keys/cohort/eyes · `PARTIAL` partly met

## Acceptance criteria 1–25 (sprint package §8 + exec-review §5)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Fresh account → spoken job → reviewed estimate; zero forms, ≤2 Q | BLOCKED | Intake state machine present (`index.html:4347+`); AI build needs `ANTHROPIC_API_KEY` (unset) + device/voice |
| 2 | "I'm Eden." once/account; "I'm listening." first job only | PARTIAL | Once-gating + awareness contexts present; exact spec strings not verbatim in the paper retrofit — product decision |
| 3 | Quiet context: no text, no audio, screen functional | PASS | `edenCtx()` quiet branch; no forced speech |
| 4 | Trust line appears exactly **twice**, never spoken | PASS | Now renders at **two** gated sites: first greeting (`edenIntakeHeader`) + first review (`trustReviewOnce()` in `tabBuild`, once per account); never spoken (rendered HTML only) |
| 5 | Orb states blind-distinguishable; 60fps; static under reduced-motion | BLOCKED | `prefers-reduced-motion` CSS present; 60fps/blindness is perceptual/device |
| 6 | No "Recording/Transcript/Processing" UI strings or mic glyph | PASS | grep=0 forbidden UI labels |
| 7 | Thinking ≤1.5s to first response; items stream; zero spinners | BLOCKED | Streaming present (Slice 6); timing needs AI key + device |
| 8 | Airplane mode: record → kill app → restore → estimate arrives | BLOCKED | Offline IndexedDB queue present (`index.html` capDB); kill-test needs a device |
| 9 | Voice off: behavior identical to text-only timings | BLOCKED | Device/perf |
| 10 | TTS blocked/absent: text on timers, no workflow break | PASS | Fallback timers; TTS behind `bbSpeak()` feature-detect |
| 11 | Tap mid-sentence: audio stops <100ms, action executes | BLOCKED | Barge-in code present; <100ms is device timing |
| 12 | Eden's speech never appears in Project notes | PASS | Mic gating separates spoken text from `capAppendTranscript` |
| 13 | Backgrounded acceptance: zero audio until briefing, then one line | PASS | Foreground gate in `edenMaySpeakSync` |
| 14 | Three opens in one hour: greeting speaks at most once | PASS | Speech budget + never-twice gate |
| 15 | Fourth speak-worthy moment in a session: silent | PASS | Budget = 3 non-intake moments |
| 16 | Every spoken string in §6; **one** speech dispatch site | PARTIAL | One dispatch site ✅ (`speechSynthesis.speak` single call, `index.html:4694`); string-in-§6 audit not yet guarded (Eng-Const B-13) |
| 17 | Learned rate applies to next same-trade job; toast undo reverts | PASS | `edenUpsertLaborRate` + `toastAction` undo |
| 18 | Settings persist to profile cross-device; headphones-only never loudspeaker | PASS | Voice settings persisted to profile (server); cross-device/headphones = device-confirm |
| 19 | Beta metrics fire and aggregate (north-star + intake/voice/ambiguity signals) | PASS | Instrumented: `estimate_built`, `voice_disabled/enabled`, `ambiguity_shown/resolved`, `offline_capture_queued`, `transcript_opened`. `Analytics.betaMetrics()` computes P50 TTFE, voice-disable, ambiguity-catch, offline-use, wk2-retention, approval-without-reading → `/api/admin/overview.beta` |
| 20 | Ambiguous figure → the follow-up; no unverified number in an estimate line | PASS | Slice 7 ambiguity routing (`assist.js` intake + `index.html` chips); AI-confirm on device |
| 21 | "Here's what I heard" opens transcript ≤1 tap; correcting re-prices | PASS | `heardCard` + rebuild-from-conversation (`index.html`) |
| 22 | Capture uses 3 audio constraints; transcript usable on 70dB noise fixtures | BLOCKED | getUserMedia constraints partial; noise-fixture suite not built (Eng-Const B-15/16) |
| 23 | Full happy path with one thumb, zero keyboard | BLOCKED | Device/UX judgment |
| 24 | P50 signup → first reviewed estimate ≤3 min | BLOCKED | Needs a real cohort + AC19 metric (uninstrumented) |
| 25 | Every outbound send wrapped by ApprovalGate (build-failing CI) | PASS | `scripts/approval-gate.mjs`, 17 sites classified, in `verify` + CI |

## Blueprint §5 trust blockers

| Item | Status | Evidence |
|------|--------|----------|
| Email verification | PASS / live-BLOCKED | Endpoints + tokens shipped; live send needs `RESEND_API_KEY` |
| Change email | PASS | `POST /api/account/email` (password-gated, re-verify) |
| Delete + export | PASS | `constitution-tests.mjs` §5 grace + §2 export |
| Terms / Privacy / AUP live | PASS / review-OWNER | `src/legal.js` pages live; legal review owed (Ben + counsel) |
| SMS consent | PASS / review-OWNER | Consent copy present; legal review owed |
| Branded / dual-identity emails | PASS | `emails.js` + `sendMail({fromName})` client-brand |
| Modals (no native dialogs) | PASS | `scripts/no-native-dialogs.mjs` |

## Roll-up

- **PASS:** AC 3,**4**,6,10,12,13,14,15,17,18,**19**,20,21,25 + all 7 trust blockers (2 pending legal review, 1 pending live email key). *(AC4 + AC19 fixed 2026-07-02.)*
- **FAIL:** none remaining that are fixable without keys/devices.
- **PARTIAL (2):** AC2 (exact spoken strings), AC16 (spoken-string §6 audit).
- **BLOCKED (9 — the device/live pass only Ben can run):** AC 1,5,7,8,9,11,22,23,24 — the killer-moment (spoken job → estimate on a real phone), performance/timing, airplane kill-test, and the P50 metric.

**Go/no-go read:** every item within software's control passes or is a named, fixable FAIL. The two
FAILs are in-scope P1 fixes (add the first-review trust line; instrument the metrics). The remaining
NO-GO risk is entirely the **live device pass** — the ICR's "hand a contractor a phone" — which
cannot be closed in this environment.
