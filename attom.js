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
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
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
  if (!detail.ok && detail.status === 401) { const e = new Error("ATTOM rejected the API key (401)."); e.code = "AUTH"; throw e; }
  const code = detail.json?.status?.code;
  if (!detail.json || code === undefined) { const e = new Error("ATTOM returned an unreadable response."); e.code = "UPSTREAM"; e.detail = detail.text?.slice(0, 300); throw e; }
  const prop = detail.json?.property?.[0];
  if (!prop || code !== 0) { const e = new Error("No property found for that address. Check spelling, or add the ZIP code."); e.code = "NOT_FOUND"; e.attomStatus = detail.json?.status; throw e; }

  let avm = null;
  try { const a = await attomGet("/propertyapi/v1.0.0/attomavm/detail", { address1, address2 }); avm = a.json?.property?.[0]?.avm || null; } catch {}

  let assessmentProp = null;
  try { const a = await attomGet("/propertyapi/v1.0.0/assessment/detail", { address1, address2 }); assessmentProp = a.json?.property?.[0] || null; } catch {}

  let saleProp = null;
  try { const s = await attomGet("/propertyapi/v1.0.0/saleshistory/detail", { address1, address2 }); saleProp = s.json?.property?.[0] || null; } catch {}

  let ownerProp = null;
  try { const o = await attomGet("/propertyapi/v1.0.0/property/detailowner", { address1, address2 }); ownerProp = o.json?.property?.[0] || null; } catch {}

  let mortgageProp = null;
  try { const m = await attomGet("/propertyapi/v1.0.0/property/detailmortgage", { address1, address2 }); mortgageProp = m.json?.property?.[0] || null; } catch {}

  const normalized = normalize(prop, avm, assessmentProp, saleProp, ownerProp, mortgageProp);

  // --- COMPS: nearby recent comparable sales via lat/lng radius, widening until enough ---
  let comps = { status: "not_attempted", count: 0, items: [], arv: null, pricePerSqftMedian: null };
  try {
    const lat = normalized.address.lat, lng = normalized.address.lng;
    if (lat && lng) {
      const tiers = [1, 2, 3]; // miles; larger radius is a strict superset of the smaller
      for (const radius of tiers) {
        const c = await attomGet("/propertyapi/v1.0.0/sale/snapshot", {
          latitude: lat, longitude: lng, radius,
        });
        const list = Array.isArray(c.json?.property) ? c.json.property : [];
        const probe = buildComps(list, normalized, c.status, c.text, { lat, lng, radius });
        comps = probe;
        if (probe.count >= 5) break; // good enough; don't keep paying for wider searches
      }
    } else {
      comps.status = "no_geo";
    }
  } catch (e) {
    comps.status = "error";
  }
  normalized.comps = comps;
  normalized.source = "ATTOM full v7 (profile+avm+assessment+sales+owner+mortgage+comps)";
  return normalized;
}

