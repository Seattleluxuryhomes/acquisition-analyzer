# BidVoice — Brand Value Backlog

*The CBO's running list of opportunities to make BidVoice more **valuable** (not just
consistent). Ranked by impact on perception/conversion/trust. Ship the safe ones, propose the
identity-adjacent ones. See `docs/brand-steward.md`.*

## Shipped
- **Hero message tightened to one promise** (EN+ES). Cut the six-feature run-on to a single
  outcome: *"Describe a job out loud. Eden writes the estimate, sends the proposal in your
  customer's language, and collects the deposit — in minutes."* Conversion over feature-listing.
  *(2026-07-01)*
- **Real product visual added to the hero** (EN+ES). The demo is now a dark BidVoice **app
  frame** — Eden header + "Building your estimate" status → spoken job → priced bid. Shows the
  product and work happening (confidence, not concepts). Rendered + verified. *(2026-07-01)*
- **Every landing icon reviewed** — the two remaining mic glyphs (hero + "try it" button) both
  replaced with the **B mark**; nothing on the page reinforces mic/dictation/chatbot anymore.
  Try button relabeled "Talk to Eden". *(2026-07-01)*
- **Landing hero microphone → B logo mark** (app-icon treatment). *(2026-07-01)*
- **Wordmark "Bid Voice" (two words) → "BidVoice"** — CSS flex-gap fix; only rendering caught it.
  *(2026-07-01)*

## Next source of truth: real contractors (per founder)
Website keeps evolving, but **customers now drive it, not imagination.** Priority is
deploy → verify prod → onboard → gather feedback → iterate. Hold further hero polish until
real usage data says what to change. Ideas parked below are candidates, not commitments.

## Watching (benchmark-driven, not yet scoped)
- **Motion consistency** — define one easing/duration system shared by app + landing (Linear's
  restraint), so nothing feels bolted on.
- **OG image** — redesign in the official logo + Archivo once artwork lands (currently system
  font; cosmetic but it's the link-preview first impression).
- **Trust markers** — a tasteful proof strip (contractors served / bids sent) once real.

## Blocking all of it
- **Stale live deploy.** A premium brand serving old code destroys value faster than any fix
  adds it. Getting `bidvoice.ai` onto the current branch is the single highest-value action
  available. (Confirm via `/api/health` → `build`.)
