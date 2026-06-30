// ============================ Trade Intelligence Packs ============================
// THE single source of truth for trade knowledge. Every surface reads one pack per
// trade from here — estimator, AI receptionist, website/SEO, Bid Brain, proposals,
// follow-ups, marketing. One trade definition powers them all.
//
// Architectural principles (founder's call):
//  • One source of truth — nothing hardcodes trade knowledge anywhere else.
//  • Interface-agnostic — a pack returns DATA, never UI. The same intelligence can
//    feed a web page, the phone receptionist, a voice assistant, or whatever device
//    comes next. The interface changes; the intelligence does not.
//  • Compose, don't duplicate — the estimating brain + labels + capture hints already
//    live in trades.js; we read them through here rather than copy them.
//  • Depth-first — roofing is the deep reference pack that proves the structure; other
//    trades inherit sensible defaults (intake derived from their estimating fields)
//    until each is filled to the same depth.
//
// Today this consolidates the estimating intake checklists (relocated here from
// assist.js) and adds the receptionist / SEO / FAQ knowledge that had no home. The
// remaining split — the client picker's copy of emoji/label/"bring" in
// public/index.html — should migrate to read from a pack endpoint next.

import { TRADES, tradeBrain, tradeLabel, tradeList } from "./trades.js";

// ---- Estimating intake checklists (one home now; was assist.js TRADE_FIELDS) ----
// What the estimate needs captured, per trade. Drives the AI estimator's interview.
export const ESTIMATING_FIELDS = {
  fencing: ["Total linear feet", "Height", "Material (cedar, vinyl, chain-link…)", "Gates (count & width)", "Tear-out of existing fence?", "Post type & set (concrete-set?)", "Stain / finish or natural", "Grade / terrain", "Haul-off of debris"],
  painting: ["Interior or exterior", "Rooms / square footage", "Prep & prime (patch, sand, caulk)", "Who supplies the paint", "Sheen (flat, eggshell, satin…)", "Trim, doors & jambs", "Ceilings included?", "Number of coats"],
  roofing: ["Roof system (architectural, 3-tab, metal, TPO…)", "Squares (or footprint + pitch)", "Existing layers / tear-off", "Decking condition", "Underlayment & ice-and-water", "Ventilation (ridge / soffit)", "Flashing & drip edge", "Gutters", "Disposal"],
  electrical: ["Service size (amps)", "Service upgrade or panel swap?", "New circuits / devices (count)", "Rough-in & trim-out scope", "AFCI / GFCI / tamper-resistant", "Permit & inspection", "Wire runs & access"],
  "excavation-demo": ["Scope (clear & grub, mass ex, trenching, grading, demo, haul)", "Volume — bank cubic yards (BCY)", "Cut / fill balance — export or import?", "Soil type (sand, clay, rock?)", "Spoils: haul-off or stockpile on-site", "Compaction spec & import fill", "Dewatering / groundwater?", "Equipment access & staging", "Utility locates (811)", "Erosion control / permits", "Haul distance / dump fees"],
  windows: ["Opening count (windows & doors)", "Type per opening (single / double-hung, casement, slider, picture…)", "Sizes (W×H) or to-measure", "Retrofit / insert vs full-frame replacement", "Frame material (vinyl, wood, fiberglass, clad)", "Glass package (Low-E, dual / triple, tempered where required)", "Egress required (bedrooms / basements)?", "Interior & exterior trim / casing", "Flashing & waterproofing (full-frame)", "Removal & disposal of old units", "Lead-safe (pre-1978) & access / height"],
  concrete: ["Area (sq ft)", "Thickness / spec", "Type (slab, driveway, footings, flatwork)", "Reinforcement (rebar / mesh / fiber)", "Forming & sub-base", "Finish (broom, trowel, stamped, exposed)", "Demo & haul of existing?", "Control joints / sealer"],
  flooring: ["Material (LVP, tile, hardwood, carpet…)", "Area (sq ft)", "Subfloor prep / leveling", "Tear-out of existing", "Underlayment / moisture barrier", "Transitions & trim", "Rooms / layout"],
  decking: ["Deck size (sq ft)", "Decking material (cedar, composite, PT)", "Substructure & footings", "Railing system", "Stairs", "Tear-out of existing?", "Finish / stain"],
  drywall: ["Area (sq ft / sheet count)", "Hang / tape / finish or repair", "Finish level (0–5)", "Texture (knockdown, orange peel, smooth)", "Ceilings", "Paint included?"],
  plumbing: ["Scope (fixtures, repipe, water heater, gas…)", "Fixture count", "Material (PEX, copper, PVC / ABS)", "Rough-in & trim-out", "Permit & inspection", "Access / walls open?"],
  siding: ["Area (sq ft) / wall count", "Material (vinyl, fiber-cement, LP, cedar, stucco)", "Tear-off of existing?", "House wrap / weather barrier", "Trim, corners & J-channel", "Soffit & fascia", "Flashing (windows / doors)", "Stories / access (scaffold?)", "Pre-finished or paint"],
  gutters: ["Linear feet of gutter", "Profile & size (5\"/6\" K-style, half-round)", "Material (aluminum, steel, copper)", "Downspouts (count & size)", "Gutter guards?", "Fascia condition / repair", "Tear-off of existing?", "Stories / access"],
  hvac: ["Scope (replace, new install, repair)", "System type (split, package, mini-split, furnace, heat pump)", "Tonnage / BTU (sizing / Manual J)", "Ductwork — new, replace, or existing", "Electrical / gas available?", "Thermostat / controls", "Permit & inspection", "Access (attic, crawl, roof)"],
  tile: ["Area (sq ft) — floor / wall / both", "Tile type & size (porcelain, ceramic, stone, mosaic)", "Substrate prep (backerboard, waterproofing)", "Pattern / layout", "Demo of existing?", "Niches, curbs, edges / trim", "Grout & sealing", "Heated floor?"],
  masonry: ["Scope (brick, block, stone, repair, repoint)", "Area / linear feet / count", "Material & veneer type", "Footings / foundation?", "Mortar & reinforcement", "Tear-out of existing?", "Flashing & weeps", "Access / scaffold"],
  "kitchen-remodel": ["Scope (cabinets, counters, plumbing, electrical, floor)", "Layout change / walls moved?", "Cabinets (stock, semi-custom, custom)", "Countertop material", "Appliances — who supplies?", "Plumbing & electrical changes", "Flooring", "Permits", "Demo & disposal"],
  "bathroom-remodel": ["Scope (tub/shower, vanity, tile, plumbing, electrical)", "Layout change?", "Shower / tub (tile, surround, pan)", "Waterproofing", "Vanity & fixtures — who supplies?", "Plumbing & electrical changes", "Ventilation fan", "Flooring & tile", "Permits", "Demo & disposal"],
  landscaping: ["Scope (planting, sod, hardscape, irrigation, grading)", "Area (sq ft)", "Plant / material list", "Hardscape (pavers, retaining wall, patio)", "Irrigation / drainage", "Soil prep / amendment", "Haul-off of debris", "Equipment access"],
  framing: ["Scope (walls, floors, roof, addition)", "Square footage / wall LF", "Lumber package — who supplies?", "Engineered members (LVL, I-joist, trusses)?", "Sheathing", "Plans / engineering provided?", "Crane / access", "Permit & inspection"],
  "garage-doors": ["Door count & sizes (W×H)", "Type (sectional, roll-up; insulated?)", "Material (steel, wood, aluminum, glass)", "Opener (new or reuse)", "Springs & hardware", "Removal of existing?", "Windows / style"],
  countertops: ["Material (quartz, granite, laminate, butcher block)", "Square footage / linear feet", "Edge profile", "Sink & cooktop cutouts", "Backsplash?", "Template & install", "Demo of existing?", "Plumbing disconnect / reconnect"],
  doors: ["Opening count", "Type (interior, exterior, slab vs pre-hung, French, sliding)", "Sizes (W×H)", "Material (wood, steel, fiberglass)", "Hardware (locksets, hinges)", "Jamb / casing / trim", "Removal of existing?", "Weatherstrip & threshold (exterior)"],
  insulation: ["Area (sq ft) & location (attic, walls, crawl)", "Type (batts, blown-in, spray foam, rigid)", "R-value target", "Air sealing / vapor barrier", "Existing insulation — remove?", "Access", "Ventilation / baffles"],
  "fire-alarm": ["Device counts (pull stations, smoke/heat detectors, horn/strobes)", "Panel — new FACP or tie-in to existing", "Addressable vs conventional", "Conduit/wire (plenum?) & runs", "Monitoring & comms (cellular/IP)", "AHJ / permit & acceptance test", "Risers / floors", "Demo of existing devices"],
  "low-voltage": ["Systems (data, AV, intercom, paging, WiFi)", "Drop/jack count & category (Cat6/6A/fiber)", "Cable type & total footage", "Rack / IDF / headend & patch panels", "Pathways (conduit, J-hooks, plenum)", "Terminations & testing/certification", "Floors / buildings", "Demo or reuse of existing cabling"],
  "access-control": ["Door count", "Reader & lock type per door (maglock, strike, mortise)", "New panels/controllers or existing system", "Credentials (card, fob, mobile, biometric)", "Power supplies & battery backup", "Door position switches / REX / ADA operators", "Software / hosting & integration", "Conduit & wire runs"],
  "security-cameras": ["Camera count by type (dome, bullet, PTZ, fisheye)", "Indoor / outdoor & mounting height", "Resolution & lens / coverage", "NVR/VMS, storage & retention days", "PoE switches & cabling runs", "Network / remote viewing", "Existing system tie-in?", "Lift/boom for high mounts"],
  mechanical: ["System scope (HVAC, hydronic/piping, process)", "Tonnage / load (or Manual J / equipment schedule)", "Ductwork — new, modify, or reuse", "Piping linear feet & material", "Equipment (RTUs, AHUs, boilers, pumps, VRF)", "Controls / BAS", "Rigging & roof/structural access", "Permit, balancing & startup"],
  elevator: ["Type (traction, hydraulic, MRL, LULA, lift)", "Number of stops & floors served", "Hoistway dimensions & pit/overhead", "Capacity (lbs) & speed", "New install vs modernization", "Cab finishes & fixtures", "Code/permit & state inspection", "Power & machine room needs"],
  engineering: ["Discipline (structural, civil, MEP, geotechnical)", "Scope / deliverable (stamped drawings, calcs, PE letter)", "Plans, sketches or existing drawings provided?", "Project type & jurisdiction (code/AHJ)", "Site visit required?", "Number of revisions included", "Schedule / turnaround", "Permit submittal support"],
  geotech: ["Site location & size", "Number & depth of borings / test pits", "Structure type the report supports", "Deliverable (report, recommendations, bearing capacity)", "Lab testing scope", "Access for drill rig & utility clearance (811)", "Groundwater / known conditions", "Schedule / turnaround"],
  survey: ["Parcel size & location (address / APN)", "Survey type (boundary, topographic, ALTA/NSPS, as-built)", "Deliverable format (PDF, CAD, stamped plat)", "Monumentation / staking required?", "Existing records, deeds or prior surveys", "Site access & terrain", "Title commitment provided (ALTA)?", "Schedule / turnaround"],
};
export const GENERIC_FIELDS = ["Customer & address", "Scope of work", "Key measurements / quantities", "Materials & who supplies them", "Site access & staging", "Permits / inspections", "Timeline / start date"];
export function tradeFields(key) { return ESTIMATING_FIELDS[key] || GENERIC_FIELDS; }

