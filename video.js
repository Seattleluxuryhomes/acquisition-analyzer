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

async function loadLogo(p) {
  if (!p || !canvasMod) return null;
  try { return await canvasMod.loadImage(p); } catch { return null; }
}

// Draw a logo (preserving aspect) at targetW, anchored center/left/right at cx.
// `backing` paints a soft dark rounded panel behind it so a white logo stays
// legible over any background (e.g. a bright sky).
function drawLogo(ctx, logo, cx, topY, targetW, align = "center", shadow = false, backing = false) {
  if (!logo) return 0;
  const tw = targetW, th = tw * (logo.height / logo.width);
  const x = align === "right" ? cx - tw : align === "left" ? cx : cx - tw / 2;
  if (backing) {
    const p = tw * 0.12, r = th * 0.35;
    ctx.save();
    ctx.fillStyle = "rgba(12,13,16,0.42)";
    const bx = x - p, by = topY - p * 0.7, bw = tw + p * 2, bh = th + p * 1.4;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, r); ctx.fill(); }
    else ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }
  if (shadow) { ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = tw * 0.05; ctx.shadowOffsetY = 2; }
  ctx.drawImage(logo, x, topY, tw, th);
  if (shadow) ctx.restore();
  return th;
}

function factsLine(listing) {
  const parts = [];
  if (listing.beds != null) parts.push(listing.beds + " bd");
  if (listing.baths != null) parts.push(listing.baths + " ba");
  if (listing.sqft != null) parts.push(numf(listing.sqft) + " sqft");
  if (listing.yearBuilt != null) parts.push("Built " + listing.yearBuilt);
  return parts.join("   ·   ");
}

// Intro title card PNG (opaque): logo + address + price + facts.
export function renderTitleCard(listing, w, h, outPath, logo) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  // thin gold frame
  ctx.strokeStyle = "rgba(201,163,92,0.5)"; ctx.lineWidth = Math.max(2, Math.round(h / 360));
  const m = Math.round(h * 0.07); ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  drawLogo(ctx, logo, w / 2, h * 0.12, w * 0.28, "center");
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

// Outro card PNG (opaque): logo + CTA.
export function renderOutroCard(listing, w, h, outPath, logo) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  drawLogo(ctx, logo, w / 2, h * 0.26, w * 0.36, "center");
  ctx.textAlign = "center";
  const [line1] = splitAddress(listing.address);
  ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.06)}px ${SERIF}`;
  ctx.fillText("Schedule a private showing", w / 2, h * 0.55);
  ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.04)}px ${SANS}`;
  ctx.fillText(line1 || "", w / 2, h * 0.65);
  fs.writeFileSync(outPath, cv.toBuffer("image/png"));
  return outPath;
}

