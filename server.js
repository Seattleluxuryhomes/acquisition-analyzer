import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchProperty } from "./attom.js";
import { analyze } from "./analyze.js";
import { arcadsReady } from "./arcads.js";
import { resolveListing } from "./zillow.js";
import { buildShowcase, estimate, defaultEngine, OUTPUTS_DIR } from "./showcase.js";
import { videoToolingReady } from "./video.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Global JSON parser is small; the showcase route (base64 photos) opts out and
// uses its own larger parser, so the small global limit can't reject it first.
const smallJson = express.json({ limit: "256kb" });
app.use((req, res, next) => (req.path === "/api/showcase/start" ? next() : smallJson(req, res, next)));
app.use(express.static(__dirname));

// Serve generated showcase media.
fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
app.use("/outputs", express.static(OUTPUTS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    attomKey: !!process.env.ATTOM_API_KEY,
    anthropicKey: !!process.env.ANTHROPIC_API_KEY,
    arcadsKey: arcadsReady(),
    rapidApiKey: !!process.env.RAPIDAPI_KEY,
    videoTooling: videoToolingReady(),
  });
});

app.post("/api/analyze", async (req, res) => {
  const address = (req.body?.address || "").trim();
  if (!address) return res.status(400).json({ error: "Enter a property address." });

  let normalized;
  try {
    normalized = await fetchProperty(address);
  } catch (err) {
    const map = { BAD_ADDRESS: 400, NOT_FOUND: 404, AUTH: 502, UPSTREAM: 502 };
    const code = map[err.code] || 500;
    return res.status(code).json({ error: err.message, stage: "attom", detail: err.detail || err.attomStatus || null });
  }

  let report;
  try {
    report = await analyze(normalized);
  } catch (err) {
    return res.status(200).json({ data: normalized, report: null, analysisError: err.message });
  }

  res.json({ data: normalized, report });
});

// ---- Showcase video maker ----

// Resolve a listing (facts + any auto-fetched photos) and estimate cost.
app.post("/api/showcase/preview", async (req, res) => {
  const zillowUrl = (req.body?.zillowUrl || "").trim();
  const address = (req.body?.address || "").trim();
  if (!zillowUrl && !address) return res.status(400).json({ error: "Provide a Zillow URL or an address." });
  try {
    const listing = await resolveListing({ zillowUrl, address });
    const photoCount = Math.max(1, Number(req.body?.photoCount) || listing.photos.length || 5);
    const est = estimate({ photoCount, duration: Number(req.body?.duration) || 5, resolution: req.body?.resolution || "720p", engine: req.body?.engine });
    res.json({ listing, estimate: est, arcadsKey: arcadsReady(), defaultEngine: defaultEngine(), videoTooling: videoToolingReady() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory job store (showcase generation runs for minutes).
const jobs = new Map();

function decodePhotos(arr) {
  const out = [];
  for (const p of arr || []) {
    const dataUrl = typeof p === "string" ? p : p?.dataUrl;
    const m = /^data:(image\/[a-z.+-]+);base64,(.+)$/i.exec(dataUrl || "");
    if (!m) continue;
    out.push({ mime: m[1], buffer: Buffer.from(m[2], "base64"), label: p?.label || null });
  }
  return out;
}

// Start a showcase job. Body: { zillowUrl?, address?, listing?, photos:[dataUrl|{dataUrl,label}], opts, confirm }
// Photos arrive as base64 data URLs, so this route gets a larger body limit.
app.post("/api/showcase/start", express.json({ limit: "60mb" }), async (req, res) => {
  const opts = req.body?.opts || {};
  const engine = opts.engine === "arcads" || opts.engine === "local" ? opts.engine : defaultEngine();
  if (engine === "arcads" && !arcadsReady()) {
    return res.status(400).json({ error: "Arcads credentials not set — add ARCADS_BASIC_AUTH to .env (run ./scripts/setup.sh), or use the free local engine." });
  }
  if (engine === "arcads" && req.body?.confirm !== true) {
    return res.status(400).json({ error: "Cost not confirmed — set confirm:true to proceed." });
  }

  const photos = decodePhotos(req.body?.photos);
  if (!photos.length) return res.status(400).json({ error: "Upload at least one listing photo." });
  if (photos.length > 8) return res.status(400).json({ error: "Max 8 photos per showcase." });

  let listing = req.body?.listing;
  if (!listing) {
    try { listing = await resolveListing({ zillowUrl: req.body?.zillowUrl, address: req.body?.address }); }
    catch (e) { listing = { address: (req.body?.address || null), price: null, beds: null, baths: null, sqft: null, photos: [], warnings: ["resolve failed: " + e.message] }; }
  }

  const id = crypto.randomUUID();
  const job = { id, status: "running", progress: [], result: null, error: null, startedAt: Date.now() };
  jobs.set(id, job);

  buildShowcase({
    listing,
    photos,
    opts: { ...opts, engine },
    onProgress: (p) => { job.progress.push({ t: Date.now(), ...p }); if (job.progress.length > 200) job.progress.shift(); },
  })
    .then((result) => { job.result = result; job.status = "done"; })
    .catch((err) => { job.error = err.message; job.status = "error"; });

  res.json({ jobId: id });
});

app.get("/api/showcase/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found." });
  res.json({ id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Acquisition Analyzer on http://localhost:${PORT}`);
});
