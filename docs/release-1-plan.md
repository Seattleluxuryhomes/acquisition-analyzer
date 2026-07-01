# Release 1 — Readiness Review & Plan (CTO)

*Goal: get months of un-shipped work into contractors' hands, confidently, this week. The biggest
risk is no longer missing features — it's contractors never seeing the ones we built.*

Branch `claude/finish-building-tkauur` vs `main`: **10 code files, +1454 / −283**, 13 code commits
(+ 14 docs). Code-level verification (just run): client JS parses, all server modules parse, server
boots 200, `/api/trades` 200, timeline spine dormant, new tables migrate clean. **Nothing here is
code-broken. The only real gate is on-device behavior.**

## 1. Release Readiness Report (per feature)

| Feature | State | Risk | Why |
|---|---|---|---|
| **Trade Intelligence Packs** (server source of truth, offline-safe client picker, 36 trades) | ✅ **Ready** | Low | Estimator byte-identical; 18/18 + headless tests; offline fallback verified |
| **Emoji → icon sweep** (whole UI) | ✅ **Ready** (visual spot-check) | Low | Syntax+boot+static-SVG verified; worst case is a slightly-off icon, nothing breaks |
| **Onboarding redesign + input bar** | 🟡 **Needs device check** | Low-Med | Headless-verified; the "clipping" we chased was an *environment artifact*, not a real bug — confirm on a real phone, don't re-perfect it |
| **Voice conversation loop** (recorder→conversation, orb, hands-free) | 🟡 **Needs device pass** | **Med-High** | The primary interaction, and the only thing we *cannot* verify headless (real mic/speaker/iOS gating). Logic is 27/27 in tests; behavior is unproven on hardware |
| **Timeline spine** (3 tables + `customer_id` + dormant `timeline.js`) | ✅ **Ship inert** | Low | Additive migration; **nothing imports it** — lands the foundation ahead of the feature, zero user surface |
| **Public `/api/trades`** | ✅ **Ready** | Low | Returns generic taxonomy only (no user data); needed pre-auth by onboarding |

**Verdict: the whole branch is mergeable.** It is one evolved `index.html` + clean server modules;
there is no clean way to cherry-pick "voice out," and we don't need to — voice **degrades
gracefully** (permission denied → type; iOS gating → tap-to-talk; no transcription → fallback), and
hands-free can be turned off (`bt_handsfree`). So the device pass is to confirm it's *good or at
worst gracefully degraded*, not perfect.

## 2. Merge Checklist (the real blockers, perfectionism removed)

- [ ] **On-device voice pass** (the one true blocker — §4).
- [ ] **Visual spot-check** of the swept screens + onboarding + input bar on iPhone + Android.
- [ ] **Back up the production DB** before deploy (the additive migration touches the live `job`
      table — safe, but back up anyway).
- [ ] Run the 12-item Release Checklist (`docs/release-checklist.md`).
- [ ] Merge to `main`, deploy, smoke-test the live URL (load, trade picker, start a bid).

**Not blockers (challenge perfectionism — do NOT hold the release for these):** pixel-tuning the
onboarding headline (environment artifact), deepening more trade packs, wiring the timeline,
icon micro-polish. Ship, then learn.

## 3. Release 1 Plan

- **Included:** Trade Intelligence Packs · offline-safe trade picker · full emoji→icon system ·
  onboarding redesign · finished input bar · voice conversation loop (graceful-degrade) · inert
  timeline schema.
- **Deferred:** everything designed-but-unbuilt — receptionist, SEO/website engine, Morning
  Briefing (→ Release 2), TrustedValue/provenance, R&D engine, photo/vision, timeline *wiring*.
- **Known issues:** voice unproven on hardware (mitigated by graceful degrade + toggle); big
  `index.html` animation budget on low-end Android (mitigated by off-screen pause + reduced-motion).
- **Device testing required:** yes (§4) — the gate.
- **Risk level:** **Medium**, concentrated entirely in voice-on-device; everything else is Low.
- **Success criteria:** a contractor can start and finish a bid; voice works or cleanly falls back
  to typing; no crashes; the app feels noticeably more alive than the last shipped version.

## 4. Device Testing Checklist (founder — you own this; I can't from here)

**iPhone (Safari/PWA) + Android (Chrome/PWA), installed:**
- [ ] Voice: tap mic → it listens → speak → it transcribes → Bid Brain replies (out loud if TTS on).
- [ ] Voice loop: after a question, does it become ready/listen again? Silence auto-submits at the
      right time? Barge-in (tap while speaking) works?
