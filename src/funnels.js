// AI Funnel (Sprint 15) — offer-led landing pages + the on-submit automation seam.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function rowTo(r) {
  if (!r) return null;
  return { id: r.id, user_id: r.user_id, name: r.name || "", service: r.service || "", offer: r.offer || "",
    headline: r.headline || "", subhead: r.subhead || "", cta: r.cta || "Get my free estimate",
    views: r.views || 0, leads: r.leads || 0,
    conversion: r.views ? Math.round((r.leads / r.views) * 100) : 0,
    created_at: r.created_at, updated_at: r.updated_at };
}

export function create(userId, { name, service, offer, headline, subhead, cta }) {
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO funnel (id,user_id,name,service,offer,headline,subhead,cta,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, userId, String(name || offer || "Offer").slice(0, 80), String(service || "").slice(0, 80),
      String(offer || "").slice(0, 80), String(headline || "").slice(0, 140), String(subhead || "").slice(0, 200),
      String(cta || "Get my free estimate").slice(0, 60), now, now);
  return rowTo(db.prepare("SELECT * FROM funnel WHERE id=?").get(id));
}
export function list(userId) {
  return db.prepare("SELECT * FROM funnel WHERE user_id=? ORDER BY created_at DESC").all(userId).map(rowTo);
}
export function getPublic(id) { return rowTo(db.prepare("SELECT * FROM funnel WHERE id=?").get(id)); }
export function remove(userId, id) { return db.prepare("DELETE FROM funnel WHERE id=? AND user_id=?").run(id, userId).changes > 0; }
export function bumpView(id) { try { db.prepare("UPDATE funnel SET views=views+1 WHERE id=?").run(id); } catch {} }
export function bumpLead(id) { try { db.prepare("UPDATE funnel SET leads=leads+1 WHERE id=?").run(id); } catch {} }

// Appointment-time suggestions for a follow-up: the next few business days at two
// reasonable windows. Pure date math; the contractor confirms when they reply.
export function suggestTimes(now = Date.now(), n = 3) {
  const out = [];
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 || day === 6) continue; // skip weekends
    const label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    out.push(`${label} morning (9 AM) or afternoon (2 PM)`);
  }
  return out;
}
