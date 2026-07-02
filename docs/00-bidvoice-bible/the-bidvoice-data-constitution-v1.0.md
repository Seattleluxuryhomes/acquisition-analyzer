# The BidVoice Data Constitution
### Version 1.0 — FROZEN

> **Authority & status.** Subordinate only to **The Soul of BidVoice v1.0**; it is the Soul's
> data chapter. **Frozen and immutable** — amendments require an explicit, recorded decision by
> Ben (same discipline as the Soul). Amendment log: none. Filed to the repo 2026-07-02 per the
> Operational Mandate. Enforcement lives in `docs/engineering-constitution.md`.
>
> The Soul says no data hostage, no monetized conversations, no pricing leakage. This document
> makes those sentences enforceable. Every rule here is written to be testable; where a rule
> cannot be tested, it names its owner.

---

## 1. Ownership
The contractor owns his business record: his customers, jobs, estimates, prices, communications,
photos, recordings, and everything Eden has learned in his service. **BidVoice is the custodian,
never the owner.** Homeowner information inside that record belongs to the record — it is the
contractor's customer file, held to the same standard, and never BidVoice's audience.

Eden's memory of a contractor is part of his record. What she learned working for him is his, the
way a bookkeeper's ledgers belong to the business, not the bookkeeper.

## 2. Portability
Everything in §1 exports in one tap: complete, machine-readable, human-readable where it matters
(customers and estimates as CSV/PDF, memory and price book as plain language), and never punished,
delayed, degraded, or followed by retention theater. **Export works on the day a contractor is
angriest at us.** The open door is the proof he is an employer, not a hostage, and the export
endpoint is **tested in CI** like any other trust feature.

## 3. Isolation
Every contractor is a **sealed tenant.** No query, feature, report, model, or employee dashboard
may read across tenants' business content. Specifically and permanently banned: pricing benchmarks
built from customer data, "market rate" suggestions derived from other contractors, win-rate
comparisons, and any product — internal or external — that lets one contractor's numbers inform
another's. This includes the laundered versions: **"anonymized insights" and "aggregated trends"
are the same sin in a lab coat.** An agent, partner, or homeowner sees only what one contractor
explicitly granted on one project. Isolation is enforced by **automated tests that attempt
cross-tenant reads and fail the build if any succeed.**

## 4. Learning and Training
Two kinds of learning, never confused:

**Eden learning for the contractor** — his rates, his phrasing, his customers, his corrections —
happens freely, belongs to his record, exports with it, and serves no one else. This is her job.

**Model training on customer content** — using contractors' words, recordings, estimates, or
customer communications to train shared models — **does not happen without explicit, specific,
revocable opt-in, unbundled from the terms of service and defaulted off.** No dark patterns, no
consent buried in updates. **Pricing data never trains shared models under any consent**, because
§3 outranks consent.

**Product telemetry** — feature usage, error rates, latency, crash logs — is not content and is
used to fix the product. The line between telemetry and content is maintained by engineering and
reviewed by the owner of this document; **where ambiguous, it is content.**

## 5. Retention and Deletion
**Account deletion:** plain confirmation, **30-day grace with export offered**, then hard delete of
the business record. What lawfully survives, disclosed in advance: financial transaction records for
their statutory period, and the approval audit trail below. Individual memories, customers, and
recordings are deletable by the contractor at any time, immediately, without ceremony.

**Voice recordings** exist to serve the contractor: retained 30 days by default for transcript
correction, then deleted unless he chooses longer. Recordings never train shared voice or speech
models without the §4 opt-in.

## 6. The Approval Audit Trail
Every approval — what the contractor saw, when he tapped, what left the system — is retained for
**seven years.** It exists for accountability in both directions: it protects the contractor when a
client disputes, and the company when a contractor blames Eden for what he approved. It is
disclosed, visible to the contractor, and **never surfaced as an "I told you so."**

## 7. Homeowner Data
Homeowners' data lives inside the contractor's record and is served through him. BidVoice honors
direct legal requests from homeowners (access, deletion) under applicable law, with notice to the
contractor and the minimum footprint the law requires. **BidVoice never contacts, markets to,
profiles, or builds an audience from homeowners.** The portal is theirs to use and never theirs to
be sold through.

## 8. The Never List
BidVoice never sells data. Never rents it. Never trades it. Never shows ads on it. Never builds an
insights product from it. Never uses private performance data to rank contractors. Never grants a
partner, agent, investor, or acquirer visibility beyond what a contractor granted per project. Never
treats a security breach as a communications problem — §9 governs.

## 9. Failure
When contractor data is breached, exposed, or mishandled, the affected contractors hear it from
BidVoice **first, plainly**, with what happened, what it touched, and what we did — on the timeline
the law requires or faster. The Soul already committed us: *we say so first, plainly, and fix it.*
**A company that hides its failures teaches its employee to hide hers.**

## 10. Custody Beyond Us
Subprocessors (hosting, telephony, speech, models) are disclosed on a **public list**; additions are
announced before they touch customer content, and every one is bound to this document's standards by
contract. If BidVoice is ever acquired, **this constitution binds the successor as a condition of
custody**: the data transfers only with these rules attached, and contractors are notified with
export offered before any transfer of control.

---

**Enforcement.** §2 export, §3 isolation, and §5 deletion are **CI-tested** (see
`scripts/constitution-tests.mjs` + `docs/engineering-constitution.md`). §4's content/telemetry line,
§7's legal-request handling, and §10's subprocessor list have **named human owners** recorded in the
Engineering Constitution. This document amends by decision, never by drift.
