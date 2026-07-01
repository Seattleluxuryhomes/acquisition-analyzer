# The Home Screen — from brochure to AI Operating System (design, no code yet)

> **Brief (founder's):** stop making small UI improvements — challenge the page's *purpose*.
> It should be the emotional center of BidVoice. A contractor lands and feels *"I hired an AI
> employee,"* not *"I'm reading about software."* Alive, interactive, personal. Design like a
> $100M software company. Think Apple / Linear / Tesla. **Do not design a dashboard — design an
> AI operating system.**

## 0. Challenge the page itself (the first decision)

The screenshot is `viewWhy()` — a **marketing brochure living inside the paid app** (feature
cards: "Talk instead of type," "One bid, two languages"…). A contractor who already bought the
product does not need to be sold the product. **So the page's purpose dies.** Two moves:

1. **The value-story (the cards) relocates** to where it belongs — **logged-out marketing +
   first-run onboarding**, for *prospects* who haven't bought yet. It's not deleted; it's
   moved to its real audience.
2. **The emotional AI-OS experience the brief describes becomes the HOME** (`viewHome`) — the
   first thing every contractor sees every morning. There aren't two screens here; there's one
   home that finally feels like the employee.

This also fixes a redundancy: today there's a `viewHome` *dashboard* (greeting + daily insight +
revenue hero) **and** this `viewWhy` *brochure*. We collapse to one living home and retire the
brochure-in-app.

---

## 1. THE constraint that makes this trustworthy (read this first)

The brief's hero is perfect — *"I answered two calls while you were working. Booked one estimate.
Collected one deposit."* — **for a contractor who actually has that activity.** For a brand-new
user with no data, every one of those lines is a **fabrication** — the exact thing our Trust
Architecture and north star (*"the AI professionals trust with their reputation"*) forbid.

So the single most important design rule: **alive and personal must NEVER mean invented.** Every
proactive line is grounded in a real event or it does not appear. This is precisely what will
make our home feel trustworthy when every other SaaS "Welcome back, here's your fake activity"
feels hollow. The home is **state-aware** (§4): it says exactly as much as the data truthfully
supports, and not one word more.

**The beautiful payoff:** this makes the Home the **first real reader of the Customer Timeline
spine** we just built. The "show the AI working" stream = *real* `timeline_event`s. The briefing =
the briefing engine + `project_state` health. The page can only feel alive because the events
under it are real — which is the whole thesis of BidVoice, expressed as a screen.

---

## 2. Anatomy (top → bottom, calm and spacious)

1. **Time-aware greeting** — "Good morning, Mike." (name from settings, time from device). Big,
   warm, human. One line.
2. **The Orb — the centerpiece, not decoration.** Large, centered, softly glowing and breathing
   (the living states we already built). It *is* the page's focal point — Bid Brain waiting for
   instructions. Tap → the conversation overlay (built). With voice on, it *speaks* the briefing
   (the voice loop we built). The orb is the one piece of motion that earns the spotlight;
   everything else stays still around it (Tesla/Apple restraint — one hero motion, calm elsewhere).
3. **The Living Briefing** — 2–4 short lines in an employee's voice, **each grounded in a real
   event**, ending in a question: *"…One proposal is waiting for a signature. Want me to follow
   up?"* Tapping a line jumps to that job/customer (it's a real timeline event with a `refId`).
   Source: `BRAIN.briefing` (paid, signed, awaiting-signature, follow-ups) — already real.
4. **Primary Actions — a few large, beautiful buttons** (not a utility grid):
   🎤 **Start an Estimate** · 💬 **Talk to Bid Brain** · 📅 **Plan My Day** · 📷 **Analyze Photos**
   · 🌐 **See My Website.** Voice-first is visually dominant. (Custom icons, not emoji — our system.)
5. **"It's already working" — the Activity Stream.** Recent **real** `timeline_event`s rendered
   as living proof: *Estimate created · Deposit collected · Review requested · Website captured a
   lead.* Honest by construction — it shows only what truly happened (see §3 for the honesty caveat
   on receptionist lines). Empty → it gracefully yields to ▶ Experience BidVoice.
6. **▶ Experience BidVoice** — one large button → an **AI-guided interactive experience** (not a
   tutorial) that runs the whole story on sample data clearly marked *demo*: call → receptionist →
   appointment → estimate → sign → deposit → project managed → review → referral. This is the
   "show, don't tell" that replaces the cards — and it's how a brand-new contractor *sees it
   working* without us faking *their* data.
