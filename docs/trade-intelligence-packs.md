# Trade Intelligence Packs — the moat

> **Mission.** BidVoice is the **AI Operating System for the trades**. Every capability
> — estimating, the receptionist, scheduling, CRM, marketing, payments, project
> management, future vision — is the *same intelligent teammate*, not another app. The
> contractor never thinks "I'm opening a feature." They think *"I'm asking Bid Brain to
> take care of it."*
>
> **The line that governs it:** *The contractor builds. BidVoice remembers, organizes,
> schedules, answers, follows up, and runs the office.*

## Why this is the competitive advantage

Everyone else is racing to build a smarter *general* AI. We're building an AI that
**already knows the trade before the conversation starts.** A generic receptionist asks
"Tell me more." Ours asks *"Is it a 200-amp panel or a subpanel?"* — because the same
trade knowledge that powers the estimator also powers the phone.

That depth is hard to copy and it compounds: every surface that reads the same pack gets
smarter at once. The knowledge is the moat — not the telephony, not the UI.

## The Pack — one canonical structure

A **Trade Intelligence Pack** is the single source of truth for one trade. Every surface
reads from it; nothing hardcodes trade knowledge anywhere else.

```
TradePack {
  key, label, emoji
  vocabulary[]          // the words a 20-yr office manager uses (ridge vent, ice & water…)
  intakeQuestions[]     // what the receptionist asks a caller (trade-aware, not generic)
  estimatingFields[]    // what the estimate needs  ← TODAY: TRADE_FIELDS
  captureHints          // what to bring / measure   ← TODAY: TRADE_PICK.bring
  materials[]           // common materials + units
  pricingGuidance       // ranges / drivers (contractor sets real numbers — never fabricate)
  proposalLanguage      // scope/exclusions/warranty phrasing for this trade
  customerFAQs[]        // the questions homeowners actually call about
  followUpSequences[]   // trade-appropriate nudges
  schedulingRules       // duration, crew, season, lead-time norms
  warranty              // typical terms + what to disclose
  upsells[]             // legitimate, value-adding add-ons
  safety[]              // jobsite / code considerations
  seo / marketingCopy   // website + ad copy seeds
  photoContext          // what the material scanner / vision should expect to see
}
```

Today two of these fields already exist — **split across two files**:

| Pack field | Lives today in | Notes |
|---|---|---|
| `estimatingFields` | `src/assist.js` → `TRADE_FIELDS` | the estimator intake checklists |
| `captureHints` | `public/index.html` → `TRADE_PICK.bring` | "bring the footprint, pitch, layers…" |
| `label`/`emoji` | `public/index.html` → `TRADE_PICK` | picker chrome |

Everything else is unbuilt. **The fragmentation is the thing to fix first** — before a
third surface (the receptionist) adds a third copy of trade knowledge.

## The seam to lay (architecture, not a build)

One server-side registry, `tradePack(key)`, becomes the source of truth. Step one is pure
**consolidation, no behavior change**: move `TRADE_FIELDS` and the `bring` hints behind
`tradePack(key).estimatingFields` / `.captureHints`, and have the estimator + picker read
from it. Same output, one home. After that, each new pack *field* is additive and every
surface inherits it for free.

This mirrors the provider seam we already hold (all AI behind `/api/assist/*` +
`/api/brain/*`) and the voice seam shipped with the conversation loop (`VOICE_PROFILES`
behind one `bbSpeak()`): **separate the knowledge from the surfaces, so tomorrow's
capability plugs in without a refactor.**

## Depth-first, not breadth-first (a deliberate call)

18 shallow packs is a *worse* moat than one trade that feels like a 20-year veteran.
We prove the structure by making **one** pack genuinely deep — **roofing** (the lead
example) — across all fields, then template it. Breadth is cheap once depth is proven.

### Roofing — the reference pack (sketch)
- **vocabulary:** squares, pitch (6/12), tear-off vs overlay, decking, underlayment,
  ice-&-water shield, ridge/soffit ventilation, flashing, drip edge, valleys, ridge cap,
  step flashing, insurance/ACV claims.