function median(nums) {
  const a = nums.filter((x) => typeof x === "number" && !isNaN(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number" || isNaN(v))) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function monthsAgoISO(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

const NONRES = /(commercial|vacant|land|industrial|agric|office|retail|warehouse|mobile)/i;

function buildComps(list, subject, httpStatus, rawText, geo) {
  const subjId = String(subject.attomId || "");
  const subjSqft = subject.building?.livingSqft || subject.building?.sizeSqft || null;
  const subjLat = geo?.lat ?? subject.address?.lat ?? null;
  const subjLng = geo?.lng ?? subject.address?.lng ?? null;
  const cutoff = monthsAgoISO(24); // recent sales only

  const raw = [];
  for (const pr of list) {
    const id = pr?.identifier || {};
    if (String(id.attomId || "") === subjId) continue; // skip the subject itself

    const sale = pr?.sale || {};
    const amt = Number(sale?.amount?.saleamt ?? sale?.saleamt ?? 0) || 0;
    if (amt < 1000) continue; // drop $0 / nominal / non-arms-length transfers

    const date = sale?.amount?.salerecdate ?? sale?.salesearchdate ?? sale?.saleTransDate ?? null;
    if (!date || String(date) < cutoff) continue; // must be a recent, dated sale

    const type = pr?.summary?.propclass || pr?.summary?.proptype || pr?.summary?.propertyType || null;
    if (type && NONRES.test(String(type))) continue; // residential-ish only

    const size = pr?.building?.size || {};
    const sqft = Number(size.universalsize ?? size.livingsize ?? size.bldgsize ?? 0) || null;
    // living-area band: skip footprints far from the subject when both are known
    if (subjSqft && sqft && (sqft < subjSqft * 0.6 || sqft > subjSqft * 1.5)) continue;

    const cLat = Number(pr?.location?.latitude) || null;
    const cLng = Number(pr?.location?.longitude) || null;
    const dist = subjLat && subjLng ? haversineMiles(subjLat, subjLng, cLat, cLng) : null;

    raw.push({
      address: pr?.address?.oneLine || pr?.address?.line1 || null,
      saleAmount: amt,
      saleDate: String(date),
      sqft,
      pricePerSqft: sqft ? Math.round(amt / sqft) : null,
      distanceMi: dist != null ? Math.round(dist * 100) / 100 : null,
      type,
    });
  }

  // trim $/sqft outliers (a flip or teardown otherwise wrecks the ARV)
  const ppsfAll = raw.map((r) => r.pricePerSqft).filter(Boolean);
  const med = median(ppsfAll);
  let filtered = raw;
  if (med && ppsfAll.length >= 4) {
    filtered = raw.filter((r) => !r.pricePerSqft || (r.pricePerSqft >= med * 0.5 && r.pricePerSqft <= med * 1.8));
  }

  // rank closest-and-most-recent first
  filtered.sort((a, b) => {
    const d = (a.distanceMi ?? 99) - (b.distanceMi ?? 99);
    if (Math.abs(d) > 0.25) return d;
    return (b.saleDate || "").localeCompare(a.saleDate || "");
  });

  const top = filtered.slice(0, 8);
  const ppsf = median(top.map((i) => i.pricePerSqft).filter(Boolean));
  const arvFromPpsf = ppsf && subjSqft ? Math.round(ppsf * subjSqft) : null;
  const arvFromMedian = median(top.map((i) => i.saleAmount).filter(Boolean));
  return {
    status: top.length ? "ok" : (httpStatus === 200 ? "empty" : "http_" + httpStatus),
    count: top.length,
    radiusMi: geo?.radius ?? null,
    subjectSqft: subjSqft,
    pricePerSqftMedian: ppsf,
    arv: arvFromPpsf || arvFromMedian,
    arvBasis: arvFromPpsf ? "median $/sqft of comps × subject sqft" : (arvFromMedian ? "median comp sale price" : null),
    filters: "≤" + (geo?.radius ?? "?") + "mi · last 24 mo · residential · living area within -40%/+50% of subject",
    items: top,
  };
}

function normalize(p, avm, ap, sp, op, mp) {
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

  const mtgList = mp?.mortgage || mp?.mortgageHistory || [];
  const mtg = Array.isArray(mtgList) && mtgList.length ? mtgList[0] : (mp?.mortgage || aAssessment?.mortgage || pAssessment?.mortgage || p.mortgage || {});
  const mtgAmt = mtg?.amount || {};
  const mtgLender = mtg?.lender || {};

  const ownerObj = op?.owner || op?.assessment?.owner || ap?.assessment?.owner || ap?.owner || p.owner || {};
  const o1 = ownerObj.owner1 || {};
  const o2 = ownerObj.owner2 || {};
  const buildName = (o) => { if (!o) return null; if (o.fullname) return o.fullname; const parts = [o.firstNameAndMi || o.firstname || o.firstName, o.lastname || o.lastName].filter(Boolean); return parts.length ? parts.join(" ") : null; };
  const ownerNames = [];
  const nm1 = buildName(o1); if (nm1) ownerNames.push(nm1);
  const nm2 = buildName(o2); if (nm2) ownerNames.push(nm2);
  if (!ownerNames.length && ownerObj.description) ownerNames.push(ownerObj.description);

  return {
    fetchedAt: new Date().toISOString(),
    source: "ATTOM full v7",
    attomId: pickStr(id.attomId, id.Id),
    apn: pickStr(id.apn, id.apnOrig),
    fips: pickStr(id.fips),
    address: {
      line1: n(addr.line1), line2: n(addr.line2),
      city: pickStr(addr.locality, addr.city),
      county: pickStr(addr.countrySubdName, p.area?.countrySecSubd),
      state: pickStr(addr.countrySubd), zip: pickStr(addr.postal1),
      full: [n(addr.line1), n(addr.line2)].filter(Boolean).join(", "),
      lat: num(p.location?.latitude), lng: num(p.location?.longitude),
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
    lot: { sizeAcres: pick(lot.lotsize1, aLot.lotsize1), sizeSqft: pick(lot.lotsize2, aLot.lotsize2), depthFt: pick(lot.depth, aLot.depth), frontageFt: pick(lot.frontage, aLot.frontage) },
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
      taxYear: pick(aTax.taxyear, pTax.taxyear), taxAmount: pick(aTax.taxamt, pTax.taxamt),
      avmValue: pick(avm?.amount?.value), avmHigh: pick(avm?.amount?.high), avmLow: pick(avm?.amount?.low),
      avmConfidence: pick(avm?.amount?.scr, avm?.condition?.score),
    },
    lastSale: { date: pickStr(lastSaleEntry?.saleTransDate, lastSaleEntry?.salesearchdate, saleAmt.salerecdate, p.sale?.saleTransDate), amount: pick(saleAmt.saleamt, p.sale?.amount?.saleamt), deedType: pickStr(saleAmt.saledoctype, lastSaleEntry?.saleTransType) },
    mortgage: {
      amount: pick(mtgAmt.mortgageamount, mtg.amount, mtg.firstmtgamt, mtgAmt.loanamount),
      lender: pickStr(mtgLender.lastname, mtgLender.companyName, mtg.lender, mtg.firstmtglender, mtg.lendername),
      date: pickStr(mtg.date, mtgAmt.mortgagedate, mtg.firstmtgdate, mtg.recordingDate),
      term: pickStr(mtg.term, mtgAmt.term), rate: pickStr(mtg.interestRate, mtgAmt.interestrate), loanType: pickStr(mtg.loanType, mtg.loantypecode),
    },
    ownership: {
      names: ownerNames,
      ownerOccupied: pickStr(summary.ownerOccupied, ownerObj.absenteeOwnerStatus, o1.ownerOccupied),
      mailingAddress: pickStr(ownerObj.mailingaddressoneline, op?.address?.oneLine),
      corporateOwner: pickStr(ownerObj.corporateindicator),
    },
  };
}
