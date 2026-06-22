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
import { signPhotoUrl, verifyPhotoSig } from "./src/files.js";
import * as Billing from "./src/billing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uid = () => crypto.randomBytes(9).toString("base64url");
const app = express();

// Stripe webhook needs the RAW body for signature verification — register it
// before any JSON parsing so the bytes are untouched.
app.post("/api/billing/webhook", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  try {
    const event = Billing.verifyWebhook(req.body.toString("utf8"), req.headers["stripe-signature"]);
    Billing.handleEvent(event);
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

const baseUrl = (req) => process.env.BT_PUBLIC_URL || `${req.protocol}://${req.get("host")}`;

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
    from: user.default_from_lang, to: user.default_to_lang,
  };
}

function attachPhotos(userId, job) {
  if (!job) return job;
  const rows = db.prepare("SELECT id FROM photo WHERE job_id=? AND user_id=? ORDER BY created_at").all(job.id, userId);
  job.photos = rows.map((r) => ({ id: r.id, url: signPhotoUrl(job.id, r.id) }));
  return job;
}

// ---- Health ----
app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiConfigured(), billing: Billing.billingConfigured() }));

// ---- Auth ----
app.post("/api/auth/signup", wrap((req, res) => { res.json(signup(req.body || {})); }));
app.post("/api/auth/signin", wrap((req, res) => { res.json(signin(req.body || {})); }));
app.post("/api/auth/signout", requireAuth, wrap((req, res) => { signout(req.token); res.json({ ok: true }); }));
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

// ---- Me / settings ----
app.get("/api/me", requireAuth, (req, res) =>
  res.json({ user: publicUser(req.user), settings: settingsOf(req.user), billing: Billing.billingStatus(req.user) }));
app.patch("/api/me", requireAuth, wrap((req, res) => {
  const b = req.body || {};
  const map = { company: "company", name: "name", phone: "phone", license: "license",
    from: "default_from_lang", to: "default_to_lang" };
  const sets = [], vals = [];
  for (const [k, col] of Object.entries(map)) {
    if (k in b) { sets.push(`${col}=?`); vals.push(String(b[k] ?? "")); }
  }
  if (sets.length) { vals.push(req.user.id); db.prepare(`UPDATE user SET ${sets.join(", ")} WHERE id=?`).run(...vals); }
  const fresh = db.prepare("SELECT * FROM user WHERE id=?").get(req.user.id);
  res.json({ user: publicUser(fresh), settings: settingsOf(fresh) });
}));

// ---- Jobs ----
app.get("/api/jobs", requireAuth, (req, res) => res.json({ jobs: Jobs.listJobs(req.user.id) }));
app.post("/api/jobs", requireAuth, Billing.requireEntitled, wrap((req, res) => res.json({ job: attachPhotos(req.user.id, Jobs.createJob(req.user.id, req.body || {})) })));
app.get("/api/jobs/:id", requireAuth, wrap((req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ job: attachPhotos(req.user.id, job) });
}));
app.patch("/api/jobs/:id", requireAuth, wrap((req, res) => {
  const job = Jobs.updateJob(req.user.id, req.params.id, req.body || {});
  if (!job) return res.status(404).json({ error: "Job not found." });
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
  fs.writeFileSync(path.join(PHOTO_DIR, filename), buf);
  db.prepare("INSERT INTO photo (id, job_id, user_id, filename, mime, created_at) VALUES (?,?,?,?,?,?)")
    .run(pid, req.params.id, req.user.id, filename, m[1], Date.now());
  res.json({ photo: { id: pid, url: signPhotoUrl(req.params.id, pid) } });
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

// ---- Client proposal PDF (margin/notes stripped by buildProposal) ----
app.get("/api/jobs/:id/pdf", requireAuth, Billing.requireEntitled, wrap((req, res) => {
  const job = Jobs.getJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  const proposal = buildProposal(job, settingsOf(req.user));
  const safe = (job.title || "proposal").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="bid-${safe}.pdf"`);
  renderProposalPDF(proposal, res);
}));

// SPA fallback for the single-page app.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.BT_PORT || process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Bidtranslator on http://localhost:${PORT}`));
