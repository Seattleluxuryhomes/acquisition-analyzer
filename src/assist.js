// Server-side AI translate+structure. The provider key lives only here (hard
// rule #1). Output is validated/sanitized before returning. If the key is unset
// or the call fails, this throws — the client falls back to manual entry (rule #4).
import db from "./db.js";
import { tradeBrain, tradeLabel } from "./trades.js";
// Trade Intelligence Pack: the single source of truth for trade knowledge. The
// estimator's intake checklists now live there (one home, shared with the
// receptionist + website), not inline here.
import { tradeFields } from "./tradePacks.js";

// Display names (native) used to tell the AI which languages to translate
// between. The AI can translate any language; this just drives the picker and
// the prompt. Keep keys in sync with public/index.html LANGS + SPEECH_LANG.
const LANGS = {
  en: "English", es: "Spanish", zh: "Chinese", hi: "Hindi", ar: "Arabic", bn: "Bengali",
  pt: "Portuguese", ru: "Russian", ja: "Japanese", pa: "Punjabi", de: "German", ko: "Korean",
  fr: "French", te: "Telugu", mr: "Marathi", ta: "Tamil", tr: "Turkish", vi: "Vietnamese",
  ur: "Urdu", it: "Italian", gu: "Gujarati", pl: "Polish", uk: "Ukrainian", fa: "Persian",
  kn: "Kannada", ml: "Malayalam", th: "Thai", nl: "Dutch", id: "Indonesian",
  ms: "Malay", tl: "Filipino", sw: "Swahili", ro: "Romanian", el: "Greek",
  cs: "Czech", hu: "Hungarian", sv: "Swedish", he: "Hebrew", da: "Danish", fi: "Finnish",
  no: "Norwegian", sk: "Slovak", hr: "Croatian", sr: "Serbian", bg: "Bulgarian",
  lt: "Lithuanian", sl: "Slovenian", lv: "Latvian", et: "Estonian", af: "Afrikaans",
  sq: "Albanian", am: "Amharic", hy: "Armenian", az: "Azerbaijani", ka: "Georgian",
  kk: "Kazakh", ne: "Nepali", si: "Sinhala", km: "Khmer", lo: "Lao", my: "Burmese",
  mn: "Mongolian", is: "Icelandic", ga: "Irish", cy: "Welsh", eu: "Basque",
  gl: "Galician", ca: "Catalan", ps: "Pashto", so: "Somali", ha: "Hausa", yo: "Yoruba",
  ig: "Igbo", zu: "Zulu", xh: "Xhosa"
};

// Cost guardrails (hard rule / spec §7, §13): per-user monthly cap + light rate limit.
const MONTHLY_CAP = Number(process.env.BT_AI_MONTHLY_CAP || 2000);
const recentCalls = new Map(); // userId -> [timestamps]
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = Number(process.env.BT_AI_RATE_MAX || 40); // voice-first does many small calls (record + live intake); keep headroom so a demo doesn't trip the per-minute limit

function checkRate(userId) {
  const now = Date.now();
  const arr = (recentCalls.get(userId) || []).filter((t) => now - t < RATE_WINDOW);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  recentCalls.set(userId, arr);
  return true;
}

function checkMonthlyCap(user) {
  // Founder/admin is never capped — heavy testing must never silence the AI.
  const admin = (process.env.BT_ADMIN_EMAIL || "").trim().toLowerCase();
  if (admin && String((user && user.email) || "").toLowerCase() === admin) return true;
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  let count = user.ai_calls_month;
  if (user.ai_calls_period !== period) count = 0;
  if (count >= MONTHLY_CAP) return false;
  db.prepare("UPDATE user SET ai_calls_month=?, ai_calls_period=? WHERE id=?")
    .run(count + 1, period, user.id);
  return true;
}

const UNIT_LIST = ["each", "sq ft", "ln ft", "sq yd", "cu yd", "ton", "gal", "hr", "box", "roll", "pallet", "board ft", "slab"];

function buildSystemPrompt(from, to, priceBook, trade) {
  const brain = tradeBrain(trade);
  return (
    "You are an estimating assistant for construction contractors. Translate the " +
    "field conversation and turn it into a structured bid draft. Respond with ONLY " +
    "valid minified JSON, no markdown fences and no commentary, matching exactly: " +
    '{"translation":string,"summary":string,' +
    '"brief":{"project_type":string,"scope":[string],"materials":[string],"customer_supplied":[string],"timeline":string,"budget":string,"labor":string},' +
    '"lines":[{"section":string,"desc":string,' +
    '"type":"fixed"|"hourly"|"unit","price":number,"hours":number,"rate":number,"qty":number,"unit":string}],' +
    '"assumptions":[string],"exclusions":[string],"upgrades":[{"desc":string,"price":number}]}. ' +
    "BRIEF: a short structured read-back of the job for the CONTRACTOR (never shown to the " +
    "client). project_type = the kind of job (e.g. \"Kitchen remodel\"). scope = 2-6 short bullet " +
    "phrases of the work to be done. materials = the key materials named. customer_supplied = " +
    "items the client will supply themselves ([] if none). timeline = any dates/deadline mentioned, " +
    "else \"Not specified\". budget = a stated budget figure or \"Pending\". labor = crew/labor notes " +
    "or \"Not specified\". Keep every brief value short; use only facts from the conversation, never invent. " +
    "Rules: at most 12 lines, at most 4 upgrades. Group the work by room or area: put the room/area " +
    "name (e.g. \"Bathroom\", \"Kitchen\") in each line's \"section\". Keep different rooms in " +
    "different sections — never merge two rooms into one line. If the whole job is one area, use a " +
    "single section name or leave \"section\" empty. " +
    "LINE TYPES: 'fixed' = a flat price (set price; hours/rate/qty 0). 'hourly' = labor by time (set " +
    "hours and rate; price 0). 'unit' = work measured by area/length/count — square feet, linear " +
    "feet, slabs, each, etc. For 'unit' set qty (the measured amount), unit (one of: " + UNIT_LIST.join(", ") +
    ") and rate (price per unit); set price 0. Example: \"220 square feet of tile at 12 a foot\" -> " +
    "{type:\"unit\",qty:220,unit:\"sq ft\",rate:12}. Prefer 'unit' whenever a measurement and a " +
    "per-unit price are mentioned. NEVER pre-multiply qty by rate. " +
    "PRICING: if the conversation states a price, use that exact number — never replace a stated " +
    "price with a guess. Only invent a rough USD placeholder when no price is given. If a price is " +
    "noted as plus tax, add that as an assumption. If the client supplies a material, add it as an " +
    "exclusion. " +
    "LANGUAGE: write section names, line descriptions, assumptions and exclusions in correct, " +
    "professional trade terminology — the words an experienced estimator puts on a real bid (e.g. " +
    "tear-off, rough-in, service upgrade, footings, squares) — clear enough for a homeowner but never " +
    "generic or amateur. " +
    (brain
      ? "TRADE FOCUS — this is a " + (tradeLabel(trade) || trade) + " job. Apply this trade's takeoff " +
        "method, derive quantities, and include the right line items, assumptions and exclusions:\n" + brain + "\n" +
        "Still use any prices stated in the conversation; trade math fills the gaps the contractor didn't say.\n"
      : "") +
    (priceBook
      ? "PRICE BOOK — the contractor's real items (name | unit | unit_price). When a line clearly " +
        "matches one, use that item's exact unit and unit_price as the rate (type 'unit'):\n" + priceBook + "\n"
      : "") +
    "Translate from " + (LANGS[from] || from) + " to " + (LANGS[to] || to) + ". The \"translation\" " +
    "field is the conversation rendered in " + (LANGS[to] || to) + "."
  );
}

