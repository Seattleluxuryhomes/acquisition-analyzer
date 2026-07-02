// "Get paid" — contractors collect payment from homeowners via Stripe Connect.
// Each contractor onboards their OWN Stripe (Express) account; charges are made
// directly on that account, so the money goes straight to the contractor and the
// platform never holds funds. Like billing.js, this is optional: with no
// STRIPE_SECRET_KEY it reports "not configured" and the UI hides the feature.
import crypto from "node:crypto";
import db from "./db.js";
import { track } from "./analytics.js";
import * as QuickBooks from "./quickbooks.js";

const KEY = () => process.env.STRIPE_SECRET_KEY || "";

export function paymentsConfigured() {
  return !!KEY();
}

// ---- Stripe REST helper (no SDK). Supports GET/POST and acting on a connected
// account via the Stripe-Account header (that's what makes a charge "direct"). ----
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) form(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => form({ [i]: item }, key, out));
    else if (v != null) out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

async function stripe(path, { method = "POST", body, account } = {}) {
  const headers = {
    Authorization: "Bearer " + KEY(),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (account) headers["Stripe-Account"] = account; // act on the connected account
  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/" + path, {
      method,
      headers,
      body: method === "POST" && body ? form(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Could not reach the payment provider. Try again."), { status: 502 });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error page */ }
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message || "Payment provider error."), { status: 502 });
  }
  if (!json) throw Object.assign(new Error("Unexpected response from payment provider."), { status: 502 });
  return json;
}

// ---- Connect onboarding ----
async function ensureConnectAccount(user) {
  if (user.stripe_connect_account_id) return user.stripe_connect_account_id;
  const acct = await stripe("accounts", {
    body: {
      type: "express",
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: { name: user.company || undefined },
      metadata: { user_id: user.id },
    },
  });
  db.prepare("UPDATE user SET stripe_connect_account_id=? WHERE id=?").run(acct.id, user.id);
  return acct.id;
}

// Returns a Stripe-hosted onboarding URL the contractor completes once.
export async function startOnboarding(user, baseUrl) {
  if (!paymentsConfigured()) { const e = new Error("Payments are not configured."); e.status = 503; throw e; }
  const account = await ensureConnectAccount(user);
  const link = await stripe("account_links", {
    body: {
      account,
      refresh_url: `${baseUrl}/?payments=refresh`,
      return_url: `${baseUrl}/?payments=connected`,
      type: "account_onboarding",
    },
  });
  return link.url;
}

// Pull the live account state from Stripe and cache whether it can take charges.
export async function refreshConnectStatus(user) {
  if (!paymentsConfigured() || !user.stripe_connect_account_id) return connectStatus(user);
  const acct = await stripe("accounts/" + user.stripe_connect_account_id, { method: "GET" });
  const enabled = acct.charges_enabled ? 1 : 0;
  db.prepare("UPDATE user SET connect_charges_enabled=? WHERE id=?").run(enabled, user.id);
  return { ...connectStatus(user), charges_enabled: !!enabled, details_submitted: !!acct.details_submitted };
}

export function connectStatus(user) {
  return {
    configured: paymentsConfigured(),
    connected: !!user.stripe_connect_account_id,
    charges_enabled: !!user.connect_charges_enabled,
  };
}

// ---- Payment requests ----
const MAX_CENTS = 100 * 1000 * 1000; // $1,000,000 sanity cap

function rowToRequest(r) {
  if (!r) return null;
  return {
    id: r.id,
    job_id: r.job_id || null,
    amount: r.amount_cents / 100,
    description: r.description || "",
    client_name: r.client_name || "",
    status: r.status,
    url: r.checkout_url || null,
    created_at: r.created_at,
    paid_at: r.paid_at || null,
  };
}

export function listPaymentRequests(userId, jobId) {
  const rows = jobId
    ? db.prepare("SELECT * FROM payment_request WHERE user_id=? AND job_id=? ORDER BY created_at DESC").all(userId, jobId)
    : db.prepare("SELECT * FROM payment_request WHERE user_id=? ORDER BY created_at DESC").all(userId);
  return rows.map(rowToRequest);
}