// Details card PNG (opaque): a tidy spec sheet (beds/baths/SF/lot/parking/schools).
export function renderDetailsCard(listing, w, h, outPath, logo) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(201,163,92,0.5)"; ctx.lineWidth = Math.max(2, Math.round(h / 360));
  const m = Math.round(h * 0.07); ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  drawLogo(ctx, logo, w / 2, h * 0.1, w * 0.2, "center");
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD; ctx.font = `${Math.round(h * 0.03)}px ${SANS}`;
  ctx.fillText("PROPERTY DETAILS", w / 2, h * 0.22);

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
export function renderLowerThird(listing, w, h, outPath, logo, label) {
  const { cv, ctx } = newCanvas(w, h);
  ctx.clearRect(0, 0, w, h);
  const pad = Math.round(w * 0.045);

  // editorial room caption, top-left
  if (label) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = h * 0.02;
    ctx.textAlign = "left"; ctx.fillStyle = GOLDB;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${Math.round(h * 0.006)}px`;
    ctx.font = `${Math.round(h * 0.033)}px ${SANS}`;
    ctx.fillText(String(label).toUpperCase(), pad, Math.round(h * 0.115));
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, Math.round(h * 0.003));
    ctx.beginPath(); ctx.moveTo(pad, Math.round(h * 0.14)); ctx.lineTo(pad + w * 0.07, Math.round(h * 0.14)); ctx.stroke();
    ctx.restore();
  }

  // bottom gradient strip holds: logo (top) → address → facts, with price at right
  const stripH = Math.round(h * 0.34);
  const grad = ctx.createLinearGradient(0, h - stripH, 0, h);
  grad.addColorStop(0, "rgba(12,13,16,0)");
  grad.addColorStop(1, "rgba(12,13,16,0.85)");
  ctx.fillStyle = grad; ctx.fillRect(0, h - stripH, w, stripH);

  const [line1] = splitAddress(listing.address);
  // logo sits directly above the address
  const logoW = w * 0.17, logoH = logo ? logoW * (logo.height / logo.width) : 0;
  drawLogo(ctx, logo, pad, h - Math.round(h * 0.135) - logoH, logoW, "left", true, false);

  ctx.textAlign = "left";
  if (line1) { ctx.fillStyle = BONE; ctx.font = `${Math.round(h * 0.04)}px ${SERIF}`; ctx.fillText(line1, pad, h - Math.round(h * 0.085)); }
  const facts = factsLine(listing);
  if (facts) { ctx.fillStyle = SILVER; ctx.font = `${Math.round(h * 0.028)}px ${SANS}`; ctx.fillText(facts, pad, h - Math.round(h * 0.04)); }
  if (listing.price != null) {
    ctx.textAlign = "right"; ctx.fillStyle = GOLDB; ctx.font = `${Math.round(h * 0.05)}px ${SERIF}`;
    ctx.fillText(money(listing.price), w - pad, h - Math.round(h * 0.055));
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
  // Luxury grade: gentle contrast/saturation lift + soft vignette, then overlay.
  await run(["-y", "-i", clip, "-i", overlayPng,
    "-filter_complex",
    `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,` +
    `eq=contrast=1.07:saturation=1.12:brightness=0.01:gamma=0.98,` +
    `colorbalance=rm=0.04:gm=0.0:bm=-0.04,vignette=PI/4.5[v];` +
    `[v][1:v]overlay=0:0,format=yuv420p[o]`,
    "-map", "[o]", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out]);
  return out;
}

// Crossfade a list of normalized segments (with known durations) into one mp4.
async function concatCrossfade(segs, durs, x, out) {
  const inputs = [];
  segs.forEach((s) => inputs.push("-i", s));
  let label = "[0:v]", filter = "", cum = durs[0];
  for (let i = 1; i < segs.length; i++) {
    const off = (cum - x).toFixed(3);
    const o = `[v${i}]`;
    filter += `${label}[${i}:v]xfade=transition=fade:duration=${x}:offset=${off}${o};`;
    label = o;
    cum = cum + durs[i] - x;
  }
  // Cinematic bookends: fade up from black, fade out to black.
  filter += `${label}fade=t=in:st=0:d=0.6,fade=t=out:st=${(cum - 0.9).toFixed(3)}:d=0.9[vout]`;
  await run(["-y", ...inputs, "-filter_complex", filter, "-map", "[vout]",
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an", out]);
}

// Stitch: intro → each clip (with lower-third) → details → outro, crossfaded.
export async function stitchShowcase({ clips, listing, dims, workDir, out, clipDuration = 5, labels = [] }) {
  if (!videoToolingReady()) throw new Error("Video tooling unavailable (canvas/ffmpeg).");
  const [w, h] = dims;
  const logo = await loadLogo(listing.logoPath);
  const segs = [], durs = [];
  const INTRO = 3, DETAILS = 4.5, OUTRO = 2.5;

  const intro = renderTitleCard(listing, w, h, path.join(workDir, "intro.png"), logo);
  segs.push(await stillToSegment(intro, INTRO, w, h, path.join(workDir, "seg-intro.mp4"))); durs.push(INTRO);

  for (let i = 0; i < clips.length; i++) {
    const ov = renderLowerThird(listing, w, h, path.join(workDir, `lower-${i}.png`), logo, labels[i]);
    segs.push(await clipToSegment(clips[i], ov, w, h, path.join(workDir, `seg-${i}.mp4`))); durs.push(clipDuration);
  }

  const hasDetails = listing.lotSqft != null || listing.parking || listing.schoolDistrict || (listing.schools && listing.schools.length);
  if (hasDetails) {
    const det = renderDetailsCard(listing, w, h, path.join(workDir, "details.png"), logo);
    segs.push(await stillToSegment(det, DETAILS, w, h, path.join(workDir, "seg-details.mp4"))); durs.push(DETAILS);
  }

  const outro = renderOutroCard(listing, w, h, path.join(workDir, "outro.png"), logo);
  segs.push(await stillToSegment(outro, OUTRO, w, h, path.join(workDir, "seg-outro.mp4"))); durs.push(OUTRO);

  // Cinematic crossfades; fall back to hard-cut concat if xfade errors.
  try {
    await concatCrossfade(segs, durs, 0.45, out);
  } catch {
    const list = path.join(workDir, "concat.txt");
    fs.writeFileSync(list, segs.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join("\n"));
    await run(["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
  }
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
  // Ease-out the move (fast start, gentle settle) via a sine ramp s∈[0,1].
  const s = `sin((on/${f})*(PI/2))`;
  const zc = (zt) => `1+${(zt - 1).toFixed(4)}*${s}`;
  const cx = "iw/2-(iw/zoom/2)", cy = "ih/2-(ih/zoom/2)";
  const variants = [
    { z: zc(1.22), x: cx, y: cy },                          // zoom-in center
    { z: zc(1.12), x: `(iw-iw/zoom)*${s}`, y: cy },         // pan right (+zoom)
    { z: zc(1.12), x: `(iw-iw/zoom)*(1-${s})`, y: cy },     // pan left
    { z: zc(1.14), x: cx, y: `(ih-ih/zoom)*(1-${s})` },     // pan up
    { z: zc(1.14), x: cx, y: `(ih-ih/zoom)*${s}` },         // pan down
    { z: zc(1.18), x: cx, y: cy },                          // zoom-in
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