function sanitize(data) {
  const num = (n) => Number(n) || 0;
  const unitSet = new Set(UNIT_LIST);
  const lines = (Array.isArray(data.lines) ? data.lines : []).slice(0, 12).map((l) => {
    const u = String(l.unit || "").toLowerCase().trim();
    return {
      section: String(l.section || "").slice(0, 80),
      desc: String(l.desc || "").slice(0, 200),
      type: ["hourly", "unit"].includes(l.type) ? l.type : "fixed",
      price: num(l.price), hours: num(l.hours), rate: num(l.rate),
      qty: num(l.qty), unit: unitSet.has(u) ? u : (l.type === "unit" ? "each" : ""),
    };
  });
  const briefList = (a) => (Array.isArray(a) ? a : []).slice(0, 8).map((s) => String(s).slice(0, 160)).filter(Boolean);
  const b = data.brief && typeof data.brief === "object" ? data.brief : {};
  const brief = {
    project_type: String(b.project_type || "").slice(0, 120),
    scope: briefList(b.scope),
    materials: briefList(b.materials),
    customer_supplied: briefList(b.customer_supplied),
    timeline: String(b.timeline || "").slice(0, 160),
    budget: String(b.budget || "").slice(0, 160),
    labor: String(b.labor || "").slice(0, 200),
  };
  return {
    translation: String(data.translation || ""),
    summary: String(data.summary || ""),
    brief,
    lines,
    assumptions: (Array.isArray(data.assumptions) ? data.assumptions : []).map((s) => String(s).slice(0, 300)),
    exclusions: (Array.isArray(data.exclusions) ? data.exclusions : []).map((s) => String(s).slice(0, 300)),
    upgrades: (Array.isArray(data.upgrades) ? data.upgrades : []).slice(0, 4).map((u) => ({
      desc: String(u.desc || "").slice(0, 200), price: num(u.price),
    })),
  };
}

function parseModelJSON(txt) {
  let t = String(txt || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(t); }
  catch {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("Could not parse a bid draft from the AI response.");
  }
}

export function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Universal voice: record audio in the browser, transcribe server-side. When
// configured this is the primary dictation path on EVERY device (iPhone, Android,
// desktop) — the most accurate option and the only one iOS Safari supports. The
// browser's live Web Speech API is just a fallback when this isn't configured.
// Optional/env-gated like everything else (OPENAI_API_KEY → Whisper).
export function transcribeConfigured() {
  return !!process.env.OPENAI_API_KEY;
}
const AUDIO_EXT = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "video/mp4": "mp4",
  "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/m4a": "m4a", "audio/aac": "m4a" };

