# Sprint 15 — AI Funnel (the contractor lead-gen system)

## Objective
Turn the contractor's website into a **high-converting, offer-led funnel that AI
builds** — and wire the on-submit automation (lead → customer → opportunity → AI
follow-up → appointment suggestion → notify → dashboard) **entirely inside
BidVoice**. Goal: the highest-converting contractor lead-gen system, dramatically
simpler than ClickFunnels / GoHighLevel.

## Why (the filter)
**Make More Money** — every point of conversion lift is more booked jobs from the
same traffic. **Save Time** — AI builds the page and drafts the follow-up; the
contractor never connects or configures third-party software.

## The research, distilled (what actually converts for contractors)
Pages with all of these hit **10–15%** conversion; missing a few → **1–3%**:
- **Offer-led headline** ("Free Roof Inspection") > business name.
- **One dominant CTA** + **sticky tap-to-call** on mobile.
- **Real work photos** (our Before/After gallery), never stock.
- **Trust above the fold**: license #, service area, 3–5 reviews w/ names/areas.
- **Sub-2.5s load** (already our strength — lean into it).
- Short FAQ killing the top objections.
- *Local-service insight (GHL > ClickFunnels):* the conversion driver is instant
  **follow-up + booking + CRM**, NOT a page builder or upsell flows.

## The reframe (what we already own)
- ⚡ Speed (no-framework server render, already sub-2.5s)
- 📇 CRM (we ARE it — "no third-party" is already true)
- 🖼️ Real work photos (Sprint 12 gallery = the #1 trust element)
- 🔔 Notify + dashboard (shipped)
So the gap = **offer-led pages + the instant automation chain**, not a builder.

## Build this
**1. AI-generated offer pages ("Funnels").** Contractor picks a service + an offer
(e.g. "Free Estimate," "Free Inspection"); AI generates a single-offer page using
the research patterns: offer-led headline, ONE dominant CTA, sticky tap-to-call,
social proof (reviews seam + gallery photos), license + area above the fold, an AI
FAQ, mobile-first form. Reachable at `/c/:slug/:offerSlug`. The contractor edits
the offer/headline; they do NOT build layout.

**2. On-submit automation chain (all native):**
- Create **lead** (exists) → ensure a **customer/contact** record → open an
  **opportunity** (a draft job/bid stub linked to the lead).
- Draft an **AI follow-up** (personalized text + email) → lands in the **Approval
  Inbox (Sprint 14)** for one-tap send.
- **Suggest appointment times** from the internal schedule, embedded in the
  follow-up draft.
- **Notify** the contractor (exists) + **add to dashboard** (exists).

**3. Per-funnel analytics:** views → submits → conversion rate → booked, from
existing event tracking. Show it on the funnel.

## Architect only (do NOT build)
- **A/B testing**: model a funnel as able to hold variants; do NOT build the
  split-test engine.
- **Self-serve booking calendar** (Calendly-style): suggest-times-in-follow-up now;
  full customer-facing calendar later.
- **customer/opportunity entities**: v1 maps to the existing lead→job model (lead =
  entry, job = opportunity); a distinct contact entity is a later refactor — build
  minimal now, leave the seam.

## Do NOT build yet
- No drag-drop editor (AI builds the page).
- No third-party integrations (we're native by design).
- No SMS provider — v1 follow-up is approve-to-send through the contractor's own
  channels; automated SMS sequences are later.
- No upsell/payment flows (ClickFunnels territory — out of scope).

## Depends on
- Sprint 12 gallery ✅ (real work photos)
- Sprint 14 Approval Inbox (AI follow-up renders there)
- Reviews seam (for social proof) — stub until the reviews sprint

## Definition of done
A contractor picks a service → AI generates a high-converting offer page in minutes
→ a visitor submits → a lead + customer + opportunity appear, an AI follow-up with
appointment times is drafted for one-tap send, the contractor is notified, and the
funnel's conversion rate shows in analytics. **No third-party software, ever.**
