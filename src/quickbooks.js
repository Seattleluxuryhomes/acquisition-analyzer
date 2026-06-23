// QuickBooks Online integration (per-contractor). Each contractor connects their
// OWN QuickBooks company via OAuth2; paid payments sync to their books as Sales
// Receipts. Entirely optional: if QBO_CLIENT_ID/SECRET are unset it's "not
// configured" and every entry point is a no-op (same pattern as billing/payments).
// No SDK — plain fetch + node:crypto. Tokens are server-only.
import crypto from "node:crypto";
import db from "./db.js";

const CLIENT_ID = () => process.env.QBO_CLIENT_ID || "";
const CLIENT_SECRET = () => process.env.QBO_CLIENT_SECRET || "";
// Development keys only work against the sandbox; production keys against the real
// API. Default sandbox so dev keys work out of the box; set QBO_ENVIRONMENT=production
// when you have production keys.
const SANDBOX = () => !/^prod/i.test(process.env.QBO_ENVIRONMENT || "sandbox");
const API_BASE = () => (SANDBOX() ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com");
const SECRET = () => process.env.BT_SIGNING_SECRET ||
  crypto.createHash("sha256").update("bidtranslator-dev-" + (process.env.HOSTNAME || "local")).digest("hex");

const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";

export function qboConfigured() {
  return !!CLIENT_ID() && !!CLIENT_SECRET();
}
export function qboStatus(user) {
  return {
    configured: qboConfigured(),
    connected: !!(user && user.qbo_realm_id && user.qbo_refresh_token),
    sandbox: SANDBOX(),
    connected_at: (user && user.qbo_connected_at) || null,
  };
}

// ---- OAuth state (signed so the callback can trust which user it's for) ----
const b64u = (s) => Buffer.from(s).toString("base64url");
function makeState(userId) {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return b64u(`${payload}.${sig}`);
}
function readState(state) {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const i = raw.lastIndexOf(".");
    const payload = raw.slice(0, i), sig = raw.slice(i + 1);
    const expect = crypto.createHmac("sha256", SECRET()).update(payload).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const [userId, ts] = payload.split(".");
    if (Date.now() - Number(ts) > 30 * 60 * 1000) return null; // 30-min window
    return userId;
  } catch { return null; }
}

export function authUrl(user, redirectUri) {
  const q = new URLSearchParams({
    client_id: CLIENT_ID(),
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri,
    state: makeState(user.id),
  });
  return `${AUTH_URL}?${q.toString()}`;
}

async function tokenRequest(body) {
  const basic = Buffer.from(`${CLIENT_ID()}:${CLIENT_SECRET()}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: "Basic " + basic, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) throw Object.assign(new Error(json?.error_description || "QuickBooks token error."), { status: 502 });
  return json;
}

// Exchange the auth code on callback; persist tokens + realmId on the user.
export async function handleCallback({ code, realmId, state, redirectUri }) {
  const userId = readState(state);
  if (!userId) throw Object.assign(new Error("Invalid or expired QuickBooks state."), { status: 400 });
  if (!code || !realmId) throw Object.assign(new Error("Missing QuickBooks code/realm."), { status: 400 });
  const tok = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  db.prepare(
    "UPDATE user SET qbo_realm_id=?, qbo_access_token=?, qbo_refresh_token=?, qbo_expires_at=?, qbo_connected_at=? WHERE id=?"
  ).run(realmId, tok.access_token, tok.refresh_token, Date.now() + (Number(tok.expires_in) || 3600) * 1000, Date.now(), userId);
  return userId;
}

export function disconnect(userId) {
  db.prepare("UPDATE user SET qbo_realm_id=NULL, qbo_access_token=NULL, qbo_refresh_token=NULL, qbo_expires_at=NULL, qbo_connected_at=NULL WHERE id=?").run(userId);
}

// Return a valid access token for the user, refreshing if it's near expiry.
async function freshToken(user) {
  if (!user.qbo_refresh_token) return null;
  if (user.qbo_access_token && user.qbo_expires_at && user.qbo_expires_at - Date.now() > 60 * 1000) {
    return user.qbo_access_token;
  }
  const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: user.qbo_refresh_token });
  // Intuit rotates the refresh token — store whatever it returns.
  db.prepare("UPDATE user SET qbo_access_token=?, qbo_refresh_token=?, qbo_expires_at=? WHERE id=?")
    .run(tok.access_token, tok.refresh_token || user.qbo_refresh_token, Date.now() + (Number(tok.expires_in) || 3600) * 1000, user.id);
  return tok.access_token;
}

async function qboApi(user, token, method, path, body) {
  const res = await fetch(`${API_BASE()}/v3/company/${user.qbo_realm_id}/${path}`, {
    method,
    headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.Fault?.Error?.[0]?.Message || "QuickBooks API error."), { status: 502, detail: json });
  return json;
}

// Find (or create) a service item to attach the sale to — QB requires a line item.
async function ensureItem(user, token) {
  const q = await qboApi(user, token, "GET", "query?query=" + encodeURIComponent("select Id from Item where Type='Service' maxresults 1"));
  const found = q?.QueryResponse?.Item?.[0];
  if (found) return found.Id;
  const acc = await qboApi(user, token, "GET", "query?query=" + encodeURIComponent("select Id from Account where AccountType='Income' maxresults 1"));
  const income = acc?.QueryResponse?.Account?.[0];
  if (!income) return null;
  const made = await qboApi(user, token, "POST", "item", {
    Name: "Bidtranslator Sale", Type: "Service", IncomeAccountRef: { value: income.Id },
  });
  return made?.Item?.Id || null;
}

// Record a collected payment as a Sales Receipt in the contractor's QB. Fire-and-
// forget from the payment webhook; never throws into the caller.
export async function syncSale(user, { amount, description, customer, date } = {}) {
  if (!qboConfigured() || !user || !user.qbo_refresh_token) return { skipped: true };
  if (!(Number(amount) > 0)) return { skipped: true };
  try {
    const token = await freshToken(user);
    if (!token) return { skipped: true };
    const itemId = await ensureItem(user, token);
    if (!itemId) return { error: "no income account" };
    const body = {
      TxnDate: date ? new Date(date).toISOString().slice(0, 10) : undefined,
      PrivateNote: description || "Bidtranslator payment",
      Line: [{
        Amount: Number(amount),
        DetailType: "SalesItemLineDetail",
        Description: description || "Construction work",
        SalesItemLineDetail: { ItemRef: { value: itemId } },
      }],
      ...(customer ? { CustomerMemo: { value: String(customer).slice(0, 100) } } : {}),
    };
    const res = await qboApi(user, token, "POST", "salesreceipt", body);
    return { ok: true, id: res?.SalesReceipt?.Id || null };
  } catch (e) {
    return { error: e.message || "sync failed" };
  }
}
