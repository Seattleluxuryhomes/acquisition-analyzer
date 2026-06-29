/**
 * Offer records — create / read / update / list, plus the dashboard shape.
 * Ownership is checked against broker_id on every read/write (hard rule: each
 * broker accesses only their own offers).
 */

import crypto from 'node:crypto';
import db, { logEvent, offerEvents } from './db.mjs';
import { propertyType } from './forms.mjs';

const J = (v, fallback) => {
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

function shorthandTitle(buyers, address) {
  const b = (buyers || '').trim();
  const a = (address || '').trim();
  if (b && a) return `${b} — ${a}`;
  return a || b || 'Untitled offer';
}

export function createOffer(brokerId, { propertyTypeId = 'residential', transcript = '' } = {}) {
  const id = crypto.randomBytes(9).toString('base64url');
  const now = Date.now();
  const pt = propertyType(propertyTypeId).id;
  db.prepare(
    `INSERT INTO offer (id, broker_id, title, property_type, transcript, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, brokerId, 'New offer', pt, String(transcript).slice(0, 8000), 'draft', now, now);
  logEvent(id, 'created', pt);
  return getOffer(brokerId, id);
}

export function getOffer(brokerId, id) {
  const row = db.prepare('SELECT * FROM offer WHERE id=? AND broker_id=?').get(id, brokerId);
  if (!row) return null;
  return hydrate(row);
}

function hydrate(row) {
  return {
    id: row.id,
    title: row.title,
    property_type: row.property_type,
    address: row.address,
    buyers: row.buyers,
    purchase_price: row.purchase_price,
    status: row.status,
    transcript: row.transcript,
    property: J(row.property, {}),
    terms: J(row.terms, {}),
    forms: J(row.forms, []),
    defaults_applied: J(row.defaults_applied, []),
    questions: J(row.questions, []),
    warnings: J(row.warnings, []),
    summary_note: row.summary_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    events: offerEvents(row.id),
  };
}

/**
 * Persist a coordinated + resolved offer onto a record.
 */
export function saveCoordinated(brokerId, id, { coordinated, pkg }) {
  const row = db.prepare('SELECT id FROM offer WHERE id=? AND broker_id=?').get(id, brokerId);
  if (!row) return null;
  const t = coordinated.terms || {};
  const p = coordinated.property || {};
  const buyers = (t.buyers || coordinated.buyers || '').toString();
  const title = shorthandTitle(buyers, p.address);
  db.prepare(
    `UPDATE offer SET title=?, property_type=?, address=?, buyers=?, purchase_price=?,
       property=?, terms=?, forms=?, defaults_applied=?, questions=?, warnings=?,
       summary_note=?, status=?, updated_at=? WHERE id=?`
  ).run(
    title,
    p.type || 'residential',
    String(p.address || '').slice(0, 200),
    String(buyers).slice(0, 160),
    Math.round(Number(t.purchase_price) || 0),
    JSON.stringify(p),
    JSON.stringify(t),
    JSON.stringify(pkg.forms || []),
    JSON.stringify(coordinated.defaults_applied || []),
    JSON.stringify(coordinated.questions || []),
    JSON.stringify(pkg.warnings || []),
    String(coordinated.summary_note || '').slice(0, 400),
    'review',
    Date.now(),
    id
  );
  logEvent(id, 'coordinated', `${(pkg.forms || []).length} forms`);
  return getOffer(brokerId, id);
}

/**
 * Persist a manually-resolved form package (addenda picker changes).
 */
export function setForms(brokerId, id, pkg) {
  const row = db.prepare('SELECT id FROM offer WHERE id=? AND broker_id=?').get(id, brokerId);
  if (!row) return null;
  db.prepare('UPDATE offer SET forms=?, warnings=?, updated_at=? WHERE id=?').run(
    JSON.stringify(pkg.forms || []),
    JSON.stringify(pkg.warnings || []),
    Date.now(),
    id
  );
  logEvent(id, 'edited', `${(pkg.forms || []).length} forms`);
  return getOffer(brokerId, id);
}

export function setStatus(brokerId, id, status) {
  const allowed = ['draft', 'review', 'sent', 'accepted', 'dead'];
  if (!allowed.includes(status)) return null;
  const row = db.prepare('SELECT id FROM offer WHERE id=? AND broker_id=?').get(id, brokerId);
  if (!row) return null;
  db.prepare('UPDATE offer SET status=?, updated_at=? WHERE id=?').run(status, Date.now(), id);
  logEvent(id, 'status', status);
  return getOffer(brokerId, id);
}

export function deleteOffer(brokerId, id) {
  const r = db.prepare('DELETE FROM offer WHERE id=? AND broker_id=?').run(id, brokerId);
  return r.changes > 0;
}

/**
 * Dashboard list — light rows, newest first.
 */
export function listOffers(brokerId) {
  return db
    .prepare(
      `SELECT id, title, property_type, address, buyers, purchase_price, status, updated_at
       FROM offer WHERE broker_id=? ORDER BY updated_at DESC LIMIT 200`
    )
    .all(brokerId);
}
