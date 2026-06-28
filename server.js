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
import { signup, signin, signout, changePassword, requireAuth, publicUser, createResetToken, confirmPasswordReset, adminCreateUser } from "./src/auth.js";
import * as Mail from "./src/mail.js";
import * as Jobs from "./src/jobs.js";
import { assistBuild, assistIntake, reviewBid, aiConfigured, parseSkus, scanMaterials, generateSiteCopy, generateProjectWriteup, generateReviewRequest, generateLeadFollowup, generateFunnelHeadline, transcribeAudio, transcribeConfigured, visualizeRoom, visualizeConfigured } from "./src/assist.js";
import * as SiteProjects from "./src/siteProjects.js";
import { growthScore } from "./src/growth.js";
import * as Inbox from "./src/inbox.js";
import * as Funnels from "./src/funnels.js";
import * as Prospecting from "./src/prospecting.js";
import * as Prospects from "./src/prospects.js";
import { tradeList, sampleScope, tradeLabel } from "./src/trades.js";
import * as Skus from "./src/skus.js";
import * as Leads from "./src/leads.js";
import * as Team from "./src/team.js";
import * as Dispatch from "./src/dispatch.js";
import * as Draws from "./src/draws.js";
import * as ChangeOrders from "./src/changeOrders.js";
import * as Referrals from "./src/referrals.js";
import { renderScopeHTML } from "./src/scopeHtml.js";
import { renderDrawHTML } from "./src/drawHtml.js";
import { renderChangeOrderHTML } from "./src/changeOrderHtml.js";
import { renderContractorSite } from "./src/contractorSite.js";
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
const isBigJson = (req) => req.method === "POST" && (req.path === "/api/skus/parse" || req.path === "/api/assist/transcribe" || req.path === "/api/assist/scan");
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

