// Bidtranslator backend (Phase 1). Express + node:sqlite. The client talks only
// to this API; the AI provider key never leaves the server.
try { process.loadEnvFile(); } catch { /* no .env file — rely on real env vars */ }
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import db, { PHOTO_DIR } from "./src/db.js";
import { signup, signin, signout, changePassword, requireAuth, publicUser } from "./src/auth.js";
import * as Jobs from "./src/jobs.js";
import { assistBuild, aiConfigured } from "./src/assist.js";
import { buildProposal } from "./src/proposal.js";
import { renderProposalPDF } from "./src/pdf.js";
import { signPhotoUrl, verifyPhotoSig, signProposalUrl, verifyProposalSig } from "./src/files.js";
import { renderProposalHTML } from "./src/proposalHtml.js";
import * as Billing from "./src/billing.js";
import * as Payments from "./src/payments.js";
import * as QuickBooks from "./src/quickbooks.js";
import * as Signatures from "./src/signatures.js";
import * as Notify from "./src/notify.js";
import * as Analytics from "./src/analytics.js";
const { track } = Analytics;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = () => crypto.randomBytes(9).toString("base64url");
const app = express();
app.set("trust proxy", true); // behind Spaceship/Hyperlift's edge proxy

// Force HTTPS + a single canonical host. If the edge received the request over
// plain HTTP, or on a non-canonical host (e.g. www vs the apex), redirect once to
// https://<canonical><path>. This gives one URL to certify and link to. No effect
// locally (X-Forwarded-Proto absent) or on the internal health check. Configure
// the canonical host with BT_CANONICAL_HOST (e.g. "bidtranslator.com"); disable
// the HTTPS push with BT_FORCE_HTTPS=0 while a cert is still provisioning. Sends
// HSTS on secure responses so browsers stick to HTTPS afterward.
const FORCE_HTTPS = !/^(0|false|off|no)$/i.test(process.env.BT_FORCE_HTTPS || "1");
const CANONICAL_HOST = (process.env.BT_CANONICAL_HOST || "").trim().toLowerCase();
app.use((req, res, next) => {
  // Never redirect the health check or the ACME HTTP-01 challenge — the latter is
  // fetched over plain HTTP by the CA to issue the TLS cert; redirecting it to
  // HTTPS (no cert yet) would make issuance fail.
  if (req.path === "/api/health" || req.path.startsWith("/.well-known/acme-challenge/")) return next();
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const host = String(req.headers.host || "");
  const hostName = host.toLowerCase().replace(/:\d+$/, "");
  const needHttps = FORCE_HTTPS && proto === "http";
  // Only canonicalize the host when the request came through the edge (proto set),
  // so local dev on localhost is never redirected.
  const needHost = !!CANONICAL_HOST && !!proto && !!hostName && hostName !== CANONICAL_HOST;
  if (needHttps || needHost) {
    return res.redirect(307, "https://" + (needHost ? CANONICAL_HOST : host) + req.originalUrl);
  }
  if (proto === "https" && FORCE_HTTPS) res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
});

