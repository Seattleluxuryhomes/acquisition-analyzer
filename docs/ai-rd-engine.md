# BidVoice AI Research & Improvement Engine — design (internal, no code yet)

> **Principle (founder's call):** BidVoice should improve faster than any competitor because
> every AI employee is also part of R&D. The product gets smarter every week — not because we
> manually brainstorm, but because the system is designed to improve itself.

> **The honest reframe (my co-founder pushback):** the dangerous version of this is "an AI reads
> the internet and invents improvements" — which produces fluent, confident *noise*, the exact
> failure the Trust Architecture exists to prevent. The trustworthy version is grounded in
> **evidence we own** and **proposes, never applies.** It is a tireless *research analyst*, not
> an autonomous deployer. Two engines, kept distinct:
>
> - **The Evidence Engine** — improvements grounded in *our own data* (telemetry, completed
>   jobs, trust calibration, support signals). High trust. Can run on a schedule continuously.
> - **The Horizon Scanner** — external scanning (competitors, papers, new models, APIs). Lower
>   trust, human-curated, episodic, and always labeled *ungrounded suggestion*.
>
> Conflating these two is how R&D systems drown teams in plausible nonsense. We never do.

---

## 1. Apply BidVoice's own Trust Architecture to the engine itself

The R&D engine is a consumer of our own trust standard. Every recommendation is a `TrustedValue`-
style object:

```
Recommendation {
  title, category,                 // Critical | High | Medium | Nice | Future | Rejected
  evidence: [{source, datum, basis}],   // what grounds it — telemetry id, ticket, job outcome, paper
  source: evidence | horizon,      // grounded-in-our-data vs external-scan (provenance)
  confidence: verified|high|likely|low,
  gates: { reducesWork, increasesTrust, simplifies, improvesProfit },  // the four protect-checks
  proposal,                        // the blue-team fix (never just the criticism)
  cost, risk, reversibility,
  decision: pending|accepted|rejected, decidedBy, why,   // a HUMAN decides; recorded
}
```

Rules: **no recommendation without cited evidence** (a "we should…" with no basis is rejected on
sight). **Propose-only** — the engine never changes a prompt, UI, or workflow; it produces a
ranked backlog a human accepts or rejects, **with the reason recorded** (rejected-with-reason is
first-class — see §7). The decision log is itself evidence the engine learns from.

---

## 2. The Evidence Engine (grounded — the real value)

Improvements derived from data we already have or are building. This is where ~80% of real wins
live, and it's trustworthy because every insight cites a number we own.

| Signal (we have / are building) | What it surfaces |
|---|---|
| Analytics `event` table (`track()`) | Funnel drop-off, dead features, rage paths, where users stall |
| Completed-job outcomes (Company Brain loop) | Bid-vs-actual: where estimating is systematically off, by trade |
| **Trust calibration** (Trust Architecture §6) | Where our confidence is *miscalibrated* — the #1 self-improvement signal |
| Trust-Gate overrides | Which warnings get dismissed (alert fatigue) vs which catch real errors |
| Assumption-resolution rates | Which assumptions never get resolved → where to invest in better capture |
| Support requests / bug reports | Friction and breakage, ranked by frequency × severity |
| Receptionist transcripts (consented) | Where conversations fail, re-ask, or mis-capture |
| Timeline patterns | Stages where projects stall, payments lag, jobs go dark |

The Evidence Engine's quality is **bounded by our instrumentation** — so the honest prerequisite
is: capture outcomes + calibration first (already designed in Trust + Timeline). Garbage in,
confident garbage out.

## 3. The Horizon Scanner (external — useful, but fenced)

Competitors, industry trends, new AI models, papers, OSS, APIs, sales/UX/behavioral research.
Genuinely valuable — but it cannot run unsupervised, for two honest reasons: (1) it needs web
access and curation BidVoice doesn't autonomously have, and (2) external "insights" are
ungrounded by definition. So the Horizon Scanner is **episodic and human-curated**: it drafts
briefs ("a competitor shipped X; a new model does Y cheaper"), each labeled `source: horizon`,
`confidence: low` until validated against our own data or a pilot. It feeds the backlog as
*hypotheses*, never as accepted improvements.

---

## 4. Every AI employee reviews itself (metric-grounded scorecards)

Each agent periodically self-evaluates against **measured** outcomes — not vibes. The self-review
is only as honest as its metric; where we lack one, the first recommendation is "instrument this."

| AI employee | Self-review metrics |
|---|---|
| Receptionist | capture accuracy (read-back confirmed), drop-off, mis-route rate, escalations |
| Estimator | bid-vs-actual variance, gate-override rate, assumption density, missed-line rate |
| Project Manager | alerts that proved real vs dismissed, things missed that should've fired |
| Scheduling | reschedule rate, conflicts created, idle-day detection accuracy |
| Website / Marketing | conversion, bounce, lead quality, claims flagged as unverifiable |
| Company Brain | learned-fact accuracy, sample sizes, stale/contradicted facts |
| **Trust System** | **calibration error** (do "likely" estimates land in tolerance?) — the meta-metric |
| Trade Intelligence Packs | which fields are most often edited/overridden by contractors → where the pack is wrong |

That last column is gold: **contractor overrides are the highest-signal correction we have** —
when many contractors edit the same pack value, the pack is wrong, and the fix is evidence-based.

## 5. Red Team / Blue Team (structured adversarial loop)

**Red (attack), weekly.** Pretend a competitor hired us to beat BidVoice: How would they win?
Where are we weak? Which assumptions are wrong? Where is AI hallucinating? Where is trust being
lost? What's unnecessary or too complicated? What can be automated away? Each finding **must cite
evidence** (a metric, a ticket, a transcript) or it's labeled `horizon`/`speculative`.

**Blue (defend), same cycle.** Never stop at the criticism — every red finding gets a proposed
fix, costed and gated. A red-team finding with no blue-team proposal is incomplete.

(We've effectively been running this manually — the estimating self-audit was a red-team pass.
This formalizes it as a recurring, recorded process.)

## 6. The learning loops (cadence, input → output, owner)

| Loop | Input | Output | Decides |
|---|---|---|---|
| **Daily** | fresh telemetry, new tickets/bugs | small observations → backlog (auto-categorized) | engine (queues only) |
| **Weekly** | the week's signals + a red/blue pass | the **Improvement Report** (ranked, gated, with proposals) | founder |
| **Monthly** | the month's accepted/rejected decisions | **architecture review** — is the structure still right? what debt accrued? | founder + Claude |
| **Quarterly** | product assumptions | **challenge every major assumption** (pricing, sequencing, the moat thesis) | founder |
| **Annual** | everything | **"start from zero"** — if we rebuilt today knowing what we know, what changes? | founder |

Each loop's output is recorded (the black box), so we can later ask "did the things we accepted
actually move the metric?" — closing the loop on the engine's *own* accuracy. The R&D engine is
itself subject to calibration: we track whether its "High Impact" calls were, in fact, high impact.

## 7. Output discipline (protect the product)

Every recommendation is categorized — **Critical · High Impact · Medium · Nice to Have · Future ·
Rejected** — and must pass the four protect-gates, else it's rejected with a reason:

> **Does it reduce work? Increase trust? Simplify the product? Improve profitability?**
> If not — **Reject**, and record why.

Two disciplines that make this a *good* R&D engine instead of a feature-factory:
- **Rejected-with-reason is first-class output.** A great R&D system says "no" most of the time,
  on the record. The reject log is how we resist shiny objects and how we avoid re-litigating the
  same idea every quarter.
- **Bias toward deletion.** The engine is explicitly chartered to propose **removals,
  consolidations, and simplifications**, not just additions — because every "Protect simplicity /
  speed / the contractor's time" principle is *violated by accretion.* An R&D engine that only
  grows the product has failed. Target: the button bar gets shorter over the years, not longer.

## 8. How it actually runs (honest infrastructure)

- **v1 is not "an always-on autonomous agent"** — we don't have the background-compute/web
  infrastructure for that (same honesty as the receptionist telephony). v1 is a **scheduled
  analyst**: a job that reads our telemetry, runs the red/blue + self-review passes, and produces
  the Weekly Improvement Report for a human. Grounded, cheap, real.
- **Propose-only, always.** The engine writes to a backlog; it never touches a prompt, schema, or
  UI. Acceptance is a human act, recorded, reversible. (An auto-applying improver would violate
  the Trust Architecture outright.)
- **It rides the substrate we built:** the analytics `event` table, the Customer Timeline (black
  box), the Company Brain (per-contractor learning), and the Trust calibration loop. The R&D
  engine is the **product-level analog of the Company Brain**: Company Brain makes each
  *contractor* smarter from their outcomes; the R&D Engine makes *BidVoice* smarter from all of
  ours. Same philosophy, different scope — and both compound.

## 9. Challenges & what to protect (the honest tensions)

1. **Most "continuous AI research" is theater.** It generates plausible noise that *feels* like
   progress. Our guard: every rec cites owned evidence; horizon scans are fenced as hypotheses;
   the engine is measured on whether its calls actually moved metrics.
2. **The engine can become a distraction.** A firehose of recommendations is its own kind of alert
   fatigue. Guard: ruthless categorization, a small Critical/High list, and most things Rejected.
   Signal over volume.
3. **Improving fast can break trust/simplicity.** Speed is a value *until* it ships regressions or
   bloat. Guard: the four protect-gates are mandatory, deletion is first-class, and nothing
   auto-applies.
4. **It's only as good as our instrumentation.** Outcome capture + calibration are prerequisites,
   not nice-to-haves. The first recommendations the engine makes will (honestly) be "instrument X
   so we can improve it." That's correct, not a failure.

## 10. MVP — the smallest trustworthy version

A **Weekly Improvement Report**, generated from our own telemetry + a structured red/blue +
self-review pass, every recommendation evidence-cited, gated, categorized, and proposed (never
applied), reviewed by the founder — with a recorded accept/reject decision that the engine learns
from. No web-scraping, no autonomy, no always-on. It compounds from there: instrument more →
ground more → recommend better → measure whether we were right → recalibrate.

This is the engine that makes BidVoice smarter every week — honestly, from evidence, with a human
in command. The same standard we hold the product to, held to ourselves.

---

*No code. Intended as a standing internal principle: BidVoice continuously improves from owned
evidence, proposes rather than applies, biases toward simplification, and is measured on whether
its own recommendations were right.*