// ---- PACK_EXT: receptionist + SEO + FAQ knowledge (no prior home) ----
// Depth-first: ROOFING is the reference pack. Each `services` entry becomes a real
// SEO page; `intakeQuestions` are what the receptionist asks a caller; `faqs` feed
// both the site and the receptionist. Other trades fall back to generic defaults
// until filled to this depth.
const PACK_EXT = {
  roofing: {
    // SEO service pages (the engine will render one real page per entry).
    services: [
      { slug: "roof-replacement", name: "Roof Replacement", blurb: "Full tear-off and re-roof with a manufacturer-backed system." },
      { slug: "roof-repair", name: "Roof Repair", blurb: "Fast leak repair and targeted fixes — honest repair-vs-replace advice." },
      { slug: "storm-hail-damage", name: "Storm & Hail Damage", blurb: "Insurance-claim roofing — we document the damage and meet your adjuster." },
      { slug: "metal-roofing", name: "Metal Roofing", blurb: "Standing-seam and metal systems built to last decades." },
      { slug: "flat-roofing", name: "Flat & Low-Slope Roofing", blurb: "TPO and low-slope systems for additions and commercial roofs." },
      { slug: "gutter-installation", name: "Gutter Installation", blurb: "Seamless gutters and guards to protect the roof you just paid for." },
      { slug: "skylight-installation", name: "Skylight Installation", blurb: "Leak-free skylight install and re-flashing." },
      { slug: "roof-inspection", name: "Roof Inspection", blurb: "Pre-sale and storm inspections with a clear written report." },
    ],
    // What a 20-year roofing office manager asks a caller — trade-aware, not generic.
    intakeQuestions: [
      "Is this a leak or repair, or are you looking at a full roof replacement?",
      "Are you seeing an active leak or water stains on the ceiling right now?",
      "Roughly how old is the roof, if you know?",
      "Is this storm or hail damage — would you be filing an insurance claim?",
      "Do you know the roof type — asphalt shingle, metal, or flat/TPO?",
      "About how many stories is the home, and is the roof steep or walkable?",
      "Could you send a couple of photos — the problem area plus a wide shot of the roof?",
    ],
    faqs: [
      { q: "Do you handle insurance claims?", a: "Yes — we document the damage, meet your adjuster on site, and bill the approved scope so your out-of-pocket is just the deductible." },
      { q: "How long does a roof replacement take?", a: "Most homes are a one-to-two-day tear-off and re-roof, weather permitting." },
      { q: "Do you offer a warranty?", a: "Yes — a workmanship warranty on the installation plus the manufacturer's system warranty on the materials." },
      { q: "Can you just repair a section instead of replacing the whole roof?", a: "Often, yes. We'll tell you honestly whether a repair or a full replacement is the better value for your situation." },
    ],
    upsells: ["Ridge-vent ventilation upgrade", "Ice-&-water shield at eaves and valleys", "Seamless gutter replacement", "Skylight re-flash"],
    warranty: "Workmanship warranty on the installation, plus the manufacturer's material/system warranty.",
  },
};

