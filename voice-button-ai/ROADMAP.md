# Voice Button AI — Roadmap & Future-Proofing

The job here is to stay ahead: ship the moats competitors won't, and solve the
next problem *before* it bites. This doc tracks what's built, what's next, and
the failure modes we're designing around now so they never become incidents.

> Principle: **every layer degrades gracefully and is swappable.** Storage,
> model, and learning all sit behind seams so the future is a config change, not
> a rewrite.

---

## Built (the foundation + the moats)

- **Voice + button launcher, vertical workflow packs** (real estate, contractor,
  business, more) — the wedge into audiences that pay.
- **On-device learning** — adaptive intent matcher + epsilon-greedy prompt-variant
  bandit. Private, per-user, no backend required.
- **Fable Execution Engine** — server-side, key-safe streaming runs with
  refusal-fallback to Opus 4.8, offline degrade, and per-run credit metering.
- **Aggregate Learning Flywheel** — privacy-preserving cross-user learning:
  anonymous signals only (never prompts/inputs), aggregated server-side, shipped
  back as priors so a brand-new user is smart on tap #1. **This is the moat** —
  the product gets better for everyone with use, and the data advantage compounds.
- **Credits ledger + budget guard** — per-identity free daily allowance, debit
  after each run, 402 with reset time when exhausted, purchased-balance hook for
  checkout. The monetization spine and the abuse throttle in one mechanism.

---

## Anticipated problems → the design that absorbs them

| Future problem | Designed-in answer (status) |
|---|---|
| **A better/cheaper model ships** (Fable N+1, a fast tier) | Model choice is isolated in `server/fable.mjs` + `server/pricing.mjs`. Adopting a new model is a constant change. *Next: a `models` registry mapping task-tier → model so the engine auto-routes (fast vs. max).* |
| **Cost runaway** as usage scales | **Built:** server-side credits ledger debits each run, per-identity free daily cap, 402 when exhausted. *Next: wire a checkout to `grant()` for purchased balance.* |
| **Prompt injection via voice transcripts** | The engine system prompt constrains output and never trusts transcript as instructions. *Next: an input-guard pass + output policy checks before client-facing render.* |
| **Privacy / trust** as the flywheel grows | Egress is opt-in, anonymized, generic-words-only; server sanitizes (PII-shaped tokens and bad ids are dropped today). *Next: client-side hashing + k-anonymity thresholds before a token prior is published.* |
| **Multi-device / team** expectations | `storage.ts` is a single get/set seam built for a cloud adapter. *Next: Supabase adapter + auth; the flywheel state syncs like any other.* |
| **Streaming reliability** (drops, proxies) | SSE has heartbeats + `keepalive` egress; client parser is resilient. *Next: resumable runs (server keeps the partial, client reconnects).* |
| **Offline-first capture** (the original promise) | Local-first throughout; the app fully works with no server. *Next: a service worker + queued runs that fire when back online (true PWA install).* |
| **Abuse / scraping of the engine** | *Next: per-identity rate limits + signed run tokens; the credits ledger doubles as the throttle.* |
| **Observability** (where users convert/drop) | The aggregate already counts runs by workflow/variant. *Next: a funnel readout — intent→launch→run→👍 — to steer the workflow library.* |

---

## Horizons

**Now → next (highest leverage)**
1. ~~Credits ledger + budget guard~~ — **built** (free daily allowance enforced,
   402 on exhaustion, purchased-balance hook). Next: a Stripe checkout calling
   `grant()`.
2. **Model registry / task-tier routing** — future-proof for the next model and
   cut cost on routine runs (fast tier) while reserving max-effort for the hard
   ones.
3. **Cloud sync adapter (Supabase) + optional auth** — cross-device favorites,
   history, and learning; unlocks Team and replaces the soft client id with a
   real user id (the ledger's `identityOf` is the only thing that changes).

**Soon**
4. **Workflow Composer** — let power users (and Fable) *author* new workflows
   from a few examples; the flywheel then optimizes them. Turns the library from
   curated to self-growing.
5. **Agentic multi-step runs** — Fable's long-horizon strength: "voice note →
   full bid package" or "address → complete offer packet from the disclosure
   PDF" using the 1M context window and document input.
6. **Extension power-features** — floating button on any page, inject the result
   into the focused field, Gmail/CRM/Claude helpers.

**Later (the platform bet)**
7. **Shared, rated workflow marketplace** — vertical packs others publish, ranked
   by the same aggregate-reward signal that powers the bandit. Network effects on
   top of the data flywheel.
8. **Bidtranslator convergence** — one key-safe backend, two front-ends, shared
   billing and shared learning across the contractor audience.

---

## The thesis, in one line

Anyone can call a model. The defensible system is **vertical workflows + private
per-user learning + a privacy-preserving aggregate flywheel + a metered,
model-agnostic engine** — each piece swappable, each one compounding. That's the
combination nobody else is shipping together, and it gets harder to catch the
longer it runs.
