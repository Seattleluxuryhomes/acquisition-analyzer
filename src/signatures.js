// Customer proposal signatures — a lightweight approval record (not a full legal
// e-sign platform). Validates the inked PNG, stores who/when/where + the accepted
// total, and exposes the latest signature for a job (public proposal + PDF).
import crypto from "node:crypto";
import db from "./db.js";

const MAX_PNG = 240 * 1024; // generous for a canvas signature; well under the 256kb body cap
const PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/;

export function isValidSignaturePng(png) {
  return typeof png === "string" && PNG_RE.test(png) && png.length <= MAX_PNG && png.length > 80;
}

// Persist a signature for a job. Returns the stored record, or throws (400) on a
// bad payload so the route can surface a clean message.
export function saveSignature(jobRow, { name, png, total, ip, userAgent, approved } = {}) {
  const signer = String(name || "").trim().slice(0, 120);
  if (!signer) { const e = new Error("Please type your name to sign."); e.status = 400; throw e; }
  if (approved !== true) { const e = new Error("Please check the approval box before signing."); e.status = 400; throw e; }
  if (!isValidSignaturePng(png)) { const e = new Error("Your signature didn't come through — please sign again."); e.status = 400; throw e; }

  const id = crypto.randomBytes(9).toString("base64url");
  const now = Date.now();
  db.prepare(`INSERT INTO signature
    (id, job_id, user_id, signer_name, signature_png, accepted_total, approved, ip, user_agent, signed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, jobRow.id, jobRow.user_id, signer, png,
    Math.max(0, Math.round(Number(total) || 0)), 1,
    String(ip || "").slice(0, 64), String(userAgent || "").slice(0, 300), now
  );
  return { id, job_id: jobRow.id, signer_name: signer, accepted_total: Math.round(Number(total) || 0), signed_at: now };
}

// Most recent signature on a job (what the proposal page + PDF show).
export function latestSignature(jobId) {
  return db.prepare("SELECT * FROM signature WHERE job_id=? ORDER BY signed_at DESC LIMIT 1").get(jobId) || null;
}
