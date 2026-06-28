// Trade estimator "brains". Each trade injects domain expertise + a takeoff
// method into the AI build prompt so the draft comes back with REAL, derived
// quantities and the right line items for that trade — instead of a generic bid.
// Selected per job at capture and passed through to assistBuild().
//
// This is pure data + small helpers (no provider calls). Keep each `prompt`
// focused on: (1) how that trade does a takeoff, (2) the line items to always
// include, (3) the assumptions/exclusions a pro would add. The output schema is
// unchanged — the model still returns the same {lines, assumptions, exclusions,
// upgrades} JSON; the brain just makes those fields trade-accurate.
//
// Pricing rule everywhere: AI numbers are placeholders the contractor confirms
// (hard rule #7). When the contractor's price book matches a line, the model
// uses that exact unit + unit_price as the rate.

export const TRADES = {
  "general-contractor": {
    label: "General Contractor (whole project)", emoji: "👷",
    inputs: [
      "The whole scope — which phases/trades the job covers (demo, foundation, framing, mechanicals, finishes…)",
      "Which items are owner allowances or owner-supplied (fixtures, finishes, appliances)",
      "Who pulls permits, and your markup on subs",
    ],
    prompt:
      "GENERAL CONTRACTOR / WHOLE-PROJECT ESTIMATING. This is a multi-trade project the GC manages — organize the bid " +
      "by PHASE/DIVISION, not as a flat list: put the phase in each line's section, in build order — Site/Demo, " +
      "Foundation, Framing, Roofing & Exterior, Plumbing, Electrical, HVAC, Insulation, Drywall, Interior Finishes " +
      "(paint, flooring, tile, cabinets & counters, trim & doors), Final. Each major trade is a line (or a few) as a " +
      "SUBCONTRACTOR / scope cost. ALWAYS carry GENERAL CONDITIONS as their own lines: project management & " +
      "supervision, permits & fees, dumpster(s), portable toilet, temporary power/water, site protection & safety, and " +
      "final cleanup. Use ALLOWANCES for owner-selected items (fixtures, finishes, appliances, flooring, countertops) — " +
      "label them as allowances in the desc and note that final selections adjust the price. PRICING: each line is the " +
      "GC's COST (sub price + materials + own labor); the GC's markup / overhead & profit is the PRIVATE margin the app " +
      "applies — NEVER a client-facing 'markup' line (hard rule #2). Typical GC markup 10–20% (a cost-plus job states a " +
      "fee % instead). Add a CONTINGENCY/allowance line for unknowns on renovations. Use the SKU unit + unit_price when " +
      "a line matches the price book. ASSUMPTIONS: scope per the plans/selections provided; allowances as stated; owner " +
      "selections made on time; permit responsibility; normal working hours; existing conditions sound unless noted — " +
      "on renovations, hidden conditions behind walls (rot, mold, code) are handled as change orders. EXCLUSIONS when " +
      "not stated: owner-supplied items, architectural/engineering & design, survey, structural changes not shown, " +
      "hazmat (asbestos/lead/mold) abatement, landscaping, offsite/utility work, permit fees beyond an allowance, and " +
      "anything outside the documented scope. Group by room/area within a phase when the job spans rooms.",
  },

  windows: {
    label: "Windows & Doors", emoji: "🪟",
    inputs: [
      "A photo of each elevation (front, back, left, right)",
      "One reference dimension per photo (a door is ~80\" tall, or a wall width)",
      "Your window/door SKU list with standard sizes — or the plans / window schedule",
    ],
    prompt:
      "WINDOW & DOOR ESTIMATING. Windows and doors sell in STANDARD sizes — identify each opening and match it " +
      "to the SKU list; do not invent custom sizes. For each opening determine TYPE (single-hung, double-hung, " +
      "casement, slider, picture, awning, bay/bow; or door type), approximate SIZE (W×H), and COUNT. If photos " +
      "with a reference dimension are given, scale each opening against the reference and classify it to the " +
      "NEAREST standard size in the price book. If plans or a window schedule are given, read them as ground " +
      "truth. Make ONE 'unit' line per distinct type+size: unit 'each', qty = count, rate = the matching SKU " +
      "unit_price; put type+size+color in desc (e.g. \"Double-hung vinyl 36×60 — white\"). ALWAYS add separate " +
      "lines for: install labor (per opening), exterior trim/wrap & flashing, interior trim/casing, and haul-away " +
      "of old units; a small materials line for caulk/sealant & fasteners. ASSUMPTIONS to include: \"Final sizes " +
      "field-verified before ordering — sizes shown are from photos/plans\"; \"Standard replacement in existing " +
      "openings; no structural resizing unless noted\". EXCLUSIONS when not stated: rotted framing/sill repair, " +
      "egress enlargement, interior paint, window treatments. NEVER treat a photo-derived size as order-ready — " +
      "it is a draft to confirm with a tape.",
  },

  roofing: {
    label: "Roofing", emoji: "🏠",
    inputs: [
      "Building footprint (length × width) or roof plan area",
      "Roof pitch (e.g. 6/12) and number of stories/layers to tear off",
      "Linear feet of ridges, hips, valleys, eaves & rakes (if known)",
    ],
    prompt:
      "ROOFING ESTIMATING. Price by SQUARES (1 square = 100 sq ft of roof surface). Compute roof area = footprint " +
      "× PITCH MULTIPLIER (4/12≈1.054, 6/12≈1.118, 8/12≈1.202, 10/12≈1.302, 12/12≈1.414); ÷100 = squares; add 10% " +
      "waste (15% for cut-up/complex roofs). Derive materials from squares + linear measurements: field shingles " +
      "(qty in squares or bundles per the SKU), underlayment (per square), starter strip (eave+rake LF), ridge cap " +
      "(ridge+hip LF), drip edge (eave+rake LF), valley/step flashing (valley LF), pipe-boot & penetration " +
      "flashings, ridge/box vents (count), nails/fasteners. Use the SKU's exact unit + unit_price as the rate when " +
      "it prices by square or bundle. LABOR: a separate install line ($/square); a TEAR-OFF line ($/square × " +
      "layers) when removing the old roof; a steep/multi-story surcharge line at 8/12+ or 2+ stories. ALWAYS " +
      "include dumpster/haul-away and a magnetic nail sweep. ASSUMPTIONS: state the pitch, squares, waste % and " +
      "layers used, and \"decking assumed sound — damaged sheathing replaced at a per-sheet rate if found\". " +
      "EXCLUSIONS when not stated: decking replacement beyond an allowance, rafter/structural repair, gutters, " +
      "skylight replacement, owner-pulled permits. With footprint + pitch you can get within a few percent — show " +
      "the math in assumptions so the contractor can sanity-check.",
  },

  siding: {
    label: "Siding", emoji: "🧱",
    inputs: [
      "Wall measurements (or footprint + wall height + number of stories)",
      "Siding type/profile and your SKU list (per square or per piece)",
      "Linear feet of corners, trim, soffit & fascia; window/door count for J-channel",
    ],
    prompt:
      "SIDING ESTIMATING. Price wall area by SQUARES (1 square = 100 sq ft). Wall area ≈ perimeter × wall height, " +
      "minus large openings; add 10% waste (15% for lap/complex). Derive: siding field material (squares), starter " +
      "strip (bottom LF), inside/outside corner posts (corner LF), J-channel (window+door perimeter LF), " +
      "soffit & fascia (eave/rake LF), house wrap/weather barrier (squares), trim, fasteners. Use SKU unit + " +
      "unit_price as the rate when matched. LABOR: install ($/square) + tear-off of old siding ($/square) when " +
      "applicable; flashing & detail labor. ASSUMPTIONS: squares & waste used, \"sheathing assumed sound\". " +
      "EXCLUSIONS when not stated: rot/sheathing repair, insulation, painting (unless pre-finished), gutters.",
  },

  gutters: {
    label: "Gutters", emoji: "🌧️",
    inputs: [
      "Linear feet of gutter run (eaves) and number of downspouts",
      "Gutter size (5\"/6\" K-style, half-round) and material",
      "Number of inside/outside corners; stories for height",
    ],
    prompt:
      "GUTTER ESTIMATING. Price gutter by LINEAR FOOT of eave run and downspouts by piece. Derive: gutter (LF), " +
      "downspouts (each, estimate length by stories × ~10 ft), hangers (~1 per 2 ft), end caps, inside/outside " +
      "corners/miters (count), outlets, splash blocks or extensions, sealant. Add gutter guards as an upgrade. Use " +
      "SKU unit + unit_price when matched. LABOR: install ($/LF) + removal/haul of old gutters when applicable; a " +
      "two-story surcharge when relevant. ASSUMPTIONS: total LF and downspout count used, \"fascia assumed sound\". " +
      "EXCLUSIONS when not stated: fascia/soffit repair, roof work, drainage/underground tie-in.",
  },

  painting: {
    label: "Painting", emoji: "🎨",
    inputs: [
      "Interior: room sizes or wall sq ft; ceilings/trim/doors count",
      "Exterior: wall sq ft (perimeter × height) and stories",
      "Number of coats, surface condition, and your paint/labor rates",
    ],
    prompt:
      "PAINTING ESTIMATING. Measure paintable area in SQ FT (walls = perimeter × height; ceilings = floor area). " +
      "One gallon covers ~350 sq ft per coat — derive paint from area × coats ÷ 350, plus primer where bare/" +
      "patched. Separate lines by surface: walls, ceilings, trim/baseboard (LF), doors (each), windows (each). " +
      "LABOR: prep (scrape/sand/patch/caulk), masking & protection, prime, then paint — price by sq ft or as " +
      "fixed per room/surface. Use SKU unit + unit_price when matched. ASSUMPTIONS: number of coats, \"two coats " +
      "on color change\", surfaces in normal condition. EXCLUSIONS when not stated: lead-safe remediation (pre-" +
      "1978), major drywall repair, wallpaper removal, staining of unfinished wood unless specified.",
  },

  flooring: {
    label: "Flooring", emoji: "🪵",
    inputs: [
      "Floor area per room (sq ft) and material (tile, LVP, hardwood, carpet, laminate)",
      "Your flooring SKU list (per sq ft) plus underlayment/trim",
      "Demo of existing floor? Pattern (diagonal/herringbone adds waste)",
    ],
    prompt:
      "FLOORING ESTIMATING. Price by SQ FT of floor area per room; add waste by material — 10% straight lay, " +
      "15% diagonal, 20% herringbone/tile patterns. Derive: field material (sq ft), underlayment/moisture barrier " +
      "(sq ft), thinset/grout for tile, transition strips & trim/quarter-round (LF), baseboard if replaced (LF). " +
      "Use SKU unit + unit_price as the rate when matched. LABOR: demo & haul of existing floor (sq ft), subfloor " +
      "prep/leveling, install ($/sq ft, higher for tile/herringbone). ASSUMPTIONS: waste %, \"subfloor flat & " +
      "sound\". EXCLUSIONS when not stated: subfloor replacement, floor leveling beyond an allowance, furniture " +
      "moving, appliance disconnect.",
  },

  concrete: {
    label: "Concrete (flatwork)", emoji: "🧊",
    inputs: [
      "Slab dimensions (length × width) and thickness (4\" typical)",
      "Linear feet of edge forms; finish type (broom, stamped, exposed)",
      "Access for the truck and any tear-out of existing slab",
    ],
    prompt:
      "CONCRETE FLATWORK ESTIMATING. Compute volume in CUBIC YARDS: (length ft × width ft × thickness ft) ÷ 27, " +
      "+5–10% waste; thickness 4\"=0.33ft, 6\"=0.5ft. Derive: concrete (cu yd), gravel base (cu yd at ~4\"), rebar/" +
      "wire mesh (sq ft), forms (edge LF), vapor barrier, control joints, sealant/cure. Use SKU unit + unit_price " +
      "when matched. LABOR: excavation & grading, set forms, pour & finish ($/sq ft — higher for stamped/exposed/" +
      "colored), strip forms. ALWAYS include tear-out & haul of existing slab when present, and pump truck when " +
      "access is poor. ASSUMPTIONS: thickness, cu yd, finish, \"soil suitable for standard base\". EXCLUSIONS when " +
      "not stated: engineered/structural slabs, drainage, retaining walls, soil import beyond an allowance.",
  },

  fencing: {
    label: "Fencing", emoji: "🚧",
    inputs: [
      "Total fence length (linear feet) and height",
      "Material (wood, vinyl, chain-link, aluminum) and number of gates",
      "Terrain/slope, post spacing, and tear-out of existing fence",
    ],
    prompt:
      "FENCING ESTIMATING. Price by LINEAR FOOT plus per-gate. Posts ≈ (LF ÷ post spacing 6–8 ft) + 1, plus one " +
      "per corner/end and per gate; concrete ≈ 1–2 bags per post. Derive: posts (each), pickets/panels/rails or " +
      "chain-link fabric (LF or by section), concrete (bags), gates (each) with hinges/latches, fasteners. Use SKU " +
      "unit + unit_price when matched. LABOR: layout & utility locate, dig & set posts, install panels/rails, hang " +
      "gates; tear-out & haul of existing fence when present. ASSUMPTIONS: LF, height, post spacing, gate count, " +
      "\"normal soil, no rock\". EXCLUSIONS when not stated: rock/hardpan digging, grading, staining/sealing unless " +
      "specified, survey/property-line verification, permits/HOA.",
  },

  decking: {
    label: "Decking", emoji: "🪜",
    inputs: [
      "Deck size (length × width) and height above grade",
      "Decking material (PT, cedar, composite) and railing linear feet",
      "Stairs (count of steps), footings, and ledger attachment",
    ],
    prompt:
      "DECKING ESTIMATING. Price deck surface by SQ FT; railing & stairs separately. Derive: decking boards (sq ft " +
      "+10–15% waste, more for diagonal/picture-frame), framing — joists/beams/ledger (sq ft of structure), posts " +
      "& footings (count by span), joist hangers & hardware, fasteners/hidden clips (per sq ft). Railing by LF " +
      "(posts, rails, balusters). Stairs by step count (stringers, treads, risers). Use SKU unit + unit_price when " +
      "matched. LABOR: layout, footings/concrete, framing, decking, railing, stairs; tear-out of old deck when " +
      "present. ASSUMPTIONS: sq ft, footing count, \"soil bearing adequate for standard footings\". EXCLUSIONS when " +
      "not stated: engineered/elevated structures, permits, electrical/lighting, ground prep, skirting unless noted.",
  },

  drywall: {
    label: "Drywall", emoji: "🧱",
    inputs: [
      "Wall & ceiling area (sq ft) or room dimensions",
      "New hang vs. patch/repair; texture type and finish level",
      "Ceiling height and number of corners (for corner bead)",
    ],
    prompt:
      "DRYWALL ESTIMATING. Price by SQ FT of board (walls + ceilings). Sheets = area ÷ 32 (4×8) +10% waste. " +
      "Derive: drywall sheets (sq ft or count), joint compound, tape, corner bead (outside-corner LF), screws, " +
      "primer. Use SKU unit + unit_price when matched. LABOR by sq ft, separate lines for: hang, tape & finish " +
      "(to the stated finish level, Level 4 typical / Level 5 for critical light), texture (knockdown/orange-peel/" +
      "smooth), prime. For repairs, price by patch (each) not sq ft. ASSUMPTIONS: sq ft, finish level, texture " +
      "match \"as close as practical\". EXCLUSIONS when not stated: paint, insulation, framing repair, asbestos/" +
      "lead testing on older homes, full-room repaint to blend texture.",
  },

  doors: {
    label: "Interior/Exterior Doors", emoji: "🚪",
    inputs: [
      "Door count by type (interior pre-hung, exterior entry, slab, barn, garage)",
      "Sizes and handing; your door SKU list",
      "Hardware (knobs/levers, hinges, locksets) and casing needs",
    ],
    prompt:
      "DOOR ESTIMATING. Price per door by type+size; match to the SKU list. Make ONE 'unit' line per door type/" +
      "size (unit 'each', qty = count, rate = SKU unit_price); desc names type+size+finish. ALWAYS add: hardware " +
      "(knob/lever/lockset per door), hinges, install labor (per door — pre-hung faster than slab requiring mortise/" +
      "bore), interior casing/trim (per opening), exterior weatherstrip & threshold for entry doors, haul-away of " +
      "old doors. Use SKU unit + unit_price when matched. ASSUMPTIONS: \"existing rough openings reused; sizes " +
      "field-verified\". EXCLUSIONS when not stated: framing/rough-opening changes, painting/staining, glass/" +
      "sidelite work, smart-lock wiring.",
  },

  insulation: {
    label: "Insulation", emoji: "🧯",
    inputs: [
      "Area to insulate (sq ft) by location — attic, walls, crawlspace, rim joist",
      "Type (batt, blown-in, spray foam) and target R-value",
      "Existing insulation removal? Air-sealing scope",
    ],
    prompt:
      "INSULATION ESTIMATING. Price by SQ FT of area per location, to the target R-value. Batts: bundles = area ÷ " +
      "coverage. Blown-in: bags = area × depth-for-R ÷ bag coverage. Spray foam: priced by board-foot (sq ft × " +
      "inches). Derive material per location (attic/walls/crawl/rim) + air-sealing (caulk/foam at penetrations) + " +
      "baffles/vents for attics. Use SKU unit + unit_price when matched. LABOR by sq ft per type (spray foam " +
      "highest). ASSUMPTIONS: target R-value, sq ft per area, \"attic accessible\". EXCLUSIONS when not stated: " +
      "removal of old/contaminated insulation, ventilation upgrades, drywall removal/replacement, vapor barrier " +
      "unless specified, mold/pest remediation.",
  },

  "kitchen-remodel": {
    label: "Kitchen Remodel", emoji: "🍳",
    inputs: [
      "Kitchen size and scope (cabinets, counters, appliances, floor, paint)",
      "Cabinet linear feet; countertop sq ft and material",
      "Layout change? Plumbing/electrical moves? Who supplies appliances",
    ],
    prompt:
      "KITCHEN REMODEL ESTIMATING. Organize by phase/area; this is a multi-trade job — include each phase as its " +
      "own line(s). DEMO & haul. CABINETS by linear foot (base + wall + tall) or per the SKU list; include install " +
      "labor. COUNTERTOPS by sq ft (slab material is 'slab' unit per SKU) + fabrication/edge + sink cutout + " +
      "install. Appliances (note customer-supplied as exclusions/customer_supplied). PLUMBING (sink, faucet, " +
      "disposal, dishwasher hookup; rough-in if moved). ELECTRICAL (outlets/GFCI, under-cabinet & can lighting, " +
      "appliance circuits). BACKSPLASH by sq ft. FLOORING by sq ft. PAINT. Use SKU unit + unit_price when matched. " +
      "ASSUMPTIONS: \"layout unchanged unless noted\", who supplies appliances, permit responsibility. EXCLUSIONS " +
      "when not stated: structural/load-bearing changes, moving gas lines, asbestos/lead, appliances if customer-" +
      "supplied, window/door changes.",
  },

  "bathroom-remodel": {
    label: "Bathroom Remodel", emoji: "🛁",
    inputs: [
      "Bathroom size and scope (tub/shower, vanity, toilet, tile, floor)",
      "Tile area (walls + floor sq ft) and fixture selections",
      "Layout change? Plumbing moves? Waterproofing method",
    ],
    prompt:
      "BATHROOM REMODEL ESTIMATING. Organize by phase; multi-trade. DEMO & haul (protect & contain). PLUMBING " +
      "(tub/shower valve, toilet, vanity faucet & drains; rough-in if relocated). SHOWER/TUB: pan & waterproofing " +
      "(membrane), wall tile (sq ft) + floor tile (sq ft) with thinset/grout +15% waste, niche, glass door/" +
      "enclosure (often customer-selected). VANITY & TOP, TOILET, MIRROR, ACCESSORIES (each). ELECTRICAL (GFCI, " +
      "exhaust fan, vanity lighting). FLOORING & PAINT. Use SKU unit + unit_price when matched. ASSUMPTIONS: " +
      "waterproofing method, \"layout unchanged unless noted\", tile sq ft & waste. EXCLUSIONS when not stated: " +
      "moving wet walls, subfloor/joist repair, asbestos/lead, mold remediation, frameless glass if customer-" +
      "supplied, permits if owner-pulled.",
  },

  landscaping: {
    label: "Landscaping & Hardscape", emoji: "🌳",
    inputs: [
      "Areas in sq ft (planting beds, sod/lawn, patio/paver, mulch)",
      "Plant/material list and counts; hardscape dimensions",
      "Irrigation zones, grading/drainage needs, access",
    ],
    prompt:
      "LANDSCAPING & HARDSCAPE ESTIMATING. Price each area by its measure. SOFTSCAPE: soil/amendments & mulch by " +
      "CU YD (area sq ft × depth ft ÷ 27), sod by sq ft, plants/trees/shrubs by count, edging by LF. HARDSCAPE: " +
      "pavers/patio by sq ft (+ base gravel cu yd + sand + edge restraint + polymeric sand), retaining wall by " +
      "face sq ft, gravel by cu yd or ton. IRRIGATION by zone (heads, valves, pipe LF, controller). Use SKU unit + " +
      "unit_price when matched. LABOR: site prep/grading, excavation & base, install per area, cleanup & haul. " +
      "ASSUMPTIONS: areas & depths used, \"normal soil, positive drainage\". EXCLUSIONS when not stated: drainage/" +
      "grading beyond an allowance, tree removal, lighting, permits, soil import beyond an allowance.",
  },

  framing: {
    label: "Framing", emoji: "🪚",
    inputs: [
      "Wall linear feet & height; floor/roof area if applicable",
      "Stud spacing (16\"/24\" OC), lumber size and species",
      "Openings (doors/windows) for headers; sheathing area",
    ],
    prompt:
      "FRAMING ESTIMATING. Walls: studs ≈ (wall LF × 12 ÷ spacing) + corners/openings, plus top & bottom plates " +
      "(2–3 × wall LF), headers per opening. Floors/roofs: joists/rafters ≈ (span LF × 12 ÷ spacing) + 1; sheathing " +
      "by sq ft (÷32 per sheet, +10% waste). Derive lumber by piece/board-foot, sheathing (sq ft), hangers/straps/" +
      "hardware, nails. Use SKU unit + unit_price when matched. LABOR by sq ft of framed area or by wall LF. " +
      "ASSUMPTIONS: stud spacing, lumber size/species, \"loads conventional — engineering by others if required\". " +
      "EXCLUSIONS when not stated: engineered lumber/beams design, structural engineering, foundation, sheathing if " +
      "separate, permits.",
  },

  electrical: {
    label: "Electrical", emoji: "⚡",
    inputs: [
      "Count of devices/fixtures (outlets, switches, lights, fans, dedicated circuits)",
      "Any service/panel upgrade (e.g. 100A → 200A) and existing panel capacity",
      "New construction vs. remodel (fishing wire in finished walls is slower)",
    ],
    prompt:
      "ELECTRICAL ESTIMATING. Price by device/circuit/fixture COUNT plus service work. Make per-item lines: " +
      "receptacles/switches (each — note GFCI/AFCI where required: kitchen, bath, exterior, garage), recessed cans & " +
      "fixtures & fans (each), dedicated circuits + breakers (each, e.g. range, dryer, A/C, EV), rough-in wire by run, " +
      "low-voltage/data. SERVICE: panel/service upgrade priced per amperage (100→200A), sub-panels, meter. Use SKU " +
      "unit + unit_price when matched. LABOR per device or hourly; remodel/old-work fishing in finished walls costs " +
      "more than new work. ALWAYS add permit & inspection. ASSUMPTIONS: existing panel has capacity, \"no aluminum " +
      "branch wiring or knob-and-tube unless noted\". EXCLUSIONS when not stated: panel/service upgrade unless " +
      "specified, trenching/utility coordination, drywall patch & paint, low-voltage/AV, permit if owner-pulled.",
  },

  plumbing: {
    label: "Plumbing", emoji: "🔧",
    inputs: [
      "Fixture count by type (sink, toilet, tub, shower, water heater, hose bibb)",
      "New rough-in or relocate vs. fixture swap; water heater tank vs. tankless",
      "Repipe scope (linear feet or per-fixture) and access to walls/crawl",
    ],
    prompt:
      "PLUMBING ESTIMATING. Price by FIXTURE plus rough-in plus service. Per-fixture lines (sink, toilet, tub, " +
      "shower, water heater, hose bibb, disposal, dishwasher/ice line) each carry the fixture + supply + drain " +
      "connection. ROUGH-IN per fixture when new/relocated: supply lines, drain & vent by LF, shutoffs/valves. WATER " +
      "HEATER by type (tank vs. tankless, each — tankless adds gas/venting/electrical). REPIPE by LF or per fixture. " +
      "Gas line work by LF + connections. Use SKU unit + unit_price when matched. LABOR per fixture or hourly. ALWAYS " +
      "add permit & inspection for new/relocated work. ASSUMPTIONS: fixtures accessible, \"existing supply/drain " +
      "sizing adequate\". EXCLUSIONS when not stated: under-slab/slab-leak repair, sewer/main line replacement, " +
      "drywall patch, water treatment/softener, permit if owner-pulled.",
  },

  hvac: {
    label: "HVAC", emoji: "❄️",
    inputs: [
      "Conditioned square footage (and stories) to size tonnage",
      "System type (AC + furnace, heat pump, mini-split — and head count)",
      "Reuse existing ductwork or new; gas vs. electric; thermostat needs",
    ],
    prompt:
      "HVAC ESTIMATING. Price by SYSTEM plus ductwork plus controls. Size equipment by tonnage — rough rule ~1 ton " +
      "per 400–600 sq ft (state it's a rule-of-thumb pending a Manual J load calc). Lines: condenser/heat pump + " +
      "air handler/furnace (each, by tonnage/BTU), or mini-split by HEAD COUNT (condenser + each indoor head + line " +
      "set), ductwork (by run/register count or sq ft), thermostat, refrigerant & line set, condensate, gas/electrical " +
      "connections, registers/grilles. Use SKU unit + unit_price when matched. LABOR by system. ALWAYS add permit & " +
      "inspection. ASSUMPTIONS: state the tonnage & sizing basis, \"existing ductwork reused unless noted\". " +
      "EXCLUSIONS when not stated: Manual J/load calc if required by code, electrical panel upgrade, full duct " +
      "replacement beyond an allowance, asbestos duct abatement, permit if owner-pulled.",
  },

  masonry: {
    label: "Masonry & Stucco", emoji: "🧱",
    inputs: [
      "Area in sq ft (stucco walls, brick/block/stone veneer)",
      "System (3-coat vs. 1-coat stucco; veneer type) and repair vs. new",
      "Linear feet of corners/control joints; substrate condition",
    ],
    prompt:
      "MASONRY & STUCCO ESTIMATING. Price by SQ FT of face area. STUCCO: 3-coat (lath + scratch + brown + finish) vs. " +
      "1-coat — derive lath/wire (sq ft), each coat, control & expansion joints (LF), corner aid, color/finish coat. " +
      "VENEER (brick/block/stone): units by sq ft (units per sq ft per material), mortar, wall ties, flashing, weep. " +
      "+10–15% waste. Use SKU unit + unit_price when matched. LABOR by sq ft (higher for stone & repair/patch — " +
      "price repairs by patch, not sq ft). ASSUMPTIONS: sq ft, system, \"substrate/sheathing sound; weather-resistant " +
      "barrier intact\". EXCLUSIONS when not stated: structural/foundation repair, waterproofing beyond standard, " +
      "exact color match on patches, scaffolding beyond standard reach, painting unless specified.",
  },

  "garage-doors": {
    label: "Garage Doors", emoji: "🚗",
    inputs: [
      "Number of doors and sizes (single 8–9×7, double 16×7)",
      "Door material/insulation (R-value) and window options",
      "New opener? (HP, belt/chain/screw drive, smart/wifi)",
    ],
    prompt:
      "GARAGE DOOR ESTIMATING. Price PER DOOR by size + type, opener separately. Make one 'unit' line per door " +
      "(unit 'each', qty = count, rate = SKU unit_price; desc = size + material + insulation, e.g. \"16×7 insulated " +
      "steel, R-12\"). ALWAYS add: springs/tracks/rollers/hardware, weatherseal & bottom seal, install labor, and " +
      "haul-away of the old door. OPENER per door (by HP & drive type) with rail, remotes, keypad, safety sensors, " +
      "smart/wifi if specified. Use SKU unit + unit_price when matched. ASSUMPTIONS: \"existing opening reused; sizes " +
      "field-verified\". EXCLUSIONS when not stated: structural header/opening changes, electrical outlet for the " +
      "opener, drywall/trim repair, painting.",
  },

  "excavation-demo": {
    label: "Dirt Work / Excavation & Grading", emoji: "🚜",
    inputs: [
      "Cut & fill volumes (or footprint/area + depths) — and whether the site balances",
      "Soil type (topsoil/sand/clay/rock) and the haul distance to dump or fill source",
      "Equipment access, groundwater, and which testing/permits are the owner's",
    ],
    prompt:
      "DIRT-WORK / EARTHWORK ESTIMATING. Price by the CUBIC YARD, and ALWAYS distinguish soil volume states — this is " +
      "the #1 thing estimators get wrong: BANK CY (BCY, in-place, what plans show and what you get paid for) vs LOOSE " +
      "CY (LCY, after digging, swelled — what fills the trucks) vs COMPACTED CY (CCY, placed fill). SWELL (bank→loose, " +
      "sizes the trucking): sand/gravel +10–18%, common earth ≈ +25% (20–30%), clay +30–40%, blasted rock +40–70% " +
      "(rock does not shrink). SHRINK (bank→compacted, sizes the fill/import): common earth ≈ −10%, clay −15–25%. " +
      "Formulas: LCY = BCY×(1+swell); CCY = BCY×(1−shrink); to build X CCY of fill you must dig X/(1−shrink) BCY and " +
      "haul that ×(1+swell) LCY. State the soil, swell% and shrink% used in assumptions. Volume = (area sq ft × depth " +
      "ft)÷27, or from the plan's cut/fill takeoff; add an over-dig allowance (slope laybacks, over-ex below footings) " +
      "beyond neat-line. CUT-TO-FILL means balance on site (no import/export); if unbalanced, price IMPORT (select/" +
      "structural fill or aggregate base by CY/ton) or EXPORT (haul-off + tipping). " +
      "PRICING: build a per-CY rate from machine production — Unit$/CY = (machine wet rate $/hr ÷ production CY/hr) + " +
      "haul $/CY + import-or-disposal $/CY, then mark up 10–20% O&P. Production ≈ (bucket × fill-factor × ~0.83 " +
      "efficiency × 3600)/cycle-sec; a 1-CY excavator ≈ 350–700 CY/day. Price HOURLY (machine + operator, 4-hr min + " +
      "move-in) when soil/access/quantities are uncertain; price PER-CY or lump sum only when the volume is known. " +
      "LINE ITEMS to build (each its own line): mobilization/move-in; clear & grub (per acre); strip & stockpile " +
      "topsoil (CY — call it out, it's often a missed change order); mass excavation / cut-to-fill (BCY); over-" +
      "excavation/undercut of unsuitable soil (UNIT-PRICE it — quantity unknown); import fill/aggregate base (CY/ton); " +
      "rough grading then fine/finish grading (SY or SF); compaction in lifts (in the fill rate); hauling/export " +
      "(CY or per truck-load — tandem ~10–14 CY, tri-axle ~14–16 CY) + tipping/dump fees; erosion control/SWPPP (silt " +
      "fence per LF, inlet protection, stabilized entrance); dewatering (day/LS) if water; utility trenching & backfill " +
      "(LF). Match trucks to the loader: trucks needed ≈ truck cycle-time ÷ load-time (3–5 bucket passes/truck). Use " +
      "the SKU unit + unit_price as the rate whenever a line matches the price book. " +
      "RISK — the bid lives or dies here: ROCK costs 5–10× soil ($50–$200/CY vs $2.50–$15/CY; blasting $40–$150/CY), " +
      "so NEVER bury it — exclude it and add a ROCK CLAUSE: 'excavation priced as common/unclassified material; rock, " +
      "ledge, hardpan, high water table or other unforeseen subsurface conditions are billed at the stated unit prices " +
      "as a change order.' Add 10–15% contingency for unknown soil/weather, or transfer it via unit prices instead of " +
      "a fat lump sum. ASSUMPTIONS: 'based on quantities/geotech provided; site balances (no import/export priced); " +
      "on-site soils suitable as engineered fill, free of organics/debris/rock >8\"; no rock or groundwater; one " +
      "mobilization; normal working hours & dry weather; compaction to 90–95% modified Proctor (ASTM D1557) achievable " +
      "with on-site soil.' EXCLUSIONS when not stated: rock/blasting, dewatering, import/export & tipping, undercut/" +
      "unsuitable-soil replacement, compaction/density TESTING (owner pays the geotech; contractor provides access " +
      "only), permits (grading/SWPPP/dewatering), shoring/sheeting, surveying & staking, utility relocation, " +
      "hazardous/contaminated soil, traffic control, winter/adverse-weather standby, landscape/paving restoration. " +
      "DEMOLITION (when part of the job): price by area/volume removed + dumpsters (each, 10/20/30 yd) + disposal/" +
      "tipping + protection of what stays; haul C&D separately from clean dirt. Photo-derived volumes are a draft to " +
      "confirm by survey/takeoff before the number is final.",
  },

  countertops: {
    label: "Countertops", emoji: "🪨",
    inputs: [
      "Countertop area (sq ft) or slab count, and material (quartz, granite, etc.)",
      "Edge profile, number of sink/cooktop cutouts, backsplash",
      "Tear-out of existing top? Who supplies the sink/faucet",
    ],
    prompt:
      "COUNTERTOP ESTIMATING. Price by SQ FT of counter (stone often priced by 'slab' per the SKU). Derive: material " +
      "(sq ft or slab), fabrication + edge profile (LF of finished edge), sink/cooktop cutouts (each), seams, " +
      "templating, backsplash (sq ft or LF), tear-out & haul of the old top, install/set. Use SKU unit + unit_price " +
      "when matched (a quartz/granite slab is unit 'slab'). LABOR in fabrication & install. ASSUMPTIONS: sq ft & " +
      "material, \"cabinets level & ready; sink/faucet supplied by others unless noted\". EXCLUSIONS when not stated: " +
      "plumbing disconnect/reconnect, cabinet modification/leveling, electrical for cooktop, backsplash unless " +
      "specified.",
  },

  tile: {
    label: "Tile", emoji: "🔲",
    inputs: [
      "Area per surface (floor / wall / shower) in sq ft",
      "Tile size & pattern (mosaic, herringbone, large-format add labor/waste)",
      "Wet area (waterproofing) and substrate condition",
    ],
    prompt:
      "TILE ESTIMATING. Price by SQ FT per surface (floor, wall, shower). Add waste by pattern — 10% straight, 15% " +
      "diagonal, 20% mosaic/herringbone/large-format. Derive: tile (sq ft), thinset, grout, backer board/membrane " +
      "(sq ft), WATERPROOFING for wet areas (pan, membrane), trim/bullnose/Schluter edge (LF), niche/bench (each), " +
      "sealer. Use SKU unit + unit_price when matched. LABOR by sq ft — higher for small mosaic, herringbone, and " +
      "large-format (needs leveling). ASSUMPTIONS: sq ft & waste %, waterproofing method, \"substrate flat & sound\". " +
      "EXCLUSIONS when not stated: substrate/subfloor replacement, demolition of existing tile unless noted, " +
      "plumbing/fixtures, structural repair.",
  },
};

