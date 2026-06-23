// SQLite persistence (built-in node:sqlite — no native build step).
// Schema mirrors the data model in CLAUDE.md. Lines and upgrades are stored as
// JSON columns on the job (allowed for this size); photos get their own table so
// files can live on disk behind signed URLs.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.BT_DATA_DIR || path.join(__dirname, "..", "data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");
fs.mkdirSync(PHOTO_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, "bidtranslator.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company TEXT DEFAULT 'Your Company',
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  license TEXT DEFAULT '',
  default_from_lang TEXT DEFAULT 'es',
  default_to_lang TEXT DEFAULT 'en',
  ai_calls_month INTEGER DEFAULT 0,
  ai_calls_period TEXT DEFAULT '',
  trial_ends_at INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'none',
  current_period_end INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS job (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  from_lang TEXT DEFAULT 'es',
  to_lang TEXT DEFAULT 'en',
  transcript TEXT DEFAULT '',
  translation TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  assumptions TEXT DEFAULT '[]',   -- JSON array
  exclusions TEXT DEFAULT '[]',    -- JSON array
  lines TEXT DEFAULT '[]',         -- JSON array
  upgrades TEXT DEFAULT '[]',      -- JSON array
  notes TEXT DEFAULT '',           -- PRIVATE: never in client view / PDF
  margin REAL DEFAULT 20,          -- PRIVATE: never in client view / PDF
  status TEXT DEFAULT 'draft',     -- draft | sent
  sent_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS job_user_idx ON job(user_id);

CREATE TABLE IF NOT EXISTS photo (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photo_job_idx ON photo(job_id);

-- Payment requests: a contractor asks a homeowner to pay, money goes to the
-- contractor's own connected Stripe account (Stripe Connect). The platform never
-- holds the funds. job_id is optional so a request can stand alone.
CREATE TABLE IF NOT EXISTS payment_request (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES job(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',     -- pending | paid | canceled
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  checkout_url TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX IF NOT EXISTS payreq_user_idx ON payment_request(user_id);
CREATE INDEX IF NOT EXISTS payreq_job_idx ON payment_request(job_id);
CREATE INDEX IF NOT EXISTS payreq_session_idx ON payment_request(stripe_session_id);

-- "Coming soon" demand signals: a user taps "Notify me" on a not-yet-built
-- feature (e.g. the Team plan). One row per user per feature — count rows to
-- see how much real demand exists before building it.
CREATE TABLE IF NOT EXISTS interest (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, feature)
);
CREATE INDEX IF NOT EXISTS interest_feature_idx ON interest(feature);

-- Product analytics: one row per tracked event. Designed as the single sink the
-- app writes to; src/analytics.js can later fan these out to Mixpanel/PostHog/
-- Segment/a warehouse without changing call sites.
CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  props TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS event_name_idx ON event(name);
CREATE INDEX IF NOT EXISTS event_user_idx ON event(user_id);
CREATE INDEX IF NOT EXISTS event_time_idx ON event(created_at);

-- Customer signatures on accepted proposals. A lightweight contractor approval
-- record (NOT a full legal e-sign platform): who signed, the inked signature
-- image, when, from where, and the total they accepted. One job can be re-signed
-- (latest row wins); kept append-only for the audit trail.
CREATE TABLE IF NOT EXISTS signature (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,  -- the contractor (owner)
  signer_name TEXT DEFAULT '',
  signature_png TEXT NOT NULL,        -- data:image/png;base64 of the inked canvas
  accepted_total INTEGER DEFAULT 0,   -- dollars the signer accepted (tax-inclusive)
  approved INTEGER DEFAULT 1,         -- the "I reviewed and approve" box was checked
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  signed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS signature_job_idx ON signature(job_id);

-- Price book: a contractor's reusable catalog of materials/labor SKUs. Uploaded
-- (paste / CSV / photo) and organized by AI into clean rows, then dropped into
-- bids as line items so estimating is fast and consistent.
CREATE TABLE IF NOT EXISTS sku (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku_code TEXT DEFAULT '',
  category TEXT DEFAULT '',
  unit TEXT DEFAULT 'each',
  unit_price REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sku_user_idx ON sku(user_id);
`);

// Migrate older databases that predate the billing columns.
function ensureColumns(table, cols) {
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name));
  for (const [name, ddl] of cols) {
    if (!existing.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`);
  }
}
ensureColumns("user", [
  ["trial_ends_at", "INTEGER"],
  ["stripe_customer_id", "TEXT"],
  ["stripe_subscription_id", "TEXT"],
  ["subscription_status", "TEXT DEFAULT 'none'"],
  ["current_period_end", "INTEGER"],
  ["setup_fee_paid", "INTEGER DEFAULT 0"],
  // Stripe Connect (contractor gets paid by homeowners).
  ["stripe_connect_account_id", "TEXT"],
  ["connect_charges_enabled", "INTEGER DEFAULT 0"],
  // Company logo (small data-URI) shown on the client bid + PDF.
  ["logo", "TEXT"],
  // Analytics: last sign-in + when onboarding was completed.
  ["last_login", "INTEGER"],
  ["onboarded_at", "INTEGER"],
  // Notifications: when the contractor last cleared their "good news" inbox
  // (customer accepted / paid). Events newer than this are "unread".
  ["notifications_seen_at", "INTEGER"],
  // Sales tax the contractor charges clients. Set/confirmed at signup from their
  // region; they own the rate (we never auto-file tax). region = US state code.
  ["tax_rate", "REAL DEFAULT 0"],
  ["region", "TEXT"],
  // QuickBooks Online (per-contractor OAuth). Each contractor connects their own
  // company; paid payments sync to their books. Tokens are server-only.
  ["qbo_realm_id", "TEXT"],
  ["qbo_access_token", "TEXT"],
  ["qbo_refresh_token", "TEXT"],
  ["qbo_expires_at", "INTEGER"],
  ["qbo_connected_at", "INTEGER"],
  // Follow Up Boss person id — the founder's CRM record for this contractor
  // (platform-level; set once when we first push them to FUB).
  ["fub_person_id", "TEXT"],
]);
// Photos: per-photo opt-in to appear on the client-facing bid (default off, so a
// private/internal photo is never exposed unless the contractor chooses it).
ensureColumns("photo", [
  ["show_on_bid", "INTEGER DEFAULT 0"],
]);
// Calendar: the date a job is scheduled for (YYYY-MM-DD), set at the Scheduled stage.
ensureColumns("job", [
  ["scheduled_date", "TEXT"],
  ["scheduled_time", "TEXT"],   // "HH:MM" 24h, optional — turns the date into a real appointment
  // Maps: the job's street address (drives Maps/Directions/Street View links).
  ["address", "TEXT"],
  ["customer", "TEXT"],         // who the proposal is FOR (shown on the bid + PDF)
  ["deposit_pct", "INTEGER"],   // deposit to collect on acceptance, % of total (default 25)
  ["tax_rate", "REAL"],         // sales tax % for this job; defaults from the contractor, 0 = none
]);

export default db;
