# Brand Steward — BidVoice

*Standing charter. Not a project; a continuous responsibility. Owner: Claude, acting as Brand
Steward (Creative Director + Brand Manager + Product Designer + CTO in one).*

## The mandate

Continuously evolve and improve the BidVoice brand while protecting its consistency. Every
commit leaves BidVoice **slightly better than it was found**. The bar: make BidVoice feel like
a **billion-dollar software company long before it is one**.

## The one test (apply to everything shipped)

> **"Does this strengthen or weaken the BidVoice brand?"**
> Weakens it → don't ship it. Strengthens it → ship it, and refine it.

## Protected — never change without proposing first

These are the **core identity**. Touching them requires an explicit proposal to the founder.

- **The B logo** — used exactly as supplied. Never recreated, redrawn, refonted, recolored, or
  re-proportioned. (Source of truth: `brand/` + `brand/BRAND.md`.)
- **The name system** — Platform: **BidVoice** (one word, capital V). Assistant: **Eden**.
- **Positioning** — *"BidVoice is the AI Construction Operating System. Eden is your AI employee."*
- **Tagline** — *"Your AI employee for contractors."*
- **Core palette** — amber `#EE9B2E` / amber-deep `#CF7F18` / ink `#1F252C` / paper `#F1EEE7`.
- **Typography** — Archivo (display) · IBM Plex Sans (body) · IBM Plex Mono (numbers).

## Evolve freely — continuously improve

Copy, messaging, layout, spacing, hierarchy, motion, microcopy, presentation, polish,
onboarding, empty states, error states, email/PDF layout, social/marketing composition — all
of it should get better over time, as long as it stays inside the protected identity above.

## The recurring Brand Audit (do not wait to be asked)

On **every meaningful change**, before pushing:

1. **Run the automated audit:** `npm run brand-verify`
   - `brand-check` — retired branding + wordmark misspellings across all user-facing files.
   - `brand-sync --check` — every logo/icon/social image still matches its single master.
2. **Eyeball the touched surface** against the protected list — one company, one day.
3. **Log it:** append a dated entry to `docs/brand-audit-log.md` (what changed, what was
   checked, findings, follow-ups). This is the paper trail that keeps the brand honest.
4. **Surface inconsistencies proactively** — fix the safe ones in the same commit; for anything
   touching the protected identity, **propose first**.

## Consistency surfaces (the touchpoint checklist)

Website · web app · login · splash · dashboard · settings · landing (EN/ES) · emails
(reset/invite/notify) · proposal & estimate PDFs · customer portal · OG/Twitter/LinkedIn/FB
images · favicon · PWA/app icon · social & outreach collateral. Every one should feel like the
same company. When a change hits any of these, the audit above runs.

## Known debt (tracked, non-blocking)

- **Internal code comments** still say "Bid Brain" (the retired assistant name) in `server.js`,
  `src/memory.js`, `src/db.js`, `src/assist.js`, `src/tradePacks.js`. **Not customer-facing**
  (comments only) — low priority; clean up opportunistically, never in a risky churn.
- **Official logo artwork** pending from founder — `brand/masters/` holds interim marks until
  it arrives; then `npm run brand-sync` swaps every surface at once.
