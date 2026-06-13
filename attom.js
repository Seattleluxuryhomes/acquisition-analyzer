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
  const prop =
