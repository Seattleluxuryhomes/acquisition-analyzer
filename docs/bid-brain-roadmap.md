# 🧠 Bid Brain — from companion to AI operations manager

> Vision (fixed): Bid Brain is the contractor's **AI employee** — always present,
> remembers everything, and *does* the work, conversationally. Not another screen.
> Execution (incremental): one production-ready milestone at a time, each making the
> contractor faster / more profitable / more likely to win.

## Shipped
- **M0 — Iconic living mark.** One neural mark, 8 color+motion states, signature
  orbital ring + traveling node, drag-to-edge with memory, idle awake-cue, off-screen
  pause. The generic 🧠 emoji is gone — we own the visual identity.
- **M1 — Conversational companion (`/api/brain/chat`).** One tap opens an in-place
  conversation (never a new page). Grounded in the contractor's live business
  snapshot (jobs, customers, statuses, markup — scoped to their `user_id`) so it
  recalls specifics ("that kitchen remodel" → "Maria Martinez on Main St, proposal
  unsigned"). Talk / Type / Photos / Attach + suggested actions. Continuous: the
  thread persists through the day. Graceful local fallback so it's never silent.
  - Action framework: replies can emit `[[action:…]]` / `[[job:ID]]` directives that
    surface as in-thread buttons (create_estimate, continue_estimate, find_customer,
    **schedule**, order_materials, followups, open_job). This is the hook every future
    "Bid Brain does it" capability plugs into.

- **M2 v1 — Bid Schedule (conversational, in-app).** Bid Brain now *schedules* from
  the conversation: "Schedule an estimate with John tomorrow at 2" → it resolves the
  date against the client's local "now", writes a real scheduled job (customer, address,
  date, time) straight into the existing jobs/schedule store (offline-first sync, no new
  screen), and confirms: "Done — estimate with John tomorrow at 2 PM, saved to your
  schedule." Also handles block-time, reminders, and move/reschedule (find by customer
  or time). NLU on the server (`[[schedule:{…}]]` directive); the client does the write.
  No Google Calendar yet — proving the in-app experience first.

## Next up

### 📅 M2 — Bid Schedule — remaining
Lives **under Bid Brain**, not as a separate calendar app. v1 (above) proves the
in-app experience; from here we deepen and then sync out, one milestone at a time.
- **v1.1 polish:** richer "move" matching, customer-record linking when a prospect
  exists, conflict warnings surfaced conversationally.
- **v2 (Google Calendar sync):** OAuth connect → create the event on Google Calendar,
  invite the customer (if email on file), attach the proposal PDF, add the address,
  set reminders, deep-link Google Maps when it's time to leave.
- **v3 (proactive optimization):** Bid Brain notices opportunities —
  > "You have a 2-hour opening tomorrow afternoon — want me to slot the Smith estimate there?"
  > "This appointment is 40 min from your next job — want me to reorder the day to cut drive time?"

### 🌅 M3 — Daily Briefings & Interruptions (real initiative)  ← after this branch is polished
The reframe (founder's call): these are **not "notifications."** They're an employee
keeping you informed — Bid Brain quietly running the business in the background and
speaking up only when it's *meaningful, timely, and true*. Every one fires from a
**real event**, never fabricated intelligence.

The cadence:
- **🌅 Morning Briefing** — "Here's what happened overnight." (the briefing we just
  built, delivered proactively instead of only on open)
- **☀️ Midday Check-in** — "You have a gap at 2:30. Want me to fill it?"
- **🎉 Celebrations** — "Proposal signed!" · "Jenny just paid a deposit."
- **⚠️ Needs Attention** — "Smith hasn't responded in 7 days." · "A payment is overdue."
- **🌙 End-of-Day Recap** — "Today you sent 3 estimates, collected $1,500, and have
  2 follow-ups ready."

Real triggers only (the guardrail): deposit paid · proposal signed · proposal
unopened N days · customer replied · schedule gap tomorrow · payment overdue.
Build order: in-app interruption cards first (no new infra), then push notifications
once each is wired to a genuine event. **No fabricated intelligence — only meaningful,
timely, real information.**

### Beyond (the operations-manager trajectory)
As memory accrues, Bid Brain graduates from recall → action → anticipation:
remember every customer & estimate · learn pricing habits & markup strategy · learn
preferred suppliers · build material takeoffs · prepare material orders · draft
follow-up messages · help schedule crews · monitor jobs · **suggest the next best
action before the contractor asks.**

**Success metric:** a contractor should feel they *hired a full-time employee*, not
downloaded another estimating app.
