// Subscription billing via Stripe. Talks to Stripe's REST API with fetch (no SDK
// dependency) and verifies webhooks with node:crypto. Entirely optional: if
// STRIPE_SECRET_KEY is unset, billing is "not configured" and every user is
// treated as entitled, so the app runs fully without it (same pattern as the AI step).
import crypto from "node:crypto";
import db from "./db.js";
import { track } from "./analytics.js";
import { referralStatus, agentStatus, agentFreeActive } from "./referrals.js";
import * as Credits from "./referralCredits.js";

const KEY = () => process.env.STRIPE_SECRET_KEY || "";
const PRICE = () => process.env.STRIPE_PRICE_ID || "";
// Optional one-time signup fee (a one-time Price). Charged on the first
// subscription checkout only — see createCheckout + handleEvent.
const SETUP_PRICE = () => process.env.STRIPE_SETUP_PRICE_ID || "";
// Display amount for the setup fee (dollars). Off (0) until we turn it on — the
// plan is to switch this on when we start running ads, so cold/ad signups cover
// the ad spend. Set BT_SETUP_FEE=299 (and configure STRIPE_SETUP_PRICE_ID to a
// matching $299 one-time Price) to enable it.
const SETUP_FEE_DISPLAY = () => Number(process.env.BT_SETUP_FEE || 0);
// The setup fee is WAIVED for founders (rate-locked / Founding Member) and for anyone who
// came in through a referral link — only cold signups (ads) pay it.
function setupWaived(user) {
  return !!(user && (user.locked_monthly != null || user.founding_member || user.referred_by));
}
const WEBHOOK_SECRET = () => process.env.STRIPE_WEBHOOK_SECRET || "";
// Optional: collect sales tax automatically via Stripe Tax. Off unless set, so
// checkout never breaks before Stripe Tax is enabled + registered in the account.
const TAX_ENABLED = () => /^(1|true|yes|on)$/i.test(process.env.BT_STRIPE_TAX || "");

export function billingConfigured() {
  return !!KEY() && !!PRICE();
}

// A user can use paid features if billing is off, OR they hold an active/trialing
// Stripe subscription, OR they're still inside the card-free in-app trial. The
// trial needs no card so people can start using the app immediately; they only
// get charged when they actively choose to subscribe (no surprise auto-charge).
export function isEntitled(user) {
  if (!billingConfigured()) return true;
  // Real-estate agents are entitled for their whole free first year (no card).
  if (agentFreeActive(user)) return true;
  const status = user.subscription_status;
  if (status === "active" || status === "trialing") {
    if (!user.current_period_end || user.current_period_end > Date.now() - 3 * 24 * 60 * 60 * 1000) return true;
  }
  if (user.trial_ends_at && Date.now() < user.trial_ends_at) return true;
  return false;
}

// Cached display prices (in dollars) pulled from Stripe so the paywall copy
// always matches what checkout actually charges. null = unknown (not configured
// or fetch failed); 0 = explicitly none (e.g. no setup fee Price set).
let priceCache = { monthly: null, setup: null };
export async function loadPrices() {
  if (!billingConfigured()) { priceCache = { monthly: null, setup: 0 }; return priceCache; }
  try { const p = await stripeGet("prices/" + PRICE()); priceCache.monthly = (p.unit_amount || 0) / 100; } catch { /* leave null */ }
  if (SETUP_PRICE()) { try { const s = await stripeGet("prices/" + SETUP_PRICE()); priceCache.setup = (s.unit_amount || 0) / 100; } catch { /* leave null */ } }
  else priceCache.setup = 0; // no setup-fee Price configured → genuinely none
  return priceCache;
}

export function billingStatus(user) {
  const entitled = isEntitled(user);
  const inTrial = !!(user.trial_ends_at && Date.now() < user.trial_ends_at);
  return {
    configured: billingConfigured(),
    entitled,
    status: user.subscription_status || "none",
    in_trial: inTrial,
    trial_ends_at: user.trial_ends_at || null,
    current_period_end: user.current_period_end || null,
    has_subscription: !!user.stripe_subscription_id,
    // Monthly price (dollars). A Founding Member sees their locked rate (captured from
    // Stripe at activation); otherwise the live Stripe price, then the display fallback.
    monthly: user.founding_price_cents != null ? user.founding_price_cents / 100
      : (priceCache.monthly != null ? priceCache.monthly : referralStatus(user).base),
    founding_member: !!user.founding_member,
    // Setup fee: the configured amount, ZEROED when waived (founders + referral signups).
    // setup_fee_base is the un-waived amount so the UI can say "waived".
    setup_fee: setupWaived(user) ? 0 : (SETUP_FEE_DISPLAY() || priceCache.setup || 0),
    setup_fee_base: SETUP_FEE_DISPLAY() || priceCache.setup || 0,
    setup_waived: setupWaived(user),
    // Referral: attribution + the credit-ledger summary (give-a-month/get-a-month,
    // 12/calendar-year cap). No per-sub price ladder anymore — credits are discrete.
    referral: { ...referralStatus(user), credits: Credits.summary(user.id) },
    // Agent persona (null for contractors): free-first-year countdown + T-90 nudge.
    agent: agentStatus(user),
  };
}

