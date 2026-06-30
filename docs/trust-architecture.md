# BidVoice Trust Architecture — the most trustworthy AI contractor platform

> **Product principle (founder's call):** BidVoice is not an AI estimator. It is the world's
> best **AI estimating assistant.** The contractor remains the estimator, the engineer of
> record, the pilot in command. BidVoice advises, computes, remembers, and checks — the human
> decides and signs. Trust is not a feature; it is the platform's spine and its moat.

> **The thesis in one line:** BidVoice is an **instrument, not an oracle.** Like a cockpit
> display or a lab result, every output carries its *source*, its *uncertainty*, and a clear
> line of *human authority*. A contractor should never wonder "can I trust this?" — they
> should always already know what the AI knows, what it doesn't, what it assumed, what needs
> verification, and why it recommended what it did.

---

## 1. What high-consequence industries actually teach

We borrow from fields where a confident wrong answer costs lives or livelihoods.

| Industry | Principle | BidVoice translation |
|---|---|---|
| **Aviation** | Mode awareness — the autopilot always shows *what it's doing, why, and who's flying*. No silent mode changes. | The UI always shows whether a value is **AI-suggested** or **human-verified**. AI guesses never silently become "data." |
| **Aviation** | Tiered alerts (advisory / caution / warning), each distinct and grounded. Alert fatigue is itself a hazard. | Three alert tiers, each **must cite the rule + the data/missing-data**. Dedup + prioritize so warnings still mean something. |
| **Aviation** | The black box — an immutable record of everything the system knew and did. | The Customer Timeline (append-only) records every AI suggestion, assumption, and human override, with provenance + time. |
| **Aviation** | Go-around — a safe abort is always available. | A bid can always be paused/flagged "not ready"; nothing consequential auto-commits. |
| **Medicine** | Evidence grading + calibrated language ("likely / possible / cannot exclude"); "I don't know" is acceptable. | A controlled confidence vocabulary; **"unknown" and "needs your eyes" are first-class outputs**, never hidden. |
| **Medicine** | Differential diagnosis — a ranked set with confidence, not one false answer. | Where appropriate, ranges/options with confidence, not a single fabricated number. |
| **Medicine** | Informed consent — the clinician advises; the patient decides, knowing the risks. | The contractor confirms every consequential number, seeing exactly what's assumed. |
| **Engineering** | Tolerances + units on every number; factors of safety; conservative defaults. | Every quantity has a source and (where known) a ± and units; uncertainty defaults toward flagging, never optimism. |
| **Engineering** | The stamp — a licensed human takes personal responsibility; peer/design review gates. | The **Trust Gate**: the contractor reviews-and-stamps before a bid is sent. BidVoice never "signs." |
| **Engineering** | FMEA — enumerate failure modes before they happen. | Our estimating self-audit + failure-mode catalog drive the deterministic checks. |
| **Accounting** | Source documents — every number traces to a receipt; full audit trail. | **Provenance on every datum** — nothing is sourceless. |
| **Accounting** | Reasonable assurance, not absolute; qualified opinions with explicit scope + disclosures. | When BidVoice assesses ("looks healthy"), it states its **scope and limitations** like an audit opinion. |
| **Accounting** | Materiality — focus attention where the dollars matter. | Warn loudly on margin-movers (disposal, permits, labor); don't nag on trivia. |
| **Industrial safety** | Stop-work authority — anyone can halt; near-miss reporting; defense in depth. | The gate can block a send; **near-misses** (a bad bid caught before it went out) are logged and learned from. |
| **Weather forecasting** | Calibration — "70% chance" must be right ~70% of the time, measured and corrected. | Confidence scores are **measured against outcomes** and recalibrated. Uncalibrated confidence is banned. |

The throughline: these fields earn trust not by being right every time, but by being **honest about what they know, disciplined about human authority, and relentless about recording and learning.**

---

## 2. The seven Trust Principles (the culture, memorable on purpose)

1. **Every number knows where it came from.** (Provenance is mandatory, not optional.)
2. **Confidence is earned, never asserted.** (No percentage we haven't grounded or measured.)
3. **The contractor is the estimator.** (AI advises; the human decides and stamps.)
4. **Show the seams.** (AI-suggested vs human-verified is always visibly distinct.)
5. **Safe when unsure.** (Uncertainty fails toward a flag, never toward a confident guess.)
6. **The record is permanent.** (Every suggestion, assumption, and override is logged forever.)
7. **Quiet is earned.** (As real data accrues, confidence rises and caveats recede — over-warning is its own failure.)

---

## 3. The trust primitives (what must be built into the data model now)

This is the architectural commitment: trust can't be bolted on later. **Every consequential value is an object, not a scalar.**

```
TrustedValue {
  value,                       // the number / claim
  unit,                        // where applicable
  source:  measured | stated | assumed | computed | pack | company | external,
  basis,                       // human-readable: "from your last 12 roofs" / "customer said" / "IRC default"
  confidence: { band: verified|high|likely|low|unknown, score?, n? },  // score only when calibrated
  assumedBy:  ai | rule | null,
  verifiedBy: userId | null,   // who promoted it from suggestion → verified, and when
  refEventId,                  // the timeline event that recorded this (the black-box link)
}
```

**Provenance taxonomy** (the `source` field — every datum is exactly one):
- `measured` — the contractor entered/measured it. Highest trust.
- `stated` — the customer/lead said it (trust the *fact that they said it*, not its accuracy).
- `assumed` — an AI or rule default filled a gap. **Always visible, never silent.**
- `computed` — derived from other values (carries the provenance of its inputs; only as strong as its weakest input).
- `pack` — generic Trade Intelligence Pack knowledge ("industry-typical, **not your jurisdiction**").
- `company` — learned from this contractor's own completed jobs (with sample size `n`).
- `external` — a code/permit/price API or document (with the source + as-of date).

**Calibrated confidence vocabulary** (the only words we use):
`verified` (a human confirmed) · `high` · `likely` · `low` · `unknown` · `cannot determine`.
A numeric `score` appears **only** once it's been measured against outcomes (§6). Until then we
show the band + the basis — never false precision.

**The verification state machine** (mode awareness — show the seams):
`suggested → reviewed → verified` (or `→ overridden`). AI writes `suggested`; the contractor
promotes to `verified` or replaces (`overridden`). The UI renders the three states distinctly
(e.g., suggested = dashed/tinted "pending"; verified = solid). **AI output never auto-promotes.**

---

## 4. The Trust Gate (the engineering stamp, applied to every consequential artifact)

Borrowed from the engineering stamp + the aviation checklist. A draft can be as rough as you
like. But before an artifact **leaves BidVoice** (a bid sent, a CO issued, a draw requested, a
customer time confirmed), it passes the gate:

1. **Completeness check** (deterministic) — the pack's mandatory items present? (disposal,
   permits, access/protection, general conditions…). Missing items are listed by rule.
2. **Assumption ledger** — every `assumed` value surfaced in one place; the contractor
   acknowledges or replaces each. A bid that is *mostly assumptions* cannot be sent quietly.
3. **Materiality flags** — the margin-movers and the thin-margin warnings, each citing its basis.
4. **The stamp** — the contractor reviews and confirms. **BidVoice never sends an unstamped
   artifact.** The stamp + the assumption ledger are recorded to the timeline (the black box).

The gate is *progressive*: as a contractor's Company Brain fills in, more values arrive
pre-`verified`-equivalent (high confidence from their own history), so the gate gets faster —
the trust UX recedes exactly as fast as we earn it (Principle 7).

---

## 5. Tiered alerts (aviation), grounded and fatigue-resistant

| Tier | Meaning | Rule |
|---|---|---|
| **FYI** (advisory) | "Worth knowing." | Quiet; never blocks. |
| **Check this** (caution) | "You likely want to act." | Must cite rule + the event/missing data. |
| **Stop** (warning/blocker) | "Don't send/commit until resolved." | Reserved for real harm (unsigned, underpriced, missing permit). Citable + overridable-with-reason. |

Anti-fatigue (because a platform that cries wolf is *less* safe): alerts are deduped by
condition (`dedupe_key`), prioritized by materiality, and **silenceable with a recorded
reason** (which itself becomes learning). An alert with no cited cause is a bug.

---

## 6. The black box + the calibration loop (how trust compounds)

- **Black box:** the append-only Customer Timeline already records every event with provenance.
  We extend it to log AI *suggestions*, *assumptions used*, and *human overrides* — so any bid,
  schedule, or recommendation can be replayed: *what did BidVoice know, assume, and advise, and
  what did the human do?* This protects the contractor (and us) and is the substrate for learning.
- **Outcome capture:** every completed job reports bid-vs-actual (labor hours, material qty,
  missed items, final margin). The post-mortem feeds the Company Brain.
- **Calibration:** we measure whether our confidence is honest — do "likely" labor estimates
  land within their stated tolerance? — and recalibrate. **This is what earns the right to ever
  show a number-confidence.** Near-misses (bad bids caught at the gate) are logged like aviation
  near-misses: leading indicators, not just lagging losses.

This is the loop that turns the self-audit's scary "labor = 3/10" into "labor = 8/10 *for this
company*." Trust is not declared; it is accrued, per contractor, from their own outcomes.

---

## 7. Trust applied to every surface

| Surface | Trust treatment |
|---|---|
| **Estimator** | Provenance + confidence band on every line/qty/price; the Trust Gate before send; assumption ledger; company-calibrated confidence. |
| **Receptionist** | Never promises price or availability it can't verify; **reads back** captured details ("I heard 'replace 40 ft of fence' — right?"); flags low transcription confidence; logs all to the timeline; hands off commitments to the human. |
| **Project Management / Health** | Every alert cites rule + event (already designed); no fabricated concerns; "looks healthy" = absence of fired rules, stated as such. |
| **Scheduling** | Surfaces its assumptions (duration, crew, weather unknown); never confirms a customer-facing time without human confirmation. |
| **Photo Intelligence** | Qualitative + confidence only ("possible hail damage — medium; confirm"). **Never presents a measurement.** What-to-shoot guidance comes from the pack. |
| **Company Brain** | Every learned fact carries its evidence + sample size ("CertainTeed on 9 of 11 roofs"); degrades gracefully at low `n` ("2 data points — low confidence"); always revisable by the owner. |
| **Trade Intelligence Packs** | Generic knowledge labeled generic ("industry-typical, not your jurisdiction"); company overlay labeled as the owner's; external code/permit data carries source + as-of date. |
| **Websites / Marketing** | **Verified-or-omitted** — never fabricate reviews, stats, credentials, or claims (generalize the existing "show the rating only if real" rule across all customer-facing content). |
| **Customer Timeline** | The black box: provenance on every entry; visibility mask (margin/notes never customer-facing). |
| **Health Score** | Earned confidence, cited reasons, conservative defaults; a qualified-opinion scope note where it assesses. |

---

## 8. Challenges & tensions (the co-founder pushback)

1. **Trust can become friction.** If every number is caveated, the product feels timid and
   slow, and contractors learn to dismiss the warnings — the exact failure aviation calls alert
   fatigue. **Resolution:** calibrated, *progressive* trust. Show high confidence cleanly when
   earned; caveat only where warranted; let caveats recede as company data accrues. The goal is
   not maximum warnings — it's *the right warning at the right moment*, and silence the rest.
2. **Provenance has a real engineering cost.** "Every number knows where it came from" means the
   line-item model becomes `TrustedValue` objects threaded through estimating, proposals, draws,
   and the timeline. This must be designed in **now**, at the data layer — retrofitting it later
   is a rewrite. It's the price of the moat; pay it early.
3. **We must not fake calibration either.** Showing "82% confident" before we've measured our
   calibration would itself violate Principle 2. **Early stance:** show provenance + qualitative
   bands + the *basis*; introduce numeric confidence only per-area once outcomes prove it.
   Honesty about our *own* uncertainty is the first test of the architecture.
4. **The human must stay engaged, not rubber-stamp.** If the gate becomes a reflexive "OK," trust
   theater replaces trust. **Resolution:** the gate highlights *only* what's assumed/material —
   short, specific, worth reading — not a wall of legalese. Make the review genuinely useful.

---

## 9. What the world's most trustworthy AI contractor platform looks like

Not the smartest. Not the flashiest. The one a contractor bets their license and their margin
on — because:

- **It never hides its uncertainty to look smart.** Competitors smooth over AI's gaps to seem
  magical; that's exactly what blows up in front of a customer. We surface the seams, and
  professionals trust us *because* we do. (Hobbyist tools impress; professional tools disclose.)
- **Every number traces to a source, every warning to a rule, every recommendation to a reason.**
  There is never a black-box "the AI says $14,200." There is "$14,200 — 3 lines assumed
  (flagged), labor from your last 12 roofs (±8%), confirm before sending."
- **It gets more trustworthy the more you use it** — per contractor, from their own outcomes —
  so trust is a compounding moat a competitor starting from forms-and-AI cannot copy.
- **The contractor is always in command.** BidVoice is the world's best co-pilot, instrument
  panel, and office manager. It never pretends to be the pilot.

**The objective, restated:** a contractor should never ask "can I trust this?" — because the
answer is always already on the screen: what's known, what's assumed, what's unverified, and
why. Trust, made visible, becomes the reason they never go back.

---

*No code. This document is intended to become a core, standing design principle of BidVoice —
every future feature is measured against it.*