// Receptionist intake — trade-aware where we have it, otherwise derived from the
// estimating fields so EVERY trade has a usable interview from day one.
export function receptionistIntake(key) {
  const ext = PACK_EXT[key];
  if (ext && ext.intakeQuestions && ext.intakeQuestions.length) return ext.intakeQuestions;
  return tradeFields(key).slice(0, 6);
}

// ---- The unified pack every consumer reads ----
export function tradePack(key) {
  const t = TRADES[key] || null;
  const ext = PACK_EXT[key] || {};
  return {
    key,
    label: (t && t.label) || tradeLabel(key) || key,
    emoji: (t && t.emoji) || "",
    captureHints: (t && t.inputs) || [],          // "what to bring / measure"
    estimatingFields: tradeFields(key),            // estimator interview checklist
    estimatingBrain: tradeBrain(key),              // system-prompt trade knowledge
    services: ext.services || [],                  // SEO service pages
    intakeQuestions: receptionistIntake(key),      // AI receptionist interview
    faqs: ext.faqs || [],                          // site + receptionist FAQs
    upsells: ext.upsells || [],
    warranty: ext.warranty || "",
    // Slots the next milestones fill (proposal language, follow-ups, locations,
    // marketing copy, photo context) — present so consumers can rely on the shape.
    proposalLanguage: ext.proposalLanguage || "",
    followUps: ext.followUps || [],
    depth: PACK_EXT[key] ? "deep" : "base",
  };
}

// Ordered list for pickers / iteration (composed from trades.js, not duplicated).
export function tradePackList() { return tradeList(); }

// Is this trade filled to reference depth yet? (for "deep on roofing first")
export function isDeepPack(key) { return !!PACK_EXT[key]; }
