# Release Review — how we ship (working agreement)

> Our goal isn't to release quickly. It's to build the contractor operating system
> people recommend because it feels unlike anything they've used. Nothing ships
> because it's "good enough." We optimize for delight, trust, and craftsmanship.

## How we work
- **Build on the feature branch.** All development stays on the feature branch until
  the founder explicitly approves a merge to production. Claude never merges to
  `main` without that explicit go.
- **Don't let deployment mechanics slow product work.** A branch preview is worth it
  only if it's quick and reliable (a few minutes). If preview tooling becomes a
  distraction, skip it and keep building.
- **Own quality (CTO mandate).** Beyond building features, continuously audit the
  whole product for inconsistencies, friction, visual imperfections, and chances to
  simplify. Fix it — or propose a better solution — before the founder has to ask.
- **Challenge readiness.** If a feature isn't ready, say so. We'd rather delay a
  release than ship something that weakens the product or trust.

## Release Checklist (complete before every merge)
- [ ] **No placeholder UI** — nothing reads as a missing asset or a dead control.
- [ ] **No system emojis in the interface** — use our custom icon system. (Exception:
      country flags in the language picker, which are inherently emoji.)
- [ ] **Revenue, jobs, and dashboard metrics verified** against real data.
- [ ] **Every button has a clear purpose** — and communicates it without explanation.
- [ ] **Mobile experience tested** (iPhone + Android, installed PWA).
- [ ] **Dark mode looks premium** (and light mode is clean).
- [ ] **No broken links or console errors.**
- [ ] **Onboarding feels polished** — the first 30 seconds earn a smile.
- [ ] **Bid Brain conversation feels natural** — like an employee, not a chatbot.
- [ ] **Animations are smooth** (60fps; reduced-motion respected).
- [ ] **Voice interactions work** end-to-end (record → transcribe → respond).
- [ ] **Overall experience feels intentional and production-ready.**

## Standing audit backlog (quality debt to retire before the next big merge)
- **System-emoji sweep.** Audit found ~139 emoji glyphs across ~301 UI lines.
  Flagship surfaces (Bid Brain companion + onboarding) are being moved to the custom
  icon system first; the long tail (trade pickers, growth, settings, inbox, etc.)
  follows. Flags stay.
- **Front-end modularization.** The UI is one inline `public/index.html` (~340KB) —
  great for zero-build speed, a scaling risk long term. Retire deliberately.
