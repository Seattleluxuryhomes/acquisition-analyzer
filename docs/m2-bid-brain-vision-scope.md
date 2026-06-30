# Milestone 2 — Bid Brain Vision (AI Takeoff) — Scope (for approval)

> **Goal:** turn hours of manual estimating into minutes. Contractor speaks +
> scans the job → Bid Brain does the takeoff, prices it, builds the estimate +
> proposal, and produces a send-ready material order.
> **Success metric:** a contractor goes from "walk + talk + a few photos" to a
> priced estimate **and** a material order in minutes, with quantities they trust.
> **Status:** scope only. No code until approved.

## The honest CTO read (what's already done vs. genuinely new)
A huge part of "takeoff" already works — we **reuse, not rebuild**:
- **`src/trades.js`** already encodes per-trade takeoff logic: waste factors and
  derivation formulas (roofing → squares, bundles/sq, underlayment, ridge-cap LF,
  starter; concrete → cu yd from thickness; drywall → sheets = area÷32 +10%;
  insulation, siding, flooring, framing, masonry, excavation…). The AI build
  already turns a spoken scope + measurements into quantified line items using these.
- **`scanMaterials()`** (AI Material Scanner) already does **photo → identified
  materials** → bid lines.
- **`assistBuild`** assembles the estimate from text + trade + the price book (`sku`).
- **Bid Brain memory** (M1) is ready to learn waste factors, preferred materials,
  and suppliers.

So the genuinely **new** work is: (1) a clean **Takeoff Sheet** + **Material Order**
view built on the existing build output; (2) **Vision measurement** (photos/video →
dimensions) — the hard part; (3) Bid Brain learning the takeoff inputs.

## Phasing (each phase production-ready before the next)

### Phase A — Takeoff Sheet + Material Order (buildable now, low risk, high value)
Reuses the existing build + trade brains; adds presentation + a purchasing list.
- Contractor speaks scope **with key measurements** ("1,200 sq ft architectural
  shingles, 6/12 pitch") and/or scans materials.
- Bid Brain produces a reviewable **Takeoff Sheet**: each material with derived
  quantity, waste %, and the components (bundles, ridge cap, underlayment, nails,
  drip edge, starter, vents…), editable.
- Prices from the contractor's price book; labor from the trade brain.
- Generates a **Material Order** — grouped purchase list (qty + unit) the
  contractor can review and **send** (Phase A: a clean PO PDF/text to the supplier;
  supplier API is M3).
- Bid Brain **learns**: waste % used, materials chosen, → memory keys
  (`waste_factors`, `preferred_materials`) so the next takeoff pre-fills them.

### Phase B — Vision measurement (the hard CV; validate before it prices)
- Photos/video → estimated **area + pitch + counts**. Start with the highest-value,
  most-tractable case (roof area + pitch) and **show the estimate for confirmation**
  before it ever feeds pricing — never silently price off a guessed measurement.
- Honest constraint: this is real computer vision; accuracy is everything. We ship
  it only when validated against known jobs, and always contractor-confirmable.

### Phase C — Supplier purchasing prep (bridges into M3)
- Structured PO ready to send; supplier selection from memory. Actual API
  submission + delivery scheduling is Milestone 3.

## Reusable components (no duplication)
| Need | Reuse |
|---|---|
| Takeoff math / waste / derivation | `src/trades.js` trade brains + `assistBuild` |
| Photo → materials | `scanMaterials()` / AI Material Scanner |
| Pricing | price book (`sku`) + existing bid lines |
| Estimate + proposal + PDF | existing job/proposal/pdf pipeline |
| Learning inputs | Bid Brain `memory` (M1) |
| Photo capture + storage | `CAP_PHOTOS`, photo upload, signed URLs |
| Entry point | Bid Brain "Analyze Job Photos" card (already present) |

## Architecture recommendation
- Add a thin **`src/takeoff.js`** that orchestrates: (scope + measurements + scanned
  materials) → calls the existing build/trade logic → returns a structured
  **takeoff** object `{ materials:[{name,qty,unit,waste,component}], labor:[…],
  order:[…] }`. It composes existing pieces; it does **not** re-implement estimating.
- Persist the takeoff on the job (additive: a `takeoff` JSON column, or reuse the
  job object's JSON fields) so it syncs offline like everything else.
- Vision (Phase B) is an **input adapter**: photo/video → measurements → fed into
  the same takeoff orchestrator. Keeps the hard CV isolated and swappable.
- Bid Brain memory writes: `waste_factors`, `preferred_materials`, `preferred_supplier`.

## Database changes
- Phase A: one additive column on `job` (`takeoff` JSON) via `ensureColumns` —
  safe, can't break boot. New memory keys need no schema change.
- Phase C: a `purchase_order` table (later) — `CREATE TABLE IF NOT EXISTS`.

## Build plan (after approval, on `claude/bid-vision`)
1. `src/takeoff.js` orchestrator + the `takeoff` job field.
2. Takeoff Sheet UI (reviewable/editable) inside the estimate flow, reached from
   Bid Brain's "Analyze Job Photos" / a new "Takeoff" action. EN/ES.
3. Material Order view + send (PO PDF/text).
4. Bid Brain learns waste/materials → pre-fills next takeoff.
5. Verify end-to-end (real estimate + material order). Preview before merge.
6. (Phase B/C scoped separately once Phase A is production-ready.)

## What we will NOT do in M2
- No autonomous ordering / supplier API (that's M3).
- No silently pricing off un-confirmed CV measurements.
- No rebuilding estimating logic that already lives in the trade brains.
