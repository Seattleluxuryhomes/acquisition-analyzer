// Bidtranslator backend (Phase 1). Express + node:sqlite. The client talks only
// to this API; the AI provider key never leaves the server.
try { process.loadEnvFile(); } catch { /* no .env file — rely on real env vars */ }
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

import db, { PHOTO_DIR } from "./src/db.js";
import { signup, signin, signout, changePassword, requireAuth, publicUser, createResetToken, confirmPasswordReset } from "./src/auth.js";
import * as Mail from "./src/mail.js";
import * as Jobs from "./src/jobs.js";
import { assistBuild, assistIntake, aiConfigured, parseSkus, transcribeAudio, transcribeConfigured, visualizeRoom, visualizeConfigured } from "./src/assist.js";
import * as Skus from "./src/skus.js";
import * as Leads from "./src/leads.js";
import { buildProposal, DEFAULT_TERMS } from "./src/proposal.js";
import { renderProposalPDF } from "./src/pdf.js";
import { signPhotoUrl, verifyPhotoSig, signProposalUrl, verifyProposalSig, verifySkuImageSig, signProposalPdfUrl, verifyProposalPdfSig } from "./src/files.js";
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
const bigJson = express.json({ limit: "12mb" }); // price-sheet photo for SKU parsing
const isPhotoUpload = (req) => req.method === "POST" &&
  (/^\/api\/jobs\/[^/]+\/photos\/?$/.test(req.path) || /^\/api\/skus\/[^/]+\/image\/?$/.test(req.path) ||
   /^\/api\/jobs\/[^/]+\/visualize\/?$/.test(req.path));
const isBigJson = (req) => req.method === "POST" && (req.path === "/api/skus/parse" || req.path === "/api/assist/transcribe");
app.use((req, res, next) => (isPhotoUpload(req) ? next() : (isBigJson(req) ? bigJson(req, res, next) : smallJson(req, res, next))));
app.use(express.static(path.join(__dirname, "public"), {
  // Cache static images/icons hard (they're versioned by deploy); keep the app
  // shell (index.html) revalidating so a deploy is picked up immediately.
  setHeaders(res, filePath) {
    if (/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(filePath)) res.setHeader("Cache-Control", "public, max-age=86400");
    else if (/\.html?$/i.test(filePath)) res.setHeader("Cache-Control", "no-cache");
  },
}));

const baseUrl = (req) =>
  (process.env.BT_PUBLIC_URL ||
    `${(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim()}://${req.get("host")}`
  ).replace(/\/+$/, "");