// Express middleware: 402 for paid-only actions when not entitled.
export function requireEntitled(req, res, next) {
  if (isEntitled(req.user)) return next();
  res.status(402).json({
    error: "Your free trial has ended. Subscribe to use AI and premium features. Building and sending bids by hand stays free.",
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

// opts.idempotencyKey → Stripe's Idempotency-Key header: retrying/re-posting the same key
// (e.g. reconcile after an ambiguous timeout) returns the ORIGINAL result instead of creating
// a second object. Essential for the money-moving balance-credit push.
async function stripe(path, body, opts = {}) {
  const headers = {
    Authorization: "Bearer " + KEY(),
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = String(opts.idempotencyKey);
  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/" + path, {
      method: "POST",
      headers,
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

async function stripeGet(path) {
  let res;
  try {
    res = await fetch("https://api.stripe.com/v1/" + path, { headers: { Authorization: "Bearer " + KEY() } });
  } catch {
    throw Object.assign(new Error("Could not reach the payment provider."), { status: 502 });
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok) throw Object.assign(new Error(json?.error?.message || "Payment provider error."), { status: 502 });
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
  // The free trial already happened in the app (card-free), so subscribing bills
  // now: the recurring plan plus the one-time setup fee (first checkout only). A
  // one-time price in a subscription-mode session lands on the first invoice.
  const line_items = [{ price: PRICE(), quantity: 1 }];
  // The one-time setup fee — only for cold signups (not founders or crew/referral),
  // and only once. Waived signups never see the line item.
  if (SETUP_PRICE() && !user.setup_fee_paid && !setupWaived(user)) line_items.push({ price: SETUP_PRICE(), quantity: 1 });
  const params = {
    mode: "subscription",
    customer,
    line_items,
    success_url: `${baseUrl}/?billing=success`,
    cancel_url: `${baseUrl}/?billing=cancel`,
  };
  // Give-a-month: a referred company gets its FIRST MONTH FREE — a once-100%-off coupon
  // applied at checkout (price-agnostic, deterministic). Recorded in the ledger for audit.
  // Stripe rejects discounts + the promo-code field together, so offer promo codes only
  // when there's no welcome credit to apply.
  const welcome = await refereeWelcomeCoupon(user).catch(() => null);
  if (welcome) params.discounts = [{ coupon: welcome }];
  else params.allow_promotion_codes = true;
  if (TAX_ENABLED()) {
    params.automatic_tax = { enabled: true };
    params.customer_update = { address: "auto" };
    params.billing_address_collection = "required";
  }
  // APPROVAL: contractor-action — the contractor's own subscription Checkout, opened when
  // they choose to subscribe. BidVoice never charges a contractor without this explicit step.
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

// ---- Referral credits ↔ Stripe (give-a-month / get-a-month; the ledger is authoritative) ----

// The value of one month for a user, in cents: their Founding Member locked rate if set,
// else the live Stripe price, else the display-base fallback. Deterministic.
async function monthlyCentsFor(user) {
  if (user && user.founding_price_cents != null) return Number(user.founding_price_cents);
  if (priceCache.monthly != null) return Math.round(priceCache.monthly * 100);
  try { const p = await stripeGet("prices/" + PRICE()); if (p && p.unit_amount) return p.unit_amount; } catch { /* fall through */ }
  return Math.round(Number(process.env.BT_BASE_PRICE || 50) * 100);
}

// A reusable "first month free" coupon (100% off, once). Deterministic id → re-creating
// is a harmless no-op. This is the give-a-month half for the REFERRED company.
async function ensureWelcomeCoupon() {
  const id = "btwelcome100";
  try { await stripe("coupons", { id, percent_off: 100, duration: "once", name: "Referral — first month free" }); }
  catch { /* already exists (or transient) — the deterministic id is reusable */ }
  return id;
}

// The give-a-month half: if this user was referred and hasn't claimed their welcome, return
// the once-100%-off coupon to apply at checkout. It does NOT record the ledger row here —
// an abandoned checkout must not burn the welcome (Fable review). The ledger row is written
// on checkout.session.completed (recordRefereeWelcome), when the free month actually lands.
async function refereeWelcomeCoupon(user) {
  if (!user || !user.referred_by) return null;
  if (Credits.welcomeExistsFor(user.id)) return null;      // already claimed (idempotent)
  return ensureWelcomeCoupon().catch(() => null);
}

// Record the referred company's first-month-free credit for audit — only once they've
// actually completed checkout. Idempotent (UNIQUE referee_id+kind). Best-effort/audit-only.
async function recordRefereeWelcome(user) {
  if (!user || !user.referred_by || Credits.welcomeExistsFor(user.id)) return;
  const cents = await monthlyCentsFor(user).catch(() => 0);
  Credits.record({ userId: user.id, kind: "referee_welcome", refereeId: user.id,
    amountCents: cents || 100, reason: "signup_welcome", status: "applied" });
}

// The get-a-month half: grant the REFERRER one month of credit on the referred company's
// FIRST real (amount_paid>0) payment — month one is free via the welcome coupon, so that
// first paid invoice is month two. Posts a customer-balance credit to Stripe (auto-applies
// to the referrer's next invoice, never below $0) and records the immutable ledger row.
// Idempotent (UNIQUE referee_id+kind → re-fires safely on redeliveries / later invoices)
// and capped at 12 rewards / calendar year.
export async function grantReferrerReward(refereeId) {
  if (!billingConfigured() || !refereeId) return;
  const referee = db.prepare("SELECT id, referred_by FROM user WHERE id=?").get(refereeId);
  if (!referee || !referee.referred_by) return;
  const referrer = db.prepare("SELECT * FROM user WHERE id=?").get(referee.referred_by);
  if (!referrer) return;
  if (Credits.rewardExistsFor(refereeId)) return;                 // already granted (idempotent)
  // Resolve the credit value BEFORE the cap check so the cap-check→insert pair is fully
  // synchronous (no await between) — closes the concurrent-referees cap race (Fable review).
  const cents = await monthlyCentsFor(referrer).catch(() => 0);
  if (!(cents > 0)) return;
  if (Credits.capReached(referrer.id)) return;                    // 12/calendar-year cap
  const row = Credits.record({ userId: referrer.id, kind: "referrer_reward", refereeId,
    amountCents: cents, reason: "month_two_completed", status: "earned" });
  if (!row) return;                                               // lost the idempotency race
  // Push the money to Stripe: a negative customer balance = credit toward future invoices.
  // If this fails (or the referrer has no customer yet), the 'earned' row stands and the
  // boot-time reconcileReferralCredits() re-pushes it. No silent loss.
  await pushCreditToStripe(row, referrer);
  track(referrer.id, "referral_reward_earned", { cents });
}

// Post one ledger row's credit to Stripe and stamp it applied. Best-effort; logged on failure.
async function pushCreditToStripe(row, referrer) {
  const customer = referrer && referrer.stripe_customer_id;
  if (!customer) return;   // no customer yet → leave 'earned' for reconcile
  try {
    // Idempotency-Key = the ledger row id: if a prior push actually reached Stripe but we
    // failed to record it (timeout/crash), reconcile re-posts the SAME key and Stripe returns
    // the original transaction instead of creating a second credit. No double-credit.
    const txn = await stripe("customers/" + customer + "/balance_transactions",
      { amount: -Math.abs(row.amount_cents), currency: row.currency || "usd", description: "Referral credit — 1 month" },
      { idempotencyKey: "refcredit_" + row.id });
    Credits.markApplied(row.id, txn && txn.id);
  } catch (e) {
    console.warn("[billing] referral credit push failed (will reconcile):", (e && e.message) || e);
  }
}

// Reconcile earned-but-unpushed referrer credits (Stripe was down, or the referrer had no
// customer at grant time). Idempotent and safe to run every boot.
export async function reconcileReferralCredits() {
  if (!billingConfigured()) return 0;
  const rows = db.prepare(
    `SELECT rc.* FROM referral_credit rc
       WHERE rc.kind='referrer_reward' AND rc.status='earned' AND rc.stripe_txn_id IS NULL`
  ).all();
  let fixed = 0;
  for (const row of rows) {
    const referrer = db.prepare("SELECT * FROM user WHERE id=?").get(row.user_id);
    if (!referrer || !referrer.stripe_customer_id) continue;
    const before = db.prepare("SELECT stripe_txn_id FROM referral_credit WHERE id=?").get(row.id);
    await pushCreditToStripe(row, referrer);
    const after = db.prepare("SELECT stripe_txn_id FROM referral_credit WHERE id=?").get(row.id);
    if (!before.stripe_txn_id && after.stripe_txn_id) fixed++;
  }
  return fixed;
}

// Founding Member grandfathering: capture the price a company signs up at the first time
// their subscription goes active, and lock it while active. Idempotent — only set once.
function captureFoundingLock(userId, sub) {
  const u = db.prepare("SELECT founding_price_cents FROM user WHERE id=?").get(userId);
  if (!u || u.founding_price_cents != null) return;              // already locked
  let cents = null;
  try { cents = sub?.items?.data?.[0]?.price?.unit_amount ?? sub?.plan?.amount ?? null; } catch { cents = null; }
  if (cents == null && priceCache.monthly != null) cents = Math.round(priceCache.monthly * 100);
  if (cents == null) return;
  db.prepare("UPDATE user SET founding_price_cents=?, founding_member=1 WHERE id=?").run(cents, userId);
}
// On full cancellation, drop the lock so a returning customer gets whatever price is
// current then (Stripe re-checkout uses the live Price — no manual intervention).
function clearFoundingLock(userId) {
  db.prepare("UPDATE user SET founding_price_cents=NULL, founding_member=0 WHERE id=?").run(userId);
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
  const row = db.prepare("SELECT id, subscription_status FROM user WHERE stripe_customer_id=?").get(customerId);
  if (!row) return;
  const next = sub.status || "none";
  db.prepare(
    "UPDATE user SET subscription_status=?, stripe_subscription_id=?, current_period_end=? WHERE id=?"
  ).run(next, sub.id || null, sub.current_period_end ? sub.current_period_end * 1000 : null, row.id);
  const live = (s) => s === "active" || s === "trialing";
  // Fire the CRM milestone once, on the transition into a paying state.
  if (live(next) && !live(row.subscription_status || "none")) track(row.id, "subscription_active", { status: next });
  // Lock the Founding Member rate on ANY live event while still unlocked — NOT only on the
  // transition edge (checkout.session.completed may set 'active' first, and event ordering
  // isn't guaranteed; subscription.created/updated always carries the price). Idempotent.
  if (live(next)) captureFoundingLock(row.id, sub);
  // On full cancellation, drop the Founding lock so a return gets the then-current price.
  if (next === "canceled") clearFoundingLock(row.id);
}

export function handleEvent(event) {
  const obj = event?.data?.object || {};
  switch (event.type) {
    case "checkout.session.completed":
      // Subscription details arrive via the subscription.* events; record the link.
      if (obj.customer && obj.subscription) {
        const row = db.prepare("SELECT id, referred_by FROM user WHERE stripe_customer_id=?").get(obj.customer);
        if (row) {
          // Mark the one-time setup fee paid so a future re-subscribe won't re-charge it.
          db.prepare("UPDATE user SET stripe_subscription_id=?, subscription_status=?, setup_fee_paid=1 WHERE id=?")
            .run(obj.subscription, "active", row.id);
          // Record the referred company's welcome (audit) now that checkout actually completed
          // — never at session creation, so an abandoned checkout can't burn the free month.
          if (row.referred_by) recordRefereeWelcome(row).catch(() => {});
        }
      }
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      applySubscription(obj.customer, obj);
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      // The referrer earns their credit on the referred company's first RENEWAL invoice that
      // moves real money — i.e. month two. Requiring billing_reason === 'subscription_cycle'
      // (a renewal, not the create invoice) AND amount_paid > 0 excludes the $0 welcome
      // invoice AND any mid-cycle proration/update invoice, so a $5 plan tweak during the free
      // month can't grant early. Gating on rewardExistsFor + UNIQUE makes duplicate events
      // (invoice.paid AND invoice.payment_succeeded both fire) and redeliveries safe no-ops.
      if (obj.billing_reason !== "subscription_cycle") break;
      if (!((obj.amount_paid || 0) > 0)) break;
      const row = db.prepare("SELECT id FROM user WHERE stripe_customer_id=?").get(obj.customer);
      if (!row) break;
      grantReferrerReward(row.id).catch((e) => console.warn("[billing] referral grant failed:", (e && e.message) || e));
      break;
    }
    default:
      break;
  }
}
