// THE one place client-facing proposal data is assembled. Both the client-view
// endpoint and the PDF go through buildProposal(), which whitelists fields — so
// `margin` and `notes` (hard rule #2) can never reach a client-facing surface.
// Bid math matches CLAUDE.md: client-furnished lines show but add $0 to the total.

export function lineAmount(l) {
  return l.type === "hourly" ? (Number(l.hours) || 0) * (Number(l.rate) || 0) : (Number(l.price) || 0);
}

export function bidTotal(lines) {
  return (lines || [])
    .filter((l) => l.furn !== "client")
    .reduce((sum, l) => sum + lineAmount(l), 0);
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

// Takes a full job row (with margin/notes) and returns ONLY what a client may see.
export function buildProposal(job, settings) {
  const lines = job.lines || [];
  const baseLines = lines.filter((l) => l.furn !== "client");
  const clientLines = lines.filter((l) => l.furn === "client");

  return {
    business: {
      company: settings.company || "Your Company",
      name: settings.name || "",
      phone: settings.phone || "",
      license: settings.license || "",
      logo: settings.logo || "",
    },
    title: job.title || "Project",
    customer: job.customer || "",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
    scope: baseLines.map((l) => ({
      section: l.section || "",
      desc: l.desc || "Item",
      type: l.type,
      hours: l.hours || 0,
      rate: l.rate || 0,
      amount: lineAmount(l),
    })),
    // Same scope, grouped by room/area with subtotals — used when the job spans
    // more than one room. Empty array signals "render the flat scope list".
    sections: hasSections(baseLines)
      ? groupBySection(baseLines).map((g) => ({
          name: g.name || "Other work",
          subtotal: g.subtotal,
          lines: g.lines.map((l) => ({
            desc: l.desc || "Item",
            type: l.type,
            hours: l.hours || 0,
            rate: l.rate || 0,
            amount: lineAmount(l),
          })),
        }))
      : [],
    clientFurnished: clientLines.map((l) => ({ desc: l.desc || "Item" })),
    upgrades: (job.upgrades || []).map((u) => ({ desc: u.desc || "", price: Number(u.price) || 0 })),
    exclusions: job.exclusions || [],
    assumptions: job.assumptions || [],
    total: bidTotal(lines),
    footer: "This is an estimate, not a contract. Pricing valid 30 days from the date above.",
    // NOTE: margin and notes are intentionally absent. Do not add them here.
  };
}
