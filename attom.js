const BASE = process.env.ATTOM_BASE || "https://api.gateway.attomdata.com";

function headers() {
  const key = process.env.ATTOM_API_KEY;
  if (!key) throw new Error("ATTOM_API_KEY is not set in the environment.");
  return { apikey: key, accept: "application/json" };
}

export function splitAddress(full) {
  const parts = String(full || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return { address1: parts[0] || "", address2: "" };
  return { address1: parts[0], address2: parts.slice(1).join(", ") };
}

async function attomGet(path, params) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { ok: res.ok, status: res.status, json, text };
}

export async function fetchProperty(full) {
  const { address1, address2 } = splitAddress(full);
  if (!address1 || !address2) {
    const err = new Error('Address must include street and city/state, e.g. "123 Main St, Olympia, WA 98501".');
    err.code = "BAD_ADDRESS";
    throw err;
  }

  const detail = await attomGet("/propertyapi/v1.0.0/property/expandedprofile", { address1, address2 });

  if (!detail.ok && detail.status === 401) {
    const e = new Error("ATTOM rejected the API key (401). Rotate and re-check ATTOM_API_KEY.");
    e.code = "AUTH"; throw e;
  }
  const code = detail.json?.status?.code;
  if (!detail.json || code === undefined) {
    const e = new Error("ATTOM returned an unreadable response.");
    e.code = "UPSTREAM"; e.detail = detail.text?.slice(0, 300); throw e;
  }
  const prop = detail.json?.property?.[0];
  if (!prop || code !== 0) {
    const e = new Error("No property found for that address. Check spelling, or add the ZIP code.");
    e.code = "NOT_FOUND"; e.attomStatus = detail.json?.status; throw e;
  }

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
  const pick = (...vals) => { for (const v of vals) { const r = num(v); if (r !== null) return r; } return null; };
  const pickStr = (...vals) => { for (const v of vals) { const r = n(v); if (r !== null) return r; } return null; };

  const id = p.identifier || {};
  const addr = p.address || {};
  const lot = p.lot || {};
  const area = p.building?.size || {};
  const rooms = p.building?.rooms || {};
  const summary = p.summary || {};
  const owner = p.owner || {};
  const assessment = p.assessment || {};
  const sale = p.sale || {};
  const saleAmt = sale.amount || {};
  const assessed = assessment.assessed || {};
  const market = assessment.market || {};
  const tax = assessment.tax || {};
  const mortgage = assessment.mortgage || p.mortgage || {};
  const util = p.utilities || {};
  const vintage = p.vintage || {};

  const ownerNames = [];
  if (owner.owner1?.fullname) ownerNames.push(owner.owner1.fullname);
  if (owner.owner2?.fullname) ownerNames.push(owner.owner2.fullname);

  return {
    fetchedAt: new Date().toISOString(),
    source: "ATTOM expandedprofile + attomavm",
    attomId: pickStr(id.attomId, id.Id),
    apn: pickStr(id.apn, id.apnOrig),
    fips: pickStr(id.fips),

    address: {
      line1: n(addr.line1),
      line2: n(addr.line2),
      city: pickStr(addr.locality, addr.city),
      county: pickStr(addr.countrySubdName, p.area?.countrySecSubd),
      state: pickStr(addr.countrySubd),
      zip: pickStr(addr.postal1),
      full: [n(addr.line1), n(addr.line2)].filter(Boolean).join(", "),
      lat: num(p.location?.latitude),
      lng: num(p.location?.longitude),
    },

    property: {
      type: pickStr(summary.propertyType, summary.proptype, summary.propclass, summary.propLandUse),
      useDescription: pickStr(summary.propLandUse, summary.propsubtype),
      yearBuilt: pick(summary.yearbuilt, summary.yearBuilt, p.building?.construction?.yearBuilt),
      stories: pick(area.levels, p.building?.construction?.levels),
      bedrooms: pick(rooms.beds),
      bathrooms: pick(rooms.bathstotal, rooms.bathsfull),
      zoning: pickStr(lot.zoningType, lot.siteZoningIdent, p.area?.zoning),
    },

    lot: {
      sizeAcres: pick(lot.lotsize1),
      sizeSqft: pick(lot.lotsize2),
      depthFt: pick(lot.depth),
      frontageFt: pick(lot.frontage),
    },

    building: {
      sizeSqft: pick(area.universalsize, area.bldgsize, area.livingsize, area.grosssize),
      grossSqft: pick(area.grosssize),
      livingSqft: pick(area.livingsize, area.universalsize),
    },

    valuation: {
      assessedTotal: pick(assessed.assdttlvalue),
      assessedLand: pick(assessed.assdlandvalue),
      assessedImprovement: pick(assessed.assdimprvalue),
      marketTotal: pick(market.mktttlvalue),
      taxYear: pick(tax.taxyear),
      taxAmount: pick(tax.taxamt),
      avmValue: pick(avm?.amount?.value),
      avmHigh: pick(avm?.amount?.high),
      avmLow: pick(avm?.amount?.low),
      avmConfidence: pick(avm?.amount?.scr, avm?.condition?.score),
    },

    lastSale: {
      date: pickStr(sale.saleTransDate, sale.salesearchdate, saleAmt.salerecdate),
      amount: pick(saleAmt.saleamt),
      deedType: pickStr(saleAmt.saledoctype, sale.saleTransType),
    },

    mortgage: {
      amount: pick(mortgage.amount, mortgage.firstmtgamt),
      lender: pickStr(mortgage.lender, mortgage.firstmtglender),
      date: pickStr(mortgage.date, mortgage.firstmtgdate),
      term: pickStr(mortgage.term),
    },

    ownership: {
      names: ownerNames,
      ownerOccupied: pickStr(summary.ownerOccupied, owner.owner1?.ownerOccupied, owner.absenteeOwnerStatus),
      mailingAddress: pickStr(owner.mailingaddressoneline),
      corporateOwner: pickStr(owner.corporateindicator),
    },
  };
}