export async function createPaymentRequest(user, { amount, description, clientName, jobId, successUrl, cancelUrl }, baseUrl) {
  if (!paymentsConfigured()) { const e = new Error("Payments are not configured."); e.status = 503; throw e; }
  if (!user.stripe_connect_account_id || !user.connect_charges_enabled) {
    const e = new Error("Finish setting up payments before sending a request.");
    e.status = 400; e.code = "CONNECT_INCOMPLETE"; throw e;
  }
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents < 100) { const e = new Error("Enter an amount of at least $1."); e.status = 400; throw e; }
  if (cents > MAX_CENTS) { const e = new Error("That amount is too large."); e.status = 400; throw e; }

  const id = crypto.randomBytes(9).toString("base64url");
  const desc = String(description || "Construction work").slice(0, 200);
  const name = String(clientName || "").slice(0, 120);
  const account = user.stripe_connect_account_id;

  // Direct charge on the contractor's connected account. Omitting
  // payment_method_types lets each contractor turn Klarna/Affirm on/off from their
  // own Stripe dashboard (that's all step #4 needs).
  // APPROVAL: client-action — a hosted Checkout the client opens and pays; the contractor
  // set the amount. Nothing is charged without the client's explicit payment. No auto-charge.
  const session = await stripe("checkout/sessions", {
    account,
    body: {
      mode: "payment",
      success_url: successUrl || `${baseUrl}/pay/done?ok=1`,
      cancel_url: cancelUrl || `${baseUrl}/pay/done?ok=0`,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: { name: desc },
        },
      }],
      payment_intent_data: { description: desc },
      metadata: { payment_request_id: id, user_id: user.id },
    },
  });

  const now = Date.now();
  db.prepare(`INSERT INTO payment_request
    (id, user_id, job_id, amount_cents, description, client_name, status,
     stripe_session_id, checkout_url, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, user.id, jobId || null, cents, desc, name, "pending",
    session.id, session.url || null, now
  );
  return rowToRequest(db.prepare("SELECT * FROM payment_request WHERE id=?").get(id));
}

// Mark a payment request paid + run the side effects ONCE. Shared by the Stripe
// webhook and the read-time reconciler so both paths are identical and idempotent.
function markPaid(row, paymentIntent) {
  if (!row || row.status === "paid") return false;
  db.prepare("UPDATE payment_request SET status='paid', stripe_payment_intent=COALESCE(?, stripe_payment_intent), paid_at=? WHERE id=?")
    .run(paymentIntent || null, Date.now(), row.id);
  track(row.user_id, "deposit_paid", { jobId: row.job_id || null, amount: (row.amount_cents || 0) / 100 });
  // Sync into the contractor's QuickBooks (no-op unless connected). Fire-and-forget.
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(row.user_id);
  if (owner) QuickBooks.syncSale(owner, { amount: (row.amount_cents || 0) / 100, description: row.description, customer: row.client_name, date: Date.now() }).catch(() => {});
  return true;
}

// Self-healing collected revenue: a payment is normally marked paid by Stripe's
// `checkout.session.completed` webhook — but if that webhook isn't delivered (Connect
// events not enabled, wrong endpoint/secret, transient miss), the request would sit
// `pending` forever and the dashboard would under-report real money. So on read we
// also VERIFY recent pending requests directly with Stripe and mark any that actually
// paid. Bounded (recent + capped) and fully best-effort — never throws, never blocks.
export async function reconcilePending(user) {
  if (!paymentsConfigured() || !user || !user.stripe_connect_account_id) return 0;
  const account = user.stripe_connect_account_id;
  const cutoff = Date.now() - 35 * 86400000; // only recent sessions; older ones have expired
  const rows = db.prepare(
    "SELECT * FROM payment_request WHERE user_id=? AND status='pending' AND stripe_session_id IS NOT NULL AND created_at > ? ORDER BY created_at DESC LIMIT 25"
  ).all(user.id, cutoff);
  let updated = 0;
  for (const row of rows) {
    try {
      const session = await stripe("checkout/sessions/" + row.stripe_session_id, { method: "GET", account });
      if (session && (session.payment_status === "paid" || session.status === "complete")) {
        if (markPaid(row, session.payment_intent || null)) updated++;
      }
    } catch { /* skip this one — the dashboard must still load */ }
  }
  return updated;
}

export function cancelPaymentRequest(userId, id) {
  const row = db.prepare("SELECT * FROM payment_request WHERE id=? AND user_id=?").get(id, userId);
  if (!row) return null;
  if (row.status === "pending") {
    db.prepare("UPDATE payment_request SET status='canceled' WHERE id=?").run(id);
  }
  return rowToRequest(db.prepare("SELECT * FROM payment_request WHERE id=?").get(id));
}

// ---- Webhook events (Connect) ----
// Shares the billing webhook endpoint/secret. Connect events carry a top-level
// `account`; we match our row by the checkout session id (or its metadata).
export function handleEvent(event) {
  const obj = event?.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed": {
      const reqId = obj.metadata?.payment_request_id;
      const row = reqId
        ? db.prepare("SELECT * FROM payment_request WHERE id=?").get(reqId)
        : db.prepare("SELECT * FROM payment_request WHERE stripe_session_id=?").get(obj.id);
      markPaid(row, obj.payment_intent || null);   // idempotent; shared with the reconciler
      break;
    }
    case "checkout.session.expired": {
      // The customer opened Checkout but abandoned it (Stripe expires the session).
      // The job stays Signed / Payment Pending — we just log the audit event.
      const reqId = obj.metadata?.payment_request_id;
      const row = reqId
        ? db.prepare("SELECT * FROM payment_request WHERE id=?").get(reqId)
        : db.prepare("SELECT * FROM payment_request WHERE stripe_session_id=?").get(obj.id);
      if (row && row.status === "pending") {
        track(row.user_id, "payment_failed", { jobId: row.job_id || null, amount: (row.amount_cents || 0) / 100, reason: "checkout_abandoned" });
      }
      break;
    }
    case "account.updated": {
      // Keep the contractor's "can take charges" flag fresh as they finish onboarding.
      if (obj.id) {
        db.prepare("UPDATE user SET connect_charges_enabled=? WHERE stripe_connect_account_id=?")
          .run(obj.charges_enabled ? 1 : 0, obj.id);
      }
      break;
    }
    default:
      break;
  }
}
