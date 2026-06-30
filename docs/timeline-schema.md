# Customer → Job → Timeline — schema design (for approval, no code yet)

> The spine of the AI Project Management OS. `customer` is the durable entity that
> outlives projects; `timeline_event` is the append-only source of truth every surface
> writes and every intelligence reads. `job` stays the project (no parallel Project table).
> **Proposed DDL below is for review — nothing is applied to `src/db.js` until approved.**
>
> **STATUS — BUILT & VERIFIED (dormant).** Schema applied to `src/db.js` (three tables +
> `job.customer_id` migration). Spine implemented in `src/timeline.js`: `recordEvent` write
> chokepoint, customer dedup (phone→email, link-or-suggest-merge), read projections,
> deterministic Health rules (each cites the event id), and an idempotent back-fill. Verified
> against seeded real-shaped data: 18/18 checks (dedup, customer_id linking, populated
> newest-first timelines, health citing the real signed event, idempotent re-run, recordEvent
> dedupe, visibility mask). **No surface imports it yet** — flag-gated (`BT_TIMELINE`) and
> verified before anything depends on it, per the founder's instruction.

## Grounding (how this fits what we already have)
- Driver: `node:sqlite` `DatabaseSync`, WAL, `PRAGMA foreign_keys = ON`.
- Conventions we follow exactly: `id TEXT PRIMARY KEY` (app-generated `crypto.randomUUID`,
  like `job`/`lead`); `user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE`
  (hard rule #5 — ownership on every row); `created_at`/`updated_at` as INTEGER epoch ms;
  JSON stored as TEXT.
- Migrations are additive: **new tables** via `CREATE TABLE IF NOT EXISTS`; **new columns on
  existing tables** via the explicit `[name, ddl]` ALTER list (the mechanism at db.js ~414).
- The existing `event` table is **product analytics** (`track()`); the timeline is a separate
  concern. We do **not** overload it.

---

## 1. `customer` — the missing core entity

Today the customer is embedded in each `job` (`job.customer`, `job.customer_phone`). That
can't support repeat business, warranty, maintenance, or lifetime value. One durable record
per real person/company, owned by the contractor.

```sql
CREATE TABLE IF NOT EXISTS customer (
  id          TEXT PRIMARY KEY,                 -- crypto.randomUUID
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT DEFAULT '',
  phone       TEXT DEFAULT '',                  -- normalized E.164-ish for matching
  email       TEXT DEFAULT '',                  -- lowercased for matching
  address     TEXT DEFAULT '',
  lat         REAL,                             -- nullable; geocoded later (maps/route)
  lng         REAL,
  source      TEXT DEFAULT '',                  -- 'Website' | 'Receptionist' | 'Referral' | 'Manual' | …
  tags        TEXT DEFAULT '[]',                -- JSON array (VIP, repeat, builder, …)
  notes       TEXT DEFAULT '',                  -- PRIVATE: contractor-only, never customer-facing
  first_seen  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  archived_at INTEGER                           -- soft delete; never hard-delete history
);
CREATE INDEX IF NOT EXISTS customer_user_idx  ON customer(user_id);
CREATE INDEX IF NOT EXISTS customer_phone_idx ON customer(user_id, phone);
CREATE INDEX IF NOT EXISTS customer_email_idx ON customer(user_id, email);
```

**Dedup policy (decision needed — see §12):** within a `user_id`, match on normalized
`phone` first, then lowercased `email`. On a match, **link** to the existing customer (and
record a `customer_merged`/`customer_matched` event); never silently overwrite. Matching is
always scoped to the owner — never across contractors (hard rule #5).

### `job` change (additive, back-compat)
```sql
-- via the ALTER migration list, NOT a new table:
ALTER TABLE job ADD COLUMN customer_id TEXT;     -- nullable; FK-by-convention to customer(id)
CREATE INDEX IF NOT EXISTS job_customer_idx ON job(customer_id);
```
The embedded `job.customer` / `job.customer_phone` stay (read-back-compat). New writes set
`customer_id`; a one-time back-fill creates `customer` rows from existing jobs (§11). The job
remains the **project** — it already carries lines, status, schedule, photos, draws, COs,
documents, payments. We add a link, not a fork.

---

## 2. `timeline_event` — the append-only source of truth

One immutable row per meaningful thing that happens in a customer's journey. **Append-only:
never UPDATE, never DELETE** (corrections are new events). High-volume → INTEGER autoincrement
PK for natural ordering + cheap cursor pagination (mirrors the analytics `event` table).

```sql
CREATE TABLE IF NOT EXISTS timeline_event (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  customer_id TEXT,                             -- nullable until a lead becomes a customer
  job_id      TEXT,                             -- nullable (pre-job events: lead, inbound call)
  ts          INTEGER NOT NULL,                 -- epoch ms (the event's logical time)
  type        TEXT NOT NULL,                    -- canonical taxonomy (§3)
  actor       TEXT NOT NULL DEFAULT 'system',   -- 'ai' | 'owner' | 'crew' | 'customer' | 'system'
  title       TEXT DEFAULT '',                  -- short human line ("Deposit paid — $1,500")
  body        TEXT DEFAULT '',                  -- optional longer text / summary
  payload     TEXT DEFAULT '{}',                -- JSON: type-specific structured data
  ref_table   TEXT DEFAULT '',                  -- 'payment_request' | 'draw' | 'change_order' | …
  ref_id      TEXT DEFAULT '',                  -- the row this event points at
  visibility  TEXT NOT NULL DEFAULT 'internal', -- 'internal' | 'customer' | 'crew' (privacy mask)
  dedupe_key  TEXT,                             -- optional: idempotency for watcher-emitted events
  created_at  INTEGER NOT NULL                  -- when the row was written (≈ ts, but distinct)
);
CREATE INDEX IF NOT EXISTS tl_job_idx      ON timeline_event(job_id, id);
CREATE INDEX IF NOT EXISTS tl_customer_idx ON timeline_event(customer_id, id);
CREATE INDEX IF NOT EXISTS tl_user_type_idx ON timeline_event(user_id, type, id);
CREATE UNIQUE INDEX IF NOT EXISTS tl_dedupe_idx ON timeline_event(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;                 -- one open "attention" per condition, not 30
```

Design notes:
- **`ts` vs `created_at`:** `ts` is the event's meaning-time (a back-filled "signed" event uses
  the original signing time); `created_at` is write-time. Order timelines by `ts, id`.
- **`dedupe_key`:** watcher alerts (`type='attention'`) set a stable key like
  `invoice_overdue:job123` so the daily tick doesn't pile up duplicates; resolving the
  condition writes a separate `attention_cleared` event (we never mutate the original).
- **`visibility`:** the privacy mask. `margin`/`notes` and internal AI reasoning are always
  `internal`; a customer-facing timeline view filters to `visibility='customer'`. Maps hard
  rules #2 (margin/notes private) and #6 (private docs) onto the timeline.
- **Append-only ⇒ projections are rebuildable.** If `project_state` is ever wrong, we drop and
  recompute it from the log. The log is the truth.

---

## 3. Event taxonomy (the canonical `type` set + who writes it)

Every surface emits events; the AI PM emits `attention`. `payload` shape is per-type.

| `type` | Writer (surface) | Key payload | actor |
|---|---|---|---|
| `lead_created` | Receptionist / Website / manual | `{source, message, trade}` | customer/ai |
| `customer_created` / `customer_matched` | spine | `{matched_on}` | system |
| `appointment_set` / `appointment_moved` | Scheduler / Bid Brain | `{date, time, address}` | ai/owner |
| `estimate_started` / `estimate_updated` | Estimator | `{trade, lines_count}` | ai/owner |
| `proposal_sent` | Proposal | `{amount, channel}` | owner |
| `proposal_viewed` | public `/p/:id` | `{}` | customer |
| `signed` | Signatures | `{signer, amount}` | customer |
| `deposit_paid` / `payment` | Payments (Stripe) | `{amount, kind, deposit?}` | customer/system |
| `work_started` / `work_stopped` / `work_resumed` | PM / Stop-Work | `{reason}` | owner/ai |
| `photo_added` | Photo Intelligence | `{phase, trade, count, ai_tags}` | crew/owner |
| `change_order` | Change Orders | `{number, amount, status}` | owner/customer |
| `draw_requested` / `draw_status` | Draws | `{number, amount, percent, status}` | owner/system |
| `inspection` | PM | `{kind, status, scheduled_for}` | owner |
| `material_delivery` | PM / suppliers | `{item, eta, status}` | system/owner |
| `crew_scheduled` | Dispatch / Team | `{sub_id, date}` | owner |
| `review_requested` / `referral_requested` | Lifecycle | `{channel}` | ai |
| `warranty_milestone` | Lifecycle | `{milestone, due}` | system |
| `message` | Comms unifier | `{channel, direction, summary}` | any |
| `note` | anyone | `{}` | owner/crew |
| `attention` / `attention_cleared` | **AI PM watchers only** | `{rule, severity, reason, action}` | ai |

Adding a type later is **data, not schema** (like the `memory` table's key pattern) — no
migration. New surfaces just call `recordEvent` with a new `type`.

---

## 4. `project_state` — the projection (cache, never truth)

A derived row per job, fully rebuildable from `timeline_event`. Holds what's expensive to
recompute on every read and what the AI PM maintains.

```sql
CREATE TABLE IF NOT EXISTS project_state (
  job_id          TEXT PRIMARY KEY REFERENCES job(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  health          TEXT DEFAULT 'green',         -- green | yellow | red
  health_reasons  TEXT DEFAULT '[]',            -- JSON: [{rule, severity, reason, event_id, action}]
  percent_complete INTEGER DEFAULT 0,
  expected_margin REAL,                         -- from the bid (private)
  actual_margin   REAL,                         -- from costs logged (private)
  next_action     TEXT DEFAULT '{}',            -- JSON: {label, directive}
  stage           TEXT DEFAULT 'lead',          -- lead→quoted→signed→in_progress→closing→won/lost→warranty
  last_event_id   INTEGER DEFAULT 0,            -- high-water mark for incremental recompute
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS pstate_user_idx ON project_state(user_id, health);
```

---

## 5. Health Score — deterministic rules, LLM only phrases

**The score is computed by a rules engine over real events — never an LLM guess.** Each rule
is a pure function; if it fires, it cites the **exact event id** (or absence) that caused it.

```
Rule = {
  id,                       // 'invoice_overdue'
  severity,                 // 'yellow' | 'red'
  evaluate(job, events, pack, company) -> null | {
    reason,                 // "Final invoice 9 days overdue ($4,200)"
    event_id,               // the payment/proposal event it’s grounded in (or null = a MISSING event)
    action                  // { label:'Send a reminder', directive:'[[remind:invoice]]' }
  }
}
health = worst severity among fired rules; health_reasons = all fired rules (each with its event_id).
```
Starter rules (v1, all deterministic): `invoice_overdue`, `deposit_unpaid_after_signed`,
`unsigned_change_order`, `inspection_unscheduled`, `schedule_gap_tomorrow`, `draw_ready`,
`proposal_unopened_Nd`, `margin_under_bid`, `no_activity_Nd`.

**Guardrail mapping:** detection is rules-only (trustworthy + free). The LLM (Bid Brain)
takes `health_reasons` and writes the natural-language briefing line and the suggested
message — it may **rephrase** the reason, never **invent** one. If no rule fired, there is no
alert; "looks healthy" is the absence of fired rules, not an LLM opinion.

---

## 6. Write path — one chokepoint

A single `recordEvent(...)` is the only way events are created (so every surface is consistent
and the projection can react). Conceptual signature (for review):

```
recordEvent({ userId, customerId?, jobId?, type, actor, title?, body?, payload?,
              refTable?, refId?, visibility='internal', ts=now, dedupeKey? })
  -> inserts one timeline_event (respecting the dedupe unique index)
  -> marks project_state(jobId) dirty (or recomputes inline for v1's small scale)
```
- **Atomicity:** when a surface changes a ref row (e.g., marks a payment paid) and records the
  event, both happen in one transaction so the log can never disagree with the row.
- **Idempotency:** `dedupe_key` prevents duplicate watcher alerts and double-fires on retries.

## 7. Read path — what intelligence consumes
- `jobTimeline(jobId, {visibility})` → ordered events (newest-first), filtered by mask.
- `customerTimeline(customerId)` → the full cross-project journey (repeat business, warranty).
- `projectState(jobId)` → health, % complete, next action, margin.
- `attentionFeed(userId)` → open `attention` events across all jobs → the proactive briefing.
- `search(userId, q)` → over event title/body/payload (FTS later; LIKE for v1).

---

## 8. How every Phase-2+ surface maps to the spine (the goal list)

| Surface | Writes (events) | Reads (projection/timeline) |
|---|---|---|
| **Receptionist** | `lead_created`, `customer_created`, `appointment_set`, `message` | customer history (so it never re-asks) |
| **Estimator** | `estimate_started/updated`, `proposal_sent` | prior jobs, pack, company brain |
| **Scheduling** | `appointment_*`, `crew_scheduled` | schedule gaps, conflicts |
| **Draws** | `draw_requested`, `draw_status` | photos + % complete + receipts (auto package) |
| **Change orders** | `change_order` | estimate/margin/schedule to ripple |
| **Stop-work** | `work_stopped/resumed` | affected schedule + crew |
| **Photos** | `photo_added` (phase, trade tags) | pack `suggestedPhotos` (what to shoot) |
| **Payments** | `deposit_paid`, `payment` | balance, draw schedule |
| **Reviews / Referrals** | `review_requested`, `referral_requested` | `won` + delight signals |
| **Warranty** | `warranty_milestone` | install date + materials |
| **AI Project Manager** | `attention`, `attention_cleared` | the whole log (read everything) |

One spine. Every box above is a small reader/writer, not a separate app — the Phase-1 pattern.

---

## 9. Privacy & ownership (hard rules on the timeline)
- **#5 ownership:** `user_id` on every row; all reads scoped to the owner; customer matching
  never crosses contractors.
- **#2 margin/notes private:** `expected/actual_margin`, `customer.notes`, and AI reasoning are
  `internal` only — the `visibility='customer'` filter is what a shared/customer timeline view
  uses, so margin can never leak (same guarantee as `buildProposal()`).
- **#6 private files:** photo/document events store **refs**, not bytes; the actual files stay
  behind the existing signed-URL routes.

## 10. Performance
- All hot reads are covered by the indexes above (`(job_id,id)`, `(customer_id,id)`,
  `(user_id,type,id)`). `project_state` keeps health glanceable without scanning the log.
- v1 scale (per contractor: hundreds of jobs, thousands of events) is trivial for SQLite;
  the projection + indexes keep us fast well beyond that.

## 11. Migration & rollout (zero-downtime, reversible)
1. `CREATE TABLE` `customer`, `timeline_event`, `project_state` (additive; safe on deploy).
2. `ALTER TABLE job ADD COLUMN customer_id` via the existing migration list.
3. **One-time back-fill** (idempotent, dedupe-keyed): for each existing job → create/link a
   `customer`; emit historical `timeline_event`s from `lead`, `job` (created/sent), `signature`,
   `payment_request`, `draw`, `change_order`, `site_project` using their stored timestamps; then
   compute `project_state`. The timeline lights up populated, not empty.
4. Reversibility: the projection is rebuildable; the new tables are additive; embedded job
   fields untouched — we can ship behind a read-only flag and verify before any surface relies
   on it.

---

## 12. Decisions I need from you
1. **Customer dedup:** phone-then-email match-and-link within an owner — agree? (Alternative:
   never auto-merge; always create + suggest a merge.)
2. **v1 scope of writers:** I propose wiring the events we *already* emit first (lead, sent,
   signed, paid, draw, CO, scheduled) + the back-fill — and adding photo/crew/comms events as
   those features get built. Agree we start with the existing set, not all 20 at once?
3. **`attention` retention:** keep resolved alerts forever (audit trail) vs. prune after N days.
   I lean keep-forever (cheap, and it feeds the Company Brain's learning).
4. **Customer-visible timeline:** in scope for the MVP, or internal-only first? (The mask
   supports both; this is a product-surface decision.)

*No code applied. On your approval of this schema (and the four decisions), the first concrete
build is: the three tables + the `job.customer_id` migration + the idempotent back-fill +
`recordEvent`/read helpers — behind a flag, verified against the existing data before any
surface depends on it.*
