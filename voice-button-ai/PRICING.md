# Voice Button AI 2.0 — Value, Price & Profitability

This is the business case for the **Fable Execution Engine**: the 2.0 leap from
"a remote control that hands you a prompt" to "speak it, and the finished work
streams back." The engine runs on **Claude Fable 5** — Anthropic's most capable
model — server-side, key-safe.

> The intent here is to be **profitable quickly**, with margin designed into
> every run rather than bolted on later. The numbers below are starting points,
> wired into `server/pricing.mjs` so they're real, not slideware.

---

## Why Fable changes the product (not just the model)

| 1.0 (today) | 2.0 with Fable |
|---|---|
| Generates a **prompt** to paste elsewhere | Produces the **finished deliverable** — offer letter, listing, bid draft, client explanation |
| Local-only, no AI cost | Server-side Fable run, metered |
| Static prompts | Long-horizon, multi-step execution (Fable's strength) |
| Can't read your documents | 1M-token context — drop in a full disclosure packet or scope and get a real answer |
| Learns the best *prompt* (the bandit) | Learns the best prompt **measured against the actual result** — the feedback loop closes |

Fable's long-horizon agentic ability + 1M context is what makes a *vertical*
workflow ("turn this voice note into a complete, margin-separated contractor
bid") produce a usable artifact in one shot. A generic chat box can't do that in
under five seconds, and a prompt library never executes at all.

---

## Unit economics (the part that has to work)

Fable wholesale: **$10 / 1M input tokens, $50 / 1M output tokens.** A typical
workflow run is a ~600-token prompt and a ~900-token deliverable:

```
cost = (600 × $10 + 900 × $50) / 1,000,000
     = ($0.006 + $0.045)
     ≈ $0.051 per run on Fable
```

The built-in **refusal fallback to Opus 4.8** ($5 / $25) costs about half that
on the rare decline, so it never blows the budget.

The engine prices each run in **credits** (1 credit = $0.01 retail) at a
`MARGIN` multiplier (default **1.6×**), so:

```
retail = ceil($0.051 × 1.6 × 100) = 9 credits  ≈ $0.09 per run
gross margin per run ≈ 43%   (and that's before prompt caching, which Fable supports)
```

Every run is profitable by construction. Tune `MARGIN` and the credit value in
one file to move the whole model.

---

## Packaging — free wedge, paid execution

| Tier | Price | What they get | Why it converts |
|---|---|---|---|
| **Free** | $0 | Unlimited local prompt generation, voice, buttons, on-device learning | Zero marginal cost to us; the habit-forming wedge. They feel the speed, then want the result. |
| **Pro** | **$29 / mo** | ~300 Fable runs included, sync, history, priority | A realtor or contractor doing ~10 runs/day = ~300/mo. COGS ≈ 300 × $0.05 = **$15**, so ~$14 contribution before infra — healthy at one user, better at scale. |
| **Team** | **$99 / mo** (3 seats) | Shared workflows, ~1,200 runs, brand voice | Vertical teams (a brokerage, a remodeling crew) standardize on shared workflow packs. |
| **Credits** | **$10 / 1,000** | Overage / pay-as-you-go | Self-liquidating: 1,000 credits cost us ≈ $6 of Fable at typical mix. |

**Why $29, not $9:** the buyer isn't paying for tokens, they're paying for the
hour a day this saves. Anchor on the outcome (a sent proposal, a written
counteroffer-in-plain-English), not the compute.

---

## The moat, in business terms

1. **Vertical workflow packs** (real estate, contractor/BidVoice) — expert
   structure a generic assistant doesn't have, and the wedge into industries
   that *pay*.
2. **On-device learning** — the app gets better at *your* phrasing and *your*
   best-performing prompts, privately. Switching cost grows with every 👍.
3. **The Bidtranslator data loop** — the contractor workflows here feed the same
   audience and the same server endpoint; one backend, two products, shared
   billing.
4. **Provider-agnostic surface** — even though execution runs on Fable, the
   user-facing value (voice → result, in seconds) isn't tied to any one chat UI.

That combination — vertical packs **+** private per-user learning **+** a
metered Fable engine designed for margin — is what nobody else is shipping
together.

---

## Fastest path to revenue

1. **Turn on the engine** for the two verticals already built (real estate +
   contractor). Those buyers have budget and a daily, repeated pain.
2. **Charge for the result, give away the prompt.** Free tier drives the habit;
   the first time they tap *Run with Fable* and a finished bid streams in, that's
   the upgrade moment.
3. **Instrument credits per run** (already wired) so cost and margin are visible
   from run #1 — no guessing whether a plan is underwater.
4. **Let learning compound.** Every thumbs-up trains the bandit on real outputs,
   so the product's quality — and stickiness — climbs with usage at no extra
   model cost.

---

### Where the numbers live in code

- `server/pricing.mjs` — `MODEL_PRICING`, `MARGIN`, `creditsForCost`, `meter()`
- `server/fable.mjs` — the Fable call (model, effort, fallback) + offline degrade
- The UI shows the per-run credit cost on every completed run, so the unit
  economics are never hidden from the operator.