// Stripe webhook needs the RAW body for signature verification — register it
// before any JSON parsing so the bytes are untouched.
app.post("/api/billing/webhook", express.raw({ type: "*/*", limit: "1mb" }), async (req, res) => {
  try {
    const event = Billing.verifyWebhook(req.body.toString("utf8"), req.headers["stripe-signature"]);
    // One endpoint serves both subscription (platform) and payment-request
    // (Connect) events; each handler ignores types it doesn't care about.
    await Billing.handleEvent(event);
    Payments.handleEvent(event);
    res.json({ received: true });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Global JSON parser, but skip the photo-upload route so its own larger limit
// applies (otherwise this 256kb cap would reject photos before they're reached).
const smallJson = express.json({ limit: "256kb" });
const isPhotoUpload = (req) => req.method === "POST" && /^\/api\/jobs\/[^/]+\/photos\/?$/.test(req.path);
app.use((req, res, next) => (isPhotoUpload(req) ? next() : smallJson(req, res, next)));
app.use(express.static(path.join(__dirname, "public")));

const baseUrl = (req) =>
  (process.env.BT_PUBLIC_URL ||
    `${(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim()}://${req.get("host")}`
  ).replace(/\/+$/, "");

// Deferring fn into .then() means synchronous throws become rejections too.
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((err) => {
  res.status(err.status || 500).json({ error: err.message || "Server error.", code: err.code });
});

// Clean JSON for malformed request bodies (instead of an HTML stack trace).
app.use((err, _req, res, next) => {
  if (err && (err.type === "entity.parse.failed" || err instanceof SyntaxError)) {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body too large." });
  }
  next(err);
});

function settingsOf(user) {
  return {
    company: user.company, name: user.name, phone: user.phone, license: user.license,
    from: user.default_from_lang, to: user.default_to_lang, logo: user.logo || "", email: user.email || "",
    tax_rate: user.tax_rate == null ? 0 : user.tax_rate, region: user.region || "",
  };
}

function attachPhotos(userId, job) {
  if (!job) return job;
  const rows = db.prepare("SELECT id, show_on_bid FROM photo WHERE job_id=? AND user_id=? ORDER BY created_at").all(job.id, userId);
  job.photos = rows.map((r) => ({ id: r.id, url: signPhotoUrl(job.id, r.id), showOnBid: !!r.show_on_bid }));
  return job;
}

// ---- Health ----
app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiConfigured(), billing: Billing.billingConfigured(), payments: Payments.paymentsConfigured() }));

// ---- Auth ----
app.post("/api/auth/signup", wrap((req, res) => {
  const out = signup(req.body || {});
  if (out && out.user) {
    db.prepare("UPDATE user SET last_login=? WHERE id=?").run(Date.now(), out.user.id);
    track(out.user.id, "user_registered", { email: out.user.email });
  }
  res.json(out);
}));
app.post("/api/auth/signin", wrap((req, res) => {
  const out = signin(req.body || {});
  if (out && out.user) {
    db.prepare("UPDATE user SET last_login=? WHERE id=?").run(Date.now(), out.user.id);
    track(out.user.id, "user_logged_in", {});
  }
  res.json(out);
}));
app.post("/api/auth/signout", requireAuth, wrap((req, res) => { track(req.user.id, "user_logged_out", {}); signout(req.token); res.json({ ok: true }); }));
app.post("/api/auth/change-password", requireAuth, wrap((req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  res.json(changePassword({ userId: req.user.id, currentPassword, newPassword, keepToken: req.token }));
}));
// Password reset by email is stubbed for Phase 1 (no mail provider wired). Always
// returns ok so the endpoint can't be used to probe which emails exist.
app.post("/api/auth/reset", wrap((req, res) => res.json({ ok: true, note: "Email reset not configured in this build." })));

// ---- Billing ----
app.get("/api/billing/status", requireAuth, (req, res) => res.json(Billing.billingStatus(req.user)));
app.post("/api/billing/checkout", requireAuth, wrap(async (req, res) => {
  res.json({ url: await Billing.createCheckout(req.user, baseUrl(req)) });
}));
app.post("/api/billing/portal", requireAuth, wrap(async (req, res) => {
  res.json({ url: await Billing.createPortal(req.user, baseUrl(req)) });
}));

// ---- Payments (Stripe Connect: contractors get paid by homeowners) ----
app.get("/api/payments/status", requireAuth, (req, res) => res.json(Payments.connectStatus(req.user)));
// Onboarding link (and a manual refresh of the connected-account status).
app.post("/api/payments/connect", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  res.json({ url: await Payments.startOnboarding(req.user, baseUrl(req)) });
}));
app.post("/api/payments/refresh", requireAuth, wrap(async (req, res) => {
  res.json(await Payments.refreshConnectStatus(req.user));
}));
// Payment requests.
app.get("/api/payments/requests", requireAuth, (req, res) =>
  res.json({ requests: Payments.listPaymentRequests(req.user.id, req.query.job_id) }));
app.post("/api/payments/requests", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { amount, description, clientName, jobId } = req.body || {};
  if (jobId && !Jobs.ownsJob(req.user.id, jobId)) return res.status(404).json({ error: "Job not found." });
  const request = await Payments.createPaymentRequest(req.user, { amount, description, clientName, jobId }, baseUrl(req));
  track(req.user.id, "payment_link_created", { jobId: jobId || null });
  track(req.user.id, "deposit_requested", { jobId: jobId || null, amount: Number(amount) || 0 });
  res.json({ request });
}));
app.post("/api/payments/requests/:id/cancel", requireAuth, wrap((req, res) => {
  const r = Payments.cancelPaymentRequest(req.user.id, req.params.id);
  if (!r) return res.status(404).json({ error: "Payment request not found." });
  res.json({ request: r });
}));