7. **The Story (ambient, optional)** — a single quiet animated line of the continuous flow
   (lead → … → referral) as reinforcement, never a feature list. Subtle; cut if it adds noise.

A calm, secondary **revenue line** (Contracted / Collected) stays available but is no longer the
hero — and every number carries its trust indicator (§ Trust Architecture). The home leads with
the *employee*, not the metrics.

---

## 3. Honest pushback on three specifics in the brief

As co-founder, three things in the brief would break trust if taken literally today:

- **"📞 Receptionist answered 3 calls" — we can't say this yet.** The receptionist (Phase 2,
  telephony) isn't built. Showing receptionist activity before the receptionist exists is the
  exact fabrication we banned. The activity stream shows **what's real today** (estimate created,
  signed, deposit collected, review requested, website lead) and adds receptionist lines the day
  that ships — not before.
- **"You worked until 6:42 yesterday" — only if we actually know it.** Cute, but if it's inferred
  loosely it feels creepy/wrong. Show it only from a real signal (last activity timestamp), or not
  at all.
- **"Congratulations on closing the Johnson project" — yes, because it's a real event.** This one
  is perfect *and* honest — it's a `signed`/`won` timeline event. That's the template for all of
  it: emotional *because* it's true.

The rule that resolves all three: **map every hero line to a real event source; if there's no
source, the line doesn't exist.** (A table in the build spec will list each candidate line →
its event source → "real today / needs spine wired / needs receptionist.")

---

## 4. The three states (the heart of the design)

The same home, scaling honestly with the data:

- **New (no activity).** No fake briefing. An honest, warm, aspirational hero: *"You're all set
  up, Mike. Let's land your first bid."* → giant **Start an Estimate** + **▶ Experience
  BidVoice** (so they feel it working without faking their numbers). Delight without dishonesty.
- **Warming (some activity).** A short, real briefing + a few real activity items + the actions.
- **Established (rich).** The full brief vision — *"I booked an estimate and collected a deposit
  while you were out; one proposal's waiting on a signature. What's next?"* — earned, every line
  true. The orb speaks it.

This is the part most products get wrong (they fake state 3 for everyone). Doing it honestly is
our differentiator, not our limitation.

---

## 5. Design language (Apple / Linear / Tesla)

Large typography, minimal words, generous spacing, dark and premium, **motion with purpose**:
the orb breathes and the briefing fades in; nothing else jitters. 60fps, `prefers-reduced-motion`
respected, off-screen pause (we have the orb infra). Remove chrome — the trial chip and bell get
quieter; the page is the orb + a few words + a few big actions. **Nothing busy.** The test for any
element: does it earn the contractor's attention this morning?

---

## 6. The four gates (apply to every element; cut what fails)

