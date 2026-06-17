# Acquisition Analyzer — Builder Buy Box MVP

Enter an address → ATTOM public records → Claude analysis → professional report. Print-to-PDF built in.

## 0. SECURITY FIRST
The ATTOM key you shared was exposed in plain text. **Rotate it in your ATTOM dashboard before deploying.** Keys live ONLY in `.env` (gitignored) — never in code, never in the browser, never committed.

## 1. Run locally (5 minutes)
```bash
npm install
cp .env.example .env
# edit .env: paste your ROTATED ATTOM_API_KEY and your ANTHROPIC_API_KEY
npm start
# open http://localhost:3000
```
Check keys loaded: `curl http://localhost:3000/api/health` → `{"attomKey":true,"anthropicKey":true}`

## 2. Folder structure
```
acquisition-analyzer/
├── package.json
├── .env.example        # template — copy to .env
├── .env                # YOUR KEYS (gitignored, never commit)
├── .gitignore
├── src/
│   ├── server.js       # Express: serves UI + /api/analyze, keeps keys server-side
│   ├── attom.js        # ATTOM call (expandedprofile + attomavm) + normalization
│   └── analyze.js      # Claude → structured JSON report
└── public/
    └── index.html      # one search box + report + Save as PDF
```

## 3. ATTOM endpoints used
- `GET /propertyapi/v1.0.0/property/expandedprofile?address1=&address2=` — profile, ownership, lot, building, assessment, tax, last sale, mortgage
- `GET /propertyapi/v1.0.0/attomavm/detail?address1=&address2=` — AVM value estimate (optional; non-fatal if absent)

Address is split on the first comma: `address1` = street, `address2` = "City, ST ZIP".

## 4. Error handling
| Case | Response |
|---|---|
| Empty address | 400 "Enter a property address." |
| Street-only (no city) | 400 with example format |
| No match | 404 "No property found… add the ZIP" |
| Bad/expired key | 502 "ATTOM rejected the API key (401). Rotate…" |
| Claude fails | 200 with raw data + `analysisError` (data still valuable) |

## 5. Deploy (pick one, ~15 min)
**Render / Railway / Fly:** push repo, set start command `npm start`, add env vars `ATTOM_API_KEY`, `ANTHROPIC_API_KEY` in the dashboard (NOT in the repo). Done.

**A VPS:**
```bash
npm install --omit=dev
ATTOM_API_KEY=xxx ANTHROPIC_API_KEY=yyy PORT=3000 npm start
# put nginx in front for TLS
```

## 6. Future PDF generation (already prepped)
- Today: browser **Save as PDF** button (`window.print()`) with a print stylesheet — zero dependencies.
- Server-side later: add `puppeteer`, render `/report/:id` to PDF in `server.js`. The report data is already a clean JSON object (`{data, report}`) ready to template.

## 7. Showcase Video Maker (Zillow → cinematic reveal)

Turn a listing's photos into a branded cinematic tour video, powered by Arcads
(Seedance 2.0 image-to-video) and stitched locally with bundled ffmpeg.

**Flow:** paste a Zillow URL (or use the address above) → **Preview** pulls facts
(ATTOM, plus Zillow price/photos if `RAPIDAPI_KEY` is set) and shows a credit
estimate → drag in the listing photos → **Generate**. Each photo is animated with
a slow camera move, then an intro title card + per-clip lower-thirds (address /
price / beds·baths·sqft) + an outro are stitched into one MP4.

**Why upload photos?** Zillow/Redfin/Realtor block automated scraping (HTTP 403).
ATTOM gives the *facts* for any address but not listing *photos*. So photos are
uploaded by hand (reliable), or auto-fetched via a RapidAPI Zillow provider if you
add `RAPIDAPI_KEY`.

**Keys:** add `ARCADS_BASIC_AUTH` (from https://app.arcads.ai/settings/api) to
`.env`, or run `./scripts/setup.sh`. Optional: `RAPIDAPI_KEY` for Zillow auto-fetch.

**Cost:** Seedance 2.0 i2v is ~48 credits/sec at 720p — e.g. 5 clips × 5s ≈ 1,200
credits. The UI shows an estimate and requires confirmation before generating;
credits are charged at generation time.

**Endpoints:**
- `POST /api/showcase/preview` `{zillowUrl?|address?, duration?, resolution?}` → resolved listing + estimate
- `POST /api/showcase/start` `{zillowUrl?|address?, listing?, photos:[dataUrl], opts, confirm:true}` → `{jobId}`
- `GET /api/showcase/job/:id` → `{status, progress[], result}` (poll; generation runs for minutes)

Output MP4s land in `outputs/` (gitignored) and are served at `/outputs/...`.
Local tooling (`ffmpeg-static`, `@napi-rs/canvas`) is bundled — no system installs.

## 8. Notes
- One Claude call per analysis; data is returned even if analysis errors.
- ATTOM field names vary by plan/property — `attom.js` normalizes defensively (missing → `null` → "Not available" in the UI), never fabricates.
- This is a research tool for licensed professionals — not legal/investment/appraisal advice (disclaimer rendered on every report).
