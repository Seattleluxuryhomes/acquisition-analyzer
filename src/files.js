// Signed, expiring URLs for private files (hard rule #6). A photo is reachable
// only via a URL carrying an HMAC over "<photoId>.<expiry>" — no public links,
// and <img> tags work without auth headers. The signing secret is server-only.
import crypto from "node:crypto";

const SECRET = process.env.BT_SIGNING_SECRET ||
  // Fallback for local/dev: stable within a process run. Set BT_SIGNING_SECRET in prod.
  crypto.createHash("sha256").update("bidtranslator-dev-" + (process.env.HOSTNAME || "local")).digest("hex");

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour

export function signPhotoUrl(jobId, photoId, ttl = DEFAULT_TTL) {
  const exp = Date.now() + ttl;
  const sig = sign(`${photoId}.${exp}`);
  return `/api/jobs/${jobId}/photos/${photoId}?exp=${exp}&sig=${sig}`;
}

export function verifyPhotoSig(photoId, exp, sig) {
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`${photoId}.${exp}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}