// A short, realistic STARTER SCOPE per trade — used to seed a sample bid when a
// contractor is onboarded, so their first login shows a structured bid for their
// trade (they set the prices). Descriptions only; no numbers.
const SAMPLE = {
  "excavation-demo": [["Mobilization", "Move-in / mobilization"], ["Site prep", "Clear & grub, strip & stockpile topsoil"], ["Earthwork", "Cut to fill / mass grading (bank CY)"], ["Earthwork", "Haul-off & disposal of surplus"], ["Grading", "Rough grade then fine grade to subgrade"], ["Compaction", "Compact fill in lifts to spec"], ["Site control", "Erosion control / silt fence"]],
  roofing: [["Tear-off", "Tear-off & disposal of existing roof"], ["Materials", "Underlayment, drip edge & flashing"], ["Materials", "Architectural shingles"], ["Install", "Install underlayment, flashing & shingles"], ["Vents", "Ridge / box vents & pipe boots"], ["Finish", "Magnetic nail sweep & cleanup"]],
  windows: [["Windows", "Supply windows (per opening, field-verified)"], ["Install", "Remove old units & install new"], ["Trim", "Exterior wrap/flashing & interior casing"], ["Finish", "Caulk, seal & haul-away of old units"]],
  "kitchen-remodel": [["Demo", "Demolition & debris haul"], ["Cabinets", "Cabinets — base, wall & install"], ["Counters", "Countertops, fabrication & install"], ["Plumbing", "Sink, faucet & disposal hookup"], ["Electrical", "Outlets/GFCI & under-cabinet lighting"], ["Finish", "Backsplash, paint & final clean"]],
  "bathroom-remodel": [["Demo", "Demolition & containment"], ["Plumbing", "Tub/shower valve, toilet & vanity"], ["Shower", "Waterproofing & wall/floor tile"], ["Fixtures", "Vanity, toilet & accessories"], ["Electrical", "GFCI, exhaust fan & vanity light"], ["Finish", "Paint & final clean"]],
  concrete: [["Prep", "Excavation, grade & set forms"], ["Base", "Gravel base & compaction"], ["Reinforce", "Rebar / wire mesh"], ["Pour", "Concrete, pour & finish"], ["Finish", "Strip forms, seal & cleanup"]],
  painting: [["Prep", "Scrape, sand, patch & caulk"], ["Protect", "Mask & protect floors / fixtures"], ["Prime", "Spot-prime bare/patched areas"], ["Paint", "Walls & ceilings (2 coats)"], ["Paint", "Trim, doors & accents"], ["Finish", "Cleanup & touch-up"]],
  "general-contractor": [["Site/Demo", "Demolition & debris removal"], ["Framing", "Framing & blocking"], ["Mechanical", "Plumbing, electrical & HVAC rough-in"], ["Finishes", "Drywall, paint & flooring"], ["Finishes", "Trim, doors & hardware"], ["General", "Permits, supervision & final clean"]],
};
const SAMPLE_GENERIC = [["Prep", "Site prep & protection"], ["Materials", "Materials & supply"], ["Labor", "Installation labor"], ["Finish", "Cleanup & haul-away"]];
export function sampleScope(key) {
  const rows = SAMPLE[key] || SAMPLE_GENERIC;
  return rows.map(([section, desc]) => ({ section, desc, type: "fixed", price: 0, hours: 0, rate: 0, qty: 0, unit: "" }));
}

// Ordered keys, demo trades first.
export function tradeKeys() { return Object.keys(TRADES); }

// The estimating brain injected into the build system prompt for a trade.
export function tradeBrain(key) {
  const t = TRADES[key];
  return t ? t.prompt : "";
}

export function tradeLabel(key) {
  const t = TRADES[key];
  return t ? t.label : "";
}

// Compact list for the client picker (key, label, emoji, what to bring).
export function tradeList() {
  return Object.entries(TRADES).map(([key, t]) => ({ key, label: t.label, emoji: t.emoji, inputs: t.inputs || [] }));
}
