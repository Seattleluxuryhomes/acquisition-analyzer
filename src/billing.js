// Subscription billing via Stripe. Talks to Stripe's REST API with fetch (no SDK
// dependency) and verifies webhooks with node:crypto. Entirely optional: if
// STRIPE_SECRET_KEY is unset, billing is "not configured" and every user is
// treated as entitled, so the app runs fully without it (same pattern as the AI step).
import crypto from "node:crypto";
import db from "./db.js";

const KEY = () => process.env.STRIPE_SECRET_KEY || "";
const PRICE = () => process.env.STRIPE_PRICE_ID || "";
// Optional one-time signup fee (a one-time Price). Charged on the first
// subscription checkout only — see createCheckout + handleEvent.
const SETUP_PRICE = () => process.env.STRIPE_SETUP_PRICE_ID || "";
const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET || "";
// Optional: collect sales tax automatically via Stripe Tax. Off unless set, so
// checkout never breaks before Stripe Tax is enabled + registered in the account.
const TAX_ENABLED = () => /^(1|true|yes|on)$/i.test(process.env.BT_STRIPE_TAX || "");
const TRIAL_DAYS = () => Math.max(0, Number(process.env.BT_TRIAL_DAYS || 14));

export function billingConfigured() {
  return !!KEY() && !!PRICE();
}

// A user can use paid features if billing is off, OR they hold an active/trialing
// Stripe subscription. The trial is now a Stripe trial (card on file, so it can
// auto-charge at the end), so entitlement comes from the subscription itself.
export function isEntitled(user) {
  if (!billingConfigured()) return true;
  const status = user.subscription_status;
  if (status === "active" || status === "trialing") {
    if (!user.current_period_end || user.current_period_end > Date.now() - 3 * 24 * 60 * 60 * 1000) return true;
  }
  return false;
}

export function billingStatus(user) {
  const entitled = isEntitled(user);
  const status = user.subscription_status || "none";
  const inTrial = status === "trialing";
  return {
    configured: billingConfigured(),
    entitled,
    status,
    in_trial: inTrial,
    // During a trial, current_period_end is the day the card gets charged.
    trial_ends_at: inTrial ? (user.current_period_end || null) : null,
    current_period_end: user.current_period_end || null,
    has_subscription: !!user.stripe_subscription_id,
  };
}

// Express middleware: 402 for paid-only actions when not entitled.
export function requireEntitled(req, res, next) {
  if (isEntitled(req.user)) return next();
  res.status(402).json({
    error: "Your free trial has ended. Subscribe to create and send new bids.",
    code: "SUBSCRIPTION_REQUIRED",
  });
}

// ---- Stripe REST helpers ----
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) form(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => form({ [i]: item }, key, out));
    else if (v != null) out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

async function stripe(path, body) {
  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + KEY(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body ? form(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Could not reach the payment provider. Try again."), { status: 502 });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON (proxy/HTML error page) */ }
  if (!res.ok) {
    throw Object.assign(new Error(json?.error?.message || "Payment provider error."), { status: 502 });
  }
  if (!json) throw Object.assign(new Error("Unexpected response from payment provider."), { status: 502 });
  return json;
}

async function ensureCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const cust = await stripe("customers", { email: user.email, metadata: { user_id: user.id } });
  db.prepare("UPDATE user SET stripe_customer_id=? WHERE id=?").run(cust.id, user.id);
  return cust.id;
}

export async function createCheckout(user, baseUrl) {
  if (!billingConfigured()) { const e = new Error("Billing is not configured."); e.status = 503; throw e; }
  const customer = await ensureCustomer(user);
  // Start a free trial with the card on file so the plan auto-charges when the
  // trial ends. The one-time setup fee is NOT a line item here — a one-time line
  // item would bill immediately; instead it's added to the first real invoice at
  // trial end (see handleEvent → invoice.created). payment_method_collection
  // "always" forces a card even though $0 is due today.
  const params = {
    mode: "subscription",
    customer,
    line_items: [{ price: PRICE(), quantity: 1 }],
    subscription_data: { trial_period_days: TRIAL_DAYS() },
    payment_method_collection: "always",
    success_url: `${baseUrl}/?billing=success`,
    cancel_url: `${baseUrl}/?billing=cancel`,
    allow_promotion_codes: true,
  };
  if (TAX_ENABLED()) {
    params.automatic_tax = { enabled: true };
    params.customer_update = { address: "auto" };
    params.billing_address_collection = "required";
  }
  const session = await stripe("checkout/sessions", params);
  return session.url;
}

export async function createPortal(user, baseUrl) {
  if (!billingConfigured()) { const e = new Error("Billing is not configured."); e.status = 503; throw e; }
  if (!user.stripe_customer_id) { const e = new Error("No billing account yet — subscribe first."); e.status = 400; throw e; }
  const session = await stripe("billing_portal/sessions", {
    customer: user.stripe_customer_id,
    return_url: `${baseUrl}/?billing=portal`,
  });
  return session.url;
}

// ---- Webhook ----
export function verifyWebhook(rawBody, sigHeader) {
  const secret = WEBHOOK_SECRET();
  if (!secret) throw Object.assign(new Error("Webhook secret not set."), { status: 500 });
  const parts = Object.fromEntries(String(sigHeader || "").split(",").map((kv) => kv.split("=")));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) throw Object.assign(new Error("Bad signature header."), { status: 400 });
  const signed = `${t}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  let ok = false;
  try { ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected)); } catch { ok = false; }
  if (!ok) throw Object.assign(new Error("Signature mismatch."), { status: 400 });
  // Guard against replay (5 min tolerance).
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw Object.assign(new Error("Stale event."), { status: 400 });
  return JSON.parse(rawBody);
}

function applySubscription(customerId, sub) {
  const row = db.prepare("SELECT id FROM user WHERE stripe_customer_id=?").get(customerId);
  if (!row) return;
  db.prepare(
    "UPDATE user SET subscription_status=?, stripe_subscription_id=?, current_period_end=? WHERE id=?"
  ).run(sub.status || "none", sub.id || null, sub.current_period_end ? sub.current_period_end * 1000 : null, row.id);
}

export async function handleEvent(event) {
  const obj = event?.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
      // The trial subscription is created; subscription.* events fill in status.
      if (obj.customer && obj.subscription) {
        const row = db.prepare("SELECT id FROM user WHERE stripe_customer_id=?").get(obj.customer);
        if (row) db.prepare("UPDATE user SET stripe_subscription_id=?, subscription_status=? WHERE id=?")
          .run(obj.subscription, "trialing", row.id);
      }
      break;
    case "invoice.created": {
      // The first real charge fires when the trial ends (billing_reason
      // "subscription_cycle"). While that invoice is still a draft, add the
      // one-time setup fee so it bills together with the first month — once only.
      if (obj.subscription && obj.billing_reason === "subscription_cycle" && SETUP_PRICE() && obj.status === "draft") {
        const row = db.prepare("SELECT * FROM user WHERE stripe_customer_id=?").get(obj.customer);
        if (row && !row.setup_fee_paid) {
          await stripe("invoiceitems", {
            customer: obj.customer, price: SETUP_PRICE(), invoice: obj.id, subscription: obj.subscription,
          });
          db.prepare("UPDATE user SET setup_fee_paid=1 WHERE id=?").run(row.id);
        }
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      applySubscription(obj.customer, obj);
      break;
    default:
      break;
  }
}