// ---- Living website (Sprint 12) helpers ----
// Name-agnostic branded address: the base domain is a single knob, so the day the
// brand is locked (BidVoice/Bidtranslator/…) the whole engine flips with one env var.
const SITE_DOMAIN = () => (process.env.BT_SITE_DOMAIN || "bidvoice.ai").trim().toLowerCase();
const brandedSiteUrl = (slug) => (slug ? `https://${slug}.${SITE_DOMAIN()}` : "");
// Public, signature-free URL for a photo PUBLISHED to a project (the /pub route
// only serves photos attached to a published project — see isPhotoPublic).
const pubPhotoUrl = (req, pid) => `${baseUrl(req)}/pub/photo/${pid}`;
function slugify(s) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function ensureSlug(user) {
  if (user.site_slug) return user.site_slug;
  const base = slugify(user.company) || slugify(user.name) || ("site-" + String(user.id).slice(0, 6).toLowerCase());
  let slug = base, n = 1;
  while (db.prepare("SELECT id FROM user WHERE site_slug=? AND id<>?").get(slug, user.id)) slug = base + "-" + (++n);
  db.prepare("UPDATE user SET site_slug=? WHERE id=?").run(slug, user.id);
  return slug;
}

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
    company: user.company, name: user.name, phone: user.phone, license: user.license, whatsapp: user.whatsapp || "",
    from: user.default_from_lang, to: user.default_to_lang, logo: user.logo || "", email: user.email || "",
    tax_rate: user.tax_rate == null ? 0 : user.tax_rate, region: user.region || "",
    // null → contractor hasn't customized; surface the default so the Settings
    // editor is pre-filled and proposals show terms out of the box.
    terms: user.terms == null ? DEFAULT_TERMS : user.terms,
    // Customer-facing website settings.
    services: (() => { try { return JSON.parse(user.services || "[]"); } catch { return []; } })(),
    site_tagline: user.site_tagline || "",
    site_color: user.site_color || "",
    site_about: user.site_about || "",
    // Living website (Sprint 12): publish state + branded/working URLs.
    site_slug: user.site_slug || "",
    site_published: !!user.site_published,
    site_branded_url: brandedSiteUrl(user.site_slug || ""),
    // Custom-site request: whether this contractor has asked us to build them one.
    site_requested: !!user.site_request_at,
    site_request_note: user.site_request_note || "",
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
    // Attribute the signup to whoever's referral code they came in on (the GC
    // earns a crew credit once this user becomes a paying subscriber).
    const ref = String((req.body && (req.body.ref || req.body.r)) || "").trim();
    if (ref && Referrals.setReferrer(out.user.id, ref)) track(out.user.id, "referred_signup", { by: ref });
    track(out.user.id, "user_registered", { email: out.user.email, role: out.user.role || "contractor" });
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
// The "you have a new lead" email — the one notification a contractor gets when a
// homeowner requests an estimate on their website, so the lead never goes unseen.
function leadEmailHtml(lead, appUrl) {
  const row = (k, v) => v ? `<tr><td style="padding:4px 12px 4px 0;color:#8a7f68">${k}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>` : "";
  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1F252C">
    <div style="font-weight:800;font-size:1.2rem">Bid<span style="color:#CF7F18">translator</span></div>
    <h2 style="margin:18px 0 6px">📥 New estimate request</h2>
    <p style="color:#5a5240">Someone just asked you for an estimate. Reach out while it's hot.</p>
    <table style="margin:14px 0;font-size:.96rem">${row("Name", lead.name)}${row("Phone", lead.phone)}${row("Email", lead.email)}${row("Project", lead.job_type)}${row("Area", lead.city)}${lead.message ? `<tr><td style="padding:4px 12px 4px 0;color:#8a7f68;vertical-align:top">Details</td><td style="padding:4px 0">${esc(lead.message)}</td></tr>` : ""}</table>
    <p style="margin:20px 0"><a href="${appUrl}/" style="background:#CF7F18;color:#1F252C;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:10px;display:inline-block">Open Bidtranslator &amp; bid it</a></p>
  </div>`;
}
function leadEmailText(lead, appUrl) {
  const f = (k, v) => v ? `${k}: ${v}\n` : "";
  return `New estimate request\n\n${f("Name", lead.name)}${f("Phone", lead.phone)}${f("Email", lead.email)}${f("Project", lead.job_type)}${f("Area", lead.city)}${lead.message ? `Details: ${lead.message}\n` : ""}\nOpen Bidtranslator to bid it: ${appUrl}/`;
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
    admin: Analytics.isAdmin(req.user), leadsNew: Leads.countNew(req.user.id), inboxNew: Inbox.countPending(req.user.id),
    ai: { build: aiConfigured(), transcribe: transcribeConfigured(), visualize: visualizeConfigured() } }));
// AI Growth Score (Sprint 13) — the coaching screen; pure data, no AI.
app.get("/api/me/growth", requireAuth, (req, res) => res.json(growthScore(req.user)));

// ---- Approval Inbox (Sprint 14): AI proposes, the contractor approves ----
app.get("/api/inbox", requireAuth, (req, res) =>
  res.json({ items: Inbox.listPending(req.user.id) }));
// Generate fresh suggestions (idempotent via dedupe). v1 source: review requests
// for won jobs, AI-drafted (template fallback when AI is off).
app.post("/api/inbox/generate", requireAuth, wrap(async (req, res) => {
  const cands = Inbox.reviewCandidates(req.user.id, 10);
  let created = 0;
  for (const job of cands) {
    let body;
    try {
      body = await generateReviewRequest(req.user, { customer: job.customer, jobTitle: job.title, company: req.user.company });
    } catch {
      body = `Hi ${job.customer || "there"}, thank you for trusting ${req.user.company || "us"} with ${job.title || "your project"}! ` +
        `If you were happy with the work, would you mind leaving us a quick review? It really helps. Thank you!`;
    }
    const s = Inbox.create(req.user.id, {
      type: "review_request", title: `Ask ${job.customer || "your client"} for a review`,
      body, context: { jobId: job.id, customer: job.customer }, dedupeKey: "review:" + job.id,
    });
    if (s) created++;
  }
  res.json({ created, items: Inbox.listPending(req.user.id) });
}));
app.post("/api/inbox/:id/approve", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  if (typeof b.body === "string" && b.body.trim()) Inbox.setBody(req.user.id, req.params.id, b.body); // contractor may edit before approving
  const s = Inbox.approve(req.user.id, req.params.id);
  if (!s) return res.status(404).json({ error: "Not found." });
  track(req.user.id, "suggestion_approved", { type: s.type });
  res.json({ suggestion: s });
}));
app.post("/api/inbox/:id/dismiss", requireAuth, wrap((req, res) => {
  const s = Inbox.dismiss(req.user.id, req.params.id);
  if (!s) return res.status(404).json({ error: "Not found." });
  res.json({ suggestion: s });
}));
app.patch("/api/me", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  if (typeof b.logo === "string" && b.logo.length > 250000) {
    return res.status(413).json({ error: "Logo image is too large — please use a smaller file." });
  }
  if (typeof b.terms === "string" && b.terms.length > 6000) b.terms = b.terms.slice(0, 6000);
  if ("services" in b) b.services = JSON.stringify((Array.isArray(b.services) ? b.services : []).slice(0, 12).map((s) => String(s).slice(0, 40)));
  const map = { company: "company", name: "name", phone: "phone", license: "license", whatsapp: "whatsapp",
    from: "default_from_lang", to: "default_to_lang", logo: "logo", region: "region", terms: "terms",
    services: "services", site_tagline: "site_tagline", site_color: "site_color", site_about: "site_about" };
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

// ---- Outbound prospecting (Gojiberry) — founder-only recruiting engine ----
// The provider key stays server-side; the client only ever gets a boolean.
app.get("/api/prospecting/config", requireAuth, requireAdmin, (req, res) =>
  res.json({ ...Prospecting.prospectingStatus(), statuses: Prospects.STATUSES }));
app.post("/api/prospecting/search", requireAuth, requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  try {
    const results = await Prospecting.search({
      trade: b.trade, city: b.city, state: b.state, keyword: b.keyword, businessType: b.businessType, limit: b.limit,
    });
    track(req.user.id, "prospect_search", { count: results.length });
    res.json({ results });
  } catch (e) { res.status(e.status || 500).json({ error: e.message, code: e.code }); }
}));
app.get("/api/prospects", requireAuth, requireAdmin, (req, res) =>
  res.json({ prospects: Prospects.list(req.user.id, req.query.status), counts: Prospects.counts(req.user.id) }));
app.post("/api/prospects", requireAuth, requireAdmin, wrap((req, res) => {
  const saved = Prospects.save(req.user.id, (req.body && req.body.prospects) || []);
  track(req.user.id, "prospect_saved", { count: saved.length });
  res.json({ saved, counts: Prospects.counts(req.user.id) });
}));
app.patch("/api/prospects/:id", requireAuth, requireAdmin, wrap((req, res) => {
  const p = Prospects.update(req.user.id, req.params.id, req.body || {});
  if (!p) return res.status(404).json({ error: "Prospect not found." });
  res.json({ prospect: p, counts: Prospects.counts(req.user.id) });
}));
app.delete("/api/prospects/:id", requireAuth, requireAdmin, wrap((req, res) => {
  if (!Prospects.remove(req.user.id, req.params.id)) return res.status(404).json({ error: "Not found." });
  res.json({ ok: true, counts: Prospects.counts(req.user.id) });
}));
// Export the prospect CRM as CSV — the handoff into Instantly (email) / LinkedHelper.
app.get("/api/prospects/export", requireAuth, requireAdmin, (req, res) => {
  const rows = Prospects.list(req.user.id);
  const cols = ["name", "contact_name", "trade", "business_type", "phone", "email", "website", "address", "city", "state", "status", "source", "notes"];
  const cell = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="bidtranslator-prospects.csv"');
  res.send(csv);
});
// Contractors who asked us to build them a custom website (the "we won't know
// unless they ask" list). Founder-only — who + their note + when, newest first.
app.get("/api/admin/site-requests", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, company, name, email, phone, site_request_at, site_request_note FROM user WHERE site_request_at IS NOT NULL ORDER BY site_request_at DESC"
  ).all();
  res.json({ requests: rows.map((r) => ({ id: r.id, company: r.company || "", name: r.name || "", email: r.email || "", phone: r.phone || "", note: r.site_request_note || "", at: r.site_request_at, site_url: baseUrl(req) + "/c/" + r.id })) });
});

// Concierge onboarding (founder-only): set a contractor up with a fully-configured
// account on the full trial, optionally import their price book, and send (or hand
// back) a secure "set your password & get started" link. The done-for-you setup
// that wires the app into their world before they ever log in.
app.post("/api/admin/onboard", requireAuth, requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const { id, user } = adminCreateUser(b);
  // Set up their website services + seed a sample bid for their trade, so their
  // first login shows a custom site AND a structured bid already waiting.
  const services = (Array.isArray(b.services) ? b.services : []).map((s) => String(s).slice(0, 40)).slice(0, 12);
  if (services.length) db.prepare("UPDATE user SET services=? WHERE id=?").run(JSON.stringify(services), id);
  const sampleTrade = services[0] || b.sample_trade || "";
  if (sampleTrade) {
    const label = (tradeList().find((t) => t.key === sampleTrade) || {}).label || "your trade";
    try {
      Jobs.createJob(id, {
        title: `Sample bid — ${label}`, customer: "Sample Client",
        from: b.from_lang || "es", to: b.to_lang || "en",
        lines: sampleScope(sampleTrade),
      });
    } catch { /* sample is a nicety — never block onboarding */ }
  }
  // Import their price book if pasted (best-effort — needs AI; never blocks onboarding).
  let skusImported = 0;
  if (String(b.priceList || "").trim()) {
    try {
      const newRow = db.prepare("SELECT * FROM user WHERE id=?").get(id);
      const parsed = await parseSkus(newRow, { text: b.priceList });
      skusImported = (Skus.bulkCreate(id, parsed.items || []) || {}).added || 0;
    } catch { /* leave 0 — onboarding still succeeds */ }
  }
  // A 7-day set-password link (an invite, not a 1-hour forgot-password reset).
  const tok = createResetToken(user.email, 7 * 24 * 60 * 60 * 1000);
  const link = `${baseUrl(req)}/reset?token=${encodeURIComponent(tok.token)}&e=${encodeURIComponent(user.email)}`;
  let emailed = false;
  if (Mail.mailConfigured()) {
    try {
      await Mail.sendMail({
        to: user.email,
        subject: `${req.user.company && req.user.company !== "Your Company" ? req.user.company : "Bidtranslator"} — your account is ready`,
        html: onboardEmailHtml(link, req.user, b.note),
        text: `You're set up on Bidtranslator. Set your password and get started:\n${link}\n\nThis link works for 7 days.`,
        replyTo: req.user.email || undefined,
      });
      emailed = true;
    } catch { emailed = false; }
  }
  track(req.user.id, "contractor_onboarded", { onboardedId: id, skus: skusImported, emailed });
  res.json({ ok: true, id, email: user.email, link, emailed, skusImported, mailConfigured: Mail.mailConfigured() });
}));
function onboardEmailHtml(link, from, note) {
  const who = from && from.name ? escHtml(from.name) : (from && from.company && from.company !== "Your Company" ? escHtml(from.company) : "We");
  return `<div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1F252C">
    <div style="font-weight:800;font-size:1.2rem">Bid<span style="color:#CF7F18">translator</span></div>
    <h2 style="margin:18px 0 8px">Your account is ready</h2>
    <p style="color:#5a5240">${who} set you up on Bidtranslator — talk a job out loud and it writes a clean, priced bid in your client's language. ${note ? escHtml(String(note)) : "Tap below to set your password and take a look."}</p>
    <p style="margin:22px 0"><a href="${link}" style="background:#CF7F18;color:#1F252C;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:10px;display:inline-block">Set your password &amp; get started</a></p>
    <p style="color:#8a7f68;font-size:.85rem">This link works for 7 days.</p>
  </div>`;
}

