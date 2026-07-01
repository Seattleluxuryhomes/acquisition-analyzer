# BidVoice — Brand Value Backlog

*The CBO's running list of opportunities to make BidVoice more **valuable** (not just
consistent). Ranked by impact on perception/conversion/trust. Ship the safe ones, propose the
identity-adjacent ones. See `docs/brand-steward.md`.*

## Shipped
- **Landing hero was a microphone → now the B logo mark** (app-icon treatment). First
  impression read as "voice recorder"; now reads as a premium software brand, consistent with
  the app + PWA icon. *(2026-07-01)*
- **Wordmark rendered as "Bid Voice" (two words) → "BidVoice"**. A CSS flex-gap split the name;
  wrapped it so the logo reads as one word. Grep couldn't catch this — only rendering did.
  *(2026-07-01)*

## Proposed — needs founder call (touches perception/messaging)
1. **Functional demo mic button** ("Tap & describe a job") still shows a mic glyph. It's a
   legitimate voice-input affordance, but given the "no mic in Eden's identity" mandate, confirm
   whether to keep the glyph, swap to the orb, or drop to a text label. *(low risk, quick)*
2. **Hero subhead is a 6-item run-on.** Premium sites (Linear/Stripe) lead with one sharp
   promise, not a feature list. Proposal: keep "Stop managing software. Start working with an AI
   teammate." then cut the list to one line; move the six capabilities into the "how it works"
   section where they already live. *(clarity + professionalism)*
3. **Above-the-fold has no product visual.** Best-in-class SaaS shows the product (a real bid,
   the orb mid-conversation) in the hero. Proposal: add a single, honest product frame. *(first
   impression + conversion)*

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
