// Windows & Doors — Trade Intelligence Pack (reference depth).
// Everything a 20-year window-company office manager + estimator would know. Generic
// trade knowledge only; the contractor's preferred brands, glass packages, waste %,
// and financing thresholds layer on via the Company Brain overlay.
export default {
  estimatingFields: [
    "Opening count (windows & doors)", "Type per opening (single / double-hung, casement, slider, picture…)",
    "Sizes (W×H) or to-measure", "Retrofit / insert vs full-frame replacement",
    "Frame material (vinyl, wood, fiberglass, clad)", "Glass package (Low-E, dual / triple, tempered where required)",
    "Egress required (bedrooms / basements)?", "Interior & exterior trim / casing",
    "Flashing & waterproofing (full-frame)", "Removal & disposal of old units", "Lead-safe (pre-1978) & access / height",
  ],
  vocabulary: [
    "double-hung", "single-hung", "casement", "slider", "picture", "bay", "bow", "awning", "hopper",
    "Low-E coating", "argon / krypton gas fill", "U-factor", "SHGC", "double / triple pane", "IGU (sealed unit)",
    "grids / grilles (GBG, SDL)", "egress", "tempered / safety glass", "retrofit / insert vs full-frame",
    "nail-fin", "jamb depth", "sash", "vinyl / fiberglass / clad / aluminum frame",
  ],
  intakeQuestions: [
    "How many windows are you looking to replace?",
    "Is this a full replacement in an existing home, or new construction?",
    "Do you know the frame material you have now — vinyl, wood, or aluminum?",
    "What's driving it — drafts, high energy bills, fogging between the panes, or the look?",
    "Are any of them bedroom or basement windows? (those may need egress sizing)",
    "Do you know the rough sizes, or should we come out and measure?",
    "Could you send a photo of a typical window from the inside and the outside?",
  ],
  services: [
    { slug: "window-replacement", name: "Window Replacement", blurb: "Replace drafty, failing windows with energy-efficient units — measured and installed right." },
    { slug: "window-installation", name: "Window Installation", blurb: "New-construction and full-frame window installation with proper flashing." },
    { slug: "energy-efficient-windows", name: "Energy-Efficient Windows", blurb: "Low-E, gas-filled, multi-pane windows that lower bills and boost comfort." },
    { slug: "vinyl-windows", name: "Vinyl Windows", blurb: "The best-value replacement window — durable, low-maintenance, efficient." },
    { slug: "fiberglass-windows", name: "Fiberglass Windows", blurb: "Stronger, paintable frames that handle temperature swings without warping." },
    { slug: "egress-windows", name: "Egress Windows", blurb: "Code-compliant egress windows for bedrooms and finished basements." },
    { slug: "bay-bow-windows", name: "Bay & Bow Windows", blurb: "Add light and space with a custom bay or bow window." },
    { slug: "patio-sliding-doors", name: "Patio & Sliding Doors", blurb: "Smooth-gliding, secure, energy-efficient patio and sliding doors." },
    { slug: "entry-doors", name: "Entry Doors", blurb: "Fiberglass and steel entry doors that seal tight and look sharp." },
  ],
  faqs: [
    { q: "Do new windows really lower my energy bill?", a: "Yes — modern Low-E, gas-filled units cut heat transfer dramatically. The bigger win for most homeowners is comfort: no more cold drafts or hot spots by the glass." },
    { q: "Insert/retrofit or full-frame replacement?", a: "Inserts are faster and more affordable when the existing frame is sound. If there's rot or water damage, full-frame is the right call so we can flash it properly." },
    { q: "How long does an install take?", a: "Most homes are done in a single day; larger whole-home projects run one to two days." },
    { q: "Can I replace just one or two windows?", a: "Absolutely — though there's a minimum trip charge, so many homeowners bundle a few at once." },
  ],
  materials: ["Vinyl (best value)", "Fiberglass (strength + paintable)", "Composite / clad (wood look, low maintenance)", "Low-E + argon dual-pane (standard)", "Triple-pane (cold climates)", "Foam-filled frames", "Tempered glass where code requires"],
  customerObjections: [
    { objection: "New windows are expensive", response: "They are an investment — but they pay you back in lower bills and comfort every month, and we offer financing so it's a manageable monthly payment instead of a big check." },
    { objection: "I can buy windows cheaper at the big-box store", response: "The window is only half the job — a bad install leaks and voids the warranty. We measure, flash, and seal each opening so it performs and stays covered." },
    { objection: "I'll just replace them myself", response: "Plenty of folks do for one window. For a whole home, our install warranty and proper flashing usually pay for themselves the first storm." },
  ],
  financingTriggers: ["Project over $5,000", "Whole-home replacement", "Customer says 'expensive' or asks about payments", "Strong interest in energy savings"],
  upsells: ["Upgrade to triple-pane", "Decorative grids / grilles", "Exterior trim capping (maintenance-free)", "Full-frame where openings are rotted", "Add a patio or entry door"],
  warranty: "Lifetime manufacturer warranty on vinyl/fiberglass units (glass seal + frame), plus our workmanship warranty on the installation.",
  proposalLanguage: "Scope: remove existing units, install new windows level & square, insulate and flash each opening, install interior & exterior trim/caulk, and haul away the old windows. Exclusions unless stated: drywall repair beyond trim, painting beyond caulk lines, hidden rot (handled as a change order), and lead abatement on pre-1978 homes beyond RRP-safe practices.",
  safety: ["Lead-safe RRP practices on pre-1978 homes", "Ladder / fall protection on upper-floor windows", "Tempered glass required near doors, floors & wet areas", "Egress sizing in bedrooms (code)"],
  suggestedPhotos: ["A typical window from inside", "The same window from outside", "Any fogged / failed sealed units", "The interior trim & casing", "Hard-to-reach or second-story windows"],
  marketingCopy: "Lower energy bills, a quieter home, and curb appeal that pays you back — professionally installed and fully warrantied, with easy financing.",
  reviewRequest: "Hope you're loving the new windows! A quick review helps other homeowners find an installer they can trust — would you mind sharing how it went?",
  referralMessage: "Know a neighbor tired of drafty windows or sky-high energy bills? Send them our way — we'll take great care of them, and there's a thank-you in it for you.",
  followUps: [
    { when: "estimate_sent_3d", message: "Just checking you got the window quote — happy to walk through the glass options or the financing whenever you're ready." },
    { when: "seasonal_winter", message: "Heading into the cold season — if those drafty windows are on your mind, now's a great time to lock in before winter." },
  ],
};
