// Roofing — Trade Intelligence Pack (reference depth).
// Everything a 20-year roofing office manager + estimator would know. Generic trade
// knowledge only; the contractor's own standards (preferred brands, waste %, min job
// size, financing thresholds) layer on top via the Company Brain overlay — never
// hardcode one company's preferences here.
export default {
  // ---- estimating ----
  estimatingFields: [
    "Roof system (architectural, 3-tab, metal, TPO…)", "Squares (or footprint + pitch)",
    "Existing layers / tear-off", "Decking condition", "Underlayment & ice-and-water",
    "Ventilation (ridge / soffit)", "Flashing & drip edge", "Gutters", "Disposal",
  ],
  // ---- vocabulary (so every surface "speaks roofer") ----
  vocabulary: [
    "square (100 sq ft)", "pitch / slope (e.g. 6:12)", "tear-off vs overlay", "decking / sheathing",
    "underlayment", "ice-&-water shield", "ridge / soffit ventilation", "flashing", "step flashing",
    "drip edge", "valley", "ridge cap", "starter strip", "boot / pipe jack", "ACV / RCV insurance claim",
  ],
  // ---- AI receptionist interview (trade-aware, not generic) ----
  intakeQuestions: [
    "Is this a leak or repair, or are you looking at a full roof replacement?",
    "Are you seeing an active leak or water stains on the ceiling right now?",
    "Roughly how old is the roof, if you know?",
    "Is this storm or hail damage — would you be filing an insurance claim?",
    "Do you know the roof type — asphalt shingle, metal, or flat/TPO?",
    "About how many stories is the home, and is the roof steep or walkable?",
    "Could you send a couple of photos — the problem area plus a wide shot of the roof?",
  ],
  // ---- SEO service pages (engine renders one real page per entry) ----
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
  faqs: [
    { q: "Do you handle insurance claims?", a: "Yes — we document the damage, meet your adjuster on site, and bill the approved scope so your out-of-pocket is just the deductible." },
    { q: "How long does a roof replacement take?", a: "Most homes are a one-to-two-day tear-off and re-roof, weather permitting." },
    { q: "Do you offer a warranty?", a: "Yes — a workmanship warranty on the installation plus the manufacturer's system warranty on the materials." },
    { q: "Can you just repair a section instead of replacing the whole roof?", a: "Often, yes. We'll tell you honestly whether a repair or a full replacement is the better value for your situation." },
  ],
  // ---- materials (generic options; the company overlay names the preferred brand) ----
  materials: ["Architectural / dimensional shingles", "3-tab shingles", "Synthetic underlayment", "Ice-&-water shield", "Ridge vent", "Standing-seam metal", "TPO membrane (low-slope)", "Drip edge & step flashing"],
  // ---- sales intelligence ----
  customerObjections: [
    { objection: "Your price is higher than the other guy", response: "Cheaper roofs usually skip ice-&-water shield, proper ventilation, or use thinner underlayment — that's where leaks and short lifespans come from. We can show you exactly what's in the system." },
    { objection: "Can't you just patch it?", response: "Sometimes a repair is the right call and we'll say so. But if the roof is near end-of-life, repairs are throwing good money after bad — we'll give you the honest math." },
    { objection: "I want to wait until it actually leaks", response: "By the time it leaks inside, there's often decking and insulation damage too. Catching it now is almost always cheaper." },
  ],
  financingTriggers: ["Full replacement over $7,500", "Insurance deductible is a hardship", "Customer asks about monthly payments", "Storm damage with out-of-pocket gap"],
  upsells: ["Ridge-vent ventilation upgrade", "Ice-&-water shield at eaves and valleys", "Seamless gutter replacement", "Skylight re-flash", "Synthetic underlayment upgrade"],
  // ---- guidance & protections ----
  warranty: "Workmanship warranty on the installation, plus the manufacturer's material/system warranty.",
  proposalLanguage: "Scope: tear off existing roofing to the deck, inspect & replace damaged sheathing (noted as an allowance), install underlayment + ice-&-water shield per code, new shingles/system, flashing, drip edge, and ridge ventilation; haul-off and magnetic nail sweep. Exclusions unless stated: decking replacement beyond the allowance, gutter replacement, interior repairs, and hidden structural damage (handled as a change order).",
  safety: ["Fall protection / harness on steep or high roofs", "Ground spotter & drop zones for tear-off debris", "Power-line awareness", "Heat / hydration on hot decks"],
  suggestedPhotos: ["Wide shot of the full roof from the ground", "Close-up of the leak / damaged area", "Any ceiling stains inside", "Flashing at chimneys & valleys", "Gutter / eave condition"],
  // ---- marketing / lifecycle copy (seeds; company voice refines) ----
  marketingCopy: "Protect your biggest investment with a roof that's installed right and fully warrantied — free inspections and easy financing.",
  reviewRequest: "Thrilled we could get your roof squared away! A quick review helps other homeowners find a roofer they can trust — would you mind sharing your experience?",
  referralMessage: "Know a neighbor with a tired roof or storm damage? Send them our way — we'll take great care of them, and there's a thank-you in it for you.",
  followUps: [
    { when: "estimate_sent_3d", message: "Wanted to make sure you got the roofing proposal — happy to walk through the options or the financing if that helps." },
    { when: "post_storm", message: "We were working in your area after the storm — if you'd like a free roof check for hail or wind damage, we can swing by." },
  ],
};
