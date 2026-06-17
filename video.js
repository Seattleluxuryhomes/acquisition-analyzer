// video.js — render text cards/overlays (canvas) and stitch clips (ffmpeg).
//
// The static ffmpeg build has no drawtext (no freetype), so all text is drawn
// with @napi-rs/canvas into PNGs and composited via ffmpeg's overlay filter.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

let canvasMod = null;
try { canvasMod = await import("@napi-rs/canvas"); } catch { /* optional */ }

// Prefer a system ffmpeg if it actually runs (better filter support), else the
// bundled static binary. Resolved once at load.
const FFMPEG = (() => {
  try {
    const r = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    if (!r.error && r.status === 0) return "ffmpeg";
  } catch { /* fall through */ }
  return ffmpegPath;
})();

function resolveFfmpeg() {
  return FFMPEG;
}

export function videoToolingReady() {
  return !!(canvasMod && FFMPEG);
}

const money = (n) => (n == null ? null : "$" + Number(n).toLocaleString("en-US"));
const numf = (n) => (n == null ? null : Number(n).toLocaleString("en-US"));

// ---- Theme (mirrors the app's dark/gold aesthetic) ----
const INK = "#0C0D10", BONE = "#F2F0EA", SILVER = "#9BA0AB", GOLD = "#C9A35C", GOLDB = "#E3C078";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "Arial, Helvetica, sans-serif";

function newCanvas(w, h) {
  const cv = canvasMod.createCanvas(w, h);
  return { cv, ctx: cv.getContext("2d") };
}

function factsLine(listing) {
  const parts = [];
  if (listing.beds != null) parts.push(listing.beds + " bd");
  if (listing.baths != null) parts.push(listing.baths + " ba");
  if (listing.sqft != null) parts.push(numf(listing.sqft) + " sqft");
  if (listing.yearBuilt != null) parts.push("Built " + listing.yearBuilt);
  return parts.join("   ·   ");
}

// Intro title card PNG (opaque): address + price + facts.
export function renderTitleCard(listing, w, h, outPath) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  // thin gold frame
  ctx.strokeStyle = "rgba(201,163,92,0.5)"; ctx.lineWidth = Math.max(2, Math.round(h / 360));
  const m = Math.round(h * 0.07); ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  ctx.textAlign = "center";
  ctx.fillStyle = SILVER; ctx.font = `${Math.round(h * 0.028)}px ${SANS}`;
  ctx.fillText("PROPERTY SHOWCASE", w / 2, h * 0.34);

  const [line1, line2] = splitAddress(listing.address);
  ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.07)}px ${SERIF}`;
  ctx.fillText(line1 || "Address unavailable", w / 2, h * 0.46);
  if (line2) { ctx.font = `${Math.round(h * 0.045)}px ${SERIF}`; ctx.fillStyle = SILVER; ctx.fillText(line2, w / 2, h * 0.535); }

  if (listing.price != null) {
    ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.075)}px ${SERIF}`;
    ctx.fillText(money(listing.price), w / 2, h * 0.66);
    if (listing.priceLabel) { ctx.fillStyle = SILVER; ctx.font = `${Math.round(h * 0.024)}px ${SANS}`; ctx.fillText(listing.priceLabel, w / 2, h * 0.70); }
  }
  const facts = factsLine(listing);
  if (facts) { ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.034)}px ${SANS}`; ctx.fillText(facts, w / 2, h * 0.78); }

  fs.writeFileSync(outPath, cv.toBuffer("image/png"));
  return outPath;
}

// Outro card PNG (opaque): simple CTA.
export function renderOutroCard(listing, w, h, outPath) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  const [line1] = splitAddress(listing.address);
  ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.06)}px ${SERIF}`;
  ctx.fillText("Schedule a private showing", w / 2, h * 0.46);
  ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.04)}px ${SANS}`;
  ctx.fillText(line1 || "", w / 2, h * 0.57);
  fs.writeFileSync(outPath, cv.toBuffer("image/png"));
  return outPath;
}

// Details card PNG (opaque): a tidy spec sheet (beds/baths/SF/lot/parking/schools).
export function renderDetailsCard(listing, w, h, outPath) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(201,163,92,0.5)"; ctx.lineWidth = Math.max(2, Math.round(h / 360));
  const m = Math.round(h * 0.07); ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  ctx.textAlign = "center";
  ctx.fillStyle = GOLD; ctx.font = `${Math.round(h * 0.03)}px ${SANS}`;
  ctx.fillText("PROPERTY DETAILS", w / 2, h * 0.2);

  const rows = [];
  if (listing.bedsNote || listing.beds != null) rows.push(["Bedrooms", String(listing.bedsNote ?? listing.beds)]);
  if (listing.baths != null) rows.push(["Bathrooms", String(listing.baths)]);
  if (listing.sqft != null) rows.push(["Finished", numf(listing.sqft) + " SF"]);
  if (listing.lotSqft != null) rows.push(["Lot", numf(listing.lotSqft) + " SF"]);
  if (listing.parking) rows.push(["Parking", listing.parking]);
  if (listing.schoolDistrict) rows.push(["School district", listing.schoolDistrict]);

  const xL = Math.round(w * 0.18), xR = Math.round(w * 0.82);
  const top = h * 0.3, rowH = h * 0.078;
  ctx.font = `${Math.round(h * 0.036)}px ${SANS}`;
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    ctx.textAlign = "left"; ctx.fillStyle = SILVER; ctx.fillText(r[0], xL, y);
    ctx.textAlign = "right"; ctx.fillStyle = BONE; ctx.fillText(r[1], xR, y);
    ctx.strokeStyle = "rgba(35,38,46,1)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xL, y + rowH * 0.28); ctx.lineTo(xR, y + rowH * 0.28); ctx.stroke();
  });

  if (listing.schools && listing.schools.length) {
    ctx.textAlign = "center"; ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.03)}px ${SANS}`;
    ctx.fillText(listing.schools.join("   ·   "), w / 2, top + rows.length * rowH + h * 0.04);
  }
  fs.writeFileSync(outPath, cv.toBuffer("image/png"));
  return outPath;
}

