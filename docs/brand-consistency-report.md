# BidVoice — Brand Consistency Report

*Date: 2026-07-01 · Branch: `claude/finish-building-tkauur`*

**Goal:** one premium, unified brand across web, app, email, proposals, and outreach —
nothing revealing that parts were built at different times.

**Status:** All **text, wordmark, color, typography, and metadata** are unified and guarded
by CI (`npm run brand-verify`). A **single source of truth** (`brand/`) now feeds every image
surface. The **only** blocker to 100% is the **official logo artwork**, which you're
providing — once it lands, it's a one-command swap. I did **not** recreate or redraw any logo.

---

## 1. Single source of truth — built ✅

```
brand/
  BRAND.md            # brand system: logo rules, color, type, naming, swap steps
  manifest.json       # machine-readable map: master → destinations → surfaces
  masters/            # the ONE copy of every logo/icon/social image
scripts/sync-brand-assets.mjs   # copies masters → all surfaces (npm run brand-sync)
```

- **No duplicate logo files.** Every `public/`+`docs/` image is now a *generated output* of a
  single master. `npm run brand-sync` regenerates them; `-- --check` fails CI on drift.
- Tokens (color/type/wordmark) are documented once in `manifest.json` and match the app CSS
  and `manifest.json` exactly.
- New scripts: `brand-sync`, `brand-verify` (runs `brand-check` + sync drift check).

## 2. Assets updated this pass ✅

| Surface | What changed |
|---|---|
| Landing (EN + ES) favicon | Was `/brand-orange.png` — **unified** to `/icon-192.png` + apple-touch, matching the app |
| Landing (EN + ES) OG/Twitter image | Added `?v=3` cache-buster to match app (forces re-scrape of the new image) |
| Brand masters | Seeded `brand/masters/` from current assets as the canonical set (interim, pending official logo) |
| Build tooling | `brand-sync` pipeline + `brand-verify` guard added |

*(Text/wordmark rebrand to BidVoice + "Meet Eden" positioning across app, landing, emails,
manifest, sitemap, robots, SW was completed in the prior rebrand pass and remains clean.)*

## 3. Already consistent (verified) ✅

- **Wordmark** — `BidVoice` (camelCase V) everywhere. `brand-check` fails the build if
  `BidTranslator`/`bid translator`/`bidtranslator.com` reappears in any user-facing file.
- **App**: header, login screen, splash, dashboard, settings, PWA manifest → BidVoice + B mark.
- **Emails** (password reset, invites, notifications): text wordmark `Bid`+amber `Voice`
  (`#CF7F18`) — consistent lockup in every template in `server.js`.
- **Meta/SEO/OG/Twitter**: title, description, `og:site_name`, image, alt — one message
  ("Meet Eden — your AI employee for contractors.") across app + both landing pages.
- **Color + type**: `#EE9B2E / #CF7F18 / #1F252C / #F1EEE7`, Archivo + IBM Plex — identical
  in app, landing, and emails.
- **Proposal / Estimate PDFs & customer portal**: by design these carry the **contractor's**
  own logo and brand (Hard Rule #2), not BidVoice — this is correct, not an inconsistency.

## 4. Remaining — requires the official logo file 🔴 (blocks 100%)

Drop each export into `brand/masters/` (same filename) and run `npm run brand-sync`:

| Master to replace | Feeds | Required size |
|---|---|---|
| `logo-mark-on-dark.png` | app header, login/splash, landing footer | vector-crisp, transparent |
| `logo-mark-on-light.png` | light-background lockups | vector-crisp, transparent |
| `app-icon-192.png` | favicon + PWA | 192×192 |
| `app-icon-512.png` | PWA / install | 512×512 |
| `apple-touch-icon.png` | iOS home screen | 180×180 |
| `og-share.png` / `og-share@2x.png` | FB/LinkedIn/Twitter cards | 1200×630 / 2400×1260 |
| `social-tile.png` | misc social tile | square |

**Please send:** the logo as **SVG (master)** + PNG exports at the sizes above, in the
**on-dark** and **on-light** variants. If you send only the SVG, I'll note exact export specs
back to you (no resizer runs in this environment, so PNGs must be pre-sized).

## 5. Remaining — manual design work 🟡 (not code)

These can't be auto-generated and aren't in the repo today:

- **OG image redesign** in the official logo + Archivo (current `og.png` uses a system-font
  fallback — cosmetic; see `docs/og-image-spec.md`).
- **Wordmark decision**: if the official logo is a full lockup (mark + "BidVoice"), the app's
  composite wordmark (mark image + `Bid`+`Voice` text) should be swapped to the single image.
  Trivial code change once the artwork exists — I'll wait for your call so I don't guess.
- **Off-repo outreach & sales collateral** (not in this codebase, so nothing to change here):
  business cards, flyers, pitch/sales decks, one-pagers, email signatures, LinkedIn/Facebook/
  Instagram/Text-message graphics, demo videos, product screenshots. These need design in
  your tool of choice using `brand/BRAND.md` as the spec. I can generate templates/spec sheets
  for any of them on request.
- **Favicon `.ico`**: currently PNG-only (fine for modern browsers). Add a multi-size `.ico`
  if you need legacy support.

## 6. How to keep it unified (going forward)

- CI gate: `npm run brand-verify` (retired-branding scan **+** asset-drift check). Wire it into
  the release checklist so branding can't regress.
- Rule: **never** hand-edit a file under `public/` or `docs/` that the manifest lists as a
  destination — edit the master and sync.

---

### One-line summary
Everything code-controllable is unified and guarded; hand me the **official logo exports** and
one `npm run brand-sync` makes the app, web, email, and social images visually identical.
