// showcase.js — orchestrates: photos → Seedance clips → stitched showcase mp4.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProductId, uploadImage, generateSeedanceClip, pollAsset, estimateCredits, arcadsReady } from "./arcads.js";
import { stitchShowcase, dimsFor, videoToolingReady, kenBurnsClip } from "./video.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUTPUTS_DIR = path.join(__dirname, "outputs");

// Vary the camera move per shot so the tour doesn't feel static.
const MOVES = [
  "a slow steady push-in (dolly forward)",
  "a gentle pan from left to right",
  "a slow tilt revealing the space from floor to ceiling",
  "a subtle parallax drift to the right",
  "a slow pull-back revealing the full room",
  "a smooth glide forward through the space",
];

function revealPrompt(listing, i) {
  const move = MOVES[i % MOVES.length];
  const subject = listing.address ? `this real estate listing photo of a property at ${listing.address}` : "this real estate listing photo";
  return (
    `Cinematic real estate showcase. Animate ${subject} with ${move}. ` +
    `Photorealistic, high-end property tour aesthetic, natural daylight, smooth gimbal-stabilized motion, ` +
    `crisp architectural detail, shallow realistic depth. No people, no on-screen text, no captions, no watermark, ` +
    `no warping of walls or furniture. Keep the scene true to the original photo.`
  );
}

// Default engine: Arcads AI if a key is configured, else the free local one.
export function defaultEngine() {
  return arcadsReady() ? "arcads" : "local";
}

export function estimate({ photoCount, duration = 5, resolution = "720p", engine } = {}) {
  const eng = engine || defaultEngine();
  if (eng === "local") {
    return { engine: "local", clips: photoCount, duration, resolution, total: 0, note: "Local render (ffmpeg Ken Burns) — free, no Arcads credits." };
  }
  return { engine: "arcads", ...estimateCredits({ clips: photoCount, duration, resolution }) };
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed (" + res.status + ") for " + url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return dest;
}

// Arcads engine: upload each photo, generate a Seedance 2.0 i2v clip, poll, download.
async function arcadsClips({ listing, photos, runDir, duration, aspectRatio, resolution, onProgress }) {
  onProgress({ step: "product", msg: "Resolving Arcads product…" });
  const productId = await getProductId();
  const clips = [];
  for (let i = 0; i < photos.length; i++) {
    onProgress({ step: "upload", i, n: photos.length, msg: `Uploading photo ${i + 1}/${photos.length}…` });
    const filePath = await uploadImage(photos[i].buffer, photos[i].mime);
    onProgress({ step: "generate", i, n: photos.length, msg: `Starting clip ${i + 1}/${photos.length}…` });
    const g = await generateSeedanceClip({ productId, filePath, prompt: revealPrompt(listing, i), duration, aspectRatio, resolution });
    clips.push({ assetId: g.assetId });
  }
  let totalCredits = 0;
  for (let i = 0; i < clips.length; i++) {
    onProgress({ step: "render", i, n: clips.length, msg: `Rendering clip ${i + 1}/${clips.length} (this can take a few minutes)…` });
    const r = await pollAsset(clips[i].assetId, { onTick: (s) => onProgress({ step: "poll", i, status: s }) });
    clips[i].creditsCharged = r.creditsCharged;
    if (typeof r.creditsCharged === "number") totalCredits += r.creditsCharged;
    onProgress({ step: "download", i, msg: `Downloading clip ${i + 1}…` });
    clips[i].file = await download(r.url, path.join(runDir, `clip-${i}.mp4`));
  }
  return { clips, totalCredits };
}

// Local engine: animate each still with a Ken Burns pan/zoom (no Arcads, free).
async function localClips({ photos, runDir, duration, w, h, onProgress }) {
  const clips = [];
  for (let i = 0; i < photos.length; i++) {
    onProgress({ step: "render", i, n: photos.length, msg: `Animating photo ${i + 1}/${photos.length} (local Ken Burns)…` });
    const src = path.join(runDir, `src-${i}.jpg`);
    fs.writeFileSync(src, photos[i].buffer);
    const file = await kenBurnsClip(src, duration, w, h, path.join(runDir, `clip-${i}.mp4`), i);
    clips.push({ file, creditsCharged: 0 });
  }
  return { clips, totalCredits: 0 };
}

// photos: [{ buffer, mime, label? }]
export async function buildShowcase({ listing, photos, opts = {}, onProgress = () => {} }) {
  const duration = Math.min(15, Math.max(4, opts.duration || 5));
  const aspectRatio = opts.aspectRatio === "9:16" ? "9:16" : "16:9";
  const resolution = opts.resolution === "480p" ? "480p" : "720p";
  const [w, h] = dimsFor(aspectRatio, resolution);
  const engine = opts.engine === "arcads" || opts.engine === "local" ? opts.engine : defaultEngine();

  const runDir = path.join(OUTPUTS_DIR, "showcase-" + Date.now());
  fs.mkdirSync(runDir, { recursive: true });

  onProgress({ step: "engine", msg: `Engine: ${engine === "local" ? "local Ken Burns (free)" : "Arcads Seedance 2.0"}` });
  const { clips, totalCredits } = engine === "local"
    ? await localClips({ photos, runDir, duration, w, h, onProgress })
    : await arcadsClips({ listing, photos, runDir, duration, aspectRatio, resolution, onProgress });

  const rel = (p) => "/outputs/" + path.relative(OUTPUTS_DIR, p).split(path.sep).join("/");
  const result = {
    engine,
    runDir: rel(runDir),
    clips: clips.map((c, i) => ({ index: i, url: rel(c.file), creditsCharged: c.creditsCharged })),
    final: null,
    stitched: false,
    totalCredits,
  };

  if (videoToolingReady()) {
    try {
      onProgress({ step: "stitch", msg: "Stitching title card, clips, and outro…" });
      const out = path.join(runDir, "showcase.mp4");
      await stitchShowcase({ clips: clips.map((c) => c.file), listing, dims: [w, h], workDir: runDir, out, clipDuration: duration });
      result.final = rel(out);
      result.stitched = true;
    } catch (e) {
      result.stitchError = e.message;
    }
  } else {
    result.stitchError = "Video tooling unavailable — returning individual clips.";
  }

  onProgress({ step: "done", msg: "Showcase complete." });
  return result;
}
