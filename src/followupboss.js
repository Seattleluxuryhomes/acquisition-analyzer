// Follow Up Boss CRM — the FOUNDER's contact list of every contractor who signs
// up for BidVoice (platform-level, one FUB account via FOLLOWUPBOSS_API_KEY).
// On signup we create the contractor as a person, sourced/tagged "BidVoice"
// so they stay separate from the founder's real-estate pipeline; key lifecycle
// moments are added as notes so the founder knows who to follow up with.
//
// Entirely optional: unset FOLLOWUPBOSS_API_KEY = no-op. Called fire-and-forget
// from analytics.forwardToSinks, so it never blocks or breaks a request.
import db from "./db.js";

const BASE = () => (process.env.FOLLOWUPBOSS_BASE_URL || "https://api.followupboss.com/v1").replace(/\/+$/, "");
const KEY = () => process.env.FOLLOWUPBOSS_API_KEY || "";
const SOURCE = () => process.env.FOLLOWUPBOSS_SOURCE || "BidVoice";
const TAG = () => process.env.FOLLOWUPBOSS_TAG || "BidVoice Contractor";

export function fubConfigured() { return !!KEY(); }

function headers() {
  return {
    // FUB uses HTTP Basic with the API key as the username and an empty password.
    Authorization: "Basic " + Buffer.from(KEY() + ":").toString("base64"),
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-System": "BidVoice",
    "X-System-Key": process.env.FOLLOWUPBOSS_SYSTEM_KEY || "bidtranslator",
  };
}

async function fub(method, path, body) {
  const res = await fetch(BASE() + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(json?.errorMessage || `Follow Up Boss ${res.status}`), { status: res.status });
  return json;
}

// Don't add the founder's own admin account as one of their contractors.
function isAdminEmail(email) {
  const a = (process.env.BT_ADMIN_EMAIL || "").trim().toLowerCase();
  return !!a && String(email || "").toLowerCase() === a;
}

function nameParts(user) {
  const n = String(user.name || "").trim();
  if (n) { const i = n.indexOf(" "); return i > 0 ? { firstName: n.slice(0, i), lastName: n.slice(i + 1) } : { firstName: n, lastName: "" }; }
  return { firstName: user.company || "Contractor", lastName: "" };
}

async function addNote(personId, subject, body) {
  return fub("POST", "/notes", { personId: Number(personId) || personId, subject, body: body || subject, isHtml: false });
}

const ready = (v) => v && v !== "pending";

// Create the contractor in FUB (once). Stores the returned person id on the user.
// Race-safe: an atomic "pending" claim means two near-simultaneous events (e.g.
// signup + onboarding) can't create duplicate people — only the claimant POSTs.
export async function upsertContractor(user) {
  if (!fubConfigured() || !user || isAdminEmail(user.email)) return { skipped: true };
  if (ready(user.fub_person_id)) return { ok: true, id: user.fub_person_id };
  const claimed = db.prepare("UPDATE user SET fub_person_id='pending' WHERE id=? AND fub_person_id IS NULL").run(user.id);
  if (claimed.changes === 0) {
    const fresh = db.prepare("SELECT fub_person_id FROM user WHERE id=?").get(user.id);
    return ready(fresh?.fub_person_id) ? { ok: true, id: fresh.fub_person_id } : { skipped: true };
  }
  try {
    const { firstName, lastName } = nameParts(user);
    const person = {
      source: SOURCE(), tags: [TAG()], firstName, lastName,
      emails: user.email ? [{ value: user.email, type: "work" }] : [],
      phones: user.phone ? [{ value: user.phone, type: "work" }] : [],
    };
    const res = await fub("POST", "/people?deduplicate=true", person);
    const id = res?.id ? String(res.id) : null;
    if (id) {
      db.prepare("UPDATE user SET fub_person_id=? WHERE id=?").run(id, user.id);
      const summary = [user.company && user.company !== "Your Company" && `Company: ${user.company}`, user.email && `Email: ${user.email}`, user.phone && `Phone: ${user.phone}`].filter(Boolean).join("\n");
      await addNote(id, "New BidVoice contractor", summary || "Signed up for BidVoice.").catch(() => {});
    } else {
      db.prepare("UPDATE user SET fub_person_id=NULL WHERE id=?").run(user.id); // release the claim
    }
    return { ok: true, id };
  } catch (e) {
    db.prepare("UPDATE user SET fub_person_id=NULL WHERE id=?").run(user.id); // release so a later event can retry
    return { error: e.message };
  }
}

// Push the contractor's real name/phone to FUB once they've filled in their
// profile (the person is created at signup with only an email).
async function updateContractor(user) {
  if (!fubConfigured() || !user || isAdminEmail(user.email)) return { skipped: true };
  try {
    let id = user.fub_person_id;
    if (!ready(id)) { const up = await upsertContractor(user); id = up.id; }
    if (!ready(id)) return { skipped: true };
    const { firstName, lastName } = nameParts(user);
    await fub("PUT", "/people/" + id, {
      firstName, lastName, tags: [TAG()],
      ...(user.phone ? { phones: [{ value: user.phone, type: "work" }] } : {}),
    });
    return { ok: true, id };
  } catch (e) { return { error: e.message }; }
}

async function logMilestone(user, text) {
  if (!fubConfigured() || !user || isAdminEmail(user.email)) return { skipped: true };
  try {
    let id = user.fub_person_id;
    if (!ready(id)) { const up = await upsertContractor(user); id = up.id; }
    if (!ready(id)) return { skipped: true }; // person not created yet — drop this note
    await addNote(id, "BidVoice update", text);
    return { ok: true };
  } catch (e) { return { error: e.message }; }
}

// Curated lifecycle moments worth a CRM timeline entry (return null to skip).
const MILESTONES = {
  bid_accepted: (p) => (p.by === "customer" ? "A customer accepted their bid. 🎉" : null),
  deposit_paid: (p) => "Collected a deposit" + (p.amount ? ` of $${Math.round(p.amount)}` : "") + ".",
  subscription_active: () => "Started a paid subscription. 💳",
};

// Single entry point from analytics.forwardToSinks (fire-and-forget).
export function onEvent(userId, name, props = {}) {
  if (!fubConfigured() || !userId) return;
  const load = () => db.prepare("SELECT * FROM user WHERE id=?").get(userId);
  if (name === "user_registered") {
    const u = load(); if (u) upsertContractor(u).catch(() => {});
    return;
  }
  if (name === "onboarding_completed") {
    // Fill in their real name/phone now that they've set up their profile.
    const u = load();
    if (u) { updateContractor(u).catch(() => {}); logMilestone(u, "Completed onboarding — set up their business profile.").catch(() => {}); }
    return;
  }
  const make = MILESTONES[name];
  if (!make) return;
  const text = make(props || {});
  if (!text) return;
  const u = load();
  if (u) logMilestone(u, text).catch(() => {});
}
