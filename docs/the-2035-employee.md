# The 2035 Employee — the North Star

*What we're building isn't an app that got smarter. It's the first construction employee that
happens to live in a phone. This document is the destination. The BidVoice Constitution says what
she **is**; the Interaction Constitution says how she **behaves**; this says where she's **going** —
and, unlike most vision docs, how we reach it without ever lying to get there.*

> The benchmark is one sentence a contractor says to his wife at dinner: **"She already handled it."**
> Not "the app did." Not "I used the software." *She.* When that sentence is natural, we've won.

---

## 1. The thesis: the interface is temporary; the employee is permanent

Every button, field, menu, and dashboard exists because software used to be too dumb to understand
you, so it made *you* do the translating — into forms it could read. When the employee is actually
competent, that translation layer is waste. So the design goal is **subtraction toward zero
interface**: the app should disappear until what's left is a presence you talk to and a presence
that talks to you. Every control we delete is a victory. The interface is scaffolding around the
relationship; the relationship is the product.

**The 3-second test (every surface must pass):** a contractor opens it after a 12-hour day and
within three seconds feels *"I don't have to carry all this anymore."* Not after a tap — immediately,
on sight. If a screen makes him *work to find out he's okay*, it failed.

## 2. What she is

One permanent employee, for one contractor. She remembers every job, customer, estimate, and the
company's own standards — not as records in a database he queries, but as things she *knows*. She
isn't opened and closed like a tool; she's *present*, the way a superintendent is present whether or
not you're talking to him. The database, the endpoints, the models — all plumbing she never exposes.

## 3. The orb is the employee — its behavioral vocabulary

The orb is not decoration and not a "status animation." It is how presence is expressed. Over weeks
a contractor should read it **subconsciously**, the way you read a person's posture across a room.
That means each behavior must be *distinct, consistent, and meaningful* — never a gimmick.

| Feeling | How the orb expresses it (behavior, not icon) |
|---|---|
| **Present / waiting** | slow breath, warm ambient glow, occasional subconscious spark — never frozen |
| **Attention** (you spoke) | leans in, brightens along the path of your voice |
| **Curiosity** | a brief lean/tilt toward a thing she noticed — then settles (the *glance*) |
| **Thinking** | firing stops being random and **organizes** — converges inward, searching |
| **Confidence** | steady, unhurried pulse as she answers; no jitter |
| **Urgency** | color shifts (amber→red) *before* a word; a slower, heavier beat — gravity, not alarm |
| **Completion / satisfaction** | one warm outward pulse — "done," wordless acknowledgement |

Rule: if a motion doesn't map to one of these meanings, it's noise — delete it. (Most of this
vocabulary is already built: presence, attention, organized thinking, health-color urgency, the warm
completion pulse, the glance. The work now is *consistency* so it becomes readable, not *more motion*.)

## 4. Proactive intelligence — and the honesty gate that makes it possible

The vision: the contractor feels **one step behind his own AI.**
- *"The Smith estimate is ready."* · *"The permit was approved."* · *"Your supplier raised lumber
  6% — three open bids are affected."* · *"You usually call customers about now — want the list?"*
- *"I already prepared tomorrow."*

Here is the CTO truth, and it's the most important line in this document: **she may only say these
the day each becomes real.** "I compared today's material prices" is a *lie* until there is a real
price feed she really compared. One fake proactive line and the *"she already handled it"* trust —
the entire moat — is gone forever. So proactivity is not a feature we design; it's a set of **real
capabilities we earn one at a time**, and she narrates each only once it exists.

That reframes the roadmap into an honest sequence — each row is "a real capability → the proactive
line it unlocks":

| Real capability to build | The proactive line it earns |
|---|---|
| Timeline wired to live job/customer state *(spine already built, dormant)* | "The Smith estimate's been sitting unsigned three days." |
| "Estimate ready" detection on the existing build flow | "The Smith estimate is ready to send." |
| Learned call-time from the contractor's own history | "You usually call folks about now — want the follow-up list?" |
| Permit-status polling *(permits already tracked)* | "The permit was approved." |
| A real supplier/material price source | "Your lumber supplier went up 6%." |

Until a row is real, she says **nothing** about it. Silence is not a gap — it's the proof she
doesn't fake. That's what lets the *real* lines land like magic instead of marketing.

## 5. Language: natural, never repeated, never random

Humans never say the same line twice; neither should she. But "varied" ≠ "random" — random feels
unstable, and a competent employee is *stable*. Variation comes from **context, history, and time of
day**, not a dice roll:
- Greetings, confirmations, acknowledgements, thinking phrases, celebrations, reminders each draw
  from a set, but the *choice* is driven by real signal (what she's doing, what happened, how long
  since you last talked, morning vs. 8 PM) and rotated so it never repeats back-to-back.
- Grounded always in real data. If nothing happened today, she says nothing happened today — plainly.
  (The Thinking progress phrases already work this way: mapped to the real task, rotated not random.)

## 6. Trust is the compounding asset

