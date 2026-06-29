/**
 * NWMLS forms knowledge base — the spine of BidVoice.
 *
 * Encodes:
 *   1. Property type  ->  base purchase & sale agreement form.
 *   2. Every addendum, ORDERED BY HOW OFTEN IT'S USED (popularity), with the
 *      trigger that should auto-suggest it and whether it auto-attaches.
 *   3. The fixed signing order for the merged package (the OUTPUT CONTRACT).
 *
 * IMPORTANT — "verify, don't assert": exact NWMLS form *numbers* must match the
 * real blank-forms library (coordinate_maps.md / NWMLS_FORM_INDEX.txt in Drive).
 * Forms confirmed by the broker's spec are marked verified:true. Anything we
 * inferred is verified:false so the UI/summary can flag "confirm form number"
 * rather than silently asserting a wrong form — the broker's own hard rule.
 */

/* -------------------------------------------------------------------------- */
/*  Property types -> base agreement                                          */
/* -------------------------------------------------------------------------- */

export const PROPERTY_TYPES = [
  { id: 'residential', label: 'Single Family Residential', base: '21', icon: 'home' },
  { id: 'condominium', label: 'Condominium', base: '21', icon: 'building', note: 'May use a condo-specific PSA — confirm in forms library.', verify: true },
  { id: 'townhome', label: 'Townhome', base: '21', icon: 'home' },
  { id: 'multifamily', label: 'Multi-Family', base: '21', icon: 'building', note: '1–4 units on Form 21; 5+ units is commercial.', },
  { id: 'land', label: 'Vacant Land', base: '25', icon: 'map', note: 'Vacant Land PSA (commonly Form 25) — confirm number.', verify: true },
  { id: 'development', label: 'Development Land', base: '25', icon: 'map', verify: true },
  { id: 'commercial', label: 'Commercial', base: 'CL', icon: 'briefcase', note: 'Commercial Brokers Assoc. forms — confirm set.', verify: true },
  { id: 'industrial', label: 'Industrial', base: 'CL', icon: 'briefcase', verify: true },
  { id: 'mixeduse', label: 'Mixed Use', base: 'CL', icon: 'briefcase', verify: true },
  { id: 'investment', label: 'Investment', base: '21', icon: 'building', note: 'Base depends on units/zoning — confirm.' },
];

export function propertyType(id) {
  return PROPERTY_TYPES.find((p) => p.id === id) || PROPERTY_TYPES[0];
}

/* -------------------------------------------------------------------------- */
/*  Base forms (always present once a transaction type is chosen)             */
/* -------------------------------------------------------------------------- */

export const BASE_FORMS = {
  '21': { id: '21', name: 'Residential Purchase & Sale Agreement', verified: true },
  '25': { id: '25', name: 'Vacant Land Purchase & Sale Agreement', verified: false },
  CL: { id: 'CL', name: 'Commercial Purchase & Sale Agreement', verified: false },
};

/* -------------------------------------------------------------------------- */
/*  Addenda — ORDERED BY MOST USED (popularity asc = top of the list)         */
/*                                                                            */
/*  trigger: hint words the coordinator/validator watch for.                   */
/*  autoAttach: attach silently when its condition is detected.                */
/*  always: part of every package (Exhibit A, Form 17).                        */
/* -------------------------------------------------------------------------- */