// Full-frame transparent overlay: bottom gradient strip + persistent address /
// price lower-third, composited over each animated clip.
export function renderLowerThird(listing, w, h, outPath) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const stripH = Math.round(h * 0.22);
  const grad = ctx.createLinearGradient(0, h - stripH, 0, h);
  grad.addColorStop(0, "rgba(12,13,16,0)");
  grad.addColorStop(1, "rgba(12,13,16,0.82)");
  ctx.fillStyle = grad; ctx.fillRect(0, h - stripH, w, stripH);

  const pad = Math.round(w * 0.045);
  ctx.textAlign = "left";
  const [line1] = splitAddress(listing.address);
  if (line1) { ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.04)}px ${SERIF}`; ctx.fillText(line1, pad, h - Math.round(h * 0.09)); }
  const facts = factsLine(listing);
  if (facts) { ctx.fillStyle = SILVER; ctx.font = `${Math.round(h * 0.028)}px ${SANS}`; ctx.fillText(facts, pad, h - Math.round(h * 0.045)); }
  if (listing.price != null) {
    ctx.textAlign = "right"; ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.05)}px ${SERIF}`;
    ctx.fillText(money(listing.price), w - pad, h - Math.round(h * 0.06));
  }
  fs.writeFileSync(outPath, cv.toBuffer("image/png"));
  return outPath;
}

function splitAddress(full) {
  if (!full) return ["", ""];
  const i = full.indexOf(",");
  return i < 0 ? [full, ""] : [full.slice(0, i).trim(), full.slice(i + 1).trim()];
}

function run(args) {
  return new Promise((resolve, reject) => {
    const ff = spawn(resolveFfmpeg(), args);
    let err = "";
    ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("error", (e) => reject(e));
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg exited " + code + ": " + err.slice(-500)))));
  });
}