// ---- Demand signals ("Notify me" on coming-soon features) ----
app.post("/api/interest", requireAuth, wrap((req, res) => {
  const feature = String((req.body || {}).feature || "").trim().slice(0, 40);
  if (!feature) return res.status(400).json({ error: "feature required" });
  db.prepare("INSERT OR IGNORE INTO interest (user_id, feature, created_at) VALUES (?,?,?)")
    .run(req.user.id, feature, Date.now());
  const { c } = db.prepare("SELECT COUNT(*) c FROM interest WHERE feature=?").get(feature);
  res.json({ ok: true, count: c });
}));

// "Build me a custom website" — the contractor asks; the founder gets the signal
// (who + an optional note) and hand-builds / upsells it. Idempotent: re-asking
// updates the note. Also recorded as a demand signal so it shows in the founder
// dashboard, and pushed to the notify sink so the founder hears about it live.
app.post("/api/me/site-request", requireAuth, wrap((req, res) => {
  const note = String((req.body || {}).note || "").trim().slice(0, 500);
  db.prepare("UPDATE user SET site_request_at=?, site_request_note=? WHERE id=?")
    .run(Date.now(), note, req.user.id);
  db.prepare("INSERT OR IGNORE INTO interest (user_id, feature, created_at) VALUES (?,?,?)")
    .run(req.user.id, "custom_website", Date.now());
  track(req.user.id, "custom_site_requested", { hasNote: !!note });
  try { Notify.notify("site_request", { userId: req.user.id, company: req.user.company || "", email: req.user.email || "", phone: req.user.phone || "", note }); } catch {}
  res.json({ ok: true, site_requested: true, site_request_note: note });
}));

