// Accounts + token sessions. Passwords hashed with scrypt (node:crypto, no deps).
// Sessions are random opaque tokens stored server-side — revocable, no JWT needed.
import crypto from "node:crypto";
import db from "./db.js";

const DAY = 24 * 60 * 60 * 1000;
const SESSION_TTL = 60 * DAY; // contractors stay signed in for field use

const uid = () => crypto.randomBytes(9).toString("base64url");

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(String(password), salt, expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    company: row.company,
    name: row.name,
    phone: row.phone,
    license: row.license,
    default_from_lang: row.default_from_lang,
    default_to_lang: row.default_to_lang,
    logo: row.logo || "",
  };
}

function issueSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.prepare(
    "INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?,?,?,?)"
  ).run(token, userId, now, now + SESSION_TTL);
  return token;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function signup({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");
  if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address.");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters.");
  const exists = db.prepare("SELECT id FROM user WHERE email=?").get(email);
  if (exists) throw httpError(409, "An account with that email already exists.");

  const id = uid();
  const now = Date.now();
  const TRIAL_DAYS = Number(process.env.BT_TRIAL_DAYS || 14);
  const trialEnds = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  db.prepare(
    "INSERT INTO user (id, email, password_hash, trial_ends_at, created_at) VALUES (?,?,?,?,?)"
  ).run(id, email, hashPassword(password), trialEnds, now);
  const row = db.prepare("SELECT * FROM user WHERE id=?").get(id);
  return { token: issueSession(id), user: publicUser(row) };
}

// Concierge onboarding (founder-only): create a fully-configured account WITHOUT
// a password — the contractor sets it via the invite link. Same trial as a normal
// signup, so they get the full package and can later subscribe or fall to the free
// manual version. Profile fields are pre-loaded so they log in ready to work.
export function adminCreateUser(profile = {}) {
  const email = String(profile.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, "Enter a valid email address.");
  if (db.prepare("SELECT id FROM user WHERE email=?").get(email)) throw httpError(409, "An account with that email already exists.");
  const id = uid(), now = Date.now();
  const TRIAL_DAYS = Number(process.env.BT_TRIAL_DAYS || 14);
  // A random password they never use — replaced when they set their own via the link.
  const pw = hashPassword(crypto.randomBytes(24).toString("hex"));
  db.prepare(`INSERT INTO user
    (id,email,password_hash,company,name,phone,default_from_lang,default_to_lang,tax_rate,region,whatsapp,trial_ends_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, email, pw,
    String(profile.company || "").slice(0, 120) || "Your Company",
    String(profile.name || "").slice(0, 120),
    String(profile.phone || "").slice(0, 40),
    String(profile.from_lang || "es").slice(0, 8),
    String(profile.to_lang || "en").slice(0, 8),
    Math.max(0, Number(profile.tax_rate) || 0),
    String(profile.region || "").slice(0, 8),
    String(profile.whatsapp || profile.phone || "").slice(0, 40),
    now + TRIAL_DAYS * DAY, now);
  return { id, user: publicUser(db.prepare("SELECT * FROM user WHERE id=?").get(id)) };
}

export function signin({ email, password }) {
  email = String(email || "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM user WHERE email=?").get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw httpError(401, "Email or password is incorrect.");
  }
  return { token: issueSession(row.id), user: publicUser(row) };
}

export function signout(token) {
  if (token) db.prepare("DELETE FROM session WHERE token=?").run(token);
}

// Change password while signed in: verify the current one, set the new one, and
// revoke every other session (so a leaked/old login can't keep going).
export function changePassword({ userId, currentPassword, newPassword, keepToken }) {
  const row = db.prepare("SELECT * FROM user WHERE id=?").get(userId);
  if (!row) throw httpError(401, "Account not found.");
  if (!verifyPassword(String(currentPassword || ""), row.password_hash)) {
    // 403 (not 401): the session is valid; only the typed current password is
    // wrong. A 401 would make the client treat it as an expired session.
    throw httpError(403, "Your current password is incorrect.");
  }
  newPassword = String(newPassword || "");
  if (newPassword.length < 8) throw httpError(400, "New password must be at least 8 characters.");
  if (verifyPassword(newPassword, row.password_hash)) {
    throw httpError(400, "Choose a password different from your current one.");
  }
  db.prepare("UPDATE user SET password_hash=? WHERE id=?").run(hashPassword(newPassword), userId);
  db.prepare("DELETE FROM session WHERE user_id=? AND token!=?").run(userId, keepToken || "");
  return { ok: true };
}

// ---- Password reset (forgot password) ----
const RESET_TTL = 60 * 60 * 1000; // 1 hour

function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function safeEq(a, b) { try { return crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b))); } catch { return false; } }

// Start a reset: store a single-use token hash + expiry on the user and return
// the raw token so the caller can email the link. Returns null when no account
// matches — the caller should still respond ok (no email-enumeration).
export function createResetToken(email, ttlMs = RESET_TTL) {
  email = String(email || "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM user WHERE email=?").get(email);
  if (!row) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("UPDATE user SET reset_token_hash=?, reset_token_exp=? WHERE id=?")
    .run(sha256(token), Date.now() + ttlMs, row.id);
  return { user: publicUser(row), token };
}

// Finish a reset: verify the single-use token, set the new password, clear the
// token, and revoke every session (so any old/leaked login is killed).
export function confirmPasswordReset({ email, token, newPassword }) {
  email = String(email || "").trim().toLowerCase();
  newPassword = String(newPassword || "");
  const row = db.prepare("SELECT * FROM user WHERE email=?").get(email);
  const ok = row && row.reset_token_hash && row.reset_token_exp > Date.now() && safeEq(sha256(token), row.reset_token_hash);
  if (!ok) throw httpError(400, "This reset link is invalid or has expired — request a new one.");
  if (newPassword.length < 8) throw httpError(400, "Password must be at least 8 characters.");
  db.prepare("UPDATE user SET password_hash=?, reset_token_hash=NULL, reset_token_exp=NULL WHERE id=?")
    .run(hashPassword(newPassword), row.id);
  db.prepare("DELETE FROM session WHERE user_id=?").run(row.id);
  return { ok: true };
}

// Express middleware: resolves the bearer token to req.user, or 401s.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  const sess = db.prepare("SELECT * FROM session WHERE token=?").get(token);
  if (!sess || sess.expires_at < Date.now()) {
    if (sess) db.prepare("DELETE FROM session WHERE token=?").run(token);
    return res.status(401).json({ error: "Your session expired — sign in again." });
  }
  const row = db.prepare("SELECT * FROM user WHERE id=?").get(sess.user_id);
  if (!row) return res.status(401).json({ error: "Account not found." });
  req.user = row;
  req.token = token;
  next();
}

export { publicUser, httpError };

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
