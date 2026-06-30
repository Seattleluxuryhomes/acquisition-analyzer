// ============================ Trade Intelligence Packs ============================
// THE single source of truth for trade knowledge. Every surface reads one pack per
// trade from here — estimator, AI receptionist, website/SEO, Bid Brain, proposals,
// follow-ups, marketing. One trade definition powers them all.
//
// Architecture:
//  • Registry + schema + overlay live here.
//  • Each DEEP trade is its own module in ./packs/<trade>.js (so "deepen a trade" is a
//    self-contained, reviewable unit — and the data can later move to a DB or JSON
//    without touching consumers). Add a trade to DEEP_PACKS as it's filled.
//  • Trades not yet deepened still work: they get their estimating fields from the base
//    map below and a receptionist interview derived from those fields.
//
// Principles (founder's call):
//  • One source of truth — nothing hardcodes trade knowledge elsewhere.
//  • Interface-agnostic — a pack returns DATA, never UI. Same intelligence can power a
//    web page, the phone receptionist, a voice assistant, or whatever device is next.
//  • Compose, don't duplicate — label/emoji/capture-hints/estimating-brain come from
//    trades.js; we read them through here.
//  • Company Brain overlay — the generic pack is customized by the contractor's own
//    standards (preferred brands, waste %, min job size, financing thresholds, voice)
//    via applyCompanyOverlay(). The seam exists now; the Company Brain fills it later.

import { TRADES, tradeBrain, tradeLabel, tradeList } from "./trades.js";
import roofing from "./packs/roofing.js";
import windows from "./packs/windows.js";

// Deep packs — one module per trade. Add here as each is filled to reference depth.
const DEEP_PACKS = { roofing, windows };

// ---- The pack schema: every field, with safe empty defaults ----
// Consumers can rely on the shape whether or not a trade is deep yet.
function emptyPack() {
  return {
    vocabulary: [], intakeQuestions: [], services: [], faqs: [], materials: [],
    customerObjections: [], financingTriggers: [], upsells: [], safety: [],
    suggestedPhotos: [], followUps: [],
    warranty: "", proposalLanguage: "", marketingCopy: "", reviewRequest: "", referralMessage: "",
  };
}

// ---- Estimating intake checklists for trades NOT yet deepened ----
// Deep packs own their own estimatingFields (in their module); these cover the rest.
export const GENERIC_FIELDS = ["Customer & address", "Scope of work", "Key measurements / quantities", "Materials & who supplies them", "Site access & staging", "Permits / inspections", "Timeline / start date"];
const BASE_FIELDS = {
  fencing: ["Total linear feet", "Height", "Material (cedar, vinyl, chain-link…)", "Gates (count & width)", "Tear-out of existing fence?", "Post type & set (concrete-set?)", "Stain / finish or natural", "Grade / terrain", "Haul-off of debris"],
  painting: ["Interior or exterior", "Rooms / square footage", "Prep & prime (patch, sand, caulk)", "Who supplies the paint", "Sheen (flat, eggshell, satin…)", "Trim, doors & jambs", "Ceilings included?", "Number of coats"],
  electrical: ["Service size (amps)", "Service upgrade or panel swap?", "New circuits / devices (count)", "Rough-in & trim-out scope", "AFCI / GFCI / tamper-resistant", "Permit & inspection", "Wire runs & access"],
  "excavation-demo": ["Scope (clear & grub, mass ex, trenching, grading, demo, haul)", "Volume — bank cubic yards (BCY)", "Cut / fill balance — export or import?", "Soil type (sand, clay, rock?)", "Spoils: haul-off or stockpile on-site", "Compaction spec & import fill", "Dewatering / groundwater?", "Equipment access & staging", "Utility locates (811)", "Erosion control / permits", "Haul distance / dump fees"],
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

// Estimating fields for a trade: deep pack first, then base map, then generic.
export function tradeFields(key) {
  return (DEEP_PACKS[key] && DEEP_PACKS[key].estimatingFields) || BASE_FIELDS[key] || GENERIC_FIELDS;
}

// Receptionist interview: trade-aware where a deep pack provides it; otherwise derived
// from the estimating fields so EVERY trade has a usable interview from day one.
export function receptionistIntake(key) {
  const deep = DEEP_PACKS[key];
  if (deep && deep.intakeQuestions && deep.intakeQuestions.length) return deep.intakeQuestions;
  return tradeFields(key).slice(0, 6);
}

// ---- The unified pack every consumer reads ----
// companyProfile is optional today (null); the future Company Brain supplies it.
export function tradePack(key, companyProfile = null) {
  const t = TRADES[key] || null;
  const deep = DEEP_PACKS[key] || {};
  const base = {
    key,
    label: (t && t.label) || tradeLabel(key) || key,
    emoji: (t && t.emoji) || "",
    captureHints: (t && t.inputs) || [],        // "what to bring / measure"
    estimatingBrain: tradeBrain(key),            // system-prompt trade knowledge
    ...emptyPack(),
    ...deep,                                      // deep pack overrides the empty defaults
    estimatingFields: tradeFields(key),          // always resolved (deep → base → generic)
    intakeQuestions: receptionistIntake(key),    // always usable
    depth: DEEP_PACKS[key] ? "deep" : "base",
  };
  return companyProfile ? applyCompanyOverlay(base, companyProfile) : base;
}

// ---- Company Brain overlay: generic trade knowledge, customized by the contractor ----
// THE moat. Generic pack in; the owner's standards layered on top so a new hire bids
// like the owner. A pass-through today (companyProfile is null) with the merge semantics
// defined now, so estimating / receptionist / website already read THROUGH the seam the
// Company Brain will fill. Owner standards win on scalars; their lists lead (their
// preferences first), and company-only knowledge rides along under `company`.
export function applyCompanyOverlay(pack, company) {
  if (!company) return pack;
  const lead = (a, b) => dedup([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
  return {
    ...pack,
    warranty: company.warranty || pack.warranty,
    proposalLanguage: company.proposalLanguage || pack.proposalLanguage,
    marketingCopy: company.marketingCopy || pack.marketingCopy,
    materials: lead(company.materials, pack.materials),         // preferred brands lead
    upsells: lead(company.upsells, pack.upsells),
    financingTriggers: lead(company.financingTriggers, pack.financingTriggers),
    // Company-only knowledge the generic pack can't have (waste %, min job size,
    // preferred suppliers, pricing habits, do/avoid rules) — learned by the Company Brain.
    company: company.standards || {},
    _customized: true,
  };
}

function dedup(arr) {
  const seen = new Set(), out = [];
  for (const x of arr) { const k = typeof x === "string" ? x.toLowerCase() : JSON.stringify(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

// Ordered list for pickers / iteration (composed from trades.js, not duplicated).
export function tradePackList() { return tradeList(); }

// Compact client-picker payload — the canonical {key,label,emoji,bring} the browser
// needs. Replaces the hardcoded client copy; served by GET /api/trades.
export function tradePickList() {
  return tradeList().map((t) => ({
    key: t.key, label: t.label, emoji: t.emoji,
    bring: Array.isArray(t.inputs) ? t.inputs.join("; ") : "",
  }));
}

// Is this trade filled to reference depth yet? (for "deep on roofing/windows first")
export function isDeepPack(key) { return !!DEEP_PACKS[key]; }
