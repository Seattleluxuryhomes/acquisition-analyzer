// Server-side AI translate+structure. The provider key lives only here (hard
// rule #1). Output is validated/sanitized before returning. If the key is unset
// or the call fails, this throws — the client falls back to manual entry (rule #4).
import db from "./db.js";
import { tradeBrain, tradeLabel } from "./trades.js";

// Display names (native) used to tell the AI which languages to translate
// between. The AI can translate any language; this just drives the picker and
// the prompt. Keep keys in sync with public/index.html LANGS + SPEECH_LANG.
const LANGS = {
  en: "English", es: "Español", zh: "中文", hi: "हिन्दी", ar: "العربية", bn: "বাংলা",
  pt: "Português", ru: "Русский", ja: "日本語", pa: "ਪੰਜਾਬੀ", de: "Deutsch", ko: "한국어",
  fr: "Français", te: "తెలుగు", mr: "मराठी", ta: "தமிழ்", tr: "Türkçe", vi: "Tiếng Việt",
  ur: "اردو", it: "Italiano", gu: "ગુજરાતી", pl: "Polski", uk: "Українська", fa: "فارسی",
  kn: "ಕನ್ನಡ", ml: "മലയാളം", th: "ไทย", nl: "Nederlands", id: "Bahasa Indonesia",
  ms: "Bahasa Melayu", tl: "Filipino", sw: "Kiswahili", ro: "Română", el: "Ελληνικά",
  cs: "Čeština", hu: "Magyar", sv: "Svenska", he: "עברית", da: "Dansk", fi: "Suomi",
  no: "Norsk", sk: "Slovenčina", hr: "Hrvatski", sr: "Српски", bg: "Български",
  lt: "Lietuvių", sl: "Slovenščina", lv: "Latviešu", et: "Eesti", af: "Afrikaans",
  sq: "Shqip", am: "አማርኛ", hy: "Հայերեն", az: "Azərbaycanca", ka: "ქართული",
  kk: "Қазақша", ne: "नेपाली", si: "සිංහල", km: "ខ្មែរ", lo: "ລາວ", my: "မြန်မာ",
  mn: "Монгол", is: "Íslenska", ga: "Gaeilge", cy: "Cymraeg", eu: "Euskara",
  gl: "Galego", ca: "Català", ps: "پښتو", so: "Soomaali", ha: "Hausa", yo: "Yorùbá",
  ig: "Igbo", zu: "isiZulu", xh: "isiXhosa"
};

// Cost guardrails (hard rule / spec §7, §13): per-user monthly cap + light rate limit.
const MONTHLY_CAP = Number(process.env.BT_AI_MONTHLY_CAP || 200);
const recentCalls = new Map(); // userId -> [timestamps]
const RATE_WINDOW = 60 * 1000;
const RATE_MAX = Number(process.env.BT_AI_RATE_MAX || 20); // voice-first does more, smaller calls

function checkRate(userId) {
  const now = Date.now();
  const arr = (recentCalls.get(userId) || []).filter((t) => now - t < RATE_WINDOW);
  if (arr.length >= RATE_MAX) return false;
  arr.push(now);
  recentCalls.set(userId, arr);
  return true;
}

function checkMonthlyCap(user) {
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
    "padding. At most 6 recommendations, most important first. If the bid looks " +
    "complete, return an empty array. " +
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
function intakeSystemPrompt() {
  return (
    "You read a contractor's spoken description of a job and extract structured " +
    "intake. Respond with ONLY valid minified JSON, no markdown, matching exactly: " +
    '{"project_name":string,"client":string,"address":string,"scope":[string],' +
    '"materials":[string],"labor":[string],"timeline":string,"notes":string,"questions":[string]}. ' +
    "Rules: client = the customer's name if stated (else \"\"). address = the job address if stated " +
    "(else \"\"). scope = short phrases of the work to do. materials = materials named. labor = labor/" +
    "crew tasks (demo, haul-away, install, paint…). timeline = any dates/deadline (else \"\"). notes = " +
    "anything else useful the contractor should remember. questions = 2 to 4 SHORT follow-up questions " +
    "the contractor still needs answered to price it (missing measurements, material/finish choices, " +
    "budget, access, who supplies what, timeline). project_name = a short job name from the client + " +
    "main work, e.g. \"Martinez — Kitchen remodel\"; if no client name, use the address, else the main " +
    "scope. At most 8 items per list. Use ONLY facts stated — never invent details."
  );
}
function sanitizeIntake(d) {
  const list = (a) => (Array.isArray(a) ? a : []).slice(0, 8).map((s) => String(s).slice(0, 160)).filter(Boolean);
  d = d && typeof d === "object" ? d : {};
  return {
    project_name: String(d.project_name || "").slice(0, 120),
    client: String(d.client || "").slice(0, 120),
    address: String(d.address || "").slice(0, 200),
    scope: list(d.scope),
    materials: list(d.materials),
    labor: list(d.labor),
    timeline: String(d.timeline || "").slice(0, 160),
    notes: String(d.notes || "").slice(0, 600),
    questions: list(d.questions),
  };
}
export async function assistIntake(user, { text }) {
  if (!aiConfigured()) { const e = new Error("AI is not configured on the server."); e.status = 503; e.code = "AI_UNCONFIGURED"; throw e; }
  const t = String(text || "").trim();
  if (t.length < 8) { const e = new Error("Say a little more about the job first."); e.status = 400; throw e; }
  if (!checkRate(user.id)) { const e = new Error("One moment — too many updates at once."); e.status = 429; throw e; }
  const model = process.env.BT_AI_MODEL || "claude-sonnet-4-6";
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 900, system: intakeSystemPrompt(), messages: [{ role: "user", content: "JOB DESCRIPTION:\n" + t.slice(0, 8000) }] }),
    });
  } catch { const e = new Error("Could not reach the AI provider."); e.status = 502; throw e; }
  if (!res.ok) { const e = new Error("AI provider error (" + res.status + ")."); e.status = 502; throw e; }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return sanitizeIntake(parseModelJSON(txt));
}