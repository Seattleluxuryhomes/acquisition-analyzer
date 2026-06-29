# BidVoice

**The fastest voice-first offer-writing operating system for real estate.**
Walk a property, tap one mic button, speak the deal for under a minute, and get a
complete, compliant NWMLS purchase & sale package ready for review and signature.

> Write an offer in your car and text the owner before you've left the driveway.

This app is built like Bidtranslator: Node + built-in `node:sqlite` (no native
build step), a mobile-first PWA front end, and a server-side AI key that never
reaches the browser.

## Run

```bash
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY (optional to start)
npm start                 # http://localhost:8788
```

Without a key the app still runs — the dashboard, transaction-type picker, manual
addenda selection, PDF package, and signing all work. The AI **coordinator**
(speech → structured offer) needs `ANTHROPIC_API_KEY`.

## How it works

1. **Pick the transaction type** (Residential, Condo, Townhome, Multi-Family,
   Land, Commercial…). This sets the base NWMLS form.
2. **Speak the offer.** The AI coordinator reads it like an experienced WA
   managing broker / TC — it extracts every term, selects the required forms,
   applies the standing defaults (and flags each one), and asks **only** the
   questions still needed.
3. **Review the summary.** A clean card of every term, conflicts caught up front
   (smart validation), open questions you can answer by voice and rebuild, and
   the **form package ordered by most-used** with toggles to adjust.
4. **Generate the package** (PDF, in signing order) and **sign & initial** in the
   right spots.

## Architecture

```
server/
  identity.mjs    Standing broker identity + silent defaults
  forms.mjs       NWMLS forms knowledge base (base forms, addenda by popularity,
                  auto-attach triggers, signing order)
  coordinator.mjs The brain — AI proxy: speech → structured, validated offer
  validate.mjs    Deterministic form resolution + conflict checks (code backstop)
  offers.mjs      Offer CRUD + dashboard
  sign.mjs        Shared sign/initial system (used by BidVoice AND Bidtranslator)
  pdf.mjs         Package PDF (pdfkit) — OUTPUT CONTRACT ordering
  db.mjs          node:sqlite persistence
  index.mjs       HTTP server + API + static PWA
public/           The mobile-first front end (vanilla, no build step)
```

## Hard rules

1. The AI key never reaches the browser — all AI goes through the server.
2. BidVoice **drafts**; the licensed broker reviews and signs. No prices, values,
   names, or comps are ever invented — unknowns become questions.
3. Defaults are applied silently but always shown as `default` so the broker can
   change anything.
4. The app still builds packages by hand if the AI step is down.
5. Each broker accesses only their own offers (scoped by `broker_id`).
6. "Verify, don't assert": form numbers we haven't confirmed against the real
   NWMLS library are flagged for confirmation rather than asserted.

## Wiring the real NWMLS forms

The final overlay — placing the structured values + signatures onto the real flat
NWMLS PDFs at saved x/y coordinates (`coordinate_maps.md`) and merging them — is
the one piece that needs the actual blank forms. It slots into `pdf.mjs` via
`pdf-lib` without changing routes or data shapes. Until then, the package renders
as a clean, complete draft with every term and the correct form set + order.
