# OG / social share image spec — `og.png`

*The link-preview image used across social/messaging. A candidate matching this spec is already
installed at `public/og.png` (1200×630) and `public/og@2x.png` (2400×1260); reproducible source is
`docs/og-source.html`. Keep it clean — no extra graphics, no logo redesign.*

## Canvas
- **1200 × 630** (the standard OG ratio). Export a **2×** (2400 × 1260) as `og@2x.png`.
- Safe zone: keep all content within ~90px of every edge (some platforms crop).

## Layout (centered, top-to-bottom)
1. **The existing "B" logo** — white version (`brand-white.png`), ~118px, centered near upper-middle.
   *Do not redesign or recolor the logo.*
2. **BidVoice** — the platform wordmark. Uppercase, letter-spaced (~0.14em), ~34px, muted light
   (`#CDD9F2`).
3. **Meet Eden** — the hero line. Extra-bold, ~104px, tight tracking. "Meet" in white, **"Eden" in
   amber `#E8A23C`**.
4. **Your AI employee for contractors.** — tagline, ~38px, medium weight, muted blue-grey (`#9FB2CD`).
5. A thin **amber baseline** (6px) at the very bottom: gradient `#CF7F18 → #E8A23C`.

## Style
- **Background:** dark premium radial — `radial-gradient(120% 120% at 50% 30%, #16243C, #0C1220 55%, #05080F 100%)`.
- **Type:** Archivo (800/900 for wordmark + hero) is the brand font; IBM Plex Sans / a clean sans for
  the tagline. *(The installed candidate uses a system bold-sans fallback because the headless
  renderer lacked the web fonts — swap to Archivo for the final asset if you want pixel-perfect brand
  type.)*
- **Contrast:** white/amber on near-black — high contrast, legible as a small mobile thumbnail.
- **No clutter:** no screenshots, no orb, no extra icons or badges. Logo + three lines + the amber rule.

## Brand lock (do not drift)
- **BidVoice** = the platform. **Eden** = the AI employee. **Tagline** = *Your AI employee for
  contractors.* The existing **B** logo stays exactly as-is.

## Wiring
- Referenced from `<meta property="og:image">` / `twitter:image` as `https://bidvoice.ai/og.png?v=3`.
- Bump the `?v=` query when the image changes so Facebook/LinkedIn/iMessage re-scrape it (they cache
  aggressively by URL). Re-scrape via the platform debuggers after deploy.
