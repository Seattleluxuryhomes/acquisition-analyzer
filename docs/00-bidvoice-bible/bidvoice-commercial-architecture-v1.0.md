# BidVoice — Commercial Architecture
### Constitutional design review · Principal Architect / CRO / CFO lens

> **Authority & status.** This document sits **below The Soul of BidVoice** and the
> BidVoice Bible in the constitutional hierarchy (Soul → Bible → Volumes → specifications
> → code). It **conforms to The Soul of BidVoice v1.0** — where a revenue idea conflicted
> with the Soul, the idea lost. It **ratifies the commercial architecture** that Bible §12
> previously left as an open founder decision. **The architecture is canon; the specific
> dollar figures are launch hypotheses to be validated against real willingness-to-pay in
> beta, and are NOT frozen.** Filed 2026-07-02.
>
> **Implementation status (2026-07-02): SHIPPED.** The commercial engine described here is
> built — per-company subscription with unlimited internal users; give-a-month/get-a-month
> referrals via an auditable credit ledger (first month free for the referred company; the
> referrer earns a capped credit — 12/calendar year — once the referral pays through month two);
> Founding Member rate-lock captured from Stripe and cleared on cancel; payments untouched.
> Engineering reference + runbook: **`docs/billing-and-referrals.md`**. The dollar figures
> ($199 / $349 / $1,500) remain beta hypotheses set in Stripe, not frozen here.

---

## 1. Executive Summary
BidVoice should not be priced like software, because the Soul says it isn't software. The
recommended architecture in one paragraph: **one flat price per company, unlimited people,
no feature gates on anything touching trust** — launching at **$199/month for Eden**
(estimating, proposals, momentum) with a second tier, **Eden Front Office ($349/month)**,
arriving only when the phone/communications layer ships behind its quality gates. **Hiring
Eden™** becomes the commercial language for onboarding: an optional **$1,500 concierge
investment** where Eden arrives already trained. **Founding Members** get their rate locked
for as long as they remain active — the "never betray early customers" principle made
mechanical. Referrals are **mutual, credit-based, and capped** — not perpetual-free.
Payments (deposits, invoices) become the **quiet second revenue engine**. **Homeowners are
never customers.** Every number below is a launch hypothesis to be validated against real
willingness-to-pay in beta; the *architecture* is designed to hold for a decade even as the
numbers move.

**The central pricing thesis: the anchor is labor, not software.** A part-time office
coordinator costs $1,800–2,800/month; an answering service alone runs $200–400. Against
SaaS, $199 looks expensive next to Joist. Against the thing Eden actually replaces, it's the
best hire a contractor ever made at a tenth the cost. The entire commercial model exists to
keep the customer making the second comparison, never the first.

## 2. Commercial Architecture
Three revenue layers, each with a constitutional check:

- **Layer 1 — The employment relationship (subscription).** Flat, per company, monthly with
  an annual option. This is the core and must stay boring, predictable, and singular.
  Predictability *is* the product — a company selling peace of mind cannot send surprise
  bills.
- **Layer 2 — Hiring Eden™ (activation).** One-time, fixed-price, fixed-outcome onboarding.
  Priced to roughly cover its true cost plus CAC contribution — an activation investment,
  deliberately *not* a profit center, because the moment onboarding margins matter it
  degrades into consulting (a named failure mode).
- **Layer 3 — Money in motion (payments).** BidVoice already moves the contractor's money —
  deposits on acceptance, invoices, reminders. Standard payment-processing economics on that
  volume is large, aligned (BidVoice earns when the contractor gets paid), and invisible as
  a "fee for Eden." At scale this layer plausibly rivals subscriptions. **Constitutional
  check:** it monetizes the contractor's *success*, not his conversations, his data, or his
  customer. Clean.

**Rejected layers, permanently:** monetizing homeowner conversations (two masters); lead
marketplaces (inverts who the customer is); white-label Eden (violates "There is one Eden");
supplier-recommendation kickbacks (any supplier revenue must be flat integration fees,
disclosed, and never allowed to influence what Eden recommends — an employee who takes
vendor kickbacks is embezzling trust).

## 3. Recommended Pricing Structure
- **Eden — $199/month per company** (launch hypothesis; test band $179–249). Everything in
  V1: intake, estimates, proposals, approvals, follow-ups, invoicing, memory, momentum.
  **Unlimited team members.**
- **Eden Front Office — $349/month per company** (arrives with the communications phase).
  Everything above plus the dedicated business number, 24/7 answering, SMS/email/forms as
  one thread, scheduling within grants. Anchored against answering service + admin time,
  this tier is self-evidently cheap.