- **intakeQuestions (receptionist):** "Is it a leak or a full replacement?" · "One layer
  or two to tear off?" · "Do you know the roof's age?" · "Is this an insurance claim?" ·
  "Any active leak we should prioritize?"
- **estimatingFields:** *(already live in `TRADE_FIELDS.roofing`)* roof system, squares /
  footprint+pitch, layers/tear-off, decking, underlayment & ice-and-water, ventilation,
  flashing & drip edge, gutters, disposal.
- **upsells:** ridge vent upgrade, gutter replacement, skylight reflash, ice-&-water at
  eaves/valleys. **warranty:** workmanship term + manufacturer system warranty.

## The boundary nobody should blur: knowledge ≠ telephony

The **Trade Intelligence Pack (knowledge)** is reusable *now* and pays off *immediately*
in the estimator and onboarding — we can deepen it today with zero new infrastructure.

The **AI Receptionist's phone answering** is a separate infrastructure build: a real
phone number per contractor, an always-on backend, live call handling, speech-to-speech
latency, and calendar sync — a different beast from today's offline-first PWA. The
conversation loop we just shipped is the *interaction model* for it; the telephony layer
is net-new and heavier.

**So the sequence writes itself:** deepen the knowledge pack → it makes estimating +
onboarding better tomorrow morning → the receptionist later stands on top of it (and on
the existing scheduler, jobs, and `[[action]]` directive framework) rather than starting
from zero. Investment compounds; nothing is throwaway.

## Priority & status (founder's call)

The build order is set: **Phase 1 — Trade Intelligence Pack** (this) → **Phase 2 — AI
Receptionist** → **Phase 3 — premium SEO engine**. SEO without conversion is wasted
traffic; once the receptionist exists, every visitor is worth far more, and every SEO page
is just another consumer of the same pack.

**Phase 1 — server foundation complete.** `src/tradePacks.js` is the single source of
truth: registry + schema + Company Brain overlay seam. The estimator's intake checklists
were relocated out of `assist.js`; estimating brain / labels / capture hints are composed
from `trades.js` (not duplicated). Behavior is preserved — the estimator gets byte-identical
fields.
- **One file per trade.** Deep packs live in `src/packs/<trade>.js` (so "deepen a trade" is
  a self-contained unit, and data can later move to a DB without touching consumers).
  `roofing` and `windows` are both filled to reference depth: estimating fields, vocabulary,
  receptionist intake, SEO services, FAQs, materials, customer objections, financing
  triggers, upsells, warranty, proposal language, safety, suggested photos, marketing /
  review / referral copy, follow-ups. Other trades keep a usable base (estimating fields +
  derived intake) until filled.
- **Company Brain overlay seam (`applyCompanyOverlay`).** The generic pack, customized by
  the contractor's own standards (preferred brands, waste %, min job size, financing
  thresholds, voice). A pass-through today (no profile yet) with merge semantics defined,
  so every surface already reads *through* the seam the Company Brain will fill. THIS is the
  moat — a new hire bids like the owner.
- *Held for the migration plan (not yet done):* eliminating the client's duplicate
  `TRADE_PICK` by having the browser consume `/api/trades` (served from the pack) with an
  offline-safe cache + fallback. Server-only so far; no client/offline behavior touched.

## Two principles that outlive today's build

- **Interface-agnostic.** A pack returns *data, never UI*. The same intelligence must be
  able to power a web page, the phone receptionist, a voice assistant, smart glasses, or
  whatever device comes next. The interface changes; the intelligence does not. (`tradePack()`
  returns plain objects for exactly this reason.)
- **One operating system, one timeline.** Website, receptionist, CRM, scheduler, estimator,
  Bid Brain, marketing, reviews, referrals — nothing exists in isolation. Every capability
  shares the same customer timeline and the same Trade Intelligence Pack.

## The bar that defines the category

BidVoice should never feel like software. Every feature should feel like the contractor
*hired another employee*: "I hired someone to answer my phones." "…to build my website."
"…to follow up with customers." "…to ask for referrals." "…to write estimates." When we
hit that, BidVoice stops competing with software and starts **competing with payroll** —
a different category entirely.

## The test for every feature
> *Would this make a contractor's day easier tomorrow morning?*

Yes → we're moving in the right direction. No → rethink it.