// Deferring fn into .then() means synchronous throws become rejections too.
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((err) => {
  // Surface unexpected (500-class) failures in the server log so issues like a
  // drifted table column are diagnosable instead of just a generic client error.
  if (!err.status || err.status >= 500) console.error(`[${req.method} ${req.path}]`, err && (err.stack || err.message || err));
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
    // null → contractor hasn't customized; surface the default so the Settings
    // editor is pre-filled and proposals show terms out of the box.
    terms: user.terms == null ? DEFAULT_TERMS : user.terms,
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
// Forgot password: email a single-use reset link. Always responds ok (never
// reveals whether an account exists). No-op email when the mail provider isn't
// configured — the flow is wired and waiting on RESEND_API_KEY.
app.post("/api/auth/reset", wrap(async (req, res) => {
  const email = String((req.body && req.body.email) || "");
  const out = createResetToken(email);
  if (out && Mail.mailConfigured()) {
    const link = `${baseUrl(req)}/reset?token=${encodeURIComponent(out.token)}&e=${encodeURIComponent(out.user.email)}`;
    try { await Mail.sendMail({ to: out.user.email, subject: "Reset your Bidtranslator password", html: resetEmailHtml(link), text: `Reset your Bidtranslator password:\n${link}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.` }); }
    catch { /* never surface send errors to the caller (no enumeration) */ }
  }
  res.json({ ok: true, sent: Mail.mailConfigured() });
}));
// Complete the reset with the emailed token + a new password.
app.post("/api/auth/reset-confirm", wrap((req, res) => {
  const { email, token, password } = req.body || {};
  res.json(confirmPasswordReset({ email, token, newPassword: password }));
}));
function resetEmailHtml(link) {
  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1F252C">
    <div style="font-weight:800;font-size:1.2rem">Bid<span style="color:#CF7F18">translator</span></div>
    <h2 style="margin:18px 0 8px">Reset your password</h2>
    <p style="color:#5a5240">Tap the button below to set a new password. This link expires in 1 hour.</p>
    <p style="margin:22px 0"><a href="${link}" style="background:#CF7F18;color:#1F252C;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:10px;display:inline-block">Set a new password</a></p>
    <p style="color:#8a7f68;font-size:.85rem">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  </div>`;
}

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
  res.json({ user: publicUser(req.user), settings: settingsOf(req.user), billing: Billing.billingStatus(req.user),
    admin: Analytics.isAdmin(req.user), leadsNew: Leads.countNew(req.user.id),
    ai: { build: aiConfigured(), transcribe: transcribeConfigured(), visualize: visualizeConfigured() } }));
app.patch("/api/me", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  if (typeof b.logo === "string" && b.logo.length > 250000) {
    return res.status(413).json({ error: "Logo image is too large — please use a smaller file." });
  }
  if (typeof b.terms === "string" && b.terms.length > 6000) b.terms = b.terms.slice(0, 6000);
  const map = { company: "company", name: "name", phone: "phone", license: "license",
    from: "default_from_lang", to: "default_to_lang", logo: "logo", region: "region", terms: "terms" };
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
app.post("/api/jobs", requireAuth, wrap((req, res) => {
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

// "See it in their kitchen" — render a price-book material onto a room photo (AI)
// and save the result as an on-bid job photo so the client sees it. OPENAI_API_KEY-
// gated (same key as voice). The render is labeled in the UI as a visualization.
//
// Renders can take 20-60s — longer than many gateways keep a connection open — so
// this is FIRE-AND-POLL: POST kicks off the render and returns a token immediately;
// the client polls GET .../visualize/:token until it's done. No long-held request,
// so no gateway 503 / "failed to fetch", and the inputs are never lost.
const vizJobs = new Map(); // token -> { status, userId, jobId, photo, error, at }
function pruneVizJobs() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of vizJobs) if (v.at < cutoff) vizJobs.delete(k);
}
app.post("/api/jobs/:id/visualize", requireAuth, Billing.requireEntitled, photoJson, wrap(async (req, res) => {
  if (!Jobs.ownsJob(req.user.id, req.params.id)) return res.status(404).json({ error: "Job not found." });
  if (!visualizeConfigured()) { const e = new Error("AI visualization isn't configured on the server."); e.status = 503; e.code = "VIZ_UNCONFIGURED"; throw e; }
  const { roomImage, skuId, surface } = req.body || {};
  if (!/^data:image\//.test(String(roomImage || ""))) return res.status(400).json({ error: "Add a photo of the room first." });
  let materialBuffer = null, materialMime = null, materialName = String((req.body && req.body.materialName) || "");
  if (skuId) {
    const sk = Skus.getSku(req.user.id, skuId);
    if (sk) {
      if (!materialName) materialName = sk.name;
      if (sk.image_file) { try { materialBuffer = fs.readFileSync(path.join(PHOTO_DIR, sk.image_file)); materialMime = sk.image_mime || "image/jpeg"; } catch {} }
    }
  }
  pruneVizJobs();
  const token = uid();
  const jobId = req.params.id, userId = req.user.id, user = req.user;
  vizJobs.set(token, { status: "pending", userId, jobId, at: Date.now() });
  // Run the render in the background; do NOT await — the response returns now.
  (async () => {
    try {
      const out = await visualizeRoom(user, { roomImage, materialBuffer, materialMime, materialName, surface });
      const pid = uid(), filename = `${pid}.png`;
      fs.writeFileSync(path.join(PHOTO_DIR, filename), out.buffer);
      db.prepare("INSERT INTO photo (id, job_id, user_id, filename, mime, show_on_bid, created_at) VALUES (?,?,?,?,?,?,?)")
        .run(pid, jobId, userId, filename, out.mime, 1, Date.now());
      vizJobs.set(token, { status: "done", userId, jobId, at: Date.now(),
        photo: { id: pid, url: signPhotoUrl(jobId, pid), showOnBid: true } });
    } catch (e) {
      console.error("[visualize]", e && (e.message || e));
      vizJobs.set(token, { status: "error", userId, jobId, at: Date.now(), error: (e && e.message) || "Render failed." });
    }
  })();
  res.json({ token, status: "pending" });
}));

// Poll a render started above. Returns {status: pending|done|error}, plus the
// photo when done or the message when failed.
app.get("/api/jobs/:id/visualize/:token", requireAuth, wrap((req, res) => {
  const v = vizJobs.get(req.params.token);
  if (!v || v.userId !== req.user.id || v.jobId !== req.params.id) return res.status(404).json({ error: "Render not found." });
  if (v.status === "done") { vizJobs.delete(req.params.token); return res.json({ status: "done", photo: v.photo }); }
  if (v.status === "error") { vizJobs.delete(req.params.token); return res.json({ status: "error", error: v.error }); }
  res.json({ status: "pending" });
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
  // Feed the contractor's own price book in so the AI uses their real items + prices.
  const data = await assistBuild(req.user, { text, from_lang, to_lang, skus: Skus.listSkus(req.user.id) });
  res.json(data);
}));
// Voice-first intake: extract structured job fields from the spoken transcript as
// the contractor talks (auto-fills the New Job screen).
app.post("/api/assist/intake", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  res.json({ intake: await assistIntake(req.user, { text: (req.body && req.body.text) || "" }) });
}));
// Universal voice fallback: transcribe a browser recording (iOS Safari has no Web Speech).
app.post("/api/assist/transcribe", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { audio, lang } = req.body || {};
  res.json(await transcribeAudio(req.user, { audio, lang }));
}));

// ---- Price book (contractor's reusable SKU catalog) ----
app.get("/api/skus", requireAuth, (req, res) => res.json({ skus: Skus.listSkus(req.user.id, req.query.q) }));
app.post("/api/skus", requireAuth, wrap((req, res) => res.json({ sku: Skus.createSku(req.user.id, req.body || {}) })));
app.patch("/api/skus/:id", requireAuth, wrap((req, res) => {
  const sku = Skus.updateSku(req.user.id, req.params.id, req.body || {});
  if (!sku) return res.status(404).json({ error: "SKU not found." });
  res.json({ sku });
}));
app.delete("/api/skus/:id", requireAuth, wrap((req, res) => {
  const r = Skus.deleteSku(req.user.id, req.params.id);
  if (!r.deleted) return res.status(404).json({ error: "SKU not found." });
  if (r.image_file) { try { fs.unlinkSync(path.join(PHOTO_DIR, r.image_file)); } catch {} }
  res.json({ ok: true });
}));

// ---- Per-SKU photo (private; signed expiring URLs, hard rule #6) ----
app.post("/api/skus/:id/image", requireAuth, photoJson, wrap((req, res) => {
  const m = /^data:(image\/[a-z.+-]+);base64,(.+)$/i.exec(String(req.body?.dataUrl || ""));
  if (!m) return res.status(400).json({ error: "Expected an image data URL." });
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image too large." });
  const ext = m[1].split("/")[1].replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const filename = `sku_${req.params.id}_${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(PHOTO_DIR, filename), buf);
  const r = Skus.setSkuImage(req.user.id, req.params.id, filename, m[1]);
  if (!r) { try { fs.unlinkSync(path.join(PHOTO_DIR, filename)); } catch {} return res.status(404).json({ error: "SKU not found." }); }
  if (r.prior) { try { fs.unlinkSync(path.join(PHOTO_DIR, r.prior)); } catch {} } // drop the replaced photo
  res.json({ image: r.url });
}));

