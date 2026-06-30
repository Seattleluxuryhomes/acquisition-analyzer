# Bid Brain — Product Principles (the north star)

> We're no longer trying to prove that Bid Brain works. We're building something
> contractors genuinely love using. Every feature passes one test:
>
> **Would a contractor tell another contractor about this?**
> If the answer is no, it probably isn't ready.

## The principles

1. **Trust above everything.** Never fabricate information. If Bid Brain doesn't
   know, it says so. If it knows, it's confident. Trust compounds; once broken it's
   extremely hard to earn back.
2. **Remove work, don't add work.** Every release reduces taps, decisions, or minutes
   to complete a task. Adding a feature? Ask what manual work we eliminate at the same time.
3. **Bid Brain should feel proactive.** The best employee notices the important things
   first — opportunities, risks, reminders, completed work — before being asked.
4. **Build for daily use.** Contractors should open this 10–20×/day because it's the
   *fastest* way to run their business. Every interaction reinforces that habit.
5. **Every release creates at least one "wow."** Not from flashy animation — from
   genuinely saving time, making money, reducing stress, or solving a problem the user
   hadn't noticed yet.
6. **Simplicity is a feature.** As we add Takeoff, Scheduling, Material Ordering,
   Intake, Payments, CRM, Websites — the app must get *easier* to use. A feature that
   adds complexity gets challenged; if there's a simpler solution, we propose it.
7. **Challenge each other.** Claude is technical co-founder, not just executor. When
   there's a significantly better product decision, say why. Challenge to improve the
   product — never to argue.
8. **Think long term.** We're not building another contractor app. We're building the
   operating system contractors run their business on for years. Every architectural
   decision supports that.

## Final mission
Every line of code, screen, animation, conversation, and workflow reinforces one belief:
**Bid Brain isn't another AI chatbot — it's the smartest employee in the company.**
Build something contractors don't just use. Build something they *miss when they close it.*

We are not building the best estimating software, or the best AI receptionist. We're
building the **first AI Operating System for the trades.** Every capability — estimating,
the receptionist, scheduler, CRM, marketing, payments, project management, future vision
— should feel like the *same* trusted teammate. The contractor should never think "I'm
opening another feature." They think *"I'm asking Bid Brain to take care of it."*

> **The line:** *The contractor builds. BidVoice remembers, organizes, schedules,
> answers, follows up, and runs the office.*

**Interface-agnostic.** The intelligence is separate from the interface. The same Trade
Intelligence Pack + Bid Brain must be able to power a website, the phone receptionist, a
voice assistant, smart glasses, or whatever device AI brings next. The interface changes;
the intelligence does not.

**The category test (the real north star).** Every feature should feel like the contractor
*hired another employee* — "I hired someone to answer my phones / build my website / follow
up / ask for referrals / write estimates." When it feels like payroll, not software, we've
won.

**The test for every feature:** *Would this make a contractor's day easier tomorrow
morning?* Yes -> right direction. No -> rethink it. (Our deepest moat is the
**Trade Intelligence Pack** — Bid Brain knowing the trade before the conversation even
starts; see `docs/trade-intelligence-packs.md`.)

---

## How we hold these (CTO operating notes)
Written down so the principles translate into decisions, not vibes.

- **#1 × #3 — proactivity is event-grounded, always.** Every proactive line fires from a
  real record (deposit paid, proposal unopened N days, signed, replied, schedule gap,
  overdue). No weather/routing/"insight" until we have the real source. A confidently
  wrong assistant breaks trust faster than a quiet one earns it.
- **#6 × #8 — conversation is how we absorb complexity.** The only way the app gets
  *simpler* while features multiply is if **Bid Brain is the single front door**:
  new capabilities arrive as conversation + intelligent suggestions, not new tabs and
  menus. Working measure — *did this feature shrink the UI surface, or grow it?* If a
  capability needs a new screen, we probably haven't found the Bid Brain-native way to
  ship it yet. The button bar should get shorter over the years, not longer.
- **#4 — earn the opens, don't engineer them.** The target is "fastest path to the task,"
  not engagement for its own sake. If we ever reach for sticky hooks to drive opens,
  that's the anti-pattern. Briefings and interruptions earn the habit by being useful.
- **#2 — every feature ships with a deletion.** When we add, we name the manual step it
  removes. A release that only adds is incomplete.
- **#8 — known architectural debt to retire deliberately.** The front end is one inline
  `public/index.html` (~330KB). Brilliant for zero-build speed today; a real scaling
  risk for an "operating system." We modularize it *before* it bites — without losing
  the no-build simplicity that makes us fast.