// ---- QuickBooks (per-contractor OAuth; paid payments sync to their books) ----
const qboRedirect = (req) => `${baseUrl(req)}/api/quickbooks/callback`;
app.get("/api/quickbooks/status", requireAuth, (req, res) => res.json(QuickBooks.qboStatus(req.user)));
app.post("/api/quickbooks/connect", requireAuth, Billing.requireEntitled, wrap((req, res) => {
  if (!QuickBooks.qboConfigured()) return res.status(503).json({ error: "QuickBooks isn't configured on the server yet." });
  res.json({ url: QuickBooks.authUrl(req.user, qboRedirect(req)) });
}));
// Intuit redirects the contractor back here after they authorize.
app.get("/api/quickbooks/callback", wrap(async (req, res) => {
  try {
    await QuickBooks.handleCallback({ code: req.query.code, realmId: req.query.realmId, state: req.query.state, redirectUri: qboRedirect(req) });
    res.redirect("/?quickbooks=connected#settings");
  } catch {
    res.redirect("/?quickbooks=error#settings");
  }
}));
app.post("/api/quickbooks/disconnect", requireAuth, wrap((req, res) => {
  QuickBooks.disconnect(req.user.id);
  res.json({ ok: true });
}));

// ---- Me / settings ----
app.get("/api/me", requireAuth, (req, res) =>
  res.json({ user: publicUser(req.user), settings: settingsOf(req.user), billing: Billing.billingStatus(req.user), admin: Analytics.isAdmin(req.user) }));
app.patch("/api/me", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  if (typeof b.logo === "string" && b.logo.length > 250000) {
    return res.status(413).json({ error: "Logo image is too large — please use a smaller file." });
  }
  const map = { company: "company", name: "name", phone: "phone", license: "license",
    from: "default_from_lang", to: "default_to_lang", logo: "logo", region: "region" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in b) { sets.push(`${col}=?`); vals.push(String(b[k] ?? "")); }
  }
  if ("tax_rate" in b) { sets.push("tax_rate=?"); vals.push(Math.max(0, Number(b.tax_rate) || 0)); }
  if (sets.length) { vals.push(req.user.id); db.prepare(`UPDATE user SET ${sets.join(", ")} WHERE id=?`).run(...vals); }
  const fresh = db.prepare("SELECT * FROM user WHERE id=?").get(req.user.id);
  if (typeof b.logo === "string" && b.logo) track(req.user.id, "logo_uploaded", {});
  const onboarded = fresh.logo || (fresh.company && fresh.company !== "Your Company");
  if (onboarded && !fresh.onboarded_at) {
    db.prepare("UPDATE user SET onboarded_at=? WHERE id=?").run(Date.now(), req.user.id);
    track(req.user.id, "onboarding_completed", {});
  }
  res.json({ user: publicUser(fresh), settings: settingsOf(fresh) });
}));

// ---- Client-side analytics events (page_view, dashboard_viewed, feature_used…) ----
app.post("/api/track", requireAuth, wrap((req, res) => {
  const { event, props } = req.body || {};
  if (event) track(req.user.id, String(event), props && typeof props === "object" ? props : {});
  res.json({ ok: true });
}));

// ---- Contractor notifications: "good news" inbox (customer accepted / paid) ----
app.get("/api/notifications", requireAuth, (req, res) =>
  res.json(Analytics.notifications(req.user.id, req.user.notifications_seen_at || 0)));
// Mark everything up to now as read (called when they open the inbox).
app.post("/api/notifications/seen", requireAuth, wrap((req, res) => {
  const now = Date.now();
  db.prepare("UPDATE user SET notifications_seen_at=? WHERE id=?").run(now, req.user.id);
  res.json({ ok: true, seen_at: now });
}));

// ---- Founder / admin dashboard (gated to BT_ADMIN_EMAIL) ----
const requireAdmin = (req, res, next) =>
  Analytics.isAdmin(req.user) ? next() : res.status(403).json({ error: "Not authorized." });