export const ADDENDA = [
  {
    id: '22A', name: 'Financing Addendum', popularity: 1, category: 'financing',
    autoAttach: true, trigger: ['financing', 'conventional', 'loan', 'lender', 'down'],
    note: 'Attach for any financed purchase (not all-cash).', verified: false,
  },
  {
    id: '35', name: 'Inspection Contingency', popularity: 2, category: 'inspection',
    autoAttach: true, trigger: ['inspection', 'inspect', 'feasibility'],
    note: 'Default inspection path (10 days) unless a recent seller report exists.', verified: true,
  },
  {
    id: '22D', name: 'Optional Clauses Addendum', popularity: 3, category: 'addendum',
    autoAttach: false, trigger: ['optional clause', 'utilities included', 'firpta', 'homeowner'],
    verified: true,
  },
  {
    id: '34', name: "Review of Seller's Inspection / Report", popularity: 4, category: 'inspection',
    autoAttach: false, trigger: ['seller inspection', "seller's report", 'pre-inspection', 'review report'],
    note: 'Prefer over Form 35 when a recent seller inspection exists.', verified: true,
  },
  {
    id: '22E', name: 'FHA/VA Financing Addendum', popularity: 5, category: 'financing',
    autoAttach: true, trigger: ['fha', 'va loan', 'va financing'],
    verified: true,
  },
  {
    id: '22K', name: 'Utilities Addendum', popularity: 6, category: 'addendum',
    autoAttach: true, trigger: ['utilities', 'water', 'power', 'sewer', 'gas'],
    verified: true,
  },
  {
    id: '22T', name: 'Title Contingency Addendum', popularity: 7, category: 'addendum',
    autoAttach: true, trigger: ['title contingency', 'title review', 'clean title'],
    verified: true,
  },
  {
    id: '22S', name: 'Septic Addendum (On-site Sewage)', popularity: 8, category: 'inspection',
    autoAttach: true, trigger: ['septic', 'on-site sewage', 'drainfield'],
    note: 'County variant may apply (e.g. 22S-Thurston).', verified: true,
  },
  {
    id: '22R', name: 'Well Addendum', popularity: 9, category: 'inspection',
    autoAttach: true, trigger: ['well', 'private water'],
    verified: true,
  },
  {
    id: '35E', name: 'Escalation Addendum', popularity: 10, category: 'strategy',
    autoAttach: false, trigger: ['escalation', 'escalate', 'beat any offer'],
    verified: true,
  },
  {
    id: '22L&A', name: 'Land / Acreage Addendum', popularity: 11, category: 'addendum',
    autoAttach: true, trigger: ['acreage', 'acres', 'land', 'parcel', 'feasibility'],
    note: 'Auto for land/acreage transactions.', verified: false,
  },
  {
    id: '22C', name: 'Seller Financing Addendum (Owner Carry)', popularity: 12, category: 'financing',
    autoAttach: true, trigger: ['seller financing', 'seller carry', 'owner carry', 'carry back'],
    verified: true,
  },
  {
    id: '38A', name: 'Back-Up Addendum', popularity: 13, category: 'strategy',
    autoAttach: false, trigger: ['back-up', 'backup offer', 'second position'],
    verified: true,
  },
];

/**
 * Always-included supporting docs (not optional addenda — part of every package).
 */
export const ALWAYS_INCLUDED = [
  { id: 'EXA', name: 'Exhibit A — Legal Description', category: 'support', verified: true },
  { id: '17', name: "Form 17 — Seller's Disclosure (acknowledge)", category: 'disclosure', verified: true },
];

/**
 * Negotiation forms — produced on their own, not part of the initial package.
 */
export const NEGOTIATION_FORMS = [
  { id: '36', name: 'Counteroffer', trigger: ['counter', 'counteroffer'], verified: true },
  { id: 'AMD', name: 'Amendment to PSA', trigger: ['amend', 'amendment'], verified: false },
];

export function addendumById(id) {
  return (
    ADDENDA.find((a) => a.id === id) ||
    ALWAYS_INCLUDED.find((a) => a.id === id) ||
    NEGOTIATION_FORMS.find((a) => a.id === id) ||
    null
  );
}

/** Addenda ordered for the picker (most-used first). */
export function addendaByPopularity() {
  return [...ADDENDA].sort((a, b) => a.popularity - b.popularity);
}

/* -------------------------------------------------------------------------- */
/*  Signing / merge order (OUTPUT CONTRACT)                                    */
/*  Form 21 -> 22-series -> 22D -> inspection (34/35) -> Exhibit A -> Form 17   */
/*  -> supporting reports                                                       */
/* -------------------------------------------------------------------------- */

const ORDER_RANK = (id) => {
  if (/^2[15]$/.test(id) || id === 'CL') return 0; // base PSA
  if (id === '22D') return 3;
  if (id === '34' || id === '35') return 4;
  if (id === 'EXA') return 5;
  if (id === '17') return 6;
  if (/^22/.test(id)) return 2; // other 22-series addenda
  if (/^3[568]/.test(id)) return 2; // 35E, 36, 38A treated as negotiation/addenda
  return 7; // supporting
};

/**
 * Order a set of form ids into the signing/merge sequence.
 */
export function signingOrder(ids) {
  return [...new Set(ids)].sort((a, b) => ORDER_RANK(a) - ORDER_RANK(b) || a.localeCompare(b));
}