// Living website, step 1: AI writes the contractor's site copy (hero + About) from
// the info already in their profile — they never have to write it. Saves it so the
// /c/:id site picks it up immediately. Save Time + Make Money: a designer-quality
// page in one tap.
app.post("/api/me/site-copy", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  let services = [];
  try { services = JSON.parse(req.user.services || "[]"); } catch { services = []; }
  const labels = services.map((k) => tradeLabel(k)).filter(Boolean);
  const copy = await generateSiteCopy(req.user, {
    company: req.user.company, services: labels, region: req.user.region, licensed: !!req.user.license,
  });
  db.prepare("UPDATE user SET site_tagline=COALESCE(NULLIF(?,''), site_tagline), site_about=? WHERE id=?")
    .run(copy.tagline, copy.about, req.user.id);
  track(req.user.id, "site_copy_generated", {});
  res.json({ ok: true, ...copy });
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
  const { text, from_lang, to_lang, trade } = req.body || {};
  // Feed the contractor's own price book in so the AI uses their real items + prices,
  // and the selected trade's estimating brain so quantities come back trade-accurate.
  const data = await assistBuild(req.user, { text, from_lang, to_lang, trade, skus: Skus.listSkus(req.user.id) });
  res.json(data);
}));
// Voice-first intake: extract structured job fields from the spoken transcript as
// the contractor talks (auto-fills the New Job screen).
app.post("/api/assist/intake", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  res.json({ intake: await assistIntake(req.user, { text: (req.body && req.body.text) || "" }) });
}));
// Trade estimator library: the list of trades (with what to bring) for the picker.
app.get("/api/trades", requireAuth, (req, res) => res.json({ trades: tradeList() }));
// "You're missing money": review a draft bid against the trade's standard scope.
app.post("/api/assist/review", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { trade, lines, text } = req.body || {};
  res.json(await reviewBid(req.user, { trade, lines, text }));
}));
// Universal voice fallback: transcribe a browser recording (iOS Safari has no Web Speech).
app.post("/api/assist/transcribe", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const { audio, lang } = req.body || {};
  res.json(await transcribeAudio(req.user, { audio, lang }));
}));
// AI Material Scanner: a photo → materials/finishes across every category, to save
// the contractor from typing the bid scope. Identifications drop into the bid.
app.post("/api/assist/scan", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const out = await scanMaterials(req.user, { image: (req.body || {}).image });
  track(req.user.id, "material_scan", { found: (out.materials || []).length });
  res.json(out);
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

// ---- Team / subs (the contractor's crew + the viral invite loop) ----
app.get("/api/team", requireAuth, (req, res) => {
  res.json({ subs: Team.listSubs(req.user.id), counts: Team.counts(req.user.id) });
});
app.post("/api/team", requireAuth, wrap((req, res) => {
  const sub = Team.createSub(req.user.id, req.body || {});
  track(req.user.id, "sub_added", { trade: sub.trade || "", lang: sub.lang || "" });
  res.json({ sub, counts: Team.counts(req.user.id) });
}));
app.patch("/api/team/:id", requireAuth, wrap((req, res) => {
  const sub = Team.updateSub(req.user.id, req.params.id, req.body || {});
  if (!sub) return res.status(404).json({ error: "Sub not found." });
  res.json({ sub, counts: Team.counts(req.user.id) });
}));
// Mark that the GC sent this sub the app (the invite went out) — drives "X of 5".
app.post("/api/team/:id/invite", requireAuth, wrap((req, res) => {
  const sub = Team.markInvited(req.user.id, req.params.id);
  if (!sub) return res.status(404).json({ error: "Sub not found." });
  track(req.user.id, "sub_invited", { trade: sub.trade || "" });
  res.json({ sub, counts: Team.counts(req.user.id) });
}));
app.delete("/api/team/:id", requireAuth, wrap((req, res) => {
  if (!Team.deleteSub(req.user.id, req.params.id)) return res.status(404).json({ error: "Sub not found." });
  res.json({ ok: true, counts: Team.counts(req.user.id) });
}));

// Inbound webhook for n8n / website forms / lead ads. Auth is the per-user token
// (query ?token= or x-lead-token header) — NOT a session. Normalizes loose payloads.
app.post("/api/inbound/leads", wrap((req, res) => {
  const token = String(req.query.token || req.headers["x-lead-token"] || "");
  const userId = Leads.userIdForToken(token);
  if (!userId) return res.status(401).json({ error: "Invalid or missing lead token." });
  const lead = Leads.createLead(userId, Leads.normalizeInbound(req.body || {}));
  // ONE notification to the contractor, three reliable channels:
  // 1) in-app "good news" inbox (an event the bell + dashboard banner surface),
  track(userId, "lead_received", { leadId: lead.id, name: lead.name || "", jobType: lead.job_type || "", source: lead.source || "website" });
  // 2) external fan-out webhook (correct signature now — was passing a bad arg),
  try { Notify.notify("lead", { contractorId: userId, lead }); } catch {}
  // 3) email the contractor so they hear about it with the app closed.
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(userId);
  if (owner && owner.email && Mail.mailConfigured()) {
    Mail.sendMail({ to: owner.email, subject: `New estimate request${lead.name ? " from " + lead.name : ""}`,
      html: leadEmailHtml(lead, baseUrl(req)), text: leadEmailText(lead, baseUrl(req)) }).catch(() => {});
  }
  // Funnel attribution: count the conversion if this came from a funnel page.
  const funnelId = String(req.query.f || (req.body && req.body.funnel) || "");
  if (funnelId) Funnels.bumpLead(funnelId);
  // Sprint 15 automation: draft an AI follow-up (with appointment times) into the
  // Approval Inbox — fire-and-forget so the homeowner's submit returns instantly.
  res.json({ ok: true, id: lead.id });
  if (owner) draftLeadFollowup(owner, lead).catch(() => {});
}));

// Draft a first-reply follow-up for a new lead and drop it in the Approval Inbox.
// AI-written when configured, otherwise a solid template — either way one tap to send.
async function draftLeadFollowup(owner, lead) {
  const times = Funnels.suggestTimes(Date.now(), 3);
  let body;
  try {
    body = await generateLeadFollowup(owner, { lead, times, company: owner.company });
  } catch {
    body = `Hi ${lead.name || "there"}, thanks for reaching out to ${owner.company || "us"} about ${lead.job_type || "your project"}! ` +
      `I'd love to come take a look and get you an estimate. Would any of these work for you?\n` +
      times.map((t) => `• ${t}`).join("\n") + `\nJust reply with what's best and I'll lock it in.`;
  }
  Inbox.create(owner.id, {
    type: "follow_up", title: `Follow up with ${lead.name || "your new lead"}`,
    body, context: { leadId: lead.id, name: lead.name || "", phone: lead.phone || "" }, dedupeKey: "followup:" + lead.id,
  });
}

// ---- Scope dispatch: send a job's scope of work to a sub (free for the sub) ----
app.post("/api/jobs/:id/dispatch", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  const { note, kind } = b;
  // Selected work subset (already stripped client-side to {section,desc,qty,unit}).
  const sel = Array.isArray(b.items) ? b.items.map((l) => ({ section: l.section, desc: l.desc, qty: l.qty, unit: l.unit })) : null;
  // One sub, or several (RFQ to 3 contractors) — each gets its own dispatch + link.
  const recipients = Array.isArray(b.subs) && b.subs.length ? b.subs : [{ id: b.subId, name: b.subName, lang: b.subLang }];
  const out = [];
  for (const r of recipients) {
    const d = Dispatch.createDispatch(req.user.id, { jobId: req.params.id, subId: r.id, subName: r.name, subLang: r.lang, note, kind, items: sel });
    if (d) out.push({ dispatch: d, url: baseUrl(req) + "/s/" + d.id, sub: r });
  }
  if (!out.length) return res.status(404).json({ error: "Job not found." });
  track(req.user.id, "scope_dispatched", { jobId: req.params.id, kind: kind === "rfq" ? "rfq" : "work", count: out.length });
  res.json({ sent: out });
}));
app.get("/api/jobs/:id/dispatches", requireAuth, (req, res) => {
  res.json({ dispatches: Dispatch.listForJob(req.user.id, req.params.id) });
});
// GC accepts a specific contractor's bid (RFQ) — owner-scoped; others auto-declined.
app.post("/api/jobs/:id/dispatch/:did/accept", requireAuth, wrap((req, res) => {
  const d = Dispatch.acceptBid(req.user.id, req.params.id, req.params.did);
  if (!d) return res.status(404).json({ error: "Bid not found." });
  track(req.user.id, "bid_accepted", { jobId: req.params.id, sub: d.accepted_by || "", amount: d.bid_amount || 0 });
  res.json({ dispatch: d, dispatches: Dispatch.listForJob(req.user.id, req.params.id) });
}));

