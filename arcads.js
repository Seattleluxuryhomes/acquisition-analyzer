// arcads.js — Arcads external API client (Seedance 2.0 image-to-video).
// Keys stay server-side. Auth + endpoints per skills/arcads-external-api/reference.md.
const BASE = process.env.ARCADS_BASE_URL || "https://external-api.arcads.ai";

// Build the HTTP Basic Authorization header from either ARCADS_BASIC_AUTH
// (preferred — a full "Basic xxx" string) or a raw ARCADS_API_KEY (key as
// username, empty password). Returns null if no usable credential is set.
export function arcadsAuthHeader() {
  const basic = process.env.ARCADS_BASIC_AUTH;
  if (basic && !/your_base64_encoded_credentials_here/.test(basic)) {
    return basic.startsWith("Basic ") ? basic : "Basic " + basic;
  }
  const key = process.env.ARCADS_API_KEY;
  if (key && key !== "your_key_here") {
    return "Basic " + Buffer.from(key + ":").toString("base64");
  }
  return null;
}

export function arcadsReady() {
  return !!arcadsAuthHeader();
}

async function api(path, { method = "GET", body } = {}) {
  const auth = arcadsAuthHeader();
  if (!auth) {
    const e = new Error("Arcads credentials not set — add ARCADS_BASIC_AUTH (or ARCADS_API_KEY) to .env.");
    e.code = "ARCADS_AUTH";
    throw e;
  }
  const headers = { Authorization: auth };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  if (!res.ok) {
    const e = new Error(`Arcads ${res.status} on ${path}`);
    e.status = res.status;
    e.detail = (text || "").slice(0, 300);
    throw e;
  }
  return json ?? {};
}

// Resolve the target product. Honors ARCADS_PRODUCT_ID; otherwise picks the
// first product on the account.
export async function getProductId() {
  if (process.env.ARCADS_PRODUCT_ID) return process.env.ARCADS_PRODUCT_ID;
  const data = await api("/v1/products");
  const items = Array.isArray(data) ? data : (data.items || data.products || data.data || []);
  if (!items.length) {
    const e = new Error("No Arcads products found on this account — create one in the Arcads dashboard.");
    e.code = "NO_PRODUCT";
    throw e;
  }
  return items[0].id || items[0].productId || items[0]._id;
}

function imageFileType(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "image/png";
  if (m.includes("webp")) return "image/webp";
  if (m.includes("heic") || m.includes("heif")) return "image/heic";
  return "image/jpeg";
}

// Upload an image buffer via the presigned-URL flow. Returns a one-time-use
// `filePath` to pass into referenceImages. (filePath is consumed by a single
// generate call — re-upload if you need it again.)
export async function uploadImage(buffer, mime = "image/jpeg") {
  const fileType = imageFileType(mime);
  const presign = await api("/v1/file-upload/get-presigned-url", { method: "POST", body: { fileType } });
  const url = presign.presignedUrl;
  const filePath = presign.filePath;
  if (!url || !filePath) {
    const e = new Error("Presigned upload response was missing presignedUrl/filePath.");
    e.detail = JSON.stringify(presign).slice(0, 200);
    throw e;
  }
  const put = await fetch(url, { method: "PUT", headers: { "Content-Type": fileType }, body: buffer });
  if (!put.ok) {
    const e = new Error(`Image upload to storage failed (${put.status}).`);
    e.status = put.status;
    throw e;
  }
  return filePath;
}

// Generate a Seedance 2.0 image-to-video clip from one reference image filePath.
// Seedance uses referenceImages (NOT startFrame) and is polled at /v1/assets.
export async function generateSeedanceClip({ productId, projectId, filePath, prompt, duration = 5, aspectRatio = "16:9", resolution = "720p" }) {
  const body = { model: "seedance-2.0", productId, prompt, aspectRatio, duration, resolution, referenceImages: [filePath] };
  if (projectId) body.projectId = projectId;
  const res = await api("/v2/videos/generate", { method: "POST", body });
  const assetId = res.id || res.assetId || res._id;
  if (!assetId) {
    const e = new Error("Seedance generate response had no asset id.");
    e.detail = JSON.stringify(res).slice(0, 200);
    throw e;
  }
  return { assetId, type: res.type, raw: res };
}

// Poll an asset (Seedance 2.0 returns type "seedance_20", lives at /v1/assets).
export async function pollAsset(assetId, { intervalMs = 5000, timeoutMs = 15 * 60 * 1000, onTick } = {}) {
  const start = Date.now();
  for (;;) {
    const a = await api("/v1/assets/" + assetId);
    const status = a.status || a.assetStatus;
    if (onTick) onTick(status, a);
    if (status === "generated") {
      return {
        status,
        url: a.url || a.videoUrl || null,
        thumbnailUrl: a.thumbnailUrl || null,
        creditsCharged: a?.data?.creditsCharged ?? null,
        raw: a,
      };
    }
    if (status === "failed") {
      const e = new Error(a?.data?.error?.message || "Seedance asset generation failed.");
      e.code = "ASSET_FAILED";
      e.raw = a;
      throw e;
    }
    if (Date.now() - start > timeoutMs) {
      const e = new Error("Timed out waiting for asset " + assetId);
      e.code = "TIMEOUT";
      throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// Credit-cost estimate for Seedance 2.0 image-to-video.
// Rate from reference.md: ~48 credits/sec at 720p (re-validated 2026-05-19).
export function estimateCredits({ clips, duration = 5, resolution = "720p" }) {
  const ratePerSec = resolution === "480p" ? 32 : 48;
  const perClip = Math.round(ratePerSec * duration);
  return {
    clips,
    duration,
    resolution,
    ratePerSec,
    perClip,
    total: perClip * clips,
    basis: "Seedance 2.0 i2v ~" + ratePerSec + " credits/sec (reference.md, re-validated 2026-05-19)",
    note: "Estimate only — confirm exact cost in the Arcads dashboard. Credits are charged at create time and are not refunded if a prompt is flagged.",
  };
}
