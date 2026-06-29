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

// Private, expiring URL for a price-book SKU's photo (same scheme as job photos).
export function signSkuImageUrl(skuId, ttl = DEFAULT_TTL) {
  const exp = Date.now() + ttl;
  const sig = sign(`skuimg.${skuId}.${exp}`);
  return `/api/skus/${skuId}/image?exp=${exp}&sig=${sig}`;
}

export function verifySkuImageSig(skuId, exp, sig) {
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`skuimg.${skuId}.${exp}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Private, expiring URL for a job DOCUMENT (permit PDF, approval, plans, etc.).
// Same HMAC scheme as photos — files are never reachable without a valid signature.
export function signDocUrl(jobId, docId, ttl = DEFAULT_TTL) {
  const exp = Date.now() + ttl;
  const sig = sign(`doc.${docId}.${exp}`);
  return `/api/jobs/${jobId}/documents/${docId}?exp=${exp}&sig=${sig}`;
}
export function verifyDocSig(docId, exp, sig) {
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`doc.${docId}.${exp}`);
  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}

// Public, expiring link to a client proposal page (for texting/emailing a bid).
// Carries an HMAC over "proposal.<jobId>.<expiry>" — no login needed, and it
// only exposes buildProposal() data (margin/notes can never appear). 30 days to
// match the "pricing valid 30 days" footer.
const PROPOSAL_TTL = 30 * 24 * 60 * 60 * 1000;

export function signProposalUrl(jobId, ttl = PROPOSAL_TTL) {
  const exp = Date.now() + ttl;
  const sig = sign(`proposal.${jobId}.${exp}`);
  return `/p/${jobId}?exp=${exp}&sig=${sig}`;
}

export function verifyProposalSig(jobId, exp, sig) {
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`proposal.${jobId}.${exp}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Signed, expiring link to the SIGNED proposal PDF — the client's downloadable
// agreement copy and the contractor's "attached to the property" record. Same
// HMAC scheme as the proposal page; PDFs are never reachable without a signature
// (hard rule #6). 30 days to match the proposal link's validity.
export function signProposalPdfUrl(jobId, ttl = PROPOSAL_TTL) {
  const exp = Date.now() + ttl;
  const sig = sign(`proposalpdf.${jobId}.${exp}`);
  return `/p/${jobId}/pdf?exp=${exp}&sig=${sig}`;
}

export function verifyProposalPdfSig(jobId, exp, sig) {
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = sign(`proposalpdf.${jobId}.${exp}`);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}