// Public, login-free scope page a sub opens. Only buildScope() data is rendered —
// the work + photos, never price/margin (hard rule #2). The unguessable id is the
// access grant (same model as /p/:id).
app.get("/s/:id", (req, res) => {
  const d = Dispatch.getPublic(req.params.id);
  if (!d) return res.status(404).send("This scope link is invalid.");
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(d.job_id);
  if (!jobRow) return res.status(404).send("Job not found.");
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(d.user_id);
  // Only the SELECTED scope subset for this dispatch (frozen snapshot), else the job.
  const scope = Dispatch.scopeForDispatch(d, Jobs.rowToJob(jobRow));
  // All of the GC's job photos (signed, expiring) — the sub needs to see the work.
  const photos = db.prepare("SELECT id FROM photo WHERE job_id=? ORDER BY created_at").all(jobRow.id)
    .map((r) => ({ url: signPhotoUrl(jobRow.id, r.id) }));
  res.type("html").send(renderScopeHTML(scope, {
    id: d.id, company: (owner && owner.company) || "Your contractor", note: d.note,
    photos, status: d.status, acceptedBy: d.accepted_by, subName: d.sub_name, lang: d.sub_lang,
    kind: d.kind, bidAmount: d.bid_amount,
  }));
});
app.post("/s/:id/viewed", wrap((req, res) => { const d = Dispatch.getPublic(req.params.id); if (d) Dispatch.markViewed(d.id); res.json({ ok: true }); }));
app.post("/s/:id/accept", wrap((req, res) => {
  const d = Dispatch.getPublic(req.params.id);
  if (!d) return res.status(404).json({ error: "Invalid scope link." });
  const out = Dispatch.accept(d.id, (req.body && req.body.name) || d.sub_name);
  track(d.user_id, "scope_accepted", { jobId: d.job_id, sub: out.accepted_by || "" });
  try { Notify.notify && Notify.notify({ type: "scope_accepted", userId: d.user_id, jobId: d.job_id, sub: out.accepted_by }); } catch {}
  res.json({ ok: true });
}));
// A contractor submits their bid back (RFQ). Public — the link is the grant.
app.post("/s/:id/bid", wrap((req, res) => {
  const d = Dispatch.getPublic(req.params.id);
  if (!d) return res.status(404).json({ error: "Invalid scope link." });
  const out = Dispatch.submitBid(d.id, { amount: (req.body && req.body.amount) || 0, note: (req.body && req.body.note) || "" });
  track(d.user_id, "scope_bid", { jobId: d.job_id, sub: out.sub_name || "", amount: out.bid_amount || 0 });
  try { Notify.notify && Notify.notify({ type: "scope_bid", userId: d.user_id, jobId: d.job_id, sub: out.sub_name, amount: out.bid_amount }); } catch {}
  res.json({ ok: true });
}));

