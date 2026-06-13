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

  let assessmentProp = null;
  try {
    const a = await attomGet("/propertyapi/v1.0.0/assessment/detail", { address1, address2 });
    assessmentProp = a.json?.property?.[0] || null;
  } catch { /* assessment optional */ }

  let saleProp = null;
  try {
    const s = await attomGet("/propertyapi/v1.0.0/saleshistory/detail", { address1, address2 });
    saleProp = s.json?.property?.[0] || null;
  } catch { /* sales history optional */ }

  let ownerProp = null;
  try {
    const o = await attomGet("/propertyapi/v1.0.0/property/detailowner", { address1, address2 });
    ownerProp = o.json?.property?.[0] || null;
  } catch { /* owner optional */ }

  return normalize(prop, avm, assessmentProp, saleProp, ownerProp);
}

function normalize(p, avm, ap, sp, op) {
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

  const aAssessment = ap?.assessment || {};
  const aAssessed = aAssessment.assessed || {};
  const aMarket = aAssessment.market || {};
  const aTax = aAssessment.tax || {};
  const aLot = ap?.lot || {};
  const aArea = ap?.building?.size || {};
  const aRooms = ap?.building?.rooms || {};

  const pAssessment = p.assessment || {};
  const pAssessed = pAssessment.assessed || {};
  const pMarket = pAssessment.market || {};
  const pTax = pAssessment.tax || {};

  const saleList = sp?.salehistory || sp?.saleHistory || [];
  const lastSaleEntry = Array.isArray(saleList) && saleList.length ? saleList[0] : (sp?.sale || p.sale || {});
  const saleAmt = lastSaleEntry?.amount || {};

  const mortgage = aAssessment?.mortgage || pAssessment?.mortgage || p.mortgage || {};

  const ownerObj = op?.owner || op?.assessment?.owner || ap?.assessment?.owner || ap?.owner || p.owner || {};
  const o1 = ownerObj.owner1 || {};
  const o2 = ownerObj.owner2 || {};
  const buildName = (o) => {
    if (!o) return null;
    if (o.fullname) return o.fullname;
    const parts = [o.firstNameAndMi || o.firstname || o.firstName, o.lastname || o.lastName].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
  };
  const ownerNames = [];
  const n1 = buildName(o1); if (n1) ownerNames.push(n1);
  const n2 = buildName(o2); if (n2) ownerNames.push(n2);
  if (!ownerNames.length && ownerObj.description) ownerNames.push(ownerObj.description);

  return {
    fetchedAt: new Date().toISOString(),
    source: "ATTOM expandedprofile + avm + assessment + saleshistory + owner",
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
      stories: pick(area.levels, aArea.levels, p.building?.construction?.levels),
      bedrooms: pick(rooms.beds, aRooms.beds),
      bathrooms: pick(rooms.bathstotal, aRooms.bathstotal, rooms.bathsfull, aRooms.bathsfull, rooms.bathfixtures, aRooms.bathfixtures),
      zoning: pickStr(lot.zoningType, aLot.zoningType, lot.siteZoningIdent, p.area?.zoning),
    },

    lot: {
      sizeAcres: pick(lot.lotsize1, aLot.lotsize1),
      sizeSqft: pick(lot.lotsize2, aLot.lotsize2),
      depthFt: pick(lot.depth, aLot.depth),
      frontageFt: pick(lot.frontage, aLot.frontage),
    },

    building: {
      sizeSqft: pick(area.universalsize, aArea.universalsize, area.bldgsize, aArea.bldgsize, area.livingsize, aArea.livingsize),
      grossSqft: pick(area.grosssize, aArea.grosssize),
      livingSqft: pick(area.livingsize, aArea.livingsize, area.universalsize, aArea.universalsize),
    },

    valuation: {
      assessedTotal: pick(aAssessed.assdttlvalue, pAssessed.assdttlvalue),
      assessedLand: pick(aAssessed.assdlandvalue, pAssessed.assdlandvalue),
      assessedImprovement: pick(aAssessed.assdimprvalue, pAssessed.assdimprvalue),
      marketTotal: pick(aMarket.mktttlvalue, pMarket.mktttlvalue),
      taxYear: pick(aTax.taxyear, pTax.taxyear),
      taxAmount: pick(aTax.taxamt, pTax.taxamt),
      avmValue: pick(avm?.amount?.value),
      avmHigh: pick(avm?.amount?.high),
      avmLow: pick(avm?.amount?.low),
      avmConfidence: pick(avm?.amount?.scr, avm?.condition?.score),
    },

    lastSale: {
      date: pickStr(lastSaleEntry?.saleTransDate, lastSaleEntry?.salesearchdate, saleAmt.salerecdate, p.sale?.saleTransDate),
      amount: pick(saleAmt.saleamt, p.sale?.amount?.saleamt),
      deedType: pickStr(saleAmt.saledoctype, lastSaleEntry?.saleTransType),
    },

    mortgage: {
      amount: pick(mortgage.amount, mortgage.firstmtgamt),
      lender: pickStr(mortgage.lender, mortgage.firstmtglender),
      date: pickStr(mortgage.date, mortgage.firstmtgdate),
      term: pickStr(mortgage.term),
    },

    ownership: {
      names: ownerNames,
      ownerOccupied: pickStr(summary.ownerOccupied, ownerObj.absenteeOwnerStatus, o1.ownerOccupied),
      mailingAddress: pickStr(ownerObj.mailingaddressoneline, op?.address?.oneLine),
      corporateOwner: pickStr(ownerObj.corporateindicator),
    },
  };
}