export async function transcribeAudio(user, { audio, lang }) {
  if (!transcribeConfigured()) { const e = new Error("Voice transcription isn't configured on the server."); e.status = 503; e.code = "TRANSCRIBE_UNCONFIGURED"; throw e; }
  const m = /^data:([\w.+-]+\/[\w.+-]+)(?:;[\w.+=-]+)*;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(audio || ""));
  if (!m || !AUDIO_EXT[m[1]]) { const e = new Error("No audio to transcribe."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many recordings in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached. You can still type."); e.status = 429; throw e; }

  const buf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  if (buf.length < 600 || buf.length > 24 * 1024 * 1024) { const e = new Error("Recording is empty or too large."); e.status = 400; throw e; }
  const form = new FormData();
  form.append("file", new Blob([buf], { type: m[1] }), "audio." + AUDIO_EXT[m[1]]);
  form.append("model", process.env.BT_TRANSCRIBE_MODEL || "whisper-1");
  const iso = String(lang || "").slice(0, 2).toLowerCase();
  if (/^[a-z]{2}$/.test(iso)) form.append("language", iso); // ISO-639-1 improves accuracy
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY }, body: form,
    });
  } catch { const e = new Error("Could not reach the transcription provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("Transcription error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json().catch(() => null);
  return { text: String((out && out.text) || "").trim() };
}

// "See it in their kitchen": render a price-book material onto the surfaces in a
// client's room photo using OpenAI's image model (gpt-image-1 edits). Reuses the
// SAME OPENAI_API_KEY as voice — pay per image, no subscription. The SKU's own
// photo is passed as a second reference so the color/veining matches. Returns PNG.
export function visualizeConfigured() {
  return !!process.env.OPENAI_API_KEY;
}
export async function visualizeRoom(user, { roomImage, materialBuffer, materialMime, materialName, surface }) {
  if (!visualizeConfigured()) { const e = new Error("AI visualization isn't configured on the server."); e.status = 503; e.code = "VIZ_UNCONFIGURED"; throw e; }
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(roomImage || ""));
  if (!m) { const e = new Error("Add a photo of the room first."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many renders in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const roomBuf = Buffer.from(m[2].replace(/\s+/g, ""), "base64");
  if (roomBuf.length < 1000 || roomBuf.length > 12 * 1024 * 1024) { const e = new Error("Room photo is empty or too large."); e.status = 400; throw e; }

  const what = (String(surface || "countertops").toLowerCase().replace(/[^a-z ]/g, "") || "countertops").slice(0, 40);
  const mat = (String(materialName || "the selected material").trim()).slice(0, 80);
  const prompt =
    `Photorealistic interior visualization. The first image is a real room. Replace ONLY the ${what} ` +
    `with ${mat}` + (materialBuffer ? `, whose exact color, pattern and veining are shown in the second image` : "") + `. ` +
    `Keep everything else identical — cabinets, flooring, walls, windows, appliances, sink, faucet, fixtures, decor, ` +
    `lighting, shadows, and the exact camera angle and perspective. The new ${what} must look naturally installed ` +
    `with correct edges, thickness, seams and realistic reflections. Change nothing except the ${what}.`;

  const extOf = (t) => (t.includes("png") ? "png" : t.includes("webp") ? "webp" : "jpg");
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("image[]", new Blob([roomBuf], { type: m[1] }), "room." + extOf(m[1]));
  if (materialBuffer && materialBuffer.length) {
    const mt = materialMime || "image/jpeg";
    form.append("image[]", new Blob([materialBuffer], { type: mt }), "material." + extOf(mt));
  }
  form.append("prompt", prompt.slice(0, 2000));
  form.append("size", "auto");
  form.append("quality", process.env.BT_VIZ_QUALITY || "medium"); // low|medium|high — cost vs fidelity
  form.append("input_fidelity", "high"); // preserve the rest of the room
  form.append("n", "1");

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: "Bearer " + process.env.OPENAI_API_KEY }, body: form,
    });
  } catch { const e = new Error("Could not reach the image provider."); e.status = 502; throw e; }
  if (!res.ok) {
    let detail = ""; try { const j = await res.json(); if (j && j.error && j.error.message) detail = " — " + j.error.message; } catch {}
    const e = new Error("Visualization error (" + res.status + ")" + detail); e.status = res.status === 400 ? 400 : 502; throw e;
  }
  const out = await res.json().catch(() => null);
  const b64 = out && out.data && out.data[0] && out.data[0].b64_json;
  if (!b64) { const e = new Error("No image came back from the render."); e.status = 502; throw e; }
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

// ---- Price book: organize a contractor's uploaded SKUs (text/CSV or a photo) ----
const SKU_UNITS = ["each", "sq ft", "ln ft", "sq yd", "cu yd", "ton", "gal", "hr", "box", "roll", "pallet", "board ft", "slab"];

function skuSystemPrompt() {
  return (
    "You organize a contractor's price list into a clean catalog of SKUs. The input " +
    "is a pasted list, a CSV, or a PHOTO of a supplier price sheet. Respond with ONLY " +
    'valid minified JSON, no markdown, matching exactly: {"items":[{"name":string,' +
    '"sku_code":string,"category":string,"unit":string,"unit_price":number}]}. Rules: ' +
    "Make ONE item per priced product. If a product lists several prices in columns " +
    "(e.g. thickness 3cm vs 2cm, or sizes), make a SEPARATE item for each priced cell and " +
    "put that variant in the name, e.g. \"Calacatta Lithos 3cm\". Skip cells with no price " +
    "(a dash, blank, or \"call\"). unit_price is the number in USD (no $ or commas). Infer " +
    "\"unit\" as one of: " + SKU_UNITS.join(", ") + " (a stone/quartz slab is \"slab\"; " +
    "flooring/tile by area is \"sq ft\"; trim is \"ln ft\"; most items are \"each\"). Set " +
    "\"category\" to the material or product type, optionally with the supplier/brand, e.g. " +
    "\"Quartz Slab (Lithos)\". \"sku_code\" only if a code is shown, else empty. Never invent " +
    "prices; use exactly what's shown. Ignore surcharge/delivery/disclaimer footnotes. Return " +
    "up to 400 items."
  );
}

function sanitizeSkus(data) {
  const unitSet = new Set(SKU_UNITS);
  const items = (Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : []).slice(0, 400).map((s) => {
    const unit = String(s.unit || "each").toLowerCase().trim();
    return {
      name: String(s.name || "").trim().slice(0, 160),
      sku_code: String(s.sku_code || s.code || "").trim().slice(0, 60),
      category: String(s.category || "").trim().slice(0, 80),
      unit: unitSet.has(unit) ? unit : "each",
      unit_price: Math.max(0, Number(s.unit_price ?? s.price) || 0),
    };
  }).filter((s) => s.name);
  return { items };
}

// Accepts { text } (paste/CSV) or { image } (a data: URL of a price-sheet photo).
export async function parseSkus(user, { text, image }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const hasText = !!String(text || "").trim();
  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(image || ""));
  if (!hasText && !m) { const e = new Error("Paste a list or add a photo of your price sheet."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many uploads in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached. You can still add SKUs by hand."); e.status = 429; throw e; }

  const content = [];
  if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2].replace(/\s+/g, "") } });
  content.push({ type: "text", text: hasText ? ("PRICE LIST:\n" + text) : "Organize the SKUs in this price sheet image." });

  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4000, system: skuSystemPrompt(), messages: [{ role: "user", content }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitizeSkus(parseModelJSON(txt));
}