// Served by signature (no bearer auth) so <img> tags load directly.
app.get("/api/skus/:id/image", (req, res) => {
  if (!verifySkuImageSig(req.params.id, req.query.exp, req.query.sig)) return res.status(403).send("Forbidden");
  const row = Skus.getSkuImage(req.params.id);
  if (!row || !row.image_file) return res.status(404).send("Not found");
  res.type(row.image_mime || "image/jpeg");
  res.setHeader("Cache-Control", "private, max-age=3600");
  fs.createReadStream(path.join(PHOTO_DIR, row.image_file)).pipe(res);
});

app.delete("/api/skus/:id/image", requireAuth, wrap((req, res) => {
  const r = Skus.clearSkuImage(req.user.id, req.params.id);
  if (!r) return res.status(404).json({ error: "SKU not found." });
  if (r.prior) { try { fs.unlinkSync(path.join(PHOTO_DIR, r.prior)); } catch {} }
  res.json({ ok: true });
}));
// Organize an uploaded list/photo into structured SKUs (preview — not saved yet).
app.post("/api/skus/parse", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { text, image } = req.body || {};
  res.json(await parseSkus(req.user, { text, image }));
}));
// Save the organized rows into the price book.
app.post("/api/skus/import", requireAuth, wrap((req, res) => {
  res.json(Skus.bulkCreate(req.user.id, (req.body && req.body.items) || []));
}));

