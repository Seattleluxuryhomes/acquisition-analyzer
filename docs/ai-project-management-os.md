# The AI Project Management Operating System — design (no code yet)

> **Mission.** Not project management software. The AI employee that runs the office.
> *The contractor builds. BidVoice remembers, organizes, schedules, communicates,
> protects profit, follows up, learns, and runs the business.*

> **The organizing question (founder's):** *"If AI existed before project management
> software, how would we build this today?"* Answer in one line: you would **not** build
> forms → tables → menus and bolt AI on. You'd build **one event stream per customer** and
> make every screen, score, and alert a *projection* of it — with AI as the default
> interface and the UI as a fallback for when typing is faster than talking.

---

## 0. The thesis that should drive every decision

**The Customer Timeline is to Phase 2+ what the Trade Intelligence Pack was to Phase 1:
the single source of truth, with unlimited interfaces.**

Phase 1 worked because we built *one* knowledge layer and pointed many surfaces at it.
Phase 2 should do the same with *state*: one append-only **event log per customer/project**
that everything writes to and reads from. The receptionist writes the first events. The
estimator, scheduler, payments, draws, change orders, and photos all write events. The AI
PM, the Health Score, the briefing, and search are all *read-projections* over that log.

If we get this one decision right, every capability on your list becomes a small consumer
of the timeline instead of a separate app. If we get it wrong — a new "Project" table that
duplicates `job`, plus per-feature state scattered across tables — we rebuild this in 18
months. This is the decision to protect.

---

## 1. Competitive analysis (where they win, where they frustrate)

| Product | Wins at | Frustrates because |
|---|---|---|
| **Procore** | Enterprise GC scale, docs, RFIs | Heavy, expensive, needs an admin; built for $50M GCs, not a 3-truck remodeler |
| **Buildertrend / CoConstruct** | All-in-one for homebuilders/remodelers | Data entry tax; contractors stop updating it; "another thing to manage" |
| **JobTread / Contractor Foreman / FieldPulse** | Affordable all-in-one, estimating→PM | Form-heavy; setup burden; you still drive every workflow |
| **ServiceTitan / Housecall Pro / Jobber** | Dispatch, service trades, recurring | Service-call DNA (short jobs), weak at multi-week project lifecycle & draws |
| **CompanyCam** | Photo capture + organization, loved on jobsites | It's a great filing cabinet — *storage*, not *intelligence*; photos don't *do* anything |
| **Monday / ClickUp / Asana / Trello** | Flexible boards | Generic; the contractor has to invent the system; nothing trade-aware |

**The universal failure mode:** *every one of them expects the contractor to operate the
software.* They are systems of **record** that demand human upkeep. The moment a job gets
busy, updates stop, and the data rots. Contractors don't quit because the features are bad
— they quit because **it's work**.

---

## 2. Opportunities competitors missed (the seams to attack)

1. **State that maintains itself.** Every competitor needs a human to mark progress. With a
   voice-first, event-driven core, state is a *byproduct* of work already happening
   (a bid sent, a deposit paid, a photo taken) — not a separate task.
2. **No single timeline.** They silo estimating, photos, scheduling, payments. The customer
   journey is reassembled by the contractor's memory. Nobody owns the *continuous timeline*.
3. **Photos that do nothing.** CompanyCam stores; nobody *uses* photos to assemble a draw
   package, validate progress %, or auto-build a proposal/marketing post.
4. **Reactive, not proactive.** All of them answer questions when asked. None *surface* the
   overdue invoice, the unscheduled inspection, the idle Friday — before you notice.
5. **Knowledge trapped in the owner.** None capture *how this company* prices/communicates/
   decides. Our Company Brain overlay is built for exactly this.
6. **The lifecycle ends at payment.** Reviews, referrals, warranty, maintenance, annual
   reconnect — left to the contractor. The highest-margin work (repeat customers) is
   un-automated everywhere.
7. **Onboarding is a wall.** "Set up your workflow." We invert it: the system already knows
   the trade (the pack) and learns the company (the brain); setup approaches zero.

---

## 3. Ten inventions only BidVoice can ship

Not better UI — capabilities competitors *structurally cannot* copy, because they started
with forms and we start with AI + the pack + voice + the timeline + the company brain.

1. **The Self-Driving Project File.** The project organizes itself from events — no folders,
   no tagging. Say it, shoot it, send it; it's filed, dated, linked, and searchable forever.
2. **Continuous Project Watch + explainable Health Score.** A daily (later, real-time) tick
   evaluates deterministic rules over the timeline and surfaces *why* a job is yellow/red
   and the one next action — never a bare color.
3. **Trade-aware Photo Intelligence.** The pack tells the contractor *exactly* which photos
   to shoot for this trade at this phase; vision tags them (before/progress/after/damage);
   they auto-flow into draws, proposals, and marketing. Photos that *work*.
4. **Zero-assembly Draw Packages.** "Request draw 2" → BidVoice assembles % complete,
   progress photos, completed-scope summary, receipts, inspection status, and the signature
   request. The contractor never builds a draw package again.
5. **Voice Change Orders that ripple.** "Customer wants a second bathroom" → CO created,
   estimate + profit + schedule + draw schedule updated, signature requested, affected crew
   notified — from one sentence.
6. **Stop/Resume Work Orders, automatic.** Rain, permit hold, failed inspection, non-payment
   → professional Stop Work doc + timeline pause + everyone notified; on resolution, a Resume
   Work doc + reschedule. Liability and schedule integrity, handled.
7. **Profit Radar.** Every project tracks expected vs. actual margin in real time and warns
   *before* it goes underwater ("labor is tracking 20% over the bid on framing").
8. **The Company Brain that compounds.** Every closed job runs a short post-mortem (did we
   make money? labor accurate? what surprised us? what would we bid differently?) and feeds
   the brain — so the next estimate, by anyone, is sharper. The owner's judgment, scaled.
9. **The Customer Memory that never forgets.** Years later: "the Johnsons — garage roof,
   2026, CertainTeed Landmark, warranty good through 2036, referred the Reyeses." Annual
   reconnects and warranty milestones fire on their own.
10. **One conversation, the whole business.** The contractor never "opens a module." They ask
    Bid Brain — and the receptionist, estimator, scheduler, draws, and PM are all the same
    teammate reading and writing the same timeline.

---

## 4. AI Project Management architecture

Four layers — three already partly exist in our codebase.

```
            ┌────────────────────────────────────────────────────────┐
 SURFACES   │ Website · AI Receptionist · Bid Brain (voice/chat) ·    │   (interfaces — swappable)
            │ Estimator · Scheduler · Draws · Proposals · Briefing     │
            └───────────────▲───────────────────────┬──────────────────┘
                            │ read projections       │ write events
            ┌───────────────┴───────────────────────▼──────────────────┐
 BRAIN      │ AI PM = Watchers (deterministic rules) → events           │
            │  + Bid Brain (LLM phrasing/action via [[directives]])     │
            │  + Company Brain overlay (how THIS company operates)      │
            └───────────────▲───────────────────────┬──────────────────┘
                            │                        │
            ┌───────────────┴───────────────────────▼──────────────────┐
 TIMELINE   │ Append-only Customer/Project event log (source of truth)  │  ← the new spine
            │  every action = an event {type, actor, project, payload}  │
            └───────────────▲───────────────────────┬──────────────────┘
                            │                        │
            ┌───────────────┴───────────────────────▼──────────────────┐
 KNOWLEDGE  │ Trade Intelligence Pack + Company Brain (Phase 1, done)   │
            └──────────────────────────────────────────────────────────┘
```

**Key decisions (and the challenges to your framing):**

- **Reuse `job` as the project spine; do NOT create a parallel `Project` table.** A "project"
  *is* a job plus its timeline. The job already carries customer, address, lines, status,
  scheduled date, photos, draws, change orders, documents, and payments. Forking a new
  entity duplicates all of that and splits the truth. (Challenge to the brief: the timeline
  is the new thing; the project is not.)
- **Introduce the one genuinely missing core entity: `customer`.** Today the customer is
  *embedded* in each job (`job.customer`, `job.customer_phone`). Repeat business, warranty,
  maintenance, lifetime value, and "the customer discovers website → … → repeat customer"
  loop all require a durable customer that *outlives* the project. This is the single most
  important new table. The receptionist creates it; every job links to it.
- **The Health Score is a rules engine, not an LLM guess.** Deterministic watchers compute
  the score from real events (overdue invoice, unsigned CO N days, unscheduled inspection,
  schedule gap, actual-vs-bid margin). Each contributing rule *cites the event that fired
  it.* The LLM only phrases the explanation and proposes the action. This protects the
  non-negotiable: never fake confidence; always explain; always cite a real event.
- **The AI PM is an evolution of pieces we already have**, not greenfield: `memory.js` already
  computes a briefing; Bid Brain already emits `[[action]]`/`[[schedule]]` directives;
  payments/draws/change-orders already exist. The PM = those, reading the timeline + a set of
  watchers, surfaced through the briefing/interruption layer (roadmap M3).

**Honest infrastructure challenge — "continuous" needs a backend we don't have yet.**
Today BidVoice is an **offline-first PWA + a stateless Express server**. "Continuously watch
every project, even when no one's looking" requires a **server-side scheduler/worker** (cron
+ a queue) that runs without a user present — net-new infrastructure, the same class of
build as the receptionist's telephony. So we phase it: **v1 computes health on read + one
daily server tick** (covers 95% of value: overdue, unscheduled, idle-day, unsigned). **v2**
adds event-driven real-time watchers. We should not promise "real-time always-on agent" on
day one; we should ship the daily heartbeat and earn the real-time tier.