// ---- AI Material Scanner ----------------------------------------------------
// Snap a photo of a room/exterior; identify the materials & finishes a contractor
// would need to spec or match for a bid. Doesn't need to be perfect — it saves the
// pro from typing. EVERY category below is always considered so nothing is missed.
const SCAN_CATEGORIES = [
  "Paint", "Flooring", "Tile", "Fixtures", "Light fixtures",
  "Windows", "Molding & trim", "Doors", "Roofing", "Landscaping", "Other",
];
function scanSystemPrompt() {
  return (
    "You are a construction material identifier helping a contractor build a bid from a photo. " +
    "Look at the image and identify the visible MATERIALS and FINISHES across these categories — " +
    "consider EVERY one, and only include a category if something for it is actually visible:\n" +
    "🎨 Paint · 🪵 Flooring · 🧱 Tile · 🚰 Fixtures (plumbing: faucets, sinks, toilets, tubs) · " +
    "💡 Light fixtures · 🪟 Windows · 〰️ Molding & trim · 🚪 Doors · 🏠 Roofing · 🌿 Landscaping.\n" +
    "Respond with ONLY valid minified JSON, no markdown: " +
    '{"materials":[{"category":string,"item":string,"spec":string,"confidence":"low"|"med"|"high","note":string}],"summary":string}. ' +
    "category = EXACTLY one of: " + SCAN_CATEGORIES.join(", ") + " (use \"Other\" for anything not covered, e.g. cabinets/countertops/siding/insulation). " +
    "item = a short material name a contractor would write on a bid (e.g. \"Luxury vinyl plank flooring\", \"3-tab asphalt shingles\", \"Satin interior wall paint\"). " +
    "spec = the useful detail to spec or match: color family, finish, material, profile, or style (e.g. \"Wood-look LVP, ~7in planks, warm gray\"; \"Matte white subway tile 3x6\"). " +
    "confidence = how sure you are from the photo alone. note = a SHORT bid tip when helpful (e.g. \"measure floor SF\", \"looks like brushed nickel\") or empty. " +
    "Identify what you can SEE — it's fine to be approximate (this saves the pro time, it isn't a lab result), but never invent items that aren't visible. " +
    "List the most prominent materials first; at most 20 items. summary = one short line on the space (e.g. \"Updated kitchen — LVP, quartz, shaker cabinets\")."
  );
}
function sanitizeScan(data) {
  const catSet = new Set(SCAN_CATEGORIES);
  const conf = new Set(["low", "med", "high"]);
  const materials = (Array.isArray(data.materials) ? data.materials : []).slice(0, 20).map((mm) => {
    let category = String(mm.category || "Other").trim();
    if (!catSet.has(category)) category = "Other";
    let c = String(mm.confidence || "med").toLowerCase().trim();
    if (!conf.has(c)) c = "med";
    return {
      category,
      item: String(mm.item || "").trim().slice(0, 120),
      spec: String(mm.spec || "").trim().slice(0, 160),
      confidence: c,
      note: String(mm.note || "").trim().slice(0, 120),
    };
  }).filter((mm) => mm.item);
  return { materials, summary: String(data.summary || "").trim().slice(0, 200), categories: SCAN_CATEGORIES };
}