- [ ] **iOS specifically:** if auto-listen is gment-gated, does it cleanly degrade to "tap to talk"?
- [ ] Permission denied → does it explain + let you type? (no dead state)
- [ ] Trade picker shows all 36 trades; works **offline** (airplane mode after one load).
- [ ] Onboarding first-run + the input bar states render correctly (no clipping on a real screen).
- [ ] Swept screens look right (icons, no missing glyphs): Home, a Job, Settings, Schedule, More.
- [ ] Start → finish a bid end-to-end. Sign + pay flow still works.

## 5. Highest-risk items (ranked)

1. **Voice on real hardware** — iOS speech gating + transcription quality. *Mitigation:* graceful
   degrade to typing; `bt_handsfree` off-switch; if rough, ship with hands-free defaulted off.
2. **Production DB migration** — additive `ALTER`/`CREATE TABLE` on live data. *Mitigation:* tested
   on fresh DB; additive-only; back up first.
3. **Low-end Android performance** — animation in a 340KB single-file app. *Mitigation:* off-screen
   pause + reduced-motion already built; spot-check on a cheap device.
4. **Visual regressions from the sweep** — a wrong icon on a key screen. *Mitigation:* the §4 spot-check.

## 6. First-week customer feedback plan

- **Watch, don't ask.** Put it in front of **3–5 real contractors**; observe one bid each in person/
  screen-share. *One hour watching > a week of architecture.*
- **Instrument what's already there:** the analytics `event` table (`track()`). Watch: do they use
  **voice** or type? do they **finish a bid**? where do they **drop**? time-to-first-bid.
- **Three questions only:** Did you understand how to talk to it? Did the bid feel right? What made
  you hesitate?
- **One number to move:** % of first-session users who complete a bid.

## 7. Release 2 — Morning Briefing MVP (design, the new 5-part frame)

1. **Long-term vision:** the Home is the Chief-of-Staff briefing (Constitution Art. IV).
2. **Smallest shippable:** restructure the Home's top into the briefing grammar using **only data we
   already compute** — `memory.js` `briefing()` (paid recently, follow-ups, awaiting signature) +
   job statuses. BLUF line ("Morning, Mike — one thing needs you" / "Everything's on track") →
   1–3 "needs you" items, each a one-tap action that already exists (`showFollowups`, open job) →
   a brief honest "in motion" → done. **No timeline back-fill, no watchers, no new tables, no new
   infra.**
3. **Expected outcome:** the contractor opens, sees the one thing that matters, taps it, leaves.
4. **Success metric:** % of morning opens where the briefed action is tapped; time-to-first-action.
5. **Reason NOT to build more yet:** prove the briefing *feels* like a Chief of Staff on existing
   data before investing in the spine-powered version. If contractors don't act on it, more
   infrastructure won't help.

## 8. What should absolutely NOT be built yet

- **AI Receptionist (telephony)** — months of new infra; and the briefing can't honestly show
  "answered calls" until it exists.
- **Premium SEO/website engine** — acquisition, not the CoS core; wait.
- **TrustedValue / provenance refactor** — important, invisible to a contractor today; wait until
  estimating-accuracy is the top complaint we actually hear.
- **Timeline wiring + back-fill** — the Briefing MVP uses existing data; don't wire the spine until
  the briefing concept is validated.
- **Company Brain learning loop** — needs outcome data we don't yet collect.
- **R&D engine, photo/vision, more trade-pack breadth** — all wait for a real demand signal.

## 9. The next 90 days (shipping, not dreaming)

| Weeks | Ship | Then |
|---|---|---|
| **1–2** | Release 1: device pass → fix blockers → merge → deploy to 3–5 contractors | **Watch them use it** |
| **3–4** | Stability/polish from *real* feedback (fix what they actually hit) | Learn what matters |
| **5–7** | Release 2: Morning Briefing MVP (existing data) | Measure tap-through |
| **8–10** | The one thing the feedback demands (likely: estimating trust *or* briefing depth) | Decide by data |
| **11–13** | One earned capability — chosen by what contractors struggle with, not this doc | Repeat |

Every phase: **ship → watch → decide.** No major build without a feedback signal that asks for it.

---

*The honest verdict, acted on: we were over-designed and under-built. This plan ships the built work
this week behind one real gate (the device pass), then earns every next step from contractors using
it. The Constitution is the guide; this is the path to users.*
