# Bidtranslator — Product Roadmap

**Vision (fixed):** Bid Brain becomes the **AI Operating System for Contractors** —
a private, per-contractor AI that learns the business and gets smarter every job.
Every new capability plugs into Bid Brain so the intelligence compounds.

**Operating principles (every milestone):**
1. Builds on the previous milestone.
2. Production-ready before moving on.
3. Reuses existing components; no duplicate functionality.
4. Strengthens Bid Brain as the intelligent core.
5. Makes contractors **noticeably faster, more profitable, more likely to win.**

---

## Milestones

### ✅ Milestone 1 — Bid Brain (Memory) — *shipped*
The AI entry point + per-contractor memory foundation. Lands on Bid Brain after
login; context-aware greeting from live data; voice-first mic; learns trade,
language, and typical markup from every estimate and pre-fills the next one.
Memory is a scalable key/value store, strictly isolated per contractor.

### 🔜 Milestone 2 — Bid Brain Companion *(recommended next)*
Evolve Bid Brain from an entry screen into a **persistent, floating, context-aware
AI companion** over the whole app — Siri/Copilot, for contractors. A glowing
animated brain on every screen: tap → panel, hold → listen, double-tap → continue.
Knows what screen you're on; act by voice. This is the **interaction substrate**
every later milestone plugs into. Phased: shell → context awareness → curated
voice commands (reliability over vocabulary).

### 🔜 Milestone 3 — Bid Brain Vision (AI Takeoff)
Turn hours of manual estimating into minutes. Contractor speaks + scans the job;
Bid Brain performs the **takeoff** (quantities with waste + components), prices
materials & labor, builds the estimate and proposal, and produces a **send-ready
material order**. Reuses the existing trade brains + material scanner. Becomes a
command into the Companion ("Bid Brain, do the takeoff").

### 🔜 Milestone 4 — AI Material Ordering
One-tap purchasing. Bid Brain sends the purchase order to the contractor's
preferred supplier, schedules delivery, adds the cost to the job, and updates
expected profit automatically. Builds on M2's takeoff + material order.

### 🔜 Milestone 5 — AI Business Coach
Bid Brain turns the accumulated memory into advice: pricing improvements, margin
leaks, which leads are most likely to close, upsell suggestions, follow-up nudges.
Builds on M1–M4 data.

### 🔜 Milestone 6 — Autonomous Project Manager
Bid Brain runs the job: scheduling, crew dispatch, follow-ups, review requests,
profitability tracking — proactively. The "AI employee" fully realized.

---

## Backlog / Future ideas (captured, not scheduled)

### 🏡 Property Services AI — candidate go-to-market wedge
A simpler vertical than remodelers, and likely an *easier first market*: cleanup,
junk removal, exterior cleaning (pressure/soft wash), yard services, and
construction prep. These operators don't need a 24-trade estimator — they need
"talk → estimate → schedule → get paid," which makes for a faster first "wow" and
cheap land-and-expand (start with cleanup, grow into landscaping/fencing/painting/
remodel on the same platform).
- *Mostly content, not new architecture:* new trade brains + packaging on top of
  the engine (takeoff, scheduling, before/after gallery, review requests already exist).
- Bid Brain example: *"Clean this property before the painters arrive"* → itemized
  services + labor hours + dump runs + trailer + fees + estimate → creates estimate/
  invoice, schedules crew, maps the dump, before/after gallery, requests the review.
- **Property Ready Mode:** *"Get this house ready for sale / for a remodel"* →
  Bid Brain generates a complete multi-service checklist and runs it end to end —
  the Autonomous-PM vision (M6) made concrete; a true project coordinator.
- Status: **not for immediate development.** Strong candidate for the first vertical
  we point real acquisition at once the core (M2–M3) is solid.

---

*Each completed milestone becomes part of the product story. Update this file as
milestones ship.*
