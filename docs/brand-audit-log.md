# BidVoice — Brand Audit Log

*Running record of brand audits. Newest first. Appended on every meaningful change per
`docs/brand-steward.md`.*

---

## 2026-07-01 — Hero conversion pass (3 focused changes, then stop)

**Trigger:** Founder approved 3 hero improvements, scoped to *conversion, not aesthetics* —
each must raise the % of contractors who start using BidVoice.

1. **One promise, not six features** — replaced the run-on subhead with a single talk→paid
   outcome (EN+ES).
2. **Real product visual** — rebuilt the hero demo as a dark BidVoice app frame: Eden header +
   live "Building your estimate" status → spoken job → priced bid. Selling confidence.
3. **Icon review** — the last two mic glyphs (hero + try button) → B mark; "Talk to Eden"
   label. No mic/dictation/chatbot cues remain.

**Verified:** rendered EN + ES hero (headless), both read as a premium product; wordmark reads
"BidVoice"; app-icon halo shape matched. `brand-verify` clean; both landings boot 200.

**Then stopped** (per instruction — no indefinite polishing). Next truth = real contractors.

---

## 2026-07-01 — CBO elevation + first-impression visual audit

**Trigger:** Role elevated from Brand Steward to **Chief Brand Officer** — mandate is to
*increase* brand value weekly, not only protect consistency.

**Method:** Rendered the landing + login headlessly and evaluated as a first-time visitor
(the CBO looks at the work, not just the source).

**Found & fixed (first-impression surface — highest stakes):**
- 🔴→✅ **Hero led with a literal microphone**, contradicting the "orb IS the microphone"
  identity and signaling "voice recorder." Replaced with the **B logo mark** (app-icon
  treatment) — consistent with nav, app header, and PWA icon. Verified by re-render.
- 🔴→✅ **Wordmark rendered as "Bid Voice"** (two words) due to a CSS flex-gap between the
  "Bid" text node and the "Voice" span. Wrapped the wordmark → renders "BidVoice". Applied to
  EN + ES. *Grep could not catch this — visual-only defect; logged as why rendering matters.*

**Proposed (logged in `docs/brand-value-backlog.md`):** tighten hero subhead, add a hero
product visual, decide on the functional demo-mic glyph.

**Process shipped:** `docs/brand-value-backlog.md` (ranked value opportunities);
`brand-check` gained a wordmark-misspelling rule; CBO charter in `docs/brand-steward.md`.

---

## 2026-07-01 — Stewardship established + full sweep

**Trigger:** Founder appointed ongoing Brand Steward role.

**Automated:** `npm run brand-verify` → clean (2 rules × 50 user-facing files; asset masters in sync).

**Manual sweep (proactive, before founder noticed):**
- **Wordmark** — consistent `BidVoice` everywhere; zero `Bid Voice` / `BidVOICE` misspellings.
  Upgraded `brand-check` to catch these automatically going forward.
- **Palette** — only the two canonical amber tokens (`#CF7F18`, `#EE9B2E`) in shipped surfaces;
  no color drift.
- **Positioning / tagline** — "AI Construction Operating System" + "AI employee for contractors"
  uniform across app, landing (EN/ES), emails.
- **Assistant name** — user-facing copy resolves to **Eden** at runtime (Name Trial System);
  no stray retired name reaches a customer.
- **Icons/favicon** — unified landing favicon to the app icon this cycle (was `brand-orange.png`).

**Findings:**
- ✅ Customer-facing brand is consistent.
- 🟡 Internal **code comments** still reference "Bid Brain" (invisible to users) — logged as
  non-blocking debt in `docs/brand-steward.md`.
- 🔴 **Official logo artwork** still pending — interim masters in place; one `brand-sync` swaps all.

**Tooling shipped this cycle:** `brand/` single source of truth + `manifest.json` + `BRAND.md`;
`sync-brand-assets.mjs` (`brand-sync`); structured `brand-check` audit; `brand-verify` combined
gate; `/api/health` build stamp (to detect stale deploys).

**Follow-ups:** deploy the branch (stale live build is the current top issue); OG image in the
official logo/font; decide composite-wordmark vs single-lockup once the logo lands.
