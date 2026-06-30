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

## Next up

### 📅 M2 — Bid Schedule (conversational scheduling)  ← immediate next
Scheduling is a daily contractor task; doing it by voice is the clearest proof that
Bid Brain is an employee, not an estimating tool. Lives **under Bid Brain**, not as a
separate calendar app. Everything conversational:
> You: "Schedule an estimate with John tomorrow at 2."
> Bid Brain: "Done — it's on your schedule for tomorrow at 2, with John's address attached."

- **v1 (in-app, no new integrations):** Bid Brain parses scheduling intent
  ("schedule an estimate with John tomorrow at 2", "block Friday morning for roofing",
  "follow up in two weeks", "move my 3 PM to Thursday") and writes to the job's existing
  `scheduled_date`/`scheduled_time` (+ the schedule view we already have). Links to the
  customer record, sets the address, and confirms in the conversation. New `schedule`
  action on the chat endpoint resolves a customer/job + date/time server-side.
- **v2 (Google Calendar sync):** OAuth connect → create the event on Google Calendar,
  invite the customer (if email on file), attach the proposal PDF, add the address,
  set reminders, deep-link Google Maps when it's time to leave.
- **v3 (proactive optimization):** Bid Brain notices opportunities —
  > "You have a 2-hour opening tomorrow afternoon — want me to slot the Smith estimate there?"
  > "This appointment is 40 min from your next job — want me to reorder the day to cut drive time?"

### Beyond (the operations-manager trajectory)
As memory accrues, Bid Brain graduates from recall → action → anticipation:
remember every customer & estimate · learn pricing habits & markup strategy · learn
preferred suppliers · build material takeoffs · prepare material orders · draft
follow-up messages · help schedule crews · monitor jobs · **suggest the next best
action before the contractor asks.**

**Success metric:** a contractor should feel they *hired a full-time employee*, not
downloaded another estimating app.
