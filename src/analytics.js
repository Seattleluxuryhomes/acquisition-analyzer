// Product analytics + observability.
//
// One write path — track() — lands every event in the `event` table. That table
// is the source of truth; forwardToSinks() is where Mixpanel / PostHog / Segment
// / a warehouse plug in later (env-gated) without touching any call site.
//
// The funnel/overview metrics below are *derived from the real tables* (user,
// job, payment_request) rather than only from events, so the founder dashboard
// is accurate immediately and retroactively — events add behavioural detail
// (page views, feature usage, where a session stalls) on top.
import db from "./db.js";
import { bidTotal, marginFactor } from "./proposal.js";
import * as FollowUpBoss from "./followupboss.js";

const DAY = 24 * 60 * 60 * 1000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const one = (sql, ...a) => db.prepare(sql).get(...a);
const cnt = (sql, ...a) => one(sql, ...a).c;

// ---------- Event tracking (the single write path) ----------
export function track(userId, name, props = {}) {
  if (!name) return;
  try {
    db.prepare("INSERT INTO event (user_id, name, props, created_at) VALUES (?,?,?,?)")
      .run(userId || null, String(name).slice(0, 60), JSON.stringify(props || {}).slice(0, 2000), Date.now());
  } catch { /* analytics must never break a request */ }
  forwardToSinks(userId, name, props);
}

// Pluggable destinations. No-ops until the matching env var is set; documented
// in EVENT_TRACKING.md. Kept fire-and-forget so a slow sink never blocks a request.
function forwardToSinks(userId, name, props) {
  // Follow Up Boss: the founder's CRM of all contractors (signup + lifecycle).
  try { FollowUpBoss.onEvent(userId, name, props); } catch { /* a sink must never break track() */ }
  // if (process.env.POSTHOG_KEY)  { /* posthog.capture(...) */ }
  // if (process.env.MIXPANEL_TOKEN) { /* mixpanel.track(...) */ }
  // if (process.env.SEGMENT_WRITE_KEY) { /* analytics.track(...) */ }
}

// ---------- Access control ----------
export function isAdmin(user) {
  const admin = (process.env.BT_ADMIN_EMAIL || "").trim().toLowerCase();
  return !!admin && !!user && String(user.email || "").toLowerCase() === admin;
}

// ---------- Helpers ----------
const ONBOARDED_SQL =
  "onboarded_at IS NOT NULL OR logo IS NOT NULL OR (company IS NOT NULL AND company <> 'Your Company')";
const HAS_BID_SQL = "lines IS NOT NULL AND lines <> '[]' AND lines <> ''";
const SENT_SQL = "sent_at IS NOT NULL OR status IN ('sent','signed','scheduled')";
const WON_SQL = "status IN ('signed','scheduled')";