app.get("/api/admin/overview", requireAuth, requireAdmin, (req, res) =>
  res.json({ overview: Analytics.overview(), funnel: Analytics.funnel(), biggestDropoff: Analytics.biggestDropoff(), features: Analytics.featureAdoption() }));
app.get("/api/admin/users", requireAuth, requireAdmin, (req, res) =>
  res.json({ users: Analytics.listUsers() }));
app.get("/api/admin/users/:id", requireAuth, requireAdmin, (req, res) => {
  const u = db.prepare("SELECT * FROM user WHERE id=?").get(req.params.id);
  if (!u) return res.status(404).json({ error: "Not found." });
  res.json({ user: Analytics.userProfile(u), events: Analytics.recentEvents(200).filter((e) => e.user_id === u.id).slice(0, 50) });
});
app.get("/api/admin/events", requireAuth, requireAdmin, (req, res) =>
  res.json({ events: Analytics.recentEvents(req.query.limit) }));

// ---- Demand signals ("Notify me" on coming-soon features) ----
app.post("/api/interest", requireAuth, wrap((req, res) => {
  const feature = String((req.body || {}).feature || "").trim().slice(0, 40);
  if (!feature) return res.status(400).json({ error: "feature required" });
  db.prepare("INSERT OR IGNORE INTO interest (user_id, feature, created_at) VALUES (?,?,?)")
    .run(req.user.id, feature, Date.now());
  const { c } = db.prepare("SELECT COUNT(*) c FROM interest WHERE feature=?").get(feature);
  res.json({ ok: true, count: c });
}));

// ---- Jobs ----
app.get("/api/jobs", requireAuth, (req, res) => res.json({ jobs: Jobs.listJobs(req.user.id) }));
app.post("/api/jobs", requireAuth, Billing.requireEntitled, wrap((req, res) => {
  const job = Jobs.createJob(req.user.id, req.body || {});
  track(req.user.id, "lead_created", { jobId: job.id });
  if ((job.lines || []).length) track(req.user.id, "bid_created", { jobId: job.id, lines: job.lines.length });
  res.json({ job: attachPhotos(req.user.id, job) });
}));
app.get("/api/jobs/:id", requireAuth, wrap((req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ job: attachPhotos(req.user.id, job) });
}));
app.patch("/api/jobs/:id", requireAuth, wrap((req, res) => {
  const job = Jobs.updateJob(req.user.id, req.params.id, req.body || {});
  if (!job) return res.status(404).json({ error: "Job not found." });
  // Status transitions = pipeline events.
  if (req.body && "status" in req.body) {
    const s = job.status;
    if (s === "sent") track(req.user.id, "bid_sent", { jobId: job.id });
    else if (s === "signed") track(req.user.id, "bid_accepted", { jobId: job.id });
    else if (s === "scheduled") track(req.user.id, "job_scheduled", { jobId: job.id });
  }
  res.json({ job: attachPhotos(req.user.id, job) });
}));
app.delete("/api/jobs/:id", requireAuth, wrap((req, res) => {
  if (!Jobs.deleteJob(req.user.id, req.params.id)) return res.status(404).json({ error: "Job not found." });
  res.json({ ok: true });
}));

// ---- Photos (private; signed expiring URLs) ----
const photoJson = express.json({ limit: "12mb" });
app.post("/api/jobs/:id/photos", requireAuth, photoJson, wrap((req, res) => {
  if (!Jobs.ownsJob(req.user.id, req.params.id)) return res.status(404).json({ error: "Job not found." });
  const m = /^data:(image\/[a-z.+-]+);base64,(.+)$/i.exec(String(req.body?.dataUrl || ""));
  if (!m) return res.status(400).json({ error: "Expected an image data URL." });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image too large." });
  const ext = m[1].split("/")[1].replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const pid = uid();
  const filename = `${pid}.${ext}`;
  const showOnBid = req.body?.showOnBid ? 1 : 0; // may be flagged offline before upload
  fs.writeFileSync(path.join(PHOTO_DIR, filename), buf);
  db.prepare("INSERT INTO photo (id, job_id, user_id, filename, mime, show_on_bid, created_at) VALUES (?,?,?,?,?,?,?)")
    .run(pid, req.params.id, req.user.id, filename, m[1], showOnBid, Date.now());
  res.json({ photo: { id: pid, url: signPhotoUrl(req.params.id, pid), showOnBid: !!showOnBid } });
}));

