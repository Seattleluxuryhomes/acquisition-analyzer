// Outbound prospecting — the clean integration layer (Gojiberry, provider-agnostic).
//
// The provider API key lives ONLY here, read from the environment — never sent to
// the browser (same rule as the AI key). Calls go through one isolated adapter so
// the day we have Gojiberry's real endpoint/response (or swap to a Google-Maps local
// source), it's a single-function change. Until configured, search() throws a clear
// "not connected" error and the UI shows a connect state — nothing silently fails.
//
// Config (env only — do NOT hard-code):
//   GOJIBERRY_API_KEY    the secret key
//   GOJIBERRY_BASE_URL   API base, e.g. https://api.gojiberry.ai/v1   (no trailing /)
//   GOJIBERRY_SEARCH_PATH  search endpoint path (default "search")
//   PROSPECTING_PROVIDER  which provider to use (default "gojiberry")

const PROVIDER = () => (process.env.PROSPECTING_PROVIDER || "gojiberry").toLowerCase();
const KEY = () => process.env.GOJIBERRY_API_KEY || "";
const BASE = () => (process.env.GOJIBERRY_BASE_URL || "").replace(/\/+$/, "");
const SEARCH_PATH = () => (process.env.GOJIBERRY_SEARCH_PATH || "search").replace(/^\/+/, "");

export function prospectingConfigured() {
  return !!KEY() && !!BASE();
}
export function prospectingStatus() {
  return { configured: prospectingConfigured(), provider: PROVIDER(), has_key: !!KEY(), has_base: !!BASE() };
}

// Normalize ANY provider record into our prospect shape. This is the ONE place to
// adjust when we see Gojiberry's real response — it just maps field names. It reads
// a generous set of common keys so a reasonable response maps without changes.
export function normalizeProspect(r = {}, source = PROVIDER()) {
  const pick = (...keys) => { for (const k of keys) { const v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), r); if (v != null && v !== "") return String(v); } return ""; };
  return {
    name: pick("name", "business_name", "company", "company_name", "businessName").slice(0, 200),
    contact_name: pick("contact_name", "contact", "owner", "person", "full_name", "contactName").slice(0, 160),
    trade: pick("trade", "category", "industry", "vertical").slice(0, 80),
    business_type: pick("business_type", "type", "businessType").slice(0, 80),
    phone: pick("phone", "phone_number", "telephone", "tel", "phoneNumber").slice(0, 40),
    email: pick("email", "email_address", "contact_email").slice(0, 160),
    website: pick("website", "url", "domain", "web").slice(0, 200),
    address: pick("address", "street", "address1", "formatted_address").slice(0, 200),
    city: pick("city", "locality", "town").slice(0, 80),
    state: pick("state", "region", "province", "state_code").slice(0, 40),
    source,
    raw: r,
  };
}

// Search the configured provider. Returns an array of normalized prospects.
// Throws { code:'PROSPECTING_UNCONFIGURED' } when not connected (graceful UI state).
export async function search({ trade, city, state, keyword, businessType, limit } = {}) {
  if (!prospectingConfigured()) {
    const e = new Error("Prospecting is not connected. Set GOJIBERRY_API_KEY + GOJIBERRY_BASE_URL.");
    e.status = 503; e.code = "PROSPECTING_UNCONFIGURED"; throw e;
  }
  // A reasonable, generic request. ADJUST the body/params + the response path to the
  // real Gojiberry contract once we have their docs — both are isolated right here.
  const body = {
    query: [keyword, trade, businessType].filter(Boolean).join(" ").trim(),
    filters: { trade: trade || undefined, business_type: businessType || undefined, city: city || undefined, state: state || undefined },
    location: [city, state].filter(Boolean).join(", "),
    limit: Math.min(Number(limit) || 25, 50),
  };
  let res;
  try {
    res = await fetch(`${BASE()}/${SEARCH_PATH()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + KEY() },
      body: JSON.stringify(body),
    });
  } catch {
    const e = new Error("Could not reach the prospecting provider."); e.status = 502; throw e;
  }
  if (!res.ok) {
    const e = new Error(`Prospecting provider error (${res.status}). Check the key/endpoint.`); e.status = 502; throw e;
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  // Pull the result array from whichever common envelope the provider uses.
  const arr = Array.isArray(data) ? data
    : (data && (data.results || data.data || data.prospects || data.leads || data.items)) || [];
  return (Array.isArray(arr) ? arr : []).slice(0, 50).map((r) => normalizeProspect(r));
}