| Element | Reduces work? | Delight? | Builds trust? | Feels like an employee? | Verdict |
|---|---|---|---|---|---|
| Living briefing (real events) | ✓ (surfaces what needs you) | ✓ | ✓ (grounded) | ✓✓ | **Keep — the core** |
| Orb centerpiece + voice | ✓ (talk, don't tap) | ✓✓ | ✓ | ✓✓ | **Keep — the hero** |
| Big primary actions | ✓ | ✓ | – | ✓ | **Keep** |
| Real activity stream | – | ✓ | ✓✓ | ✓✓ | **Keep** |
| ▶ Experience demo | – | ✓✓ | ✓ (labeled demo) | ✓ | **Keep (esp. empty state)** |
| Feature cards | ✗ | ✗ | ✗ | ✗ | **Remove → marketing/onboarding** |
| Big revenue hero | – | – | ✓ | – | **Demote to a calm, trust-tagged line** |
| Ambient story animation | – | ✓ | – | – | **Optional; cut if noisy** |

---

## 7. What it reuses (systems-thinking, not a rebuild)

The living orb + 8 states, the conversation overlay + voice loop, the briefing engine
(`memory.js`), the **Customer Timeline + `project_state`** (this is its first reader — proving the
spine end-to-end), and the Trust indicators on any numbers. We're not inventing new infrastructure
— we're giving what we built its emotional front door.

## 8. Honest scope & risks

- **It only sings with real data.** That's a feature (forces honesty) but means the Home's punch
  scales with the timeline being *wired to read* — so this redesign is also the natural moment to
  light up the spine's first read path. (No fake data to compensate.)
- **"Experience BidVoice" is a real build**, not a label — a guided, scripted walkthrough on
  clearly-marked sample data. Scope it as its own milestone; v1 can be a short guided overlay, the
  full cinematic demo later.
- **Low-end Android** (the screenshot's device): keep the animation budget tight — one hero motion
  (orb), calm elsewhere; the off-screen pause we built protects battery.
- **Don't over-animate.** The brief says "premium animation," but Apple/Tesla restraint means
  *less* motion, not more. One thing moves with intention; the rest is still and spacious.

## 9. MVP — the smallest version that delivers the feeling

Orb hero + **event-grounded** living briefing + 3 big primary actions + a **real** activity stream
+ the honest empty state + **▶ Experience BidVoice**. Defer the full cinematic guided demo and the
ambient story animation. This alone turns the brochure into the home a contractor opens every
morning — and it does it *truthfully*, which is the only way it builds the trust that is the whole
product.

---

---

# PART II — Detailed design (the founder's "one job" principle)

> **APPROVED:** retire the in-app brochure (value-story → website / welcome / interactive demo /
> onboarding — the paid app never sells itself, it immediately helps); build the new Home as the
> first real consumer of the Customer Timeline spine.

## 11. The Home has ONE job

Every morning the contractor opens BidVoice and immediately knows **"what only *I* need to do
today."** Everything else, BidVoice quietly handles. The Home is **not** a dashboard, notifications,
reports, analytics, or marketing. It is a **morning briefing from the contractor's AI employee** —
the office manager saying: *"Good morning. I already took care of what I could. Here's what only
you need to do."*

This sharpens Part I: the Home is not a *feed of what happened* — it is a **filtered triage of what
requires the human.** Everything on screen is either (a) something only the contractor can decide/
do, or (b) honest reassurance that the rest is handled.

## 12. The AI filters (restraint is the feature)

- **Twenty things happened → surface the top three.** Ranked by **materiality** (dollars, deadlines,
  risk to trust), not recency or count.
- **Nothing important happened → say so, confidently:** *"Everything's on schedule. No customer
  needs you today."* That confident "all clear" is a *feature*, not an empty state — it's the
  feeling of a well-run office. (And it must be *true* — see §15.)
- **Never a count, never a badge.** "3 things need you," not "🔴 17." The number the contractor
  cares about is *how few* things need them — because the rest is handled.

The triage source is what we already built: the **AI-PM `attention` feed** (deterministic,
event-cited) + `project_state` health + the briefing — filtered to the vital few.

## 13. The card contract (every card must justify its existence)

A card may appear **only if it answers all three** — or it's removed:

```
WhyHere   — the real event/rule that surfaced it      (grounding; from the attention event)
WhyNow    — why today, not yesterday or next week      (the trigger: overdue, arriving, signed)
WhatToDo  — the single obvious action                  (one tap: Follow up · Approve · Schedule)
```

This is literally the `attention` event shape from the timeline spine: `reason` = WhyHere,
the trigger condition = WhyNow, `action` (a `[[directive]]`) = WhatToDo, `eventId` = the citation.
**If a candidate card can't fill all three from real data, it does not render.** No filler, ever.

## 14. Designed to *reduce stress* (the anti-dashboard)

Most business software manufactures anxiety: red badges, unread counts, charts, warning lists.
We design the **opposite** — the contractor should feel *organized, in control, "my office is
running."* Concrete rules:

- **No red badges, no unread counts, no charts on the Home.** Calm dark canvas, generous space,
  the orb, a few words.
- **One focus at a time.** The top thing that needs them, large. The next one or two, quieter.
  Nothing competes.
- **Reassuring language over alarming language.** "Mrs. Smith hasn't signed — want me to follow
  up?" not "⚠️ OVERDUE: 1 unsigned proposal."
- **The orb is calm.** Soft breathing, not pulsing urgency. Urgency is reserved for genuine red
  (a real `red` health item), and even then it *explains and offers the fix*.

That calm is part of the product — the 6:30 AM feeling (§17) is a design requirement, not a vibe.

## 15. The Home never lies (trust, applied to the morning)

Grounded only in **timeline events · project_state · Company Brain · verified data.** If nothing
happened, nothing happened — we say "all clear," we don't invent activity. Two honest limits to
hold the line on:

- **"I handled everything I could" only if we actually did.** Today BidVoice automates little, so
  the honest early Home says *"Here's what needs you; the rest is on track,"* not *"I handled 17
  things."* The "I handled X" line grows true as automation (reviews, follow-ups, the receptionist)
  actually ships — and each claim cites the real action.
- **"All clear" must be earned.** It renders only when the deterministic watchers find no open
  material item — never as a default. A false "all clear" is the worst lie we could tell (it hides
  a real problem), so the watchers that back it are the most important code, not the prettiest UI.

## 16. The Home gets more valuable every month (the moat, on the home screen)

Designed to deepen as the Company Brain evolves:

- **Week 1 — useful.** It surfaces the few real things that need the contractor (from their
  timeline) and confidently handles the "all clear." Immediately less to remember.
- **Month 3 — personalized.** The Home *learns what matters to **this** contractor.* The filter is
  not static: which "needs you" items they **act on vs. dismiss** tunes the ranking (the R&D/
  Company-Brain loop applied to triage). It learns their hours, their priorities, which customers
  they chase, what they ignore — and surfaces accordingly. It starts to prioritize like they do.
- **Year 2 — impossible to leave.** The Home reflects an accumulated brain: every customer's
  history, the owner's standards, years of patterns. The switching cost isn't the features — it's
  that *BidVoice understands how they run their business,* and a competitor starts from zero.

The mechanism is honest and owned: the Home's ranking is a function over the contractor's **own**
timeline + their **own** act/dismiss behavior + the Company Brain. It personalizes from evidence
they generated, not from guesses — so "BidVoice understands my business" is *earned*, never faked.

## 17. The final test (the acceptance criteria)

A contractor opens BidVoice at 6:30 AM before the first job. They should feel **calm, prepared,
organized, confident, supported.** If the Home creates those five feelings, we succeeded. **If it
feels like software, start over.** This is the literal pass/fail for the design — not engagement,
not clicks, not time-in-app (which we'd actually want to be *low* — get them out the door informed).

## 18. Revised MVP (triage-first)

1. **"What needs you today"** — the top 1–3 open `attention` items from the spine, each satisfying
   the card contract (WhyHere / WhyNow / WhatToDo), one-tap action, materiality-ranked. 2. The
   **honest "all clear"** state when the watchers find nothing material. 3. The **orb** delivering
   it (tap to talk — the unified Bid Brain interface). 4. **Calm design** — no badges, no counts, no
   charts; one focus; reassuring language. 5. A quiet, real activity line ("on track") + a calm
   revenue line, both grounded.

Defer (each needs data/automation we don't have yet, and we won't fake them): the learned/
personalized filter (needs act-vs-dismiss history), the "I handled N things" line (needs real
automation), and the full cinematic demo. Build the honest, calm, filtered triage first — it
already delivers the 6:30 AM feeling, truthfully.

---

*No code. The Home's job: surface what only the contractor must do today, handle/reassure the rest,
never lie, and get smarter every month from their own data. The decision to confirm: build the
triage-first MVP (§18) over the Timeline spine's `attentionFeed` + `project_state`, with the calm,
restraint-first, anti-dashboard design as a hard requirement — measured by the five 6:30 AM
feelings, not by engagement.*

---

# PART III — Post-dashboard: the Home is a *briefing* (the governing frame)

## 19. Why dashboards exist — and why AI makes them obsolete

A dashboard is a wall of gauges because the software **couldn't think** — so it offloaded
*interpretation* onto the human and made them the analyst. That was the right design when software
couldn't reason. It can now. So the model inverts: **the AI does the interpreting** (the analyst /
chief-of-staff job) and hands the contractor a **briefing** — conclusions and decisions, not
gauges. A dashboard inside an AI product is a horse-drawn carriage with an engine bolted on. We
delete the dashboard not to simplify the UI, but because its entire reason for existing is gone.

## 20. One correction to the metaphor (co-founder note)

"Mission Control" is right in **function** — someone owns the complexity so you don't — but wrong
in **aesthetic**: NASA's Mission Control is a *wall of monitors*, which is exactly the dense
dashboard we're killing. The truer models for the *feeling* are the **F1 race engineer's radio**
and the **chief of staff's morning note**: a single calm voice that absorbed the firehose and
hands the principal only what they need. We borrow Mission Control's **intent, not its look.**

## 21. What the best briefings share (the research, distilled)

- **Executive / chief of staff / elite EA** — pre-digest the firehose into a one-pager; surface
  *decisions*, not data: "here are the 3 calls only you can make today."
- **Military commander's brief** — **BLUF: Bottom Line Up Front.** Conclusion first; situation →
  what it means → recommendation → decision needed. *Commander's intent* so the team acts without
  asking.
- **Aviation crew brief** — **exception-based**: only deviations are briefed; normal is assumed
  handled. Threats-&-errors: what could go wrong today and the plan.
- **Hospital handoff (SBAR / I-PASS)** — Situation, Background, Assessment, **Recommendation**; an
  explicit **action list**; and **anticipatory guidance** ("if X, do Y"). Severity-tagged. The
  receiver instantly knows what needs them.
- **F1 race engineer** — the driver can't process telemetry at 200 mph; the engineer filters it to
  **one calm, perfectly-timed instruction.** Minimal words, only what's needed *now*, calm even in
  crisis.

The five traits (founder's): **short, relevant, actionable, calm, trustworthy.** The mechanics that
produce them: **BLUF · decision-centric · exception-based · anticipatory · layered.**

## 22. The briefing grammar (this is the structure of the Home)

The Home is the AI office manager's morning handoff, in this order — *not* widgets:

1. **BLUF** — one sentence: state of the business + does anything need you. *"Morning, Mike. The
   business is on track — one thing needs you."* The headline is how *few* things need them.
2. **What only you can decide** — the 1–3 decisions, each stated bottom-line-first with a
   **recommendation** + a one-tap action. *Decisions, not data.* (Real `attention` events, ranked
   by materiality; each satisfies the card contract, §13.)
3. **Handled / in motion** — exception-based, brief, **honest**: only what truly happened or is
   progressing. Reassurance, not a feed. *"Two proposals are out and being read; the Johnson
   deposit cleared."*
4. **What I'm watching (anticipatory)** — the SBAR/F1 move that removes worry by pre-committing the
   plan: *"If the Smiths don't sign by Friday, I'll nudge them — nothing for you to do."*
5. **Done.** The brief ends; the contractor leaves for the job. A great brief gets you *out the
   door*, not staring at a screen.

Delivered by the **orb, spoken** (the voice loop) — like a person briefing you, not text read off
gauges.

## 23. Two properties a briefing has that a dashboard never does

- **It's a moment, not a place.** A handoff is an *event* you receive and walk away from — fresh
  each open, **time-aware** (a morning brief, a midday check-in, an end-of-day recap are *different*
  briefings), and content to say *"nothing new since 9 a.m."* A dashboard is ambient and persistent;
  a briefing is temporal and ephemeral. The Home should feel like a moment, not a monitor.
- **It's layered (BLUF + drill-down).** Skimmable in 5 seconds; the supporting detail is one tap
  away, never on screen. The commander reads the bottom line and drills only if needed.

## 24. Every system feeds the one briefing (the synthesis, not the sum)

The briefing is the **single filter** over everything we've built. Each system contributes events;
the briefing alone decides what — if anything — rises to the contractor. **None of these gets its
own widget on the Home.**

| System | Contributes | Surfaces only if… |
|---|---|---|
| Receptionist | calls/leads handled, bookings | a lead needs a human decision |
| PM / Health | at-risk jobs (cited) | a job is red/yellow and needs them |
| Scheduling | today's plan, gaps, conflicts | a conflict or an empty day needs a call |
| Payments / Draws | money in, draw-ready, overdue | a draw is ready or a payment is overdue |
| Change / Stop-Work | pending approvals | something awaits the contractor's sign-off |
| Reviews / Referrals | earned opportunities | a delighted customer is worth asking now |
| Website / Marketing | leads captured | a new lead needs follow-up |
| Trust System | what needs verification | an assumption is blocking a send |
| Company Brain | how *this* owner prioritizes | — (it shapes the *ranking*, not a card) |

The Home is the **synthesis** of all of it into one calm experience — the office manager who read
everything so the contractor reads one line.

## 25. Honest scope (same discipline, applied to the briefing)

The **grammar** ships now; the **content** is bounded by real data + real automation. Early: BLUF +
"what needs you" (real `attention` events) + an honest "on track" + a modest "watching." The "I
handled N things" line and rich anticipation grow as the receptionist/automation actually *do*
things — each claim citing the real action. We ship the briefing *structure* truthfully and let it
fill in; we never fake the "handled" line to make the brief look busier. A briefing that honestly
says "one thing needs you, the rest is quiet" is the product working — not an empty state.

## 26. The test (sharpened)

6:30 a.m., before the first job: **calm, prepared, organized, confident, supported — then gone,**
out the door, informed and lighter. If they linger and study it, it's still a dashboard. If they
*receive* it and leave, it's a briefing. That — not engagement, not time-in-app — is the win.

---

*No code. Parts I–II are the anatomy; Part III is the philosophy that orders them: the Home is not a
dashboard, it is a briefing from your AI employee — BLUF, decision-centric, exception-based,
anticipatory, calm, and honest — synthesizing every system into the single answer to "what only
needs my attention right now?" Build the triage/briefing MVP over the Timeline spine; measure it by
the 6:30 a.m. feelings, not by clicks.*
