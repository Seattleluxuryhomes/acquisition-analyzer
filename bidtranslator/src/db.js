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
`);

export default db;
