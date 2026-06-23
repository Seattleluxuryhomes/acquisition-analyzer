// Server-side AI translate+structure. The provider key lives only here (hard
// rule #1). Output is validated/sanitized before returning. If the key is unset
// or the call fails, this throws — the client falls back to manual entry (rule #4).
import db from "./db.js";

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
const RATE_MAX = 6;

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

function buildSystemPrompt(from, to) {
  return (
    "You are an estimating assistant for construction contractors. Translate the " +
    "field conversation and turn it into a structured bid draft. Respond with ONLY " +
    "valid minified JSON, no markdown fences and no commentary, matching exactly: " +
    '{"translation":string,"summary":string,"lines":[{"section":string,"desc":string,"type":"fixed"|"hourly",' +
    '"price":number,"hours":number,"rate":number}],"assumptions":[string],"exclusions":[string],' +
    '"upgrades":[{"desc":string,"price":number}]}. Rules: at most 12 lines, at most 4 upgrades. ' +
    "Group the work by room or area: put the room/area name (e.g. \"Bathroom\", \"Kitchen\") in each " +
    "line's \"section\". Keep different rooms in different sections — never merge two rooms into one " +
    "line. If the whole job is one area, use a single section name or leave \"section\" empty. " +
    "For a fixed line set price and use hours 0 and rate 0. For an hourly line set hours and rate " +
    "and price 0. IMPORTANT about pricing: if the conversation states a price (for an item, a room, " +
    "or labor), use that exact number — never replace a stated price with a guess. Only invent a " +
    "rough USD placeholder when no price is given. When one total price covers a room that has " +
    "several steps, make ONE line for that room whose desc lists those steps, priced at the stated " +
    "total. If a price is noted as plus tax (e.g. \"+ sales tax\"), add that as an assumption. If the " +
    "client is supplying a material, add it as an exclusion. Translate from " +
    (LANGS[from] || from) + " to " + (LANGS[to] || to) + ". The \"translation\" field is the " +
    "conversation rendered in " + (LANGS[to] || to) + "."
  );
}

function sanitize(data) {
  const num = (n) => Number(n) || 0;
  const lines = (Array.isArray(data.lines) ? data.lines : []).slice(0, 12).map((l) => ({
    section: String(l.section || "").slice(0, 80),
    desc: String(l.desc || "").slice(0, 200),
    type: l.type === "hourly" ? "hourly" : "fixed",
    price: num(l.price), hours: num(l.hours), rate: num(l.rate),
  }));
  return {
    translation: String(data.translation || ""),
    summary: String(data.summary || ""),
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

export async function assistBuild(user, { text, from_lang, to_lang }) {
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
  const system = buildSystemPrompt(from_lang, to_lang);
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
        model, max_tokens: 1200, system,
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
