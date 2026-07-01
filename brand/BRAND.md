# BidVoice — Brand System (single source of truth)

This folder is the **one place** BidVoice branding is defined. Every logo, icon, color,
and social image the product ships is either **in `brand/masters/`** or **generated from it**.
Destination files under `public/` and `docs/` are **build outputs — never hand-edit them.**

> **Platform:** BidVoice · **Assistant:** Eden · **Positioning:** *BidVoice is the AI
> Construction Operating System. Eden is your AI employee.* · **Tagline:** *Your AI employee
> for contractors.*

---

## The logo (do not recreate)

The **official BidVoice logo is the single source of truth** and must be used exactly as
supplied — do not recreate, redraw, substitute fonts, change colors, or alter spacing or
proportions. When the official artwork arrives, drop the exports into `brand/masters/`
(replacing the interim marks) and run `npm run brand-sync`. That is the *only* way a logo
enters the product.

- **On-dark lockup** → `masters/logo-mark-on-dark.png` (app header, login/splash, landing footer)
- **On-light lockup** → `masters/logo-mark-on-light.png` (light backgrounds)
- Do not introduce alternate versions **except** the intentional dark/light pair above.

The typographic wordmark in the app/landing is currently a **composite**: the mark image +
`Bid` + amber `Voice` (Archivo). If the official logo is a full lockup (mark + "BidVoice"),
replace the composite with the single image — see the report's “manual design” section.

## Color

| Token | Hex | Use |
|---|---|---|
| `amber` | `#EE9B2E` | Primary accent — the "Voice", CTAs, highlights |
| `amberDeep` | `#CF7F18` | `theme-color`, darker amber, gradients |
| `ink` | `#1F252C` | Dark surface + text |
| `paper` | `#F1EEE7` | Light surface |

These match the app's CSS tokens (`--amber`, `--amber-deep`, `--ink`, `--bg`) and
`manifest.json` `theme_color`/`background_color`. Keep them identical everywhere.

## Typography (do not substitute)

- **Display / wordmark:** Archivo (600–900)
- **Body / UI:** IBM Plex Sans (400–600)
- **Numbers / mono:** IBM Plex Mono (400–600)

## Voice & naming

- Wordmark is one word, capital **V**: **BidVoice**. Never "Bid Voice", "BidVOICE", "Bidvoice".
- The assistant is **Eden** (feminine). The platform never speaks in first person — Eden does.
- **BidTranslator is fully retired.** `npm run brand-check` fails the build if it reappears
  in any user-facing file.

---

## How to swap in the official logo (one operation)

1. Export the official logo to the exact destination sizes (this environment has **no image
   resizer**, so masters must already match): `192×192`, `512×512`, `180×180` (apple-touch),
   `1200×630` (og), `2400×1260` (og@2x).
2. Replace the corresponding files in `brand/masters/` (keep the filenames).
3. `npm run brand-sync` — copies each master to every surface in `manifest.json`.
4. `npm run brand-verify` — confirms no retired branding **and** every destination matches.
5. Bump the `?v=` cache-buster on `icon`/`og` links if the icon art changed.

`manifest.json` is the machine-readable map of **master → destinations → surfaces**.