// Identify materials in a photo. Accepts { image } as a data: URL (jpeg/png/webp).
export async function scanMaterials(user, { image }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(image || ""));
  if (!m) { const e = new Error("Add a clear photo to scan."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many scans in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached. You can still add materials by hand."); e.status = 429; throw e; }

  const content = [
    { type: "image", source: { type: "base64", media_type: m[1], data: m[2].replace(/\s+/g, "") } },
    { type: "text", text: "Identify the materials and finishes in this photo for a contractor's bid." },
  ];
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1500, system: scanSystemPrompt(), messages: [{ role: "user", content }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitizeScan(parseModelJSON(txt));
}

// ---- Living website: AI writes the contractor's site copy from their profile ----
// The first piece of content the contractor never has to write. Returns a hero
// tagline + a professional "About" paragraph. Grounded in profile facts only — it
// must NOT fabricate years in business, awards, review counts, or credentials.
function siteCopySystemPrompt() {
  return (
    "You are a copywriter for a home-services contractor's website. Using ONLY the facts provided, " +
    "write warm, professional, trustworthy marketing copy a homeowner would trust. Respond with ONLY " +
    "valid minified JSON, no markdown: {\"tagline\":string,\"about\":string}. " +
    "tagline = a punchy hero headline, <= 80 chars, benefit-led (e.g. \"Site prep & grading done right — on time, on budget\"). " +
    "about = a 2-3 sentence About paragraph, <= 420 chars, first-person-plural (\"we\"), mentioning the trade(s) and service area naturally. " +
    "STRICT: do NOT invent years in business, number of jobs, awards, certifications, review counts, or any claim not given. " +
    "If licensed is indicated, you may say \"licensed and insured\". No emojis, no hashtags, no ALL CAPS."
  );
}
export async function generateSiteCopy(user, { company, services, region, licensed } = {}) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many requests in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const facts = [
    company ? `Company: ${company}` : "",
    (Array.isArray(services) && services.length) ? `Services: ${services.join(", ")}` : "",
    region ? `Service area: ${region}` : "",
    licensed ? "Licensed and insured: yes" : "",
  ].filter(Boolean).join("\n") || "A residential contractor.";
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 600, system: siteCopySystemPrompt(), messages: [{ role: "user", content: "FACTS:\n" + facts }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const data = parseModelJSON(txt) || {};
  return {
    tagline: String(data.tagline || "").trim().slice(0, 100),
    about: String(data.about || "").trim().slice(0, 500),
  };
}

// Living website: AI writes an SEO-friendly project write-up when a contractor
// publishes a finished job to their website. Grounded in the job facts; must not
// invent details, prices, or the customer's name/address.
function projectWriteupSystemPrompt() {
  return (
    "You write short SEO-friendly project descriptions for a contractor's website portfolio. " +
    "Given a completed job's facts, write a title and a 2-3 sentence description a prospective " +
    "customer would find reassuring and that helps the page rank for the trade + area. Respond with " +
    "ONLY valid minified JSON, no markdown: {\"title\":string,\"description\":string}. " +
    "title = a concise project title with the trade and area if given (<= 90 chars, e.g. \"Cedar Fence Installation in Ballard\"). " +
    "description = <= 360 chars, third person, factual, benefit-led. " +
    "STRICT: do NOT include the customer's name, street address, or price. Do NOT invent materials, " +
    "measurements, durations, or claims not provided. No emojis, no hashtags."
  );
}
export async function generateProjectWriteup(user, { trade, jobTitle, area, scope } = {}) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Too many requests in a short window — wait a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const facts = [
    trade ? `Trade: ${trade}` : "",
    jobTitle ? `Job: ${jobTitle}` : "",
    area ? `Area: ${area}` : "",
    (Array.isArray(scope) && scope.length) ? `Work done:\n- ${scope.slice(0, 12).join("\n- ")}` : "",
  ].filter(Boolean).join("\n") || "A completed residential project.";
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 500, system: projectWriteupSystemPrompt(), messages: [{ role: "user", content: "FACTS:\n" + facts }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const data = parseModelJSON(txt) || {};
  return { title: String(data.title || "").trim().slice(0, 140), description: String(data.description || "").trim().slice(0, 400) };
}

// Approval Inbox: AI drafts a short, friendly review-request message the contractor
// approves and sends. Grounded — no fabricated details, no fake urgency.
export async function generateReviewRequest(user, { customer, jobTitle, company } = {}) {
  if (!aiConfigured()) { const e = new Error("AI not configured."); e.code = "AI_UNCONFIGURED"; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Slow down a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const sys = "You write a short, warm review-request text message for a contractor to send a happy customer. " +
    "ONE message, 2-3 sentences, first person, friendly, no emojis, no links (the contractor adds the link). " +
    "Thank them, ask if they'd leave a quick review, keep it low-pressure. Return ONLY the message text, no quotes, no preamble.";
  const facts = `Contractor: ${company || "the contractor"}\nCustomer: ${customer || "the customer"}\nJob: ${jobTitle || "their project"}`;
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 300, system: sys, messages: [{ role: "user", content: facts }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error."); e.status = 502; throw e; }
  const out = await res.json();
  return (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim().slice(0, 500);
}

// AI Funnel: draft a fast, friendly first reply to a new lead, weaving in 2-3
// suggested appointment windows. Grounded; no fabricated claims or pricing.
export async function generateLeadFollowup(user, { lead, times, company } = {}) {
  if (!aiConfigured()) { const e = new Error("AI not configured."); e.code = "AI_UNCONFIGURED"; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Slow down a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const sys = "You write the FIRST reply a contractor sends a new lead who just requested an estimate. " +
    "Warm, prompt, professional; 2-4 sentences. Thank them, reference their project if given, and propose the " +
    "appointment windows provided so they can pick one. No emojis, no pricing, no fabricated claims. " +
    "Return ONLY the message text — no quotes, no preamble.";
  const facts = `Contractor: ${company || "the contractor"}\nLead name: ${lead?.name || "there"}\n` +
    `Project: ${lead?.job_type || lead?.message || "their project"}\nSuggested windows:\n- ${(times || []).join("\n- ")}`;
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 360, system: sys, messages: [{ role: "user", content: facts }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error."); e.status = 502; throw e; }
  const out = await res.json();
  return (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim().slice(0, 700);
}

// AI Funnel: an offer-led hero headline + subhead from a service + offer. Research
// says lead with the OFFER ("Free Roof Inspection"), not the business.
export async function generateFunnelHeadline(user, { service, offer, company } = {}) {
  if (!aiConfigured()) { const e = new Error("AI not configured."); e.code = "AI_UNCONFIGURED"; throw e; }
  if (!checkRate(user.id)) { const e = new Error("Slow down a moment."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const sys = "You write a high-converting landing-page hero for a contractor. Lead with the OFFER and the " +
    "benefit, not the business name. Respond with ONLY valid minified JSON: {\"headline\":string,\"subhead\":string}. " +
    "headline <= 70 chars, offer-led (e.g. \"Free Roof Inspection — Booked in 60 Seconds\"). subhead <= 120 chars, " +
    "reinforces speed/trust. No fabricated claims, no fake urgency, no emojis.";
  const facts = `Company: ${company || "the contractor"}\nService: ${service || "home services"}\nOffer: ${offer || "Free estimate"}`;
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 300, system: sys, messages: [{ role: "user", content: facts }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error."); e.status = 502; throw e; }
  const out = await res.json();
  const data = parseModelJSON((out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n")) || {};
  return { headline: String(data.headline || "").trim().slice(0, 140), subhead: String(data.subhead || "").trim().slice(0, 200) };
}

// Compact price-book string for the prompt (cap so it never blows the token budget).
function priceBookText(skus) {
  if (!Array.isArray(skus) || !skus.length) return "";
  return skus.slice(0, 150).map((s) => `${s.name} | ${s.unit || "each"} | $${s.unit_price || 0}`).join("\n");
}

export async function assistBuild(user, { text, from_lang, to_lang, skus, trade }) {
  if (!aiConfigured()) {
    const e = new Error("AI build is not configured on the server.");
    e.status = 503; e.code = "AI_UNCONFIGURED"; throw e;
  }
  if (!String(text || "").trim()) {
    const e = new Error("No conversation text provided."); e.status = 400; throw e;
  }
  if (!checkRate(user.id)) {
    const e = new Error("Too many builds in a short window — wait a moment and retry."); e.status = 429; throw e;
  }
  if (!checkMonthlyCap(user)) {
    const e = new Error("Monthly AI build limit reached. You can still build bids by hand."); e.status = 429; throw e;
  }

  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  const system = buildSystemPrompt(from_lang, to_lang, priceBookText(skus), trade);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model, max_tokens: 2000, system,
        messages: [{ role: "user", content: "CONVERSATION:\n" + text }],
      }),
    });
  } catch {
    const e = new Error("Could not reach the AI provider."); e.status = 502; throw e;
  }
  if (!res.ok) {
    const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e;
  }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitize(parseModelJSON(txt));
}

// "You're missing money" — review a DRAFT bid against the trade's standard scope
// and flag (a) line items this trade's bids usually include but this one is missing
// (caught profit) and (b) upsell/add-on opportunities. Uses the same trade brain as
// the build, so the standards it checks against are the trade's real ones.
function reviewSystemPrompt(trade) {
  const brain = tradeBrain(trade);
  return (
    "You review a contractor's DRAFT bid for COMPLETENESS and PROFIT — like a sharp " +
    "estimator looking over their shoulder. You are given the trade and the current " +
    "line items. Find what's MISSING (line items this trade's bids almost always " +
    "include but this draft doesn't — caught money the contractor would otherwise eat) " +
    "and worthwhile UPSELLS (add-ons or better options to offer the client). Respond " +
    "with ONLY valid minified JSON, no markdown: {\"recommendations\":[{\"type\":" +
    "\"missing\"|\"upsell\",\"item\":string,\"reason\":string,\"impact\":string}]}. " +
    "item = a short line-item name to add. reason = one short clause why it matters " +
    "(e.g. \"most roofing bids include this; left off, you eat the cost\"). impact = a " +
    "SHORT note on profit/cost effect (e.g. \"~$300–600\" or \"protects your margin\"; " +
    "never a hard promise). Only suggest items genuinely standard for this trade or " +
    "clearly implied by the scope — do NOT invent client-specific facts or random " +
    "padding. If the work plainly requires a PERMIT (structural, electrical, plumbing, " +
    "mechanical, grading/earthwork, demolition, additions) and no permit or permit fee " +
    "appears in the draft, flag it as a 'missing' item (\"Permit & fee\") — permits are " +
    "one of the most commonly forgotten costs. At most 6 recommendations, most important " +
    "first. If the bid looks complete, return an empty array. " +
    (brain ? "TRADE STANDARD — check the draft against this trade's normal scope:\n" + brain + "\n" : "")
  );
}
function sanitizeReview(data) {
  const recs = (Array.isArray(data.recommendations) ? data.recommendations : []).slice(0, 6).map((r) => ({
    type: r.type === "upsell" ? "upsell" : "missing",
    item: String(r.item || "").slice(0, 120),
    reason: String(r.reason || "").slice(0, 200),
    impact: String(r.impact || "").slice(0, 60),
  })).filter((r) => r.item);
  return { recommendations: recs };
}
export async function reviewBid(user, { trade, lines, text }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const list = (Array.isArray(lines) ? lines : []).map((l) => "- " + String(l.desc || "").slice(0, 120) + (l.section ? " [" + l.section + "]" : "")).join("\n");
  if (!list.trim() && !String(text || "").trim()) { const e = new Error("Add some line items first, then check the bid."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("One moment — too many checks at once."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; throw e; }
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  const content = "CURRENT BID LINE ITEMS:\n" + (list || "(none yet)") + (text ? "\n\nJOB NOTES:\n" + String(text).slice(0, 4000) : "");
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1100, system: reviewSystemPrompt(trade), messages: [{ role: "user", content }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitizeReview(parseModelJSON(txt));
}

// Voice-first intake: read the contractor's spoken job description and pull out the
// structured fields that auto-fill the New Job screen — client, address, scope,
// materials, labor, timeline, notes, an auto project name, and follow-up questions.
// Lightweight + frequent (runs as they talk), so it's rate-limited but does NOT
// burn the monthly build cap.
// Trade-specific intake checklists now live in the Trade Intelligence Pack
// (src/tradePacks.js) — one source of truth shared with the receptionist + website.

function intakeSystemPrompt(tradeLabel, fields) {
  return (
    "You are an experienced estimator interviewing a contractor about a job — one question at a time — to " +
    "gather everything needed for a professional, accurate estimate. " +
    (tradeLabel ? "Trade: " + tradeLabel + ". " : "") +
    "Respond with ONLY valid minified JSON, no markdown, matching exactly: " +
    '{"project_name":string,"client":string,"address":string,"scope":[string],"materials":[string],' +
    '"labor":[string],"timeline":string,"notes":string,' +
    '"checklist":[{"label":string,"value":string,"status":"captured"|"missing"|"unsure"}],' +
    '"next_question":string,"ready":boolean,"questions":[string]}. ' +
    "CHECKLIST: assess each of these items for THIS job — " + JSON.stringify(fields) + ". For each item " +
    "relevant to this job, output {label, value, status}: \"captured\" (with a short value the contractor " +
    "gave), \"missing\" (not stated yet), or \"unsure\" (the contractor said they don't know / it needs to " +
    "be measured later). Skip items clearly irrelevant to this job. Keep each value short. " +
    "NEXT_QUESTION: the SINGLE most important still-missing item, phrased as one short, natural spoken " +
    "question (e.g. \"About how tall will the fence be?\"). Empty string when nothing important is missing. " +
    "Ask the MINIMUM questions needed — never ask about something already captured or flagged unsure, and " +
    "never ask filler. READY: true only when every critical item is captured OR flagged unsure (you have " +
    "enough to produce an accurate estimate; unsure items get flagged for review). " +
    "Also fill the structured fields from the conversation: client = customer name if stated (else \"\"), " +
    "address (else \"\"), scope = short work phrases, materials named, labor/crew tasks, timeline, notes = " +
    "anything else useful (put unsure/to-measure items here too). questions = up to 3 still-open items. " +
    "project_name = client + main work, else address, else main scope. Use ONLY facts stated — never invent. " +
    "VOICE: write every question, label and value the way a seasoned " + (tradeLabel || "construction") +
    " estimator talks on a job walk — correct, professional trade terminology (e.g. rough-in / trim-out, " +
    "tear-off, squares, service upgrade, footings, bank vs loose yards, full-frame vs retrofit, spoils / " +
    "haul-off), never vague consumer phrasing. Keep questions short and natural."
  );
}
function sanitizeIntake(d) {
  const list = (a) => (Array.isArray(a) ? a : []).slice(0, 8).map((s) => String(s).slice(0, 160)).filter(Boolean);
  d = d && typeof d === "object" ? d : {};
  const checklist = (Array.isArray(d.checklist) ? d.checklist : []).slice(0, 24).map((c) => ({
    label: String((c && c.label) || "").slice(0, 80),
    value: String((c && c.value) || "").slice(0, 120),
    status: ["captured", "unsure", "missing"].includes(c && c.status) ? c.status : "missing",
  })).filter((c) => c.label);
  return {
    project_name: String(d.project_name || "").slice(0, 120),
    client: String(d.client || "").slice(0, 120),
    address: String(d.address || "").slice(0, 200),
    scope: list(d.scope),
    materials: list(d.materials),
    labor: list(d.labor),
    timeline: String(d.timeline || "").slice(0, 160),
    notes: String(d.notes || "").slice(0, 600),
    checklist,
    next_question: String(d.next_question || "").slice(0, 240),
    ready: !!d.ready,
    questions: list(d.questions),
  };
}
// ===========================================================================
// Bid Brain Chat — the contractor's always-on AI operations manager.
// A continuous, context-aware conversation grounded in THEIR business snapshot
// (jobs, customers, statuses, markup) so it can recall specifics ("that kitchen
// remodel" → "Maria Martinez on Main St, proposal still unsigned") and suggest
// the next best action. Snapshot is the contractor's own data, scoped to their
// user_id upstream. Never invents facts. If AI is down or capped, the route
// falls back to localBrainReply so the companion still answers (rule #4).
// ===========================================================================
const BRAIN_ACTIONS = ["create_estimate", "continue_estimate", "find_customer", "schedule", "order_materials", "followups"];

function snapshotText(s) {
  s = s || {};
  const c = s.counts || {};
  const lines = [];
  if (s.company) lines.push(`Contractor: ${s.company}`);
  lines.push(`Right now: ${c.activeEstimates || 0} active estimate(s) being built, ${c.awaitingSignature || 0} sent and awaiting signature, ${c.followupsDue || 0} follow-up(s) due (sent >3 days ago).`);
  if (s.typical_markup != null) lines.push(`Typical markup: ${s.typical_markup}%.`);
  if (s.last_trade) lines.push(`Most recent trade: ${s.last_trade}.`);
  if (Array.isArray(s.recent_customers) && s.recent_customers.length) lines.push(`Recent customers: ${s.recent_customers.join(", ")}.`);
  if (Array.isArray(s.jobs) && s.jobs.length) {
    lines.push("Recent jobs (most recent first):");
    for (const j of s.jobs.slice(0, 12)) {
      const bits = [
        j.customer || "(no customer name)",
        j.title ? `“${j.title}”` : "",
        j.address ? `at ${j.address}` : "",
        `status ${j.status}`,
        j.total ? `~$${j.total.toLocaleString("en-US")}` : "",
        j.scheduled ? `scheduled ${j.scheduled}` : "",
        (j.status === "sent" && j.ageDays >= 0) ? `sent ${j.ageDays}d ago` : "",
      ].filter(Boolean).join(" · ");
      lines.push(`- [${j.id}] ${bits}`);
    }
  } else {
    lines.push("No jobs yet — this contractor is just getting started.");
  }
  return lines.join("\n");
}

function brainChatSystemPrompt(snapshot, now) {
  return (
    "You are Bid Brain — the AI right hand built into the app for a residential contractor. " +
    "You are not a generic chatbot; you are their sharp, friendly right hand who remembers their whole business " +
    "and helps them win and run jobs. Speak in short, warm, plain sentences (1–4 sentences, no bullet dumps, no " +
    "markdown). " +
    "PERSONALITY & VOICE: You come across as a warm, easygoing Texas woman — the most capable person in the office. " +
    "Everything you say may be read ALOUD, so it has to sound like a real person talking on the phone: natural " +
    "contractions, plain everyday words, a little unforced Southern warmth. NEVER use AI or corporate filler. " +
    "Banned words/phrases (never say these): hand-wave, hand-waving, delve, leverage, utilize, synergy, navigate, " +
    "furthermore, that said, as an AI, I'm just an, certainly, I'd be happy to, let me go ahead and, in order to. " +
    "Don't narrate your own thinking or hedge in a wordy way — just talk to them like a person would. " +
    "Be proactive: answer what they asked, recall the specific job/customer from the data when they " +
    "refer to one, and when useful suggest the single next best action. " +
    "STRICT GROUNDING: use ONLY the business data below. Never invent customers, jobs, addresses, prices, dates, " +
    "or statuses. If you don't have something, say so plainly and offer to help capture it. Their markup and " +
    "margins are private business numbers — fine to discuss with them, never to be put in front of a client. " +
    "ACTIONS: if the contractor clearly wants the app to DO one of these, append it on its OWN final line as " +
    "[[action:NAME]] — one of: create_estimate, continue_estimate, find_customer, order_materials, " +
    "followups. To pull up a specific job, use [[job:ID]] with the bracketed id from the data. Add at most one " +
    "action/job directive, only when intent is clear, and keep it out of the spoken sentence. No directive for ordinary chat.\n" +
    "SCHEDULING — you can actually schedule, not just point at a calendar. When the contractor asks to schedule " +
    "an appointment/estimate, block time, move an existing appointment, or set a reminder, append ONE directive on " +
    "its own line: [[schedule:{...}]] with minified JSON fields: intent ('create' = a new appointment/estimate, " +
    "'move' = reschedule an existing one, 'block' = hold time, 'reminder' = a task reminder), customer (name if " +
    "given else \"\"), title (short: \"Estimate\", \"Roofing\", \"Order materials\"…), date (\"YYYY-MM-DD\", resolved " +
    "from NOW), time (24-hour \"HH:MM\" or \"\"), address (only if they state one, else \"\"), trade (if clear, else " +
    "\"\"), match (only for 'move' — a short hint identifying which appointment, e.g. \"3 PM\" or the customer name). " +
    "Resolve relative dates (\"tomorrow\", \"Friday\", \"in two weeks\") against NOW. Your spoken sentence should " +
    "confirm it naturally and concretely (e.g. \"Done — estimate with John tomorrow at 2 PM, saved to your schedule.\"). " +
    "If you truly need a date/time and it wasn't given, do NOT emit the directive — ask for it in one short question. " +
    "NOW: " + (now || "unknown") + ".\n\n" +
    "BUSINESS DATA:\n" + snapshotText(snapshot)
  );
}

function sanitizeSchedule(s) {
  if (!s || typeof s !== "object") return null;
  const intent = ["create", "move", "block", "reminder"].includes(s.intent) ? s.intent : "create";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(s.date || "")) ? s.date : "";
  let time = String(s.time || "").trim();
  time = /^\d{1,2}:\d{2}$/.test(time) ? (time.length === 4 ? "0" + time : time) : "";
  return {
    intent,
    customer: String(s.customer || "").slice(0, 120),
    title: String(s.title || "").slice(0, 120),
    date, time,
    address: String(s.address || "").slice(0, 200),
    trade: String(s.trade || "").slice(0, 60),
    match: String(s.match || "").slice(0, 80),
  };
}

function parseBrainReply(txt, snapshot) {
  let reply = String(txt || "").trim();
  let action = null, jobId = null, schedule = null;
  const sm = reply.match(/\[\[schedule:(\{[\s\S]*?\})\]\]/i);
  if (sm) { try { schedule = sanitizeSchedule(JSON.parse(sm[1])); } catch { /* ignore malformed */ } }
  const am = reply.match(/\[\[action:([a-z_]+)\]\]/i);
  if (am && BRAIN_ACTIONS.includes(am[1].toLowerCase())) action = am[1].toLowerCase();
  const jm = reply.match(/\[\[job:([^\]]+)\]\]/i);
  if (jm) { const id = jm[1].trim(); if ((snapshot.jobs || []).some((j) => j.id === id)) { jobId = id; action = "open_job"; } }
  reply = reply.replace(/\[\[(action|job):[^\]]+\]\]/gi, "").replace(/\[\[schedule:\{[\s\S]*?\}\]\]/gi, "").trim();
  return { reply, action, jobId, schedule };
}

// Deterministic fallback so the companion always answers, even with no AI / cap hit.
export function localBrainReply(snapshot, messages) {
  const s = snapshot || {}, c = s.counts || {};
  const last = [...(messages || [])].reverse().find((m) => m.role === "user");
  const q = String((last && last.content) || "").toLowerCase();
  const pending = [];
  if (c.activeEstimates) pending.push(`${c.activeEstimates} active estimate${c.activeEstimates > 1 ? "s" : ""}`);
  if (c.followupsDue) pending.push(`${c.followupsDue} follow-up${c.followupsDue > 1 ? "s" : ""} due`);
  if (c.awaitingSignature) pending.push(`${c.awaitingSignature} awaiting signature`);
  if (/follow|chase|nudge/.test(q)) return { reply: c.followupsDue ? `You have ${c.followupsDue} follow-up${c.followupsDue > 1 ? "s" : ""} that ${c.followupsDue > 1 ? "need" : "needs"} a nudge. Want me to pull ${c.followupsDue > 1 ? "them" : "it"} up?` : "Nothing’s overdue for a follow-up right now — nice and clean.", action: c.followupsDue ? "followups" : null };
  if (/pending|status|what.*(left|open|going)|today/.test(q)) return { reply: pending.length ? `Here’s where things stand: ${pending.join(", ")}.` : "You’re all caught up — no estimates or follow-ups pending.", action: null };
  if (/estimate|bid|quote|new job/.test(q)) return { reply: "Let’s build it. Tap the mic and walk me through the job, or I can start a blank estimate.", action: "create_estimate" };
  if (/customer|client|find|who/.test(q)) return { reply: s.recent_customers && s.recent_customers.length ? `Recent customers: ${s.recent_customers.slice(0, 5).join(", ")}. Want me to open your customer list?` : "Let’s find them in your customer list.", action: "find_customer" };
  return { reply: pending.length ? `I’ve got you. Right now: ${pending.join(", ")}. What do you want to tackle?` : "I’m here. Want to start an estimate, find a customer, or check your follow-ups?", action: null };
}

export async function bidBrainChat(user, { messages, snapshot, now }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const msgs = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") { const e = new Error("Say something to Bid Brain first."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("One moment — let’s not talk over each other."); e.status = 429; throw e; }
  if (!checkMonthlyCap(user)) { const e = new Error("Monthly AI limit reached."); e.status = 429; e.code = "AI_CAPPED"; throw e; }
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 500, system: brainChatSystemPrompt(snapshot || {}, now), messages: msgs }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  const parsed = parseBrainReply(txt, snapshot || {});
  return { reply: parsed.reply || "I’m here — what do you need?", action: parsed.action, jobId: parsed.jobId, schedule: parsed.schedule };
}

export async function assistIntake(user, { text, trade }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const t = String(text || "").trim();
  if (t.length < 8) { const e = new Error("Say a little more about the job first."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("One moment — too many updates at once."); e.status = 429; throw e; }
  const tradeKey = String(trade || "").trim().toLowerCase();
  const fields = tradeFields(tradeKey);
  const tradeLabel = tradeKey ? tradeKey.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1300, system: intakeSystemPrompt(tradeLabel, fields), messages: [{ role: "user", content: "CONVERSATION SO FAR (contractor describing the job and answering questions):\n" + t.slice(0, 8000) }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitizeIntake(parseModelJSON(txt));
}