// ---- Draw requests: progress billing with proof (photos) → owner/bank approval ----
// The contractor documents completed work and sends a public link; the property
// owner or their lender reviews the proof and approves (and pays, if Connect is on).
app.post("/api/jobs/:id/draws", requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  let draw;
  try {
    draw = Draws.createDraw(req.user.id, { jobId: req.params.id, amount: b.amount, description: b.description, photoIds: b.photoIds });
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!draw) return res.status(404).json({ error: "Job not found." });
  // If this contractor has Stripe Connect set up, attach a pay-now link so the
  // owner/bank can approve AND pay in one step. Best-effort — the draw still works
  // as approval-only if payments aren't configured.
  if (Payments.paymentsConfigured() && req.user.connect_charges_enabled) {
    try {
      const reqObj = await Payments.createPaymentRequest(req.user, {
        amount: draw.amount, description: `Draw — ${b.description || "progress payment"}`.slice(0, 200),
        clientName: "", jobId: req.params.id,
      }, baseUrl(req));
      if (reqObj && reqObj.url) Draws.setCheckoutUrl(req.user.id, draw.id, reqObj.url);
    } catch { /* approval-only draw */ }
  }
  track(req.user.id, "draw_requested", { jobId: req.params.id, amount: draw.amount });
  const fresh = Draws.getPublic(draw.id);
  res.json({ draw: fresh, url: baseUrl(req) + "/d/" + draw.id });
}));
app.get("/api/jobs/:id/draws", requireAuth, (req, res) => {
  res.json({ draws: Draws.listForJob(req.user.id, req.params.id) });
});

// Public, login-free draw-review page the property owner or bank/lender opens. The
// unguessable id is the access grant (same model as /p/:id). No private bid data.
app.get("/d/:id", (req, res) => {
  const draw = Draws.getPublic(req.params.id);
  if (!draw) return res.status(404).send("This draw link is invalid.");
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(draw.job_id);
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(draw.user_id);
  // Only the photos the contractor attached to this draw (signed, expiring).
  const photos = (draw.photo_ids || []).map((pid) => ({ url: signPhotoUrl(draw.job_id, pid) }));
  res.type("html").send(renderDrawHTML(draw, {
    id: draw.id, company: (owner && owner.company) || "Your contractor",
    jobTitle: (jobRow && jobRow.title) || "Project", photos,
  }));
});
app.post("/d/:id/approve", wrap((req, res) => {
  const draw = Draws.getPublic(req.params.id);
  if (!draw) return res.status(404).json({ error: "Invalid draw link." });
  const out = Draws.approve(draw.id, (req.body && req.body.name) || "");
  track(draw.user_id, "draw_approved", { jobId: draw.job_id, amount: draw.amount, by: out.approved_by || "" });
  try { Notify.notify && Notify.notify({ type: "draw_approved", userId: draw.user_id, jobId: draw.job_id, amount: draw.amount, by: out.approved_by }); } catch {}
  res.json({ ok: true });
}));

