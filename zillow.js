// zillow.js — resolve a property "listing" (facts + photos) for the showcase.
//
// Reality check: Zillow / Redfin / Realtor all block automated page fetches
// (403). So we assemble a listing from sources that actually work:
//   1. ATTOM (already wired into this app) — beds/baths/sqft/year/lot/value.
//   2. Zillow via RapidAPI — list price + photos, ONLY if RAPIDAPI_KEY is set.
//   3. Whatever the user uploads/enters by hand (handled in the route).
// Every source is best-effort; missing data stays null and the UI shows it.
import { fetchProperty } from "./attom.js";

const num = (v) => (v === undefined || v === null || v === "" || isNaN(+v) ? null : +v);

// Parse a Zillow homedetails URL into a best-effort address + zpid.
// e.g. .../homedetails/11102-126th-Avenue-NE-Kirkland-WA-98033/49096885_zpid/
export function parseZillowUrl(input) {
  const url = String(input || "").trim();
  const out = { address: null, zpid: null, slug: null };
  if (!url) return out;
  const z = url.match(/(\d+)_zpid/);
  if (z) out.zpid = z[1];
  const m = url.match(/homedetails\/([^/]+)/);
  if (m) {
    const slug = decodeURIComponent(m[1]).replace(/-/g, " ").trim();
    out.slug = slug;
    // Try to split "<street> <City> <ST> <ZIP>" into "street, City ST ZIP".
    // City is assumed single-word (best effort — the user can correct it).
    const sz = slug.match(/^(.*?)\s+([A-Za-z.']+)\s+([A-Za-z]{2})\s+(\d{5})$/);
    out.address = sz ? `${sz[1]}, ${sz[2]} ${sz[3]} ${sz[4]}` : slug;
  }
  return out;
}

function emptyListing() {
  return {
    address: null, zpid: null,
    price: null, priceLabel: null,
    beds: null, baths: null, sqft: null, yearBuilt: null, lotSqft: null,
    description: null, features: [], photos: [], sources: [], warnings: [],
  };
}

// Pull facts from ATTOM (best-effort). AVM/market value is used as a price
// proxy when no MLS list price is available.
async function addAttomFacts(listing) {
  try {
    const p = await fetchProperty(listing.address);
    listing.beds = listing.beds ?? p.property?.bedrooms ?? null;
    listing.baths = listing.baths ?? p.property?.bathrooms ?? null;
    listing.sqft = listing.sqft ?? p.building?.livingSqft ?? p.building?.sizeSqft ?? null;
    listing.yearBuilt = listing.yearBuilt ?? p.property?.yearBuilt ?? null;
    listing.lotSqft = listing.lotSqft ?? p.lot?.sizeSqft ?? null;
    if (listing.price == null) {
      const est = p.valuation?.avmValue ?? p.valuation?.marketTotal ?? null;
      if (est != null) { listing.price = est; listing.priceLabel = "Est. value (ATTOM AVM)"; }
    }
    listing.sources.push("ATTOM");
  } catch (e) {
    listing.warnings.push("ATTOM: " + e.message);
  }
}

function extractPhotos(d) {
  const urls = new Set();
  const isImg = (s) => typeof s === "string" && /^https?:\/\//.test(s) && /\.(jpe?g|png|webp)(\?|$)/i.test(s);
  const walk = (node, depth) => {
    if (!node || depth > 6) return;
    if (typeof node === "string") { if (isImg(node)) urls.add(node); return; }
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    if (typeof node === "object") {
      for (const v of Object.values(node)) walk(v, depth + 1);
    }
  };
  walk(d.photos ?? d.images ?? d.originalPhotos ?? d, 0);
  if (!urls.size && isImg(d.imgSrc)) urls.add(d.imgSrc);
  return [...urls].slice(0, 12);
}

// Optional: fetch list price + photos from a Zillow RapidAPI provider.
// Configure host with RAPIDAPI_ZILLOW_HOST (default zillow-com1).
async function addRapidApiZillow(listing, zillowUrl) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) { listing.warnings.push("Zillow auto-fetch skipped: RAPIDAPI_KEY not set (using ATTOM + uploads)."); return; }
  const host = process.env.RAPIDAPI_ZILLOW_HOST || "zillow-com1.p.rapidapi.com";
  const qs = new URLSearchParams();
  if (listing.zpid) qs.set("zpid", listing.zpid);
  else if (zillowUrl) qs.set("property_url", zillowUrl);
  else return;
  try {
    const res = await fetch(`https://${host}/property?${qs}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": host },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const d = await res.json();
    const price = num(d.price);
    if (price != null) { listing.price = price; listing.priceLabel = "List price (Zillow)"; }
    listing.beds = num(d.bedrooms) ?? listing.beds;
    listing.baths = num(d.bathrooms) ?? listing.baths;
    listing.sqft = num(d.livingArea ?? d.livingAreaValue) ?? listing.sqft;
    listing.yearBuilt = num(d.yearBuilt) ?? listing.yearBuilt;
    if (d.description) listing.description = d.description;
    const photos = extractPhotos(d);
    if (photos.length) listing.photos = photos;
    listing.sources.push("Zillow(RapidAPI)");
  } catch (e) {
    listing.warnings.push("Zillow(RapidAPI): " + e.message);
  }
}

// Resolve a listing from a Zillow URL and/or a typed address.
export async function resolveListing({ zillowUrl, address } = {}) {
  const listing = emptyListing();
  const parsed = zillowUrl ? parseZillowUrl(zillowUrl) : {};
  listing.zpid = parsed.zpid || null;
  listing.address = (address && address.trim()) || parsed.address || null;
  if (listing.address) await addAttomFacts(listing);
  await addRapidApiZillow(listing, zillowUrl);
  if (!listing.address) listing.warnings.push("No address resolved — enter the address manually.");
  return listing;
}