// Keep the founder's own admin account(s) out of contractor-facing metrics — a
// solo founder watching their first real contractor shouldn't see themselves in
// the funnel. The email comes from BT_ADMIN_EMAIL (trusted env); quotes escaped.
function adminEmailSql() {
  const e = (process.env.BT_ADMIN_EMAIL || "").trim().toLowerCase();
  return e ? e.replace(/'/g, "''") : "";
}
const userExcl = () => { const e = adminEmailSql(); return e ? ` AND id NOT IN (SELECT id FROM user WHERE lower(email)='${e}')` : ""; };
const jobExcl = () => { const e = adminEmailSql(); return e ? ` AND user_id NOT IN (SELECT id FROM user WHERE lower(email)='${e}')` : ""; };

function wonValueFor(where, ...args) {
  let total = 0;
  for (const r of db.prepare(`SELECT lines, margin FROM job WHERE ${where}`).all(...args)) {
    try { total += Math.round(bidTotal(JSON.parse(r.lines || "[]")) * marginFactor(r.margin)); } catch { /* skip */ }
  }
  return total;
}

// ---------- Founder dashboard: top-line metrics ----------
export function overview() {
  const t0 = startOfToday(), w7 = Date.now() - 7 * DAY;
  const u = userExcl(), jb = jobExcl();
  const paid = one(`SELECT COUNT(*) c, COALESCE(SUM(amount_cents),0) s FROM payment_request WHERE status='paid'${jb}`);
  return {
    contractors: cnt(`SELECT COUNT(*) c FROM user WHERE 1=1${u}`),
    activeToday: cnt(`SELECT COUNT(*) c FROM user WHERE last_login >= ?${u}`, t0),
    active7d: cnt(`SELECT COUNT(*) c FROM user WHERE last_login >= ?${u}`, w7),
    newToday: cnt(`SELECT COUNT(*) c FROM user WHERE created_at >= ?${u}`, t0),
    new7d: cnt(`SELECT COUNT(*) c FROM user WHERE created_at >= ?${u}`, w7),
    onboarded: cnt(`SELECT COUNT(*) c FROM user WHERE (${ONBOARDED_SQL})${u}`),
    bidsCreated: cnt(`SELECT COUNT(*) c FROM job WHERE (${HAS_BID_SQL})${jb}`),
    bidsSent: cnt(`SELECT COUNT(*) c FROM job WHERE (${SENT_SQL})${jb}`),
    bidsAccepted: cnt(`SELECT COUNT(*) c FROM job WHERE (${WON_SQL})${jb}`),
    depositsRequested: cnt(`SELECT COUNT(*) c FROM payment_request WHERE 1=1${jb}`),
    depositsPaid: paid.c,
    depositsPaidValue: paid.s / 100,
    activeSubscriptions: cnt(`SELECT COUNT(*) c FROM user WHERE subscription_status IN ('active','trialing')${u}`),
    pipelineWonValue: wonValueFor(`(${WON_SQL})${jb}`),
    eventsTracked: cnt("SELECT COUNT(*) c FROM event"),
  };
}

// ---------- Contractor funnel with drop-off ----------
export function funnel() {
  const u = userExcl(), jb = jobExcl();
  const stages = [
    ["Sign up", cnt(`SELECT COUNT(*) c FROM user WHERE 1=1${u}`)],
    ["Onboarding", cnt(`SELECT COUNT(*) c FROM user WHERE (${ONBOARDED_SQL})${u}`)],
    ["First lead", cnt(`SELECT COUNT(DISTINCT user_id) c FROM job WHERE 1=1${jb}`)],
    ["First bid", cnt(`SELECT COUNT(DISTINCT user_id) c FROM job WHERE (${HAS_BID_SQL})${jb}`)],
    ["Proposal sent", cnt(`SELECT COUNT(DISTINCT user_id) c FROM job WHERE (${SENT_SQL})${jb}`)],
    ["Accepted", cnt(`SELECT COUNT(DISTINCT user_id) c FROM job WHERE (${WON_SQL})${jb}`)],
    ["First payment", cnt(`SELECT COUNT(DISTINCT user_id) c FROM payment_request WHERE status='paid'${jb}`)],
  ];
  const top = stages[0][1] || 0;
  return stages.map(([stage, count], i) => {
    const prev = i > 0 ? stages[i - 1][1] : count;
    return {
      stage, count,
      pctOfTop: top ? Math.round((count / top) * 100) : 0,
      dropoffFromPrev: i > 0 && prev ? Math.round(((prev - count) / prev) * 100) : 0,
    };
  });
}

// Biggest single drop in the funnel — "where contractors stop".
export function biggestDropoff() {
  const f = funnel();
  let worst = null;
  for (let i = 1; i < f.length; i++) {
    if (!worst || f[i].dropoffFromPrev > worst.dropoffFromPrev) {
      worst = { from: f[i - 1].stage, to: f[i].stage, dropoffFromPrev: f[i].dropoffFromPrev };
    }
  }
  return worst;
}

// ---------- Per-contractor profiles ----------
export function userProfile(u) {
  const id = u.id;
  return {
    id, email: u.email, company: u.company,
    created_at: u.created_at, last_login: u.last_login || null,
    subscription_status: u.subscription_status || "none",
    leads: cnt("SELECT COUNT(*) c FROM job WHERE user_id=?", id),
    bids: cnt(`SELECT COUNT(*) c FROM job WHERE user_id=? AND ${HAS_BID_SQL}`, id),
    sent: cnt(`SELECT COUNT(*) c FROM job WHERE user_id=? AND (${SENT_SQL})`, id),
    accepted: cnt(`SELECT COUNT(*) c FROM job WHERE user_id=? AND ${WON_SQL}`, id),
    depositsPaid: cnt("SELECT COUNT(*) c FROM payment_request WHERE user_id=? AND status='paid'", id),
    revenueCollected: one("SELECT COALESCE(SUM(amount_cents),0) s FROM payment_request WHERE user_id=? AND status='paid'", id).s / 100,
    pipelineWonValue: wonValueFor("user_id=? AND " + WON_SQL, id),
  };
}

export function listUsers() {
  return db.prepare(`SELECT * FROM user WHERE 1=1${userExcl()} ORDER BY created_at DESC`).all().map(userProfile);
}

// ---------- Behavioural detail (from the event log) ----------
export function featureAdoption() {
  return db.prepare(
    "SELECT name, COUNT(*) c, COUNT(DISTINCT user_id) users FROM event GROUP BY name ORDER BY c DESC LIMIT 50"
  ).all();
}
export function recentEvents(limit = 50) {
  return db.prepare(
    "SELECT e.id, e.user_id, e.name, e.props, e.created_at, u.email FROM event e LEFT JOIN user u ON u.id=e.user_id ORDER BY e.id DESC LIMIT ?"
  ).all(Math.min(Number(limit) || 50, 200));
}

// ---------- Contractor notifications ("good news" inbox) ----------
// Derived from the event log: the moments a contractor wants to know about the
// instant they happen — a homeowner ACCEPTED a proposal, or PAID a deposit.
// We only surface customer-driven events (a contractor moving their own status
// doesn't notify them). Unread = newer than their notifications_seen_at marker.
export function notifications(userId, seenAt = 0, limit = 25) {
  if (!userId) return { items: [], unread: 0 };
  const rows = db.prepare(
    `SELECT id, name, props, created_at FROM event
     WHERE user_id=? AND name IN ('deposit_paid','bid_accepted','lead_received')
     ORDER BY id DESC LIMIT ?`
  ).all(userId, Math.min(Number(limit) || 25, 50));

  const items = [];
  for (const r of rows) {
    let props = {};
    try { props = JSON.parse(r.props || "{}"); } catch { /* ignore */ }
    // A new estimate request from the contractor's website — surface it so it never
    // goes unseen (no job attached yet; tapping it opens the leads list).
    if (r.name === "lead_received") {
      items.push({ id: r.id, type: "lead", leadName: props.name || "", jobType: props.jobType || "",
        at: r.created_at, unread: r.created_at > (Number(seenAt) || 0) });
      continue;
    }
    // A proposal acceptance only counts when the CUSTOMER did it.
    if (r.name === "bid_accepted" && props.by !== "customer") continue;
    let jobTitle = "", customer = "";
    if (props.jobId) {
      const j = db.prepare("SELECT title, customer FROM job WHERE id=?").get(props.jobId);
      if (j) { jobTitle = j.title || ""; customer = j.customer || ""; }
    }
    items.push({
      id: r.id,
      type: r.name === "deposit_paid" ? "paid" : "accepted",
      jobId: props.jobId || null,
      amount: r.name === "deposit_paid" ? (Number(props.amount) || 0) : null,
      jobTitle, customer,
      at: r.created_at,
      unread: r.created_at > (Number(seenAt) || 0),
    });
  }
  return { items, unread: items.filter((i) => i.unread).length };
}