// ---- Change orders: document extra/changed work → client e-signs → optional pay ----
app.post("/api/jobs/:id/change-orders", requireAuth, wrap(async (req, res) => {
  const b = req.body || {};
  let co;
  try {
    co = ChangeOrders.createChangeOrder(req.user.id, { jobId: req.params.id, title: b.title, description: b.description, amount: b.amount, items: b.items });
  } catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!co) return res.status(404).json({ error: "Job not found." });
  // Attach a pay-now link when Connect is set up and the CO is a charge (not a credit).
  if (Payments.paymentsConfigured() && req.user.connect_charges_enabled && co.amount >= 1) {
    try {
      const reqObj = await Payments.createPaymentRequest(req.user, {
        amount: co.amount, description: `Change order #${co.number}${b.title ? " — " + b.title : ""}`.slice(0, 200),
        clientName: "", jobId: req.params.id,
      }, baseUrl(req));
      if (reqObj && reqObj.url) ChangeOrders.setCheckoutUrl(req.user.id, co.id, reqObj.url);
    } catch { /* approval-only CO */ }
  }
  track(req.user.id, "change_order_sent", { jobId: req.params.id, number: co.number, amount: co.amount });
  res.json({ change_order: ChangeOrders.getPublic(co.id), url: baseUrl(req) + "/co/" + co.id });
}));
app.get("/api/jobs/:id/change-orders", requireAuth, (req, res) => {
  res.json({ change_orders: ChangeOrders.listForJob(req.user.id, req.params.id) });
});

// Public, login-free change-order page (the client opens the shared link).
app.get("/co/:id", (req, res) => {
  const co = ChangeOrders.getPublic(req.params.id);
  if (!co) return res.status(404).send("This change-order link is invalid.");
  const jobRow = db.prepare("SELECT * FROM job WHERE id=?").get(co.job_id);
  const owner = db.prepare("SELECT * FROM user WHERE id=?").get(co.user_id);
  if (co.status === "sent") { try { db.prepare("UPDATE change_order SET updated_at=? WHERE id=?").run(Date.now(), co.id); } catch {} }
  res.type("html").send(renderChangeOrderHTML(co, {
    id: co.id, company: (owner && owner.company) || "Your contractor",
    jobTitle: (jobRow && jobRow.title) || "Project",
  }));
});
app.post("/co/:id/approve", wrap((req, res) => {
  const co = ChangeOrders.getPublic(req.params.id);
  if (!co) return res.status(404).json({ error: "Invalid change-order link." });
  const out = ChangeOrders.approve(co.id, (req.body && req.body.name) || "");
  track(co.user_id, "change_order_approved", { jobId: co.job_id, number: co.number, amount: co.amount, by: out.signed_by || "" });
  try { Notify.notify && Notify.notify({ type: "change_order_approved", userId: co.user_id, jobId: co.job_id, amount: co.amount, by: out.signed_by }); } catch {}
  res.json({ ok: true });
}));
app.post("/co/:id/decline", wrap((req, res) => {
  const co = ChangeOrders.getPublic(req.params.id);
  if (!co) return res.status(404).json({ error: "Invalid change-order link." });
  ChangeOrders.decline(co.id);
  track(co.user_id, "change_order_declined", { jobId: co.job_id, number: co.number });
  try { Notify.notify && Notify.notify({ type: "change_order_declined", userId: co.user_id, jobId: co.job_id }); } catch {}
  res.json({ ok: true });
}));

// Public, signature-free photo — ONLY for photos the contractor published to a
// project (isPhotoPublic gates it). Private job photos still require the HMAC route,
// so opting a project public never exposes anything else.
app.get("/pub/photo/:pid", (req, res) => {
  const pid = req.params.pid;
  if (!SiteProjects.isPhotoPublic(pid)) return res.status(404).send("Not found.");
  const row = db.prepare("SELECT filename, mime FROM photo WHERE id=?").get(pid);
  if (!row) return res.status(404).send("Not found.");
  res.set("Cache-Control", "public, max-age=86400");
  if (row.mime) res.type(row.mime);
  fs.createReadStream(path.join(PHOTO_DIR, row.filename)).pipe(res);
});

// Living website (Sprint 12) — publish a finished job to the website. AI writes the
// project description; chosen photos become a Before & After gallery. One tap, no
// website builder. Save Time + Make Money: a growing portfolio that ranks + converts.
app.post("/api/jobs/:id/publish-project", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  const b = req.body || {};
  // Neighborhood only (never the full street address) for privacy on a public page.
  const area = String(b.area || (job.address ? String(job.address).split(",").slice(-2, -1)[0] : "") || req.user.region || "").trim().slice(0, 80);
  let writeup = { title: b.title || job.title || "Recent project", description: b.description || "" };
  if (!b.description) {
    try {
      writeup = await generateProjectWriteup(req.user, {
        trade: tradeLabel(job.trade) || job.trade || "", jobTitle: job.title, area,
        scope: (job.lines || []).map((l) => l.desc).filter(Boolean),
      });
    } catch (e) { if (e.code === "AI_UNCONFIGURED" || e.status === 429) { /* fall back to plain title */ } else throw e; }
  }
  const proj = SiteProjects.createFromJob(req.user.id, {
    jobId: job.id, title: writeup.title, description: writeup.description,
    service: tradeLabel(job.trade) || job.trade || "", area,
    beforeIds: Array.isArray(b.beforeIds) ? b.beforeIds : [],
    afterIds: Array.isArray(b.afterIds) ? b.afterIds : (Array.isArray(b.photoIds) ? b.photoIds : []),
  });
  if (!proj) return res.status(400).json({ error: "Could not publish this project." });
  ensureSlug(req.user);
  db.prepare("UPDATE user SET site_published=1 WHERE id=?").run(req.user.id);
  track(req.user.id, "project_published", { jobId: job.id });
  res.json({ project: proj, siteUrl: baseUrl(req) + "/c/" + req.user.id });
}));
app.get("/api/jobs/:id/site-projects", requireAuth, (req, res) =>
  res.json({ projects: SiteProjects.listForJob(req.user.id, req.params.id) }));
