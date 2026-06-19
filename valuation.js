// Reconciles the available value signals (comps, AVM, assessment) into a single
// estimated value the way a Zestimate does, then derives an instant cash-offer
// range the way Zillow Offers did: market value minus standard transaction costs.

const num = (x) => (x === undefined || x === null || x === "" || isNaN(+x) ? null : +x);
const round = (n) => (n == null ? null : Math.round(n));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Standard deductions applied to the estimated value to reach a cash offer.
// Repairs/rehab are intentionally excluded (no condition data) and flagged.
const DEDUCTIONS = { sellingCosts: 0.07, serviceFee: 0.06, holding: 0.02 };

export function computeValuation(n) {
  const v = n.valuation || {};
  const comps = n.comps || {};
  const sqft = n.building?.livingSqft || n.building?.sizeSqft || null;

  const avm = num(v.avmValue);
  const avmLow = num(v.avmLow);
  const avmHigh = num(v.avmHigh);
  const avmConf = num(v.avmConfidence); // ATTOM confidence score, ~0–100
  const compVal = comps.status === "ok" && comps.count >= 3 ? num(comps.arv) : null;
  const market = num(v.marketTotal);
  const assessed = num(v.assessedTotal);

  // Weight each signal: comps grow with comp count, AVM grows with confidence.
  const sources = [];
  if (compVal) sources.push({ label: "comps", value: compVal, weight: 0.35 + 0.4 * clamp(comps.count / 8, 0, 1) });
  if (avm) sources.push({ label: "AVM", value: avm, weight: 0.25 + 0.4 * (avmConf != null ? clamp(avmConf / 100, 0, 1) : 0.5) });
  if (!sources.length && market) sources.push({ label: "market assessment", value: market, weight: 0.3 });
  if (!sources.length && assessed) sources.push({ label: "assessment", value: assessed, weight: 0.2 });

  if (!sources.length) return { status: "insufficient", estimate: null };

  const wsum = sources.reduce((s, x) => s + x.weight, 0);
  const point = round(sources.reduce((s, x) => s + x.value * x.weight, 0) / wsum);

  // Confidence from how closely the signals agree.
  const vals = sources.map((s) => s.value);
  const spread = vals.length > 1 ? (Math.max(...vals) - Math.min(...vals)) / point : 0;
  let confidence = "Low";
  if (sources.length >= 2 && spread <= 0.1) confidence = "High";
  else if (sources.length >= 2 && spread <= 0.2) confidence = "Medium";
  else if (sources.length === 1 && sources[0].label === "comps" && comps.count >= 5) confidence = "Medium";

  // Range: reuse the AVM band scaled to our point estimate; else widen by confidence.
  let low, high;
  if (avm && avmLow && avmHigh && avm > 0) {
    low = round(point * (avmLow / avm));
    high = round(point * (avmHigh / avm));
  } else {
    const pct = confidence === "High" ? 0.06 : confidence === "Medium" ? 0.1 : 0.15;
    low = round(point * (1 - pct));
    high = round(point * (1 + pct));
  }

  const offerPct = 1 - (DEDUCTIONS.sellingCosts + DEDUCTIONS.serviceFee + DEDUCTIONS.holding);
  const offer = {
    point: round(point * offerPct),
    low: round(low * offerPct),
    high: round(high * offerPct),
    deductionPct: round((1 - offerPct) * 100),
    breakdown: DEDUCTIONS,
    note: "Cash offer = estimated value minus standard selling, service, and holding costs. Excludes repair/rehab — adjust down for condition.",
  };

  return {
    status: "ok",
    estimate: point,
    low,
    high,
    pricePerSqft: sqft ? round(point / sqft) : null,
    confidence,
    basis: sources.map((s) => s.label).join(" + "),
    sources: sources.map((s) => ({ label: s.label, value: s.value, weight: Math.round(s.weight * 100) / 100 })),
    offer,
  };
}