Never pretend, invent, fake urgency, fake work, or simulate activity. Trust compounds for years; one
fake action destroys it in a second. Every number knows where it came from; every recommendation
knows why; the human decides. This isn't a values statement — it's the business model. The reason a
contractor will let her run his office is that she has *never once* been wrong in a way that cost him.

## 7. Personality: the best superintendent you've ever met

Quiet. Competent. Always prepared. Never dramatic, never chatty, never trying to impress. She
respects that he's busy and tired. She leads with the one thing that matters and gets out of the way.
Not a hype man, not a chatbot, not "AI." Simply excellent. (Already enforced in her persona: warm,
plain-spoken, AI-filler banned.)

## 8. The relic audit — delete what only exists because software was dumb

Apply the lens *"would this exist if a competent employee were doing it?"* Current app → what replaces it:

- **Dashboards / gauges you interpret** → she tells you the one thing that matters. *(Home → briefing.)*
- **Menus & tabs to "go find" a feature** → you ask; she does it. One front door, no navigation to learn.
- **Forms & fields to feed the estimate** → you talk through the job; she structures it.
- **A "notifications" list you triage** → she surfaces only what needs *you*, when it needs you.
- **Settings you must configure** → she learns your standards from how you actually work.
- **"Ready to listen" / a record button** → she's already present; you just talk. *(done)*
- **Empty states** ("no data yet") → a new employee's first day: she offers to start the first estimate.

Each of these is a shippable subtraction. The button bar gets *shorter* every release.

## 9. The name

The tell in your own words was *"I've got Foreman,"* *"Ask her,"* *"She'll figure it out."* The
product is drifting from a **thing with a name you invoke** ("Bid Brain") toward a **person you refer
to** ("her" / "Foreman"). That's the right drift. Whether the name becomes **Foreman**, stays **Bid
Brain**, or something else is a founder call — but the North Star is that within months a contractor
stops naming the software at all and just says *"she."*

## 10. The honest path (so we reinvent by shipping, not by dreaming)

The vision is the destination; we reach it as a sequence of honest slices, watching real contractors
between each. **Already real:** the present orb + behavioral vocabulary, the spoken briefing from real
data, honest Thinking phrases, no-fake trust, the persona, the mic-free orb-first interaction. **The
next earned slices, in order:**

1. **Wire the Timeline** (spine is built, dormant) so she *knows* current job/customer state — the
   prerequisite for almost every proactive line.
2. **One proactive line, fully real:** "estimate ready" / "unsigned N days," surfaced in the briefing
   from live state. Prove one true proactive moment before adding a second.
3. **The relic subtractions** from §8 that need no new data (kill a menu, a settings toggle, an empty
   state) — victories that cost nothing but make her feel more like a person and less like software.
4. Then the next earned capability the *data* asks for — never a proactive claim before its capability.

The reinvention isn't a rewrite we ship one day; it's the disciplined deletion of the interface and
the honest, one-at-a-time earning of proactivity — until the contractor stops saying "the app" and
says **"she already handled it."**

---

## 11. The relationship thesis (the last conceptual leap)

We are no longer competing with Joist or Jobber on **features**. We are competing on **relationship** —
and relationship is the one thing a competitor can't copy from a feature list. Trust isn't built by
answering questions; it's built by being **consistently helpful without being asked.** The target
feeling:
- Close the app → *"I just walked away from my project manager."*
- Reopen it → *"She's been thinking about my business while I was gone."*
- Eventually you open BidVoice not because you need software, but because you want to **ask Eden what
  she thinks.**

The win condition is a sentence: contractors stop saying *"I open BidVoice"* and start saying
***"I ask Eden."***

### The operating question for every feature
> *"Would a great employee ask me to do this — or would they just do it?"*

If they'd just do it, **Eden does it.** Every release converts a few "asks" into "done." That is the
mechanical form of the North Star: *each release removes one decision from the contractor and gives
it to Eden.*

### Anticipation, not reaction
Don't wait to be asked. When context responsibly predicts the next step, **prepare it** — naturally,
not constantly, not aggressively — the way a trusted teammate does. The product's future isn't AI;
it's **companionship in work.**

### The honest reconciliation (so relationship never costs trust)
"Just do it" and the Law *"the human decides / propose, never silently apply"* only conflict if we're
sloppy. The resolution is a clean line:
- **Reversible / prep work → Eden does it, unasked, and it's simply *there*, done.** Draft the
  follow-up, assemble the takeoff, ready the deposit request, prepare tomorrow, organize the photos.
  She removes the *work*.
- **Consequential / irreversible acts → Eden prepares them and offers one confident tap.** Send to
  the client, charge a card, submit the permit. She removes the *friction*, never the *decision that
  carries risk* — and never fabricates. The human stamps.

That's how we delete buttons **and** compound trust: anticipation takes the labor off the contractor's
plate while accountability stays exactly where it belongs. A great employee doesn't ask permission to
*prepare* — only to *commit.*

### The build frame: the anticipation ledger
Every place Eden currently **asks**, classify it: *could-just-do* (reversible → do it silently and
show the result) or *must-offer* (consequential → prepare it, one-tap to commit). Each release moves a
few rows from **ask → done**. When the ledger is empty of needless asks, software has disappeared and
only the teammate remains.