app.delete("/api/site/projects/:id", requireAuth, wrap((req, res) => {
  if (!SiteProjects.remove(req.user.id, req.params.id)) return res.status(404).json({ error: "Not found." });
  res.json({ ok: true });
}));

// Publish Website button: mark the site live + mint the branded slug. The deploy
// "backend" (real subdomain routing) is architecture-only for now — the site is
// already served at /c/:id and /c/:slug; the branded URL is the displayed address.
app.post("/api/me/publish-site", requireAuth, wrap((req, res) => {
  const slug = ensureSlug(req.user);
  db.prepare("UPDATE user SET site_published=1 WHERE id=?").run(req.user.id);
  track(req.user.id, "website_published", {});
  res.json({ ok: true, slug, branded_url: brandedSiteUrl(slug), live_url: baseUrl(req) + "/c/" + slug });
}));

// ---- AI Funnel (Sprint 15): offer-led landing pages ----
app.get("/api/funnels", requireAuth, (req, res) => res.json({ funnels: Funnels.list(req.user.id) }));
app.post("/api/funnels", requireAuth, Billing.requireEntitled, wrap(async (req, res) => {
  const b = req.body || {};
  const service = String(b.service || "").slice(0, 80);
  const offer = String(b.offer || "Free Estimate").slice(0, 80);
  let head = { headline: b.headline || "", subhead: b.subhead || "" };
  if (!b.headline) {
    try { head = await generateFunnelHeadline(req.user, { service: tradeLabel(service) || service, offer, company: req.user.company }); }
    catch { head = { headline: `${offer}${service ? " — " + (tradeLabel(service) || service) : ""}`, subhead: "Fast, free, no pressure. Get yours in 60 seconds." }; }
  }
  ensureSlug(req.user);
  const f = Funnels.create(req.user.id, { name: b.name || offer, service, offer, headline: head.headline, subhead: head.subhead, cta: b.cta });
  track(req.user.id, "funnel_created", { service });
  res.json({ funnel: f, url: baseUrl(req) + "/f/" + f.id });
}));
app.delete("/api/funnels/:id", requireAuth, wrap((req, res) => {
  if (!Funnels.remove(req.user.id, req.params.id)) return res.status(404).json({ error: "Not found." });
  res.json({ ok: true });
}));

// Public funnel page — the existing site rendered in offer mode (single dominant
// CTA, offer hero). A submit runs the same inbound-leads chain (with funnel attr).
app.get("/f/:id", (req, res) => {
  const f = Funnels.getPublic(req.params.id);
  if (!f) return res.status(404).send("Page not found.");
  const u = db.prepare("SELECT * FROM user WHERE id=?").get(f.user_id);
  if (!u) return res.status(404).send("Page not found.");
  Funnels.bumpView(f.id);
  const token = Leads.getOrCreateToken(u.id);
  const leadAction = `${baseUrl(req)}/api/inbound/leads?token=${encodeURIComponent(token)}&f=${encodeURIComponent(f.id)}`;
  const projects = SiteProjects.listPublished(u.id).slice(0, 6).map((p) => ({
    title: p.title, description: p.description, service: p.service, area: p.area,
    before: p.before_ids.map((pid) => pubPhotoUrl(req, pid)), after: p.after_ids.map((pid) => pubPhotoUrl(req, pid)),
  }));
  res.type("html").send(renderContractorSite(settingsOf(u), { leadAction, projects, offer: { headline: f.headline, subhead: f.subhead, cta: f.cta } }));
});

// Public, login-free contractor website (built from their profile + published
// projects). Resolves by user id OR slug. The estimate form posts to inbound-leads.
app.get("/c/:id", (req, res) => {
  const key = req.params.id;
  const u = db.prepare("SELECT * FROM user WHERE id=? OR site_slug=?").get(key, key);
  if (!u) return res.status(404).send("Site not found.");
  const token = Leads.getOrCreateToken(u.id);
  const leadAction = `${baseUrl(req)}/api/inbound/leads?token=${encodeURIComponent(token)}`;
  // Published projects → a Before & After gallery, photos via the public route.
  const projects = SiteProjects.listPublished(u.id).slice(0, 12).map((p) => ({
    title: p.title, description: p.description, service: p.service, area: p.area,
    before: p.before_ids.map((pid) => pubPhotoUrl(req, pid)),
    after: p.after_ids.map((pid) => pubPhotoUrl(req, pid)),
  }));
  res.type("html").send(renderContractorSite(settingsOf(u), { leadAction, projects }));
});

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