// ---- Leads: inbound contractor leads → jobs (the top of the funnel) ----
app.get("/api/leads", requireAuth, (req, res) => {
  const token = Leads.getOrCreateToken(req.user.id);
  res.json({ leads: Leads.listLeads(req.user.id), new: Leads.countNew(req.user.id),
    token, webhookUrl: `${baseUrl(req)}/api/inbound/leads?token=${token}` });
});
app.post("/api/leads", requireAuth, wrap((req, res) => res.json({ lead: Leads.createLead(req.user.id, req.body || {}) })));
app.patch("/api/leads/:id", requireAuth, wrap((req, res) => {
  const lead = Leads.updateLead(req.user.id, req.params.id, req.body || {});
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  res.json({ lead });
}));
app.delete("/api/leads/:id", requireAuth, wrap((req, res) => {
  if (!Leads.deleteLead(req.user.id, req.params.id)) return res.status(404).json({ error: "Lead not found." });
  res.json({ ok: true });
}));
app.post("/api/leads/import", requireAuth, wrap((req, res) => res.json(Leads.bulkCreate(req.user.id, (req.body && req.body.items) || []))));
app.post("/api/leads/token/rotate", requireAuth, wrap((req, res) => {
  const token = Leads.rotateToken(req.user.id);
  res.json({ token, webhookUrl: `${baseUrl(req)}/api/inbound/leads?token=${token}` });
}));

// Inbound webhook for n8n / website forms / lead ads. Auth is the per-user token
// (query ?token= or x-lead-token header) — NOT a session. Normalizes loose payloads.
app.post("/api/inbound/leads", wrap((req, res) => {
  const token = String(req.query.token || req.headers["x-lead-token"] || "");
  const userId = Leads.userIdForToken(token);
  if (!userId) return res.status(401).json({ error: "Invalid or missing lead token." });
  const lead = Leads.createLead(userId, Leads.normalizeInbound(req.body || {}));
  // Fan out to the contractor's notification sink (email/SMS via their webhook) if set.
  try { Notify.notify && Notify.notify({ type: "lead", lead, userId }); } catch {}
  res.json({ ok: true, id: lead.id });
}));

