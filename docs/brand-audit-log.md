# BidVoice — Brand Audit Log

*Running record of brand audits. Newest first. Appended on every meaningful change per
`docs/brand-steward.md`.*

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
