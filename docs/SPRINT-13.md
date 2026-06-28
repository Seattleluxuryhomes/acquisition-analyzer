# Sprint 13 — AI Growth Score

## Objective
Give every contractor an **AI Growth Score** — one screen that says *"here's where
you're leaving money on the table"* and turns each gap into a one-tap fix. This is
the engagement engine: the reason the app feels more valuable every month.

## Why (the filter)
- **Make More Money** — it drives the actions that actually generate leads.
- **Save Time** — it tells them exactly what to do next instead of guessing.

## Build this

**Compute a score (0–100)** from signals already in BidVoice — no new data sources:
- Profile complete (company, phone, logo, services, area)
- Website published
- Projects published (count + recency: updated in last 30 / 60 / 90 days)
- Has an AI About page
- Photos on file
- Estimates sent / accepted (activity)
- Reviews connected → ⚠ (0 today)

**A Growth screen** (under "More"):
- The score (ring + number) and a one-line coach: *"You're at 62 — three quick wins
  to 80."*
- A checklist: ✅ done items and ⚠ to-do items. **Each ⚠ has a one-tap CTA** that
  routes to the exact place to fix it (Publish Website, Publish a Project, Write
  About with AI, Add Photos, …).
- Recomputes live as they fix things — the number climbs while they watch.

**A Growth card on the home dashboard:** the score + the single highest-impact next
action. Tap → go do it.

## Architect only (do NOT build the backend)
- Model each ⚠ recommendation as an **action object**:
  `{ id, type, title, impact, cta, route, status }`.
  This is the SAME shape the future **Approval Inbox (Sprint 14)** will render once
  the AI starts *generating* fixes (a drafted review request, a blog post, a promo
  page). **Build the data shape now; do not build the AI generation or the inbox.**
- Leave a **reviews-provider seam**: the reviews ⚠ shows "Connect reviews (coming
  soon)" — do NOT build the Google Places integration this sprint.

## Do NOT build yet
- No AI generation of the fixes (that's Sprint 14).
- No Google reviews API.
- No "your score dropped" emails / push reminders (later).

## Definition of done
A contractor opens the app → sees their score + the #1 thing to do → taps it → does
it → the score goes up. **Entirely from data already in the system. Zero new
external dependency.**

---

### Sets up → Sprint 14 — Approval Inbox (preview, not this sprint)
The action-object shape above is deliberate. Sprint 14 builds the **one-tap
approval primitive**: the AI proposes (review request drafted, project write-up,
promo page, GBP photos) and the contractor approves — never auto-posts. Every future
"AI employee" action (marketing manager, blog, social) renders through that inbox.
Growth Score's ⚠ actions become its first cards.