// Toggle whether a photo appears on the client-facing bid (owner only).
app.patch("/api/jobs/:id/photos/:pid", requireAuth, wrap((req, res) => {
  const row = db.prepare("SELECT id FROM photo WHERE id=? AND job_id=? AND user_id=?")
    .get(req.params.pid, req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Photo not found." });
  const showOnBid = req.body?.showOnBid ? 1 : 0;
  db.prepare("UPDATE photo SET show_on_bid=? WHERE id=?").run(showOnBid, req.params.pid);
  res.json({ ok: true, showOnBid: !!showOnBid });
}));

// Served via signature, not bearer auth, so <img> tags work. Signature + expiry
// are the access grant; we still confirm the photo belongs to the job in the URL.
app.get("/api/jobs/:id/photos/:pid", (req, res) => {
  const { id, pid } = req.params;
  if (!verifyPhotoSig(pid, req.query.exp, req.query.sig)) return res.status(403).send("Forbidden");
  const row = db.prepare("SELECT * FROM photo WHERE id=? AND job_id=?").get(pid, id);
  if (!row) return res.status(404).send("Not found");
  res.type(row.mime);
  res.setHeader("Cache-Control", "private, max-age=3600");
  fs.createReadStream(path.join(PHOTO_DIR, row.filename)).pipe(res);
});

app.delete("/api/jobs/:id/photos/:pid", requireAuth, wrap((req, res) => {
  const row = db.prepare("SELECT * FROM photo WHERE id=? AND job_id=? AND user_id=?")
    .get(req.params.pid, req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Photo not found." });
  db.prepare("DELETE FROM photo WHERE id=?").run(req.params.pid);
  try { fs.unlinkSync(path.join(PHOTO_DIR, row.filename)); } catch {}
  res.json({ ok: true });
}));

// ---- AI build (server-side proxy) ----
app.post("/api/assist/build", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { text, from_lang, to_lang } = req.body || {};
  const data = await assistBuild(req.user, { text, from_lang, to_lang });
  res.json(data);
}));

// ---- Share a bid: a clean public link the contractor texts/emails ----
app.get("/api/jobs/:id/share", requireAuth, Billing.requireEntitled, wrap((req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  track(req.user.id, "bid_sent", { jobId: job.id, via: "share" });
  // Clean link — the unguessable 72-bit job id is the access grant (like a
  // Google Doc / Calendly share link). No ugly signature in the customer's email.
  res.json({ url: baseUrl(req) + "/p/" + job.id });
}));

// Public, login-free proposal page (homeowner opens the shared link). Only
// buildProposal() data is ever rendered (margin/notes can never appear).
app.get("/p/:id", (req, res) => {
  // Back-compat: links sent with the old signature are still validated (incl.
  // expiry). New clean links rely on the unguessable id.
  if (req.query.sig && !verifyProposalSig(req.params.id, req.query.exp, req.query.sig)) {
    return res.status(403).send("This link has expired or is invalid.");
  }
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(req.params.id);
  if (!jobRow) return res.status(404).send("Estimate not found.");
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(jobRow.user_id);
  // The customer (not logged in) is viewing — attribute to the owner's funnel.
  if (!req.query.paid) track(jobRow.user_id, "bid_viewed", { jobId: jobRow.id });
  const proposal = buildProposal(Jobs.rowToJob(jobRow), settingsOf(owner || {}));
  res.type("html").send(renderProposalHTML(proposal, proposalOpts(jobRow, owner, proposal, req)));
});

