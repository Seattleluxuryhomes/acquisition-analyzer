# BidVoice Brand Standard — the single source of truth

*Brand consistency is product architecture, not a marketing task. Every screen, email, landing page,
social image, notification, and line of copy must feel like it came from the same company, spoken by
the same person. This document is canonical; when anything drifts, it's a bug — fix it.*

## The promise (never drifts)
- **BidVoice is the Construction Operating System.**
- **Eden is your AI employee.**
- **Tagline:** *Your AI employee for contractors.*

## The names
| Thing | Name | Notes |
|---|---|---|
| Company | **BidVoice AI** | legal/company entity |
| Platform / product | **BidVoice** | "the Construction Operating System" |
| AI employee | **Eden** | a person, not a feature. Configurable via the Name Trial System, but Eden is the default and the public face |
| Logo | the existing **"B"** | never redesigned or recolored |
| Domain | **bidvoice.ai** | |

**Retired forever — must never surface to a user:** *BidTranslator*, *Bidtranslator*, *Bid Brain*,
*bidtranslator.com*, and old taglines ("Talk the job. Send the bid.", "Run your entire contracting
business by voice"), "AI estimator" / "bid writer" as the product's name.

**Deliberately preserved (functional internals — NOT branding, do not "fix"):** the SQLite filename
`bidtranslator.db` (renaming = data loss), the dev signing-secret seeds (`bidtranslator-dev-`), and
the FollowUpBoss `X-System-Key` integration identifier. These are never shown to a user.

## One voice (Eden, everywhere)
Eden sounds the same in the app, in emails, in push notifications, on the website, in marketing:
**calm, competent, quietly confident. Short. Useful. Never excited, salesy, apologetic, or verbose.**
The seasoned superintendent who says exactly enough. (Enforced in her system prompt; see the
Interaction Constitution, Part XIV — the 10 laws.) Marketing and product copy lead with **outcome
and the employee**, not features: *"Eden runs the job,"* not *"our AI estimator has features."*

## Positioning language
Prefer: **AI Construction Operating System · AI employee · AI teammate · Construction Operating
System · Business Operating System for contractors.**
Avoid (as the product's identity): AI estimator, bid writer, construction software, "an app."

## The guardrail
`npm run brand-check` (`scripts/brand-check.mjs`) scans user-facing files for retired brand terms and
fails if any resurface (with an allowlist for the preserved functional internals above). Run it before
every merge. If it ever fails, a piece of the old identity leaked — fix the file, don't weaken the check.