**Why not $39.99–$99, mathematically.** Voice-heavy AI COGS (ASR, TTS, telephony, LLM) will
realistically run $20–50/month for an active contractor. At $49, gross margin is
thin-to-negative for the best customers — the product punishes engagement. At $199 with
~75–80% blended margin and employee-relationship churn (~2%/month design target; low-price
SMB SaaS runs 3–6%), LTV ≈ $199 × 0.78 ÷ 0.02 ≈ **$7,760**, which supports white-glove
onboarding and real CAC. At $49 and 4% churn, LTV ≈ $955 — a business that can never afford
to answer its own phone.

**Why not $39.99–$99, psychologically.** $49 says "another app" and attracts tire-kickers
who never activate and churn accordingly; price is positioning. Nobody believes they hired
an employee for $49. Meanwhile, low price doesn't reduce churn in SMB — **activation** does,
which is why the money belongs in onboarding quality, not discounting.

**Why not higher than ~$349 at launch.** ServiceTitan proves WTP of $300–500/tech/month
exists at the top of the market, but BidVoice's wedge is the solo-to-five-crew contractor
whom enterprise tools priced out. Premium enough to fund excellence, attainable enough to be
the whole market's first real hire.

**Rules that never bend:** no feature above is ever gated that touches trust — approval
gates, transcript access, data export, the "here's what I heard" verification, and offline
capture exist identically in every tier forever. Charging extra for safety would be selling
the brakes separately.

## 4. Hiring Eden™ Strategy
Adopt the language fully. "Setup fee" is what software charges; "Hiring Eden" is what this
company does, and the reframe alone justifies the price.

**Structure:** optional, **$1,500 flat** (test band $1,000–2,500), fixed scope, fixed
outcome: price book built from two years of real estimates, customers imported, number
provisioned, proposal branding, standing arrangements configured — ending with the designed
graduation moment: the contractor speaks a job and Eden, already knowing his rates and
customers, hands back an estimate that's right. Marketed as *first day with a veteran instead
of a green hire.*

**Why paid beats free:** paid onboarding → completed onboarding → activated contractor →
retention. Free implementation is skipped implementation; the fee is a commitment device
more than a revenue line. **Why optional:** the self-serve three-minute path is
constitutionally protected (first job is the onboarding) and product-led growth needs it.
The concierge path is the *recommended* door for Front Office customers (number porting
realistically requires it) and the default for anyone with two years of paper to ingest.
**Guardrail:** fixed price, fixed deliverables, published checklist. The day Hiring Eden
bills hourly or scopes per-customer, it has become consulting disguised as onboarding.

## 5. Referral System
**The 5-companies-free concept: rejected**, with respect for the instinct. Its problems
compound: a perpetual free class of users (worst churn cohort, ongoing COGS, zero payment
relationship); an audit burden ("while those companies remain active" means someone's bill
changes when someone *else* churns — anti-peace-of-mind); fraud surface (contractors run
multiple entities; five shells = free forever); and a weird cliff at five that rewards
nothing at four.

**Replacement — mutual, capped, simple: Give a month, get a month.** Referred company gets
their first month credited (or $199 off Hiring Eden — better, because it funds activation);
referrer gets one month credited per referral that converts and completes month two, **capped
at 12 credits/year.** Advantages: bounded liability, both sides win, fraud limited by the cap
and the month-two condition, and the math still lets an evangelist contractor effectively
work with Eden free for a year — the emotional headline survives without the perpetual
liability.

**The constitutional catch:** referral prompts come from BidVoice surfaces at moments of
earned pride (proposal accepted, payment landed) — **never from Eden's mouth.** Her voice
never sells; a referral ask in her register would spend the exact trust the program depends
on. The program's job is to make gratitude easy to route, not to manufacture advocacy.

## 6. Team Licensing Strategy
**Per company. Unlimited people. Full stop.** You don't pay per coworker allowed to talk to
the office manager — per-seat pricing contradicts the employee metaphor at the root, creates
seat-policing (login sharing, the foreman locked out), and punishes exactly the behavior
BidVoice wants: the whole crew feeding Eden context, because complete data makes her better,
which deepens retention. It's also the sharpest commercial divergence from
ServiceTitan/Procore per-seat pain.

**Definitions and guardrails:** a "company" is one business entity/brand/phone number;
multi-location operations graduate to per-location licensing (the future enterprise motion).
Usage-based and AI-token pricing are rejected as anxiety machines. Internally, a generous
fair-use ceiling exists for pathological abuse and is invisible to every legitimate customer.

## 7. Expansion Strategy (Segments)
- **Homeowners — never a paying customer.** Constitutional (two masters). Served brilliantly,
  free, as the contractor's client experience — that excellence is the contractor's moat and
  BidVoice's demand engine, not a monetizable audience.
- **Property managers — yes, second segment (Year 3+).** Same disease, same cure, largely
  same product. Pursue as a *configuration* of Eden, not a fork.
- **Realtors — not customers.** At most a partner channel routing homeowners to BidVoice
  contractors. Building product for them dilutes focus for a shallow wallet.
