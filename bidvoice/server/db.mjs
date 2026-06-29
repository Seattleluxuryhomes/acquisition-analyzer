/**
 * BidVoice persistence — built-in node:sqlite (no native build step), the same
 * proven approach as Bidtranslator.
 *
 * v0 is a single broker (the standing identity). The schema is multi-tenant
 * ready: every offer carries broker_id, so a future signup is just another
 * broker row. Property + terms + the resolved form package are stored as JSON
 * columns on the offer (right size for this), with an append-only event log per
 * offer for the dashboard timeline.
 */

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STANDING_IDENTITY } from './identity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BIDVOICE_DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'bidvoice.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS broker (
  id TEXT PRIMARY KEY,
  broker_name TEXT DEFAULT '',
  brokerage TEXT DEFAULT '',
  mls_office_no TEXT DEFAULT '',
  firm_lag_no TEXT DEFAULT '',
  dol_license_no TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  entity TEXT DEFAULT '',
  address TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS offer (
  id TEXT PRIMARY KEY,
  broker_id TEXT NOT NULL REFERENCES broker(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',            -- "Buyers — Address" shorthand for the dashboard
  property_type TEXT DEFAULT 'residential',
  address TEXT DEFAULT '',
  buyers TEXT DEFAULT '',
  purchase_price INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',      -- draft | review | sent | accepted | dead
  transcript TEXT DEFAULT '',       -- the spoken offer
  property TEXT DEFAULT '{}',       -- JSON
  terms TEXT DEFAULT '{}',          -- JSON
  forms TEXT DEFAULT '[]',          -- JSON resolved package (ordered)
  defaults_applied TEXT DEFAULT '[]',
  questions TEXT DEFAULT '[]',
  warnings TEXT DEFAULT '[]',
  summary_note TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS offer_broker_idx ON offer(broker_id);
CREATE INDEX IF NOT EXISTS offer_updated_idx ON offer(updated_at);

-- Append-only timeline per offer (dashboard history + audit).
CREATE TABLE IF NOT EXISTS offer_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id TEXT NOT NULL REFERENCES offer(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,               -- created | coordinated | edited | generated | signed | sent | status
  detail TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS offer_event_idx ON offer_event(offer_id);

-- Signatures / initials captured in-app (shared sign system).
CREATE TABLE IF NOT EXISTS sig (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL REFERENCES offer(id) ON DELETE CASCADE,
  broker_id TEXT NOT NULL REFERENCES broker(id) ON DELETE CASCADE,
  anchor TEXT NOT NULL,             -- form id + slot, e.g. "21:sign:buyer1"
  kind TEXT NOT NULL,               -- sign | initial
  signer_name TEXT DEFAULT '',
  image_png TEXT NOT NULL,          -- data:image/png;base64 of the inked mark
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  signed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sig_offer_idx ON sig(offer_id);
`);

/* -------------------------------------------------------------------------- */
/*  Single-broker bootstrap (v0). Returns the one broker, creating it from the */
/*  standing identity on first run.                                            */
/* -------------------------------------------------------------------------- */

export function getBroker() {
  let row = db.prepare('SELECT * FROM broker LIMIT 1').get();
  if (!row) {
    const id = crypto.randomBytes(8).toString('base64url');
    db.prepare(
      `INSERT INTO broker (id, broker_name, brokerage, mls_office_no, firm_lag_no,
        dol_license_no, email, phone, entity, address, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      STANDING_IDENTITY.broker_name,
      STANDING_IDENTITY.brokerage,
      STANDING_IDENTITY.mls_office_no,
      STANDING_IDENTITY.firm_lag_no,
      STANDING_IDENTITY.dol_license_no,
      STANDING_IDENTITY.email,
      STANDING_IDENTITY.phone,
      STANDING_IDENTITY.entity,
      STANDING_IDENTITY.address,
      Date.now()
    );
    row = db.prepare('SELECT * FROM broker WHERE id=?').get(id);
  }
  return row;
}

export function updateBroker(id, patch) {
  const fields = ['broker_name', 'brokerage', 'mls_office_no', 'firm_lag_no', 'dol_license_no', 'email', 'phone', 'entity', 'address'];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (f in patch) {
      sets.push(`${f}=?`);
      vals.push(String(patch[f] ?? '').slice(0, 200));
    }
  }
  if (!sets.length) return getBroker();
  vals.push(id);
  db.prepare(`UPDATE broker SET ${sets.join(', ')} WHERE id=?`).run(...vals);
  return db.prepare('SELECT * FROM broker WHERE id=?').get(id);
}

export function logEvent(offerId, kind, detail = '') {
  db.prepare('INSERT INTO offer_event (offer_id, kind, detail, created_at) VALUES (?,?,?,?)').run(
    offerId,
    kind,
    String(detail).slice(0, 300),
    Date.now()
  );
}

export function offerEvents(offerId) {
  return db.prepare('SELECT kind, detail, created_at FROM offer_event WHERE offer_id=? ORDER BY id ASC').all(offerId);
}

export default db;