// Accept/pay state for the public proposal.
function proposalOpts(jobRow, owner, proposal, req) {
  const accepted = jobRow.status === "signed" || jobRow.status === "scheduled";
  const pct = jobRow.deposit_pct == null ? 25 : jobRow.deposit_pct;
  const deposit = Math.round((proposal.total || 0) * pct / 100);
  const depositPaid = !!db.prepare("SELECT 1 FROM payment_request WHERE job_id=? AND status='paid' LIMIT 1").get(jobRow.id);
  const canPay = Payments.paymentsConfigured() && !!(owner && owner.connect_charges_enabled) && deposit >= 1;
  // Photos the contractor chose to show — freshly signed each render, so the
  // public page can display them without auth and links can't be hot-linked later.
  const photos = db.prepare("SELECT id FROM photo WHERE job_id=? AND show_on_bid=1 ORDER BY created_at").all(jobRow.id)
    .map((r) => ({ url: signPhotoUrl(jobRow.id, r.id) }));
  const sig = Signatures.latestSignature(jobRow.id);
  return { id: jobRow.id, accepted, deposit, depositPaid, canPay, justPaid: req.query.paid === "1", photos,
    signedBy: sig ? sig.signer_name : "", signedAt: sig ? new Date(sig.signed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "",
    company: (owner && owner.company && owner.company !== "Your Company") ? owner.company : "" };
}
// The client's IP for the signature audit trail (behind Hyperlift's edge proxy).
const clientIp = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
// Lightweight audit beacon from the public proposal page (e.g. approval box ticked).
const PUBLIC_AUDIT = new Set(["approval_checked", "proposal_viewed"]);
app.post("/p/:id/event", wrap((req, res) => {
  const jobRow = db.prepare("SELECT user_id FROM job WHERE id=?").get(req.params.id);
  const name = String(req.body?.name || "");
  if (jobRow && PUBLIC_AUDIT.has(name)) track(jobRow.user_id, name, { jobId: req.params.id });
  res.json({ ok: true });
}));
// Customer signs the proposal: approval + inked signature, then (optionally) pay.
app.post("/p/:id/sign", wrap(async (req, res) => {
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(req.params.id);
  if (!jobRow) return res.status(404).json({ error: "Estimate not found." });
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(jobRow.user_id);
  const proposal = buildProposal(Jobs.rowToJob(jobRow), settingsOf(owner || {}));
  const { name, signature, approved, payNow } = req.body || {};

  // Persist the signature (validates approval box + name + inked PNG).
  Signatures.saveSignature(jobRow, {
    name, png: signature, approved: approved === true, total: proposal.total,
    ip: clientIp(req), userAgent: req.headers["user-agent"] || "",
  });
  track(jobRow.user_id, "approval_checked", { jobId: jobRow.id });
  track(jobRow.user_id, "signature_submitted", { jobId: jobRow.id, total: proposal.total });
  acceptJob(jobRow); // status -> signed (+ bid_accepted by customer)

  // Optional: mirror the signed proposal into the contractor's QuickBooks as an
  // Estimate (no-op unless they've connected QB). Fire-and-forget.
  if (owner) QuickBooks.syncEstimate(owner, { amount: proposal.total, description: `Signed — ${proposal.title}`, customer: name || proposal.customer, date: Date.now() }).catch(() => {});

  // Deposit? Send them straight to Stripe Checkout (status stays Signed / Payment
  // Pending until the paid webhook lands).
  const pct = jobRow.deposit_pct == null ? 25 : jobRow.deposit_pct;
  const deposit = Math.round((proposal.total || 0) * pct / 100);
  const canPay = Payments.paymentsConfigured() && owner && owner.connect_charges_enabled && deposit >= 1;
  if (canPay && payNow !== false) {
    try {
      const base = baseUrl(req);
      const reqObj = await Payments.createPaymentRequest(owner, {
        amount: deposit, description: `Deposit — ${proposal.title}`, clientName: name || proposal.customer,
        jobId: jobRow.id, successUrl: `${base}/p/${jobRow.id}?paid=1`, cancelUrl: `${base}/p/${jobRow.id}`,
      }, base);
      track(jobRow.user_id, "checkout_opened", { jobId: jobRow.id, amount: deposit });
      Notify.notifySigned({ owner, job: jobRow, signerName: name, total: proposal.total, paid: false });
      return res.json({ ok: true, checkout_url: reqObj.checkout_url });
    } catch { /* fall through to the no-payment confirmation */ }
  }
  Notify.notifySigned({ owner, job: jobRow, signerName: name, total: proposal.total, paid: false });
  res.json({ ok: true });
}));
function acceptJob(jobRow) {
  if (jobRow.status !== "signed" && jobRow.status !== "scheduled") {
    db.prepare("UPDATE job SET status='signed', updated_at=? WHERE id=?").run(Date.now(), jobRow.id);
    track(jobRow.user_id, "bid_accepted", { jobId: jobRow.id, by: "customer" });
  }
}
// Customer accepts the proposal (no payment, or payments not set up).
app.post("/p/:id/accept", wrap((req, res) => {
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(req.params.id);
  if (!jobRow) return res.status(404).send("Estimate not found.");
  acceptJob(jobRow);
  res.redirect("/p/" + jobRow.id);
}));
// Customer accepts AND pays the deposit via the contractor's connected Stripe.
app.post("/p/:id/accept-and-pay", wrap(async (req, res) => {
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(req.params.id);
  if (!jobRow) return res.status(404).send("Estimate not found.");
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(jobRow.user_id);
  acceptJob(jobRow);
  const proposal = buildProposal(Jobs.rowToJob(jobRow), settingsOf(owner || {}));
  const pct = jobRow.deposit_pct == null ? 25 : jobRow.deposit_pct;
  const deposit = Math.round((proposal.total || 0) * pct / 100);
  if (!(Payments.paymentsConfigured() && owner && owner.connect_charges_enabled && deposit >= 1)) {
    return res.redirect("/p/" + jobRow.id);
  }
  try {
    const base = baseUrl(req);
    const reqObj = await Payments.createPaymentRequest(owner, {
      amount: deposit, description: `Deposit — ${proposal.title}`, clientName: proposal.customer,
      jobId: jobRow.id, successUrl: `${base}/p/${jobRow.id}?paid=1`, cancelUrl: `${base}/p/${jobRow.id}`,
    }, base);
    return res.redirect(reqObj.checkout_url);
  } catch {
    return res.redirect("/p/" + jobRow.id);
  }
}));

// ---- Client proposal PDF (margin/notes stripped by buildProposal) ----
app.get("/api/jobs/:id/pdf", requireAuth, Billing.requireEntitled, wrap((req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  const proposal = buildProposal(job, settingsOf(req.user));
  // Embed the chosen photos' bytes directly (the PDF is generated for the owner).
  proposal.photos = db.prepare("SELECT filename, mime FROM photo WHERE job_id=? AND user_id=? AND show_on_bid=1 ORDER BY created_at")
    .all(job.id, req.user.id)
    .map((r) => { try { return { buf: fs.readFileSync(path.join(PHOTO_DIR, r.filename)), mime: r.mime }; } catch { return null; } })
    .filter(Boolean);
  // Attach the customer's signature (if they've signed) so the PDF is the signed record.
  const sig = Signatures.latestSignature(job.id);
  if (sig) proposal.signature = {
    name: sig.signer_name, png: sig.signature_png, total: sig.accepted_total,
    at: new Date(sig.signed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), ip: sig.ip || "",
  };
  const safe = (job.title || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="bid-${safe}.pdf"`);
  renderProposalPDF(proposal, res);
}));

// Standalone landing for homeowners after Stripe Checkout (they aren't logged in,
// so we don't drop them on the contractor's sign-in screen).
app.get("/pay/done", (req, res) => {
  const ok = req.query.ok !== "0";
  const title = ok ? "Payment received" : "Payment canceled";
  const msg = ok
    ? "Thank you! Your payment was received. You can close this page — the contractor has been notified."
    : "No payment was made. You can close this page, or reopen the payment link to try again.";
  const accent = ok ? "#1E4259" : "#8a7f68";
  res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F3EEE3;color:#1F252C;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;padding:32px;text-align:center">
<div style="font-size:48px;margin-bottom:8px">${ok ? "✅" : "↩️"}</div>
<h1 style="font-size:1.4rem;color:${accent};margin:0 0 10px">${title}</h1>
<p style="font-size:1rem;line-height:1.5;color:#5a5240;margin:0">${msg}</p>
</div></body></html>`);
});

// SPA fallback for the single-page app.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.BT_PORT || process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Bidtranslator on http://localhost:${PORT}`));
// Pull the real plan + setup-fee prices from Stripe so the paywall shows exactly
// what checkout charges. Fire-and-forget; the UI falls back to defaults until ready.
Billing.loadPrices().catch(() => {});