- **Real-estate investors — a niche of property management.** Served incidentally by the PM
  configuration; never a separate product.
- **Commercial contractors / GCs — a different company's problem until Year 5+.** If pursued,
  a second product line under the constitution, not a stretched V1.
- **Enterprise construction — no, and named as a failure mode.** The enterprise motion
  BidVoice should want is many-location residential franchises on per-location pricing —
  enterprise revenue with SMB product DNA.

## 8. Competitive Positioning
Jobber and Housecall Pro sell field-service software: tiered, feature-gated, per-user —
good businesses that feel like software, which is precisely the opening. ServiceTitan proves
top-end WTP but abandoned the small contractor. Joist proves the estimating wedge but
commoditized it — **BidVoice must never price-compete with Joist** because it doesn't sell
the same thing (a calculator vs. an employee). Buildertrend and Procore fight over project
management upmarket; not this fight, not this decade.

**Deliberate divergences:** (1) sell an employee, not seats; (2) one price, no gates on
trust, ever; (3) the answered phone as the core promise, not an add-on; (4) onboarding as
hiring, not implementation; (5) the anchor is labor cost, not competitor pricing. The
commoditization defense isn't features — it's the accumulated, exportable-but-irreplaceable
working relationship (her knowledge of his prices, customers, cadences) plus a constitution
competitors can't adopt without becoming a different company.

## 9. Failure Analysis — decisions that must never ship
- **Per-seat pricing** — breaks the metaphor and the data flywheel.
- **More than two tiers** — every tier is a decision, and decisions are the enemy of the
  sale; two is the maximum this company can hold with a straight face.
- **Gating trust features** — constitutional violation; safety is never an upsell.
- **AI-token/usage pricing** — surprise bills in a peace-of-mind company; punishes engagement.
- **Hidden fees** — one invoice line for subscription, one for Hiring Eden, standard
  disclosed payment rates; anything else is a crack for trust to fall through.
- **Consulting disguised as onboarding** — hourly billing converts a promise into a meter.
- **Monetizing customer conversations or data** — the soul-selling event; includes
  "anonymized insights" products, the same sin in a lab coat.
- **Discount culture** — perpetual promos betray Founding Members; the only standing
  discounts are annual prepay and the referral credit.
- **Lead marketplaces** — the day BidVoice sells contractor attention, the contractor
  stopped being the customer.
- **Enterprise exception-making** — the first custom contract with a custom Eden is the first
  crack in "There is one Eden."

## 10. Five-Year Evolution
- **Year 1:** launch Eden at the hypothesis price with **Founding Member lock** (rate frozen
  while active, founder mark on the account, first access to Front Office). Founding lock
  makes the hypothesis safe: if $199 proves low, new customers pay the corrected price and
  early believers are rewarded, not betrayed. Validate with real WTP work before scaling
  spend.
- **Year 2–3:** Front Office tier ships behind its quality gates; new-customer price steps to
  validated levels ($249/$399 plausible); payments volume becomes a tracked engine; referral
  credits mature; Hiring Eden becomes the majority path for Front Office.
- **Year 4–5:** per-location licensing for multi-office residential; property-manager
  configuration launches as segment two; payments plausibly approaches subscription revenue;
  the pricing page still fits on an index card — that fact is a KPI.

## 11. Ten-Year Evolution
By Year 10, exactly the revenue lines named in §2 grown large, and no others: subscriptions
across two segments and franchise locations, activation revenue at cost-plus, payments at
scale — plus disclosed flat-fee integrations (suppliers, accounting, insurance quoting) that
never touch Eden's recommendations. **API access exists for the contractor's own data**
(portability made programmatic), not as a monetization of Eden's judgment. The prices early
customers pay are the prices they were promised. The pricing model survives unchanged in
shape: one relationship, one company, one bill. If a tenth-year executive proposes the clever
thing — seats, tokens, tiers, homeowner monetization, a data product — **this document and
the Soul are the two papers that say no, in that order.**

## 12. Final Recommendation
**Adopt:** flat per-company pricing at $199 (Eden) and $349 (Front Office, when earned),
unlimited people, no trust gates; Hiring Eden™ at $1,500 optional fixed-scope concierge;
Founding Member rate-lock as the permanent early-adopter covenant; give-a-month/get-a-month
capped referrals with Eden's voice constitutionally excluded; payments as the embedded second
engine; homeowners never monetized; property management as segment two; enterprise refused in
favor of franchise locations.

**Honest limits, stated plainly:** the architecture is defensible for a decade; the specific
dollar figures are hypotheses. Willingness-to-pay in this market must be **measured, not
asserted** — run the beta cohort through real price testing before the numbers freeze, and
treat the Founding Member lock as the mechanism that makes early pricing mistakes survivable.
The architecture is designed so that when the numbers move, nothing about the company's word
has to.
