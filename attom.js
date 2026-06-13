// src/attom.js — ATTOM Data integration + normalization
const BASE = process.env.ATTOM_BASE || "https://api.gateway.attomdata.com";

function headers() {
  const key = process.env.ATTOM_API_KEY;
  if (!key) throw new Error("ATTOM_API_KEY is not set in the environment.");
  return { apikey: key, accept: "application/json" };
}

// ATTOM wants the address split: address1 = street, address2 = "City, ST ZIP"
export function splitAddress(full) {
  const parts = String(full || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { address1: parts[0] || "", address2: "" };
  }
  const address1 = parts[0];
  const address2 = parts.slice(1).join(", ");
  return { address1, address2 };
}

async function attomGet(path, params) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
  return { ok: res.ok, status: res.status, json, text };
}

// Primary lookup: expanded profile (richest single-call payload).
export async function fetchProperty(full) {
  const { address1, address2 } = splitAddress(full);
  if (!address1 || !address2) {
    const err = new Error("Address must include street and city/state, e.g. \"123 Main St, Olympia, WA 98501\".");
    err.code = "BAD_ADDRESS";
    throw err;
  }

  const detail = await attomGet("/propertyapi/v1.0.0/property/expandedprofile", { address1, address2 });

  // ATTOM returns status inside body even on HTTP 200; check both.
  const code = detail.json?.status?.code;
  if (!detail.ok && detail.status === 401) {
    const e = new Error("ATTOM rejected the API key (401). Rotate and re-check ATTOM_API_KEY.");
    e.code = "AUTH"; throw e;
  }
  if (!detail.json || code === undefined) {
    const e = new Error("ATTOM returned an unreadable response.");
    e.code = "UPSTREAM"; e.detail = detail.text?.slice(0, 300); throw e;
  }
  const prop = detail.json?.property?.[0];
  if (!prop || code !== 0) {
    const e = new Error("No property found for that address. Check spelling, or add the ZIP code.");
    e.code = "NOT_FOUND"; e.attomStatus = detail.json?.status; throw e;
  }

  // AVM is a separate endpoint; failure here is non-fatal.
  let avm = null;
  try {
    const a = await attomGet("/propertyapi/v1.0.0/attomavm/detail", { address1, address2 });
    avm = a.json?.property?.[0]?.avm || null;
  } catch { /* AVM optional */ }

  return normalize(prop, avm);
}

function normalize(p, avm) {
  const n = (v) => (v === undefined || v === null || v === "" ? null : v);
  const num = (v) => (v === undefined || v === null || v === "" || isNaN(+v) ? null : +v);

  const id = p.identifier || {};
  const addr = p.address || {};
  const lot = p.lot || {};
  const area = p.building?.size || {};
  const rooms = p.building?.rooms || {};
  const construction = p.building?.construction || {};
  const summary = p.summary || {};
  const owner = p.owner || {};
  const assessment = p.assessment || {};
  const sale = p.sale || {};
  const mortgage = assessment?.mortgage || p.mortgage || {};
  const tax = assessment?.tax || {};
  const assessed = assessment?.assessed || {};
  const market = assessment?.market || {};

  const ownerNames = [];
  if (owner.owner1?.fullname) ownerNames.push(owner.owner1.fullname);
  if (owner.owner2?.fullname) ownerNames.push(owner.owner2.fullname);

  return {
    fetchedAt: new Date().toISOString(),
    source: "ATTOM expandedprofile + attomavm",
    attomId: n(id.attomId || id.Id),
    apn: n(id.apn),
    fips: n(id.fips),

    address: {
      line1: n(addr.line1),
      line2: n(addr.line2),
      city: n(addr.locality),
      county: n(addr.countrySubd ? null : addr.county) || n(p.area?.countrySecSubd),
      state: n(addr.countrySubd),
      zip: n(addr.postal1),
      full: [n(addr.line1), n(addr.line2)].filter(Boolean).join(", "),
      lat: num(p.location?.latitude),
      lng: num(p.location?.longitude),
    },

    property: {
      type: n(summary.proptype || summary.propclass),
      useDescription: n(summary.propLandUse || summary.propsubtype),
      yearBuilt: num(summary.yearbuilt || construction.yearBuilt),
      stories: num(area.levels || construction.levels),
      bedrooms: num(rooms.beds),
      bathrooms: num(rooms.bathstotal),
      zoning: n(lot.zoningType || p.lot?.zoningType || p.area?.zoning),
    },

    lot: {
      sizeAcres: num(lot.lotsize1),
      sizeSqft: num(lot.lotsize2),
      depthFt: num(lot.depth),
      frontageFt: num(lot.frontage),
    },

    building: {
      sizeSqft: num(area.universalsize || area.bldgsize || area.livingsize),
      grossSqft: num(area.grosssize),
      livingSqft: num(area.livingsize),
    },

    valuation: {
      assessedTotal: num(assessed.assdttlvalue),
      assessedLand: num(assessed.assdlandvalue),
      assessedImprovement: num(assessed.assdimprvalue),
      marketTotal: num(market.mktttlvalue),
      taxYear: num(tax.taxyear),
      taxAmount: num(tax.taxamt),
      avmValue: num(avm?.amount?.value),
      avmHigh: num(avm?.amount?.high),
      avmLow: num(avm?.amount?.low),
      avmConfidence: num(avm?.amount?.scr || avm?.condition?.score),
    },

    lastSale: {
      date: n(sale.salesearchdate || sale.saleTransDate || sale.amount?.saledate),
      amount: num(sale.amount?.saleamt),
      deedType: n(sale.salesType || sale.amount?.saledoctype),
    },

    mortgage: {
      amount: num(mortgage.amount || mortgage.firstmtgamt),
      lender: n(mortgage.lender || mortgage.firstmtglender),
      date: n(mortgage.date || mortgage.firstmtgdate),
      term: n(mortgage.term),
    },

    ownership: {
      names: ownerNames,
      ownerOccupied: n(summary.ownerOccupied || owner.owner1?.ownerOccupied),
      mailingAddress: n(owner.mailingaddressoneline),
      corporateOwner: n(owner.corporateindicator),
    },
  };
}