---

## 5. Database architecture

Additive to today's schema (`user, job, photo, payment_request, lead, draw, change_order,
site_project, document, signature, sku, sub, dispatch, funnel, memory, event`). Note: the
existing `event` table is **product analytics** (`track()`), *not* the customer timeline —
keep them separate.

New / changed:

- **`customer`** (new, the durable spine): `id, user_id, name, phone, email, address,
  lat/lng, source, first_seen, tags, notes`. Jobs gain `customer_id` (back-filled from the
  embedded fields; embedded fields kept for back-compat). Unlocks repeat business, warranty,
  lifetime value.
- **`timeline_event`** (new, the source of truth): `id, user_id, customer_id, job_id, ts,
  type, actor (ai|owner|crew|customer|system), title, body, payload_json, ref_table,
  ref_id, visibility (role mask)`. Append-only. Every other table's meaningful change emits
  one. Types: `lead_created, appointment_set, estimate_started, proposal_sent, signed,
  deposit_paid, work_started, photo_added, change_order, draw_requested, inspection,
  material_delivery, crew_scheduled, payment, review_requested, warranty_milestone, note,
  message, attention` (the AI PM's surfaced concerns).
- **`project_state`** (new, a *cache/projection*, rebuildable from the log): `job_id,
  health (green|yellow|red), health_reasons_json, percent_complete, expected_margin,
  actual_margin, next_action_json, updated_at`. Never authoritative — always derivable.
- **`comm`** (new): unify calls/texts/emails/receptionist transcripts → `customer_id,
  job_id, channel, direction, ts, summary, body, audio_ref`. Feeds the timeline.
- **Photo** gains intelligence columns: `phase (before|progress|after|damage|proposal|
  warranty|marketing|inspection), trade, ai_tags_json, suggested_by_pack (bool)`.

Principle: **the log is truth; everything else is a projection that can be rebuilt.** That's
what makes the AI layer swappable and the data future-proof (the "10-year" test).

---

## 6. UI/UX philosophy

- **Conversation-first, UI-as-fallback.** The default interface is Bid Brain. Screens exist
  for when *looking* or *typing* beats talking (a photo grid, a draw package preview). The
  button bar should get *shorter* as capability grows — new powers arrive as conversation +
  suggestions, not new tabs.
- **The Project = a timeline, not a dashboard of forms.** Open a job and you see its story
  (newest first) with the Health Score and the one next action on top — not 14 empty fields.
- **Never a bare status.** Every color, badge, and alert states *why* and *what to do next*.
- **Zero data-entry tax.** State updates as a byproduct of work. If a feature requires the
  contractor to "remember to update" something, it's designed wrong — the AI should infer it
  or ask once, in context.
- **Glanceable on a phone, on a roof, in the sun.** Mobile-first, high-contrast, voice-ready,
  offline-tolerant (the patterns we already hold).

---

## 7. AI workflow architecture

- **Write path:** every surface action → a `timeline_event` (cheap, deterministic, no LLM).
- **Watch path (the AI PM):** a daily tick (v1) / event triggers (v2) run **deterministic
  watchers** over the log + pack + company brain. A watcher = pure function returning zero or
  more `attention` events with a cited cause and a proposed `[[action]]`. *No LLM in the
  detection path* — detection must be trustworthy and free. Examples: `invoiceOverdue`,
  `unsignedChangeOrder`, `inspectionUnscheduled`, `scheduleGapTomorrow`, `marginUnderBid`,
  `drawReady`, `warrantyMilestone`.
- **Phrase/act path (Bid Brain):** the LLM turns surfaced events into natural language, the
  briefing, and proposed actions — and executes via the existing directive framework. Costs
  are bounded: LLM only on *surfacing/acting*, never on *watching*.
- **Learn path (Company Brain):** on `job closed`, a short post-mortem writes structured
  learnings (margin accuracy, labor variance, winning upsells, common objections) into the
  brain overlay, sharpening future packs *for this company*.
- **Guardrails:** every proactive line cites a real event; if data is thin, say so; LLM
  output that proposes money/legal actions (CO, stop-work, draw) always requires human
  confirmation. Trust over cleverness.

---

## 8. Smallest MVP that creates a true "wow"

**The Living Project Timeline + explainable Health + "what needs you today" — built as a
projection over a thin event log, seeded entirely from events we ALREADY emit.**

Scope:
1. Add `timeline_event` + `customer` + `project_state` (rebuildable).
2. **Backfill the timeline from existing actions** — lead created, bid sent, signed, deposit
   paid, draw, change order, scheduled. *No new contractor data entry.*
3. Open a job → its timeline + a Health Score that explains itself + the one next action.
4. A **daily server tick** runs ~5 watchers (overdue, unsigned CO, unscheduled inspection,
   idle day, draw-ready) → `attention` events → surfaced in the existing briefing.

**Why it's the wow:** the contractor does *nothing extra* and BidVoice already knows the
state of every job and what's at risk — *"how did it know that?"* That's the moment they
can't go back from. It reuses the entire stack (jobs, payments, draws, COs, briefing, pack)
and the only new infra is one table + one daily tick.

**What it deliberately is NOT (yet):** real-time monitoring, full photo-vision tagging,
voice change orders, the comms unifier, telephony receptionist. Those are the roadmap — each
becomes another writer/reader of the same timeline.

---

## 9. Three-year roadmap

- **Year 1 — The spine + proactivity.** Customer entity + Timeline + Health/next-action +
  daily Watchers + briefing/interruptions (M3). The AI Receptionist (Phase 2) as the
  timeline's first external writer. Photo Intelligence v1 (pack-guided capture + phase
  tagging). Zero-assembly draws. *Outcome: nothing falls through the cracks.*
- **Year 2 — The autonomous office.** Real-time event watchers; voice change orders that
  ripple; Stop/Resume work orders; Profit Radar (live margin); unified comms; the
  lifecycle engine (reviews → referrals → warranty → maintenance → repeat). Company Brain
  post-mortems compounding. *Outcome: BidVoice runs the office; the owner is no longer the
  bottleneck.*
- **Year 3 — The compounding moat & new interfaces.** Cross-project intelligence (bid/schedule
  benchmarking from the company's own history), crew/team mode by role, supplier + material
  ordering loops, and interface expansion (phone, wearable, on-site vision) — all the same
  intelligence, new surfaces. *Outcome: a company that gets measurably smarter and more
  profitable every project.*

---

## 10. What makes a contractor say "I can never go back"

Not a feature — a *feeling*, three of them:

1. **"It already knew."** The overdue invoice, the unscheduled inspection, the idle Friday —
   surfaced before they noticed. They stop carrying the business in their head.
2. **"I just said it and it was done."** Change order, draw, follow-up — one sentence, fully
   rippled. The clipboard and the data-entry tax are gone.
3. **"My new guy bids like me."** The company's judgment, available to everyone — the owner
   stops being the single point of failure.

When those three are true, BidVoice isn't software they use. It's the employee they can't
imagine working without — and they're not comparing us to Buildertrend anymore. They're
comparing us to **hiring an office manager.** Different category. That's the win.

---

### Recommended sequencing (my co-founder call)

Build the **Customer Timeline spine + customer entity first** — it is the Phase-1-style
foundation that the receptionist *and* the AI PM both consume. Then the **AI Receptionist**
becomes its first writer (lead → customer → job, no duplicate data, no repeated questions —
exactly your "begin the journey" principle). Then the **Watchers + Health** turn it
proactive. One spine, many surfaces — the same pattern that made Phase 1 succeed.

*No code written for this yet — this is the design for your review and challenge.*