// ---- Share a bid: a clean public link the contractor texts/emails ----
app.get("/api/jobs/:id/share", requireAuth, wrap((req, res) => {
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

// Public, signed link to the proposal PDF — the client's downloadable signed
// agreement. Reachable only with a valid HMAC (hard rule #6); margin/notes are
// stripped by buildProposal (hard rule #2). Includes the ACCEPTED & SIGNED block
// when the customer has signed.
app.get("/p/:id/pdf", wrap((req, res) => {
  if (!verifyProposalPdfSig(req.params.id, req.query.exp, req.query.sig)) {
    return res.status(403).send("This link has expired or is invalid.");
  }
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(req.params.id);
  if (!jobRow) return res.status(404).send("Estimate not found.");
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(jobRow.user_id);
  const proposal = buildProposal(Jobs.rowToJob(jobRow), settingsOf(owner || {}));
  proposal.photos = db.prepare("SELECT filename, mime FROM photo WHERE job_id=? AND show_on_bid=1 ORDER BY created_at")
    .all(jobRow.id)
    .map((r) => { try { return { buf: fs.readFileSync(path.join(PHOTO_DIR, r.filename)), mime: r.mime }; } catch { return null; } })
    .filter(Boolean);
  const sig = Signatures.latestSignature(jobRow.id);
  if (sig) proposal.signature = {
    name: sig.signer_name, png: sig.signature_png, total: sig.accepted_total,
    at: new Date(sig.signed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), ip: sig.ip || "",
  };
  const safe = (jobRow.title || "agreement").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${sig ? "signed-agreement" : "bid"}-${safe}.pdf"`);
  renderProposalPDF(proposal, res);
}));

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
    // Once signed, the client can download their countersigned agreement copy.
    signedPdfUrl: sig ? signProposalPdfUrl(jobRow.id) : "",
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
  const { name, email, signature, approved, payNow } = req.body || {};

  // Persist the signature (validates approval box + name + inked PNG).
  Signatures.saveSignature(jobRow, {
    name, email, png: signature, approved: approved === true, total: proposal.total,
    ip: clientIp(req), userAgent: req.headers["user-agent"] || "",
  });
  track(jobRow.user_id, "approval_checked", { jobId: jobRow.id });
  track(jobRow.user_id, "signature_submitted", { jobId: jobRow.id, total: proposal.total });
  acceptJob(jobRow); // status -> signed (+ bid_accepted by customer)

  // Deliver the signed agreement: email the PDF to the client + contractor, and
  // file it in the contractor's QuickBooks (Estimate + attached PDF). All
  // fire-and-forget — signing must never block or fail on email/QB.
  deliverSignedAgreement(jobRow, owner, proposal, { name, email }).catch(() => {});

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
const escHtml = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const EMAIL_OK = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || ""));

// Render the signed proposal PDF (photos + signature block) to a Buffer.
function signedPdfBuffer(jobRow, owner) {
  return new Promise((resolve, reject) => {
    try {
      const proposal = buildProposal(Jobs.rowToJob(jobRow), settingsOf(owner || {}));
      proposal.photos = db.prepare("SELECT filename, mime FROM photo WHERE job_id=? AND show_on_bid=1 ORDER BY created_at")
        .all(jobRow.id)
        .map((r) => { try { return { buf: fs.readFileSync(path.join(PHOTO_DIR, r.filename)), mime: r.mime }; } catch { return null; } })
        .filter(Boolean);
      const sig = Signatures.latestSignature(jobRow.id);
      if (sig) proposal.signature = {
        name: sig.signer_name, png: sig.signature_png, total: sig.accepted_total,
        at: new Date(sig.signed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }), ip: sig.ip || "",
      };
      const pt = new PassThrough(); const chunks = [];
      pt.on("data", (c) => chunks.push(c));
      pt.on("end", () => resolve(Buffer.concat(chunks)));
      pt.on("error", reject);
      renderProposalPDF(proposal, pt);
    } catch (e) { reject(e); }
  });
}

// Email the signed agreement to client + contractor, and file it in QuickBooks
// (Estimate + attached PDF). Every step is best-effort; never throws.
async function deliverSignedAgreement(jobRow, owner, proposal, { name, email } = {}) {
  let pdf = null;
  try { pdf = await signedPdfBuffer(jobRow, owner); } catch { pdf = null; }
  const safe = (jobRow.title || "agreement").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  const filename = `signed-agreement-${safe}.pdf`;
  const company = (owner && owner.company && owner.company !== "Your Company") ? owner.company : "your contractor";

  if (pdf && Mail.mailConfigured()) {
    const to = [];
    if (EMAIL_OK(email)) to.push(String(email).trim());
    if (owner && owner.email) to.push(owner.email);
    if (to.length) {
      const html = `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;color:#1F252C">
        <h2 style="margin:0 0 8px">Signed &amp; accepted ✔</h2>
        <p style="color:#5a5240">Attached is the signed copy of the proposal for <b>${escHtml(proposal.title)}</b>${name ? `, signed by ${escHtml(name)}` : ""}. ${escHtml(company)} will be in touch about next steps.</p>
        <p style="color:#8a7f68;font-size:.85rem">Sent by Bidtranslator on behalf of ${escHtml(company)}.</p>
      </div>`;
      try {
        await Mail.sendMail({
          to, subject: `Signed agreement — ${proposal.title}`,
          html, text: `Attached is the signed agreement for ${proposal.title}.`,
          attachments: [{ filename, content: pdf.toString("base64") }],
          replyTo: owner && owner.email ? owner.email : undefined,
        });
      } catch { /* never fail signing */ }
    }
  }

  if (owner) {
    try {
      const est = await QuickBooks.syncEstimate(owner, { amount: proposal.total, description: `Signed — ${proposal.title}`, customer: name || proposal.customer, date: Date.now() });
      if (est && est.id && pdf) await QuickBooks.attachToEstimate(owner, est.id, { filename, pdf });
    } catch { /* fire-and-forget */ }
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
app.get("/api/jobs/:id/pdf", requireAuth, wrap((req, res) => {
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
