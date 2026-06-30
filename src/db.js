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
  ua TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS event_name_idx ON event(name);
CREATE INDEX IF NOT EXISTS event_user_idx ON event(user_id);
CREATE INDEX IF NOT EXISTS event_time_idx ON event(created_at);

-- Bid Brain memory: a per-contractor key/value store that makes the AI smarter
-- every job. Scalable by design — new memory types (labor rates, suppliers,
-- proposal style, voice prefs…) are just new keys, NO schema change. Strictly
-- isolated by user_id (composite PK); never mixed between contractors.
CREATE TABLE IF NOT EXISTS memory (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT DEFAULT '',          -- JSON-encoded value
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS memory_user_idx ON memory(user_id);

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

-- Leads: inbound contractor leads (website forms, ads, social, CSV, manual) that
-- convert into jobs. Money coming in — the top of the Lead → Job → Bid funnel.
CREATE TABLE IF NOT EXISTS lead (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  source TEXT DEFAULT '',
  job_type TEXT DEFAULT '',
  city TEXT DEFAULT '',
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'New',
  job_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lead_user_idx ON lead(user_id);

-- Team / subs: a contractor's crew. The viral loop — a GC adds his subs and sends
-- each the app. A sub gets a free seat to RECEIVE scope of work (the bid/payment
-- engine stays gated). 'lang' drives auto-translation of dispatched scope. Status:
-- added (entered) -> invited (link sent) -> joined (they signed up). Owner-scoped.
CREATE TABLE IF NOT EXISTS sub (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  trade TEXT DEFAULT '',
  lang TEXT DEFAULT '',
  status TEXT DEFAULT 'added',
  invited_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sub_user_idx ON sub(user_id);

-- Scope dispatch: a GC sends a job's scope of work to a sub. The sub opens a
-- public link (the unguessable id is the grant, like /p/:id) and sees the WORK
-- and photos — never prices/margin (a buildScope() whitelist, hard rule #2) — and
-- taps Accept. The acceptance is the change-order-protection record.
CREATE TABLE IF NOT EXISTS dispatch (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  sub_id TEXT REFERENCES sub(id) ON DELETE SET NULL,
  sub_name TEXT DEFAULT '',
  sub_lang TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'sent',
  kind TEXT DEFAULT 'work',        -- 'work' = assign/accept · 'rfq' = request a bid
  scope_json TEXT,                 -- frozen snapshot of the SELECTED work items (no prices)
  bid_amount INTEGER,              -- the contractor's bid back (RFQ), dollars
  bid_note TEXT DEFAULT '',
  viewed_at INTEGER,
  accepted_at INTEGER,
  accepted_by TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS dispatch_job_idx ON dispatch(job_id);
CREATE INDEX IF NOT EXISTS dispatch_user_idx ON dispatch(user_id);

-- Draw requests: a contractor documents completed work (amount + description +
-- photos) and sends a public link to the property owner OR their bank/lender, who
-- reviews the proof and APPROVES (and pays, via Stripe Connect if set up). The
-- progress-billing step between the deposit and the final payment.
CREATE TABLE IF NOT EXISTS draw (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  description TEXT DEFAULT '',
  photo_ids TEXT DEFAULT '[]',     -- JSON array of job photo ids shown as proof
  status TEXT DEFAULT 'requested', -- requested | approved | paid | declined
  checkout_url TEXT,               -- Stripe Connect pay link (optional)
  approved_by TEXT DEFAULT '',
  approved_at INTEGER,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS draw_job_idx ON draw(job_id);
CREATE INDEX IF NOT EXISTS draw_user_idx ON draw(user_id);

-- Change orders: the contractor documents extra/changed work mid-job; the client
-- opens a public link, e-signs to approve it (and optionally pays). This is the
-- money contractors lose when scope grows without a signed paper trail. Client-
-- facing amount (no margin/notes); same unguessable-id grant model as /p/:id.
CREATE TABLE IF NOT EXISTS change_order (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  number INTEGER DEFAULT 1,         -- CO #1, #2, … per job
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',       -- what changed / why (client-facing)
  line_items TEXT DEFAULT '[]',     -- JSON [{desc, amount}] client-facing line items
  amount_cents INTEGER NOT NULL,    -- total the client agrees to (+/-)
  status TEXT DEFAULT 'sent',       -- sent | approved | declined | paid
  checkout_url TEXT,                -- Stripe Connect pay link (optional)
  signed_by TEXT DEFAULT '',        -- client's typed signature/name
  signed_at INTEGER,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS co_job_idx ON change_order(job_id);
CREATE INDEX IF NOT EXISTS co_user_idx ON change_order(user_id);

-- Living website (Sprint 12 — AI Website Engine): a completed job the contractor
-- chose to publish to their website. The website is a living entity that writes
-- content here; the /c/:id site renders a Before & After gallery + project pages
-- from these rows. Photos referenced here are intentionally PUBLIC (the contractor
-- opted in) and served via /pub/photo/:id, gated on membership in a published row.
CREATE TABLE IF NOT EXISTS site_project (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES job(id) ON DELETE SET NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',       -- AI-written SEO project write-up
  service TEXT DEFAULT '',           -- trade key/label for the project
  area TEXT DEFAULT '',              -- neighborhood/city (no full address — privacy)
  before_ids TEXT DEFAULT '[]',      -- JSON photo ids shown as "before"
  after_ids TEXT DEFAULT '[]',       -- JSON photo ids shown as "after"
  status TEXT DEFAULT 'published',   -- published | hidden
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS siteproj_user_idx ON site_project(user_id);

-- Approval Inbox (Sprint 14): the AI-employee primitive. The system PROPOSES an
-- action (a drafted review request, a follow-up, a project to publish); the
-- contractor approves with one tap. Nothing is ever sent/posted automatically.
-- Every future AI capability (marketing manager, social, blog) writes cards here.
CREATE TABLE IF NOT EXISTS suggestion (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                -- review_request | follow_up | ...
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',              -- the AI-drafted content the contractor approves
  status TEXT DEFAULT 'pending',     -- pending | approved | dismissed
  context TEXT DEFAULT '{}',         -- JSON: {jobId, leadId, customer, to, channel, ...}
  dedupe_key TEXT,                   -- prevents re-suggesting the same thing
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestion_user_idx ON suggestion(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS suggestion_dedupe ON suggestion(user_id, dedupe_key);

-- AI Funnel (Sprint 15): an offer-led landing page. The contractor picks a service
-- + an offer ("Free Estimate"); AI writes the headline; the page renders the
-- existing site in "offer mode" (single dominant CTA, offer hero). A submit runs
-- the full native chain: lead -> follow-up draft (Approval Inbox) -> notify.
CREATE TABLE IF NOT EXISTS funnel (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  service TEXT DEFAULT '',
  offer TEXT DEFAULT '',          -- the offer ("Free Roof Inspection")
  headline TEXT DEFAULT '',       -- AI-written hero headline
  subhead TEXT DEFAULT '',
  cta TEXT DEFAULT 'Get my free estimate',
  views INTEGER DEFAULT 0,
  leads INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS funnel_user_idx ON funnel(user_id);

-- Outbound prospecting CRM (Gojiberry integration). A prospect is a home-service
-- business we're recruiting TO Bidtranslator (separate from inbound homeowner
-- leads). Sourced from a provider (gojiberry/…) or added by hand, then worked
-- through the pipeline. Provider-agnostic: 'source' records where it came from.
CREATE TABLE IF NOT EXISTS prospect (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',            -- business name
  contact_name TEXT DEFAULT '',
  trade TEXT DEFAULT '',
  business_type TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  status TEXT DEFAULT 'new',       -- new|contacted|interested|demo_booked|converted|not_interested
  source TEXT DEFAULT 'manual',    -- gojiberry|manual|…
  notes TEXT DEFAULT '',
  raw TEXT DEFAULT '{}',           -- the original provider record (for future enrichment)
  dedupe_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS prospect_user_idx ON prospect(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS prospect_dedupe ON prospect(user_id, dedupe_key);

-- Private vendor book: a contractor's OWN suppliers/vendors, reachable in one tap
-- from a job (call/text/email a material quote). Single-player now; the dormant
-- 'shared'/'verified' flags let this become a shared directory later (post-traction)
-- without a migration. 'materials' is free text/tags of what they carry.
CREATE TABLE IF NOT EXISTS vendor (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',            -- vendor / supplier business name
  contact_name TEXT DEFAULT '',
  trade TEXT DEFAULT '',           -- category (lumber, windows, electrical supply…)
  materials TEXT DEFAULT '',       -- what they carry (free text / comma tags)
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  website TEXT DEFAULT '',
  address TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  shared INTEGER DEFAULT 0,        -- forward-compat: future shared directory (not exposed yet)
  verified INTEGER DEFAULT 0,      -- forward-compat: future verification (not exposed yet)
  dedupe_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS vendor_user_idx ON vendor(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_dedupe ON vendor(user_id, dedupe_key);

-- Job documents: arbitrary file uploads attached to a job/project (permit PDFs,
-- approvals, inspection reports, contracts, plans). Private — served only via signed,
-- expiring URLs (hard rule #6), same as photos. 'label' is an optional category.
CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,          -- stored file on disk
  orig_name TEXT NOT NULL,         -- original/display name
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  label TEXT DEFAULT '',           -- e.g. Permit, Inspection, Contract, Plans
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS document_job_idx ON document(job_id);

-- ============ AI Project Management OS — the Customer → Job → Timeline spine ============
-- customer: the durable entity that outlives projects (today the customer is embedded in
-- job). Owner-scoped; matched by phone then email. Soft-delete only — never lose history.
CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',            -- normalized for matching
  email TEXT DEFAULT '',            -- lowercased for matching
  address TEXT DEFAULT '',
  lat REAL,
  lng REAL,
  source TEXT DEFAULT '',           -- Website | Receptionist | Referral | Manual | …
  tags TEXT DEFAULT '[]',           -- JSON array
  notes TEXT DEFAULT '',            -- PRIVATE: contractor-only, never customer-facing
  first_seen INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS customer_user_idx  ON customer(user_id);
CREATE INDEX IF NOT EXISTS customer_phone_idx ON customer(user_id, phone);
CREATE INDEX IF NOT EXISTS customer_email_idx ON customer(user_id, email);

-- timeline_event: the append-only source of truth. NEVER updated or deleted — corrections
-- are new events. Every surface writes; every intelligence reads. INTEGER PK for natural
-- ordering + cheap pagination (the analytics event table is a separate concern).
CREATE TABLE IF NOT EXISTS timeline_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  customer_id TEXT,                 -- nullable until a lead becomes a customer
  job_id TEXT,                      -- nullable (pre-job events: lead, inbound call)
  ts INTEGER NOT NULL,              -- the event's logical time (epoch ms)
  type TEXT NOT NULL,               -- canonical taxonomy
  actor TEXT NOT NULL DEFAULT 'system', -- ai | owner | crew | customer | system
  title TEXT DEFAULT '',
  body TEXT DEFAULT '',
  payload TEXT DEFAULT '{}',        -- JSON, type-specific
  ref_table TEXT DEFAULT '',        -- the row this points at (payment_request, draw, …)
  ref_id TEXT DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal', -- internal | customer | crew
  dedupe_key TEXT,                  -- idempotency for back-fill + watcher alerts
  created_at INTEGER NOT NULL       -- write time (≈ ts, but distinct)
);
CREATE INDEX IF NOT EXISTS tl_job_idx       ON timeline_event(job_id, id);
CREATE INDEX IF NOT EXISTS tl_customer_idx  ON timeline_event(customer_id, id);
CREATE INDEX IF NOT EXISTS tl_user_type_idx ON timeline_event(user_id, type, id);
CREATE UNIQUE INDEX IF NOT EXISTS tl_dedupe_idx ON timeline_event(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- project_state: a PROJECTION (cache) over the log — never authoritative, always rebuildable.
CREATE TABLE IF NOT EXISTS project_state (
  job_id TEXT PRIMARY KEY REFERENCES job(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  health TEXT DEFAULT 'green',      -- green | yellow | red
  health_reasons TEXT DEFAULT '[]', -- JSON: [{rule, severity, reason, event_id, action}]
  percent_complete INTEGER DEFAULT 0,
  expected_margin REAL,             -- PRIVATE
  actual_margin REAL,               -- PRIVATE
  next_action TEXT DEFAULT '{}',    -- JSON {label, directive}
  stage TEXT DEFAULT 'lead',        -- lead | quoted | signed | in_progress | closing | won | lost | warranty
  last_event_id INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pstate_user_idx ON project_state(user_id, health);
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
  // Website logo for light backgrounds (e.g. a dark/black mark for the white
  // contractor site header). Falls back to `logo` when not set.
  ["site_logo", "TEXT"],
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
  // Per-contractor inbound-lead webhook token (for n8n / form integrations).
  ["lead_token", "TEXT"],
  // Standard "Terms & Protections" shown on every proposal (one clause per line).
  // NULL = use the default template; "" = contractor turned terms off.
  ["terms", "TEXT"],
  // Single-use password-reset token (sha256 hash) + its expiry (ms).
  ["reset_token_hash", "TEXT"],
  ["reset_token_exp", "INTEGER"],
  // Optional WhatsApp number; blank falls back to the phone number.
  ["whatsapp", "TEXT DEFAULT ''"],
  // Referral credit: this user's own share code, who referred them, and an optional
  // founder rate-lock (pinned base monthly $; NULL = the live base price).
  ["referral_code", "TEXT"],
  ["referred_by", "TEXT"],
  ["locked_monthly", "REAL"],
  // Customer-facing website: services offered (JSON array of trade keys), a hero
  // tagline, and a brand accent color. Drive the per-contractor site at /c/:id.
  ["services", "TEXT"],
  ["site_tagline", "TEXT"],
  ["site_color", "TEXT"],
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
  // Persona: 'contractor' (default), 'agent' (real-estate agent — free distribution
  // channel: free for year 1, then $50 locked forever), or 'homeowner' (DIY GC).
  ["role", "TEXT DEFAULT 'contractor'"],
  // For agents: epoch ms their free first year ends. While now < this, the account
  // is free + entitled; after it, their locked_monthly ($50) applies.
  ["agent_free_until", "INTEGER"],
  // Custom-website request: the contractor asked us to build them a custom site.
  // The founder sees who asked (the "we won't know unless they ask" signal) and
  // hand-builds / upsells it. Timestamp = when they asked; note = what they want.
  ["site_request_at", "INTEGER"],
  ["site_request_note", "TEXT"],
  // AI-written website copy (the first piece of the "living website" content the
  // contractor never has to write). Rendered into the /c/:id About section.
  ["site_about", "TEXT"],
  // Living website (Sprint 12): a URL-friendly slug for the branded address
  // (<slug>.<BT_SITE_DOMAIN>, name-agnostic) and whether they've hit "Publish".
  ["site_slug", "TEXT"],
  ["site_published", "INTEGER DEFAULT 0"],
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
  ["customer_phone", "TEXT"],   // the customer's phone — tap to call/text from the job
  ["deposit_pct", "INTEGER"],   // deposit to collect on acceptance, % of total (default 25)
  ["tax_rate", "REAL"],         // sales tax % for this job; defaults from the contractor, 0 = none
  ["brief", "TEXT"],            // AI structured job summary (contractor-only; never on the client proposal)
  // Permits this job needs (JSON array). Tracked like assumptions/exclusions — part
  // of the job object so it syncs offline. Each: {id,type,jurisdiction,number,status,fee,notes}.
  ["permits", "TEXT"],
]);

// Self-heal a price-book (sku) table created before any of these columns existed,
// so saving/importing SKUs never fails on a 'no column named …' error. Covers
// every column the INSERT touches (timestamps included, with safe defaults so the
// ALTER works even on a table that already has rows).
ensureColumns("sku", [
  ["sku_code", "TEXT DEFAULT ''"],
  ["category", "TEXT DEFAULT ''"],
  ["unit", "TEXT DEFAULT 'each'"],
  ["unit_price", "REAL DEFAULT 0"],
  ["created_at", "INTEGER NOT NULL DEFAULT 0"],
  ["updated_at", "INTEGER NOT NULL DEFAULT 0"],
  ["image_file", "TEXT"],   // private photo of the material/color for this SKU
  ["image_mime", "TEXT"],
]);

// The signer's email (so the client can be emailed their signed copy, and the
// contractor has it on record with the signed agreement).
ensureColumns("signature", [
  ["signer_email", "TEXT DEFAULT ''"],
]);
// Device/browser string on each event, so the founder dashboard can tell iPhone
// from Android and spot the Instagram/Facebook in-app browser (where the mic is
// blocked). Migrated in because `event` predates this column in production.
ensureColumns("event", [
  ["ua", "TEXT DEFAULT ''"],
]);
// The `dispatch` table already exists in production from the first scope-dispatch
// deploy, so CREATE TABLE won't add these — they must be migrated in explicitly:
// selective-scope snapshot + the RFQ (request-a-bid) fields.
ensureColumns("dispatch", [
  ["kind", "TEXT DEFAULT 'work'"],
  ["scope_json", "TEXT"],
  ["bid_amount", "INTEGER"],
  ["bid_note", "TEXT DEFAULT ''"],
]);
// AI Project Management OS: link each job to the durable customer entity. Additive +
// nullable — the embedded job.customer/customer_phone stay for back-compat; the timeline
// back-fill creates customer rows and sets this. The index is created after the column.
ensureColumns("job", [
  ["customer_id", "TEXT"],
]);
db.exec("CREATE INDEX IF NOT EXISTS job_customer_idx ON job(customer_id)");

export default db;
