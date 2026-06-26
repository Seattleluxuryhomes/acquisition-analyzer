// THE one place client-facing proposal data is assembled. Both the client-view
// endpoint and the PDF go through buildProposal(), which whitelists fields — so
// `margin` and `notes` (hard rule #2) can never reach a client-facing surface.
// Bid math matches CLAUDE.md: client-furnished lines show but add $0 to the total.

export function lineAmount(l) {
  if (l.type === "unit") return (Number(l.qty) || 0) * (Number(l.rate) || 0);
  return l.type === "hourly" ? (Number(l.hours) || 0) * (Number(l.rate) || 0) : (Number(l.price) || 0);
}

export function bidTotal(lines) {
  return (lines || [])
    .filter((l) => l.furn !== "client")
    .reduce((sum, l) => sum + lineAmount(l), 0);
}

// True margin (not markup): the contractor's line items are their COST, and the
// client price is cost / (1 - margin/100), so the set % is the actual share of
// the price that is profit. 20% margin → price = cost / 0.8. Guarded so an
// out-of-range margin (or 0) just leaves the price equal to the cost.
export function marginFactor(margin) {
  const m = Number(margin) || 0;
  return (m > 0 && m < 100) ? 1 / (1 - m / 100) : 1;
}
// A line/total priced for the client — cost scaled by the margin, rounded to the
// dollar. Summing these (rather than scaling the grand total) keeps every line,
// subtotal and total reconciling exactly on the client's bid.
export function priceWithMargin(amount, margin) {
  return Math.round((Number(amount) || 0) * marginFactor(margin));
}

// Group scope lines by their `section` (room/area), preserving first-appearance
// order. Returns [{ name, lines, subtotal }]. If no line has a section name, this
// returns a single unnamed group so callers can render a flat list as before.
export function groupBySection(lines) {
  const groups = [];
  const byName = new Map();
  for (const l of lines || []) {
    const name = String(l.section || "").trim();
    let g = byName.get(name);
    if (!g) { g = { name, lines: [], subtotal: 0 }; byName.set(name, g); groups.push(g); }
    g.lines.push(l);
    g.subtotal += lineAmount(l);
  }
  return groups;
}

// True when the scope actually spans more than one named room/area — the only
// case where section headings + subtotals add value over a plain list.
export function hasSections(lines) {
  const named = new Set();
  let blank = false;
  for (const l of lines || []) {
    const name = String(l.section || "").trim();
    if (name) named.add(name); else blank = true;
  }
  return named.size > 1 || (named.size === 1 && blank);
}

// Default "Terms & Protections" shown on every proposal until the contractor
// edits their own in Settings. Placeholder boilerplate the contractor reviews
// (hard rule #8: terms need legal review before launch) — one clause per line.
export const DEFAULT_TERMS = [
  "Workmanship is guaranteed for 1 year from completion.",
  "Any change to this scope is priced in writing and approved before work continues (change order).",
  "Allowances (e.g. tile, fixtures, appliances) are estimates — your final selections may adjust the price.",
  "Hidden conditions found after demolition (rot, mold, code issues) are handled as a change order.",
  "Required permits are pulled as needed; permit fees are billed at cost unless stated otherwise.",
  "Payment schedule: deposit to reserve your start date, a progress payment at rough-in, balance due on completion.",
  "We are licensed and insured; proof of insurance is available on request.",
].join("\n");

// Settings value → clean list of clause strings. null/undefined → the default
// template; an explicit empty string → no terms (contractor opted out).
export function termsList(settingsTerms) {
  const raw = settingsTerms == null ? DEFAULT_TERMS : String(settingsTerms);
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

// Takes a full job row (with margin/notes) and returns ONLY what a client may see.
export function buildProposal(job, settings) {
  const lines = job.lines || [];
  const baseLines = lines.filter((l) => l.furn !== "client");
  const clientLines = lines.filter((l) => l.furn === "client");
  // Price every client-facing number through the true margin. The margin % itself
  // never leaves this function (hard rule #2) — only the resulting prices do.
  const priced = (amt) => priceWithMargin(amt, job.margin);
  // When a margin is applied the per-line rate is the contractor's cost, so the
  // "N hrs @ $X/hr" breakdown wouldn't equal the priced amount — show priced
  // amounts only. With no margin, the amount equals hrs×rate, so keep the detail.
  const showRate = marginFactor(job.margin) === 1;
  const lineType = (l) => (showRate ? l.type : "fixed");

  return {
    business: {
      company: settings.company || "Your Company",
      name: settings.name || "",
      phone: settings.phone || "",
      email: settings.email || "",
      license: settings.license || "",
      logo: settings.logo || "",
    },
    title: job.title || "Project",
    customer: job.customer || "",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    scope: baseLines.map((l) => ({
      section: l.section || "",
      desc: l.desc || "Item",
      type: lineType(l),
      hours: l.hours || 0,
      rate: l.rate || 0,
      qty: l.qty || 0,
      unit: l.unit || "",
      amount: priced(lineAmount(l)),
    })),
    // Same scope, grouped by room/area with subtotals — used when the job spans
    // more than one room. Empty array signals "render the flat scope list".
    sections: hasSections(baseLines)
      ? groupBySection(baseLines).map((g) => {
          const gl = g.lines.map((l) => ({
            desc: l.desc || "Item",
            type: lineType(l),
            hours: l.hours || 0,
            rate: l.rate || 0,
            qty: l.qty || 0,
            unit: l.unit || "",
            amount: priced(lineAmount(l)),
          }));
          // Subtotal = sum of the priced lines, so the column always adds up.
          return { name: g.name || "Other work", subtotal: gl.reduce((s, l) => s + l.amount, 0), lines: gl };
        })
      : [],
    clientFurnished: clientLines.map((l) => ({ desc: l.desc || "Item" })),
    upgrades: (job.upgrades || []).map((u) => ({ desc: u.desc || "", price: priced(Number(u.price) || 0) })),
    exclusions: job.exclusions || [],
    assumptions: job.assumptions || [],
    // Standard terms & protections (warranty, change orders, allowances, etc.),
    // set per-contractor in Settings; defaults applied when never customized.
    terms: termsList(settings.terms),
    // Subtotal = sum of the priced scope lines (reconciles with what's shown).
    // Tax is the contractor's own sales-tax rate applied to that subtotal; total
    // is what the client pays. taxRate 0 → no tax line.
    ...(() => {
      const subtotal = baseLines.reduce((s, l) => s + priced(lineAmount(l)), 0);
      const taxRate = Math.max(0, Number(job.tax_rate) || 0);
      const tax = Math.round(subtotal * taxRate / 100);
      return { subtotal, taxRate, tax, total: subtotal + tax };
    })(),
    footer: "This is an estimate, not a contract. Pricing valid 30 days from the date above.",
    // NOTE: margin and notes are intentionally absent. Do not add them here.
  };
}
