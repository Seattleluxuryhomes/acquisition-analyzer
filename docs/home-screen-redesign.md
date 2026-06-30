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

*No code. Complete vision for review. The decision to make first: confirm we (a) retire the in-app
brochure and move the value-story to marketing/onboarding, and (b) build this as the real Home,
grounded in the Timeline spine — honest by construction, alive because the events are real.*