// A still PNG → a normalized silent video segment of `seconds`.
async function stillToSegment(png, seconds, w, h, out) {
  await run(["-y", "-loop", "1", "-t", String(seconds), "-i", png,
    "-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x0C0D10,format=yuv420p`,
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}

// A Seedance clip + lower-third overlay → a normalized silent segment.
async function clipToSegment(clip, overlayPng, w, h, out) {
  await run(["-y", "-i", clip, "-i", overlayPng,
    "-filter_complex",
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1[v];[v][1:v]overlay=0:0,format=yuv420p[o]`,
    "-map", "[o]", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}

// Stitch: intro card → each clip (with lower-third) → outro card → one mp4.
export async function stitchShowcase({ clips, listing, dims, workDir, out }) {
  if (!videoToolingReady()) throw new Error("Video tooling unavailable (canvas/ffmpeg).");
  const [w, h] = dims;
  const segs = [];

  const intro = renderTitleCard(listing, w, h, path.join(workDir, "intro.png"));
  segs.push(await stillToSegment(intro, 3, w, h, path.join(workDir, "seg-intro.mp4")));

  const lower = renderLowerThird(listing, w, h, path.join(workDir, "lower.png"));
  for (let i = 0; i < clips.length; i++) {
    segs.push(await clipToSegment(clips[i], lower, w, h, path.join(workDir, `seg-${i}.mp4`)));
  }

  const hasDetails = listing.lotSqft != null || listing.parking || listing.schoolDistrict || (listing.schools && listing.schools.length);
  if (hasDetails) {
    const det = renderDetailsCard(listing, w, h, path.join(workDir, "details.png"));
    segs.push(await stillToSegment(det, 4.5, w, h, path.join(workDir, "seg-details.mp4")));
  }

  const outro = renderOutroCard(listing, w, h, path.join(workDir, "outro.png"));
  segs.push(await stillToSegment(outro, 2.5, w, h, path.join(workDir, "seg-outro.mp4")));

  // All segments share codec/params now → concat with stream copy.
  const list = path.join(workDir, "concat.txt");
  fs.writeFileSync(list, segs.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
  await run(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
  return out;
}

// Dimensions for an aspect ratio + resolution.
export function dimsFor(aspectRatio, resolution) {
  if (aspectRatio === "9:16") return resolution === "480p" ? [480, 854] : [720, 1280];
  return resolution === "480p" ? [854, 480] : [1280, 720];
}

// Local "Ken Burns" engine: animate a still photo with a slow pan/zoom — a
// real cinematic clip with no Arcads key and no credits. Variant cycles the
// camera move so a multi-photo tour doesn't feel repetitive.
export async function kenBurnsClip(image, seconds, w, h, out, variantIdx = 0) {
  const frames = Math.max(2, Math.round(seconds * 30));
  const f = frames - 1;
  const variants = [
    { z: "min(zoom+0.0010,1.20)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },              // zoom-in center
    { z: "min(zoom+0.0008,1.15)", x: `(iw-iw/zoom)*on/${f}`, y: "ih/2-(ih/zoom/2)" },           // pan right
    { z: "min(zoom+0.0008,1.15)", x: `(iw-iw/zoom)*(1-on/${f})`, y: "ih/2-(ih/zoom/2)" },       // pan left
    { z: "min(zoom+0.0008,1.15)", x: "iw/2-(iw/zoom/2)", y: `(ih-ih/zoom)*(1-on/${f})` },       // pan up
    { z: "min(zoom+0.0008,1.15)", x: "iw/2-(iw/zoom/2)", y: `(ih-ih/zoom)*on/${f}` },           // pan down
    { z: "min(zoom+0.0006,1.12)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },               // slow zoom
  ];
  const v = variants[variantIdx % variants.length];
  const big = `${w * 2}:${h * 2}`;
  const vf =
    `scale=${big}:force_original_aspect_ratio=increase,crop=${big},` +
    `zoompan=z='${v.z}':d=${frames}:x='${v.x}':y='${v.y}':s=${w}x${h}:fps=30,format=yuv420p`;
  await run(["-y", "-loop", "1", "-i", image, "-t", String(seconds), "-vf", vf,
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}
