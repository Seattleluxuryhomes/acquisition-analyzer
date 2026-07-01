// Live, custom customer-facing website for a contractor, rendered from their own
// BidVoice profile (company, trades, contact, brand color). Served at /c/:id.
// The "Request a free estimate" form is the homeowner → contractor connection: it
// posts to the contractor's inbound-leads endpoint, so a homeowner becomes a lead
// and the contractor bids it through the app. SEO-ready (LocalBusiness + reviews
// schema). Built only from public profile fields — no private data.
import { tradeList } from "./trades.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Customer-facing one-liners per trade (friendlier than the estimator labels).
const BLURB = {
  "general-contractor": "Whole-project remodels and builds, managed end to end.",
  windows: "Energy-efficient windows and doors, measured and installed right.",
  roofing: "Tear-offs and new roofs built to last, done clean.",
  siding: "Siding that protects and transforms your home's exterior.",
  gutters: "Seamless gutters and downspouts that move water where it belongs.",
  painting: "Interior and exterior painting with a finish that lasts.",
  flooring: "Hardwood, LVP, and tile installed flat, level, and built to wear.",
  concrete: "Driveways, patios, and flatwork poured and finished to last.",
  fencing: "Fences and gates built straight, solid, and on the line.",
  decking: "Decks and railings built to enjoy for years.",
  drywall: "Hang, tape, and texture — walls and ceilings done smooth.",
  doors: "Interior and exterior doors fit and finished right.",
  insulation: "Insulation that keeps you comfortable and lowers the bills.",
  "kitchen-remodel": "Kitchens that work the way you cook — cabinets to counters.",
  "bathroom-remodel": "Bathrooms done right, waterproofed to last.",
  landscaping: "Landscaping and hardscape that lifts your whole property.",
  framing: "Solid framing — the bones of every great project.",
  electrical: "Licensed electrical — outlets, lighting, panels, and service.",
  plumbing: "Licensed plumbing — fixtures, repipes, and water heaters.",
  hvac: "Heating and cooling sized and installed for real comfort.",
  masonry: "Masonry and stucco — brick, block, stone, and repair.",
  "garage-doors": "Garage doors and openers installed and serviced.",
  "excavation-demo": "Dirt work, grading, hauling, and demolition done right.",
  countertops: "Countertops templated, fabricated, and installed clean.",
  tile: "Tile set true — floors, walls, showers, and backsplashes.",
  staging: "Home staging that helps your listing sell faster, for more.",
  "interior-design": "Interior design that brings your space to life.",
};

// ---- Visitor-facing translations (the "language wheel") ----
// BidVoice's whole promise is bilingual, so the storefront should greet a
// homeowner in their own language. We translate everything WE control — UI chrome,
// CTAs, the form, trade names and blurbs. The contractor's own custom tagline/About
// are shown as they wrote them (translating their words needs AI — a later step).
// Add a language by adding a dictionary here; the switcher lists whatever exists.
const SITE_LANGS = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇲🇽" },
];
const T_STRINGS = {
  en: {
    freeEstimate: "Free estimate", getEstimate: "Get your free estimate", callUs: "Call us",
    licensed: "Licensed, bonded & insured", freeEstimates: "Free estimates",
    heroSub: (c) => `Get a free, no-pressure estimate from ${c} — fast.`,
    servicesOffered: "Services offered", serviceOffered: "Service offered", free: "Free", estimates: "Estimates",
    serviceArea: "Service area", clientRating: "Client rating", fast: "Fast", response: "Response",
    whatWeDo: "What we do", services: "Services",
    servicesLead: (c) => `Skilled, licensed work from ${c} — one team, one point of contact, one clean job.`,
    qualityTitle: "Quality craftsmanship", qualityBlurb: "Skilled, licensed work you can count on — ask us about your project.",
    about: "About", aboutOf: (c) => `About ${c}`,
    recentWork: "Recent work", beforeAfter: "Before & After", before: "Before", after: "After",
    tellUs: "Tell us about your project",
    estimateLead: (c) => `Send a few details and ${c} will get you a clean, priced estimate — fast. No pressure, no obligation.`,
    fName: "Your name", fPhone: "Phone", fAddress: "Address or neighborhood", fMessage: "What are you looking to do?",
    requestEstimate: "Request my free estimate →", sending: "Sending…",
    thanks: (c) => `✓ Thanks! ${c} got your request and will reach out shortly.`,
    formError: "Couldn't send — please check your connection and try again.",
    getStarted: "Get started", requestAFree: "Request a free estimate",
    poweredBy: "Website & booking powered by", reviews: "Google reviews", titleFree: "Free Estimates",
  },
  es: {
    freeEstimate: "Presupuesto gratis", getEstimate: "Pide tu presupuesto gratis", callUs: "Llámanos",
    licensed: "Con licencia, fianza y seguro", freeEstimates: "Presupuestos gratis",
    heroSub: (c) => `Recibe un presupuesto gratis y sin compromiso de ${c} — rápido.`,
    servicesOffered: "Servicios", serviceOffered: "Servicio", free: "Gratis", estimates: "Presupuestos",
    serviceArea: "Zona de servicio", clientRating: "Calificación", fast: "Rápida", response: "Respuesta",
    whatWeDo: "Lo que hacemos", services: "Servicios",
    servicesLead: (c) => `Trabajo profesional y con licencia de ${c} — un solo equipo, un solo contacto, un trabajo bien hecho.`,
    qualityTitle: "Trabajo de calidad", qualityBlurb: "Trabajo profesional y con licencia en el que puedes confiar — pregúntanos por tu proyecto.",
    about: "Nosotros", aboutOf: (c) => `Sobre ${c}`,
    recentWork: "Trabajos recientes", beforeAfter: "Antes y después", before: "Antes", after: "Después",
    tellUs: "Cuéntanos sobre tu proyecto",
    estimateLead: (c) => `Envía algunos detalles y ${c} te dará un presupuesto claro y con precio — rápido. Sin compromiso.`,
    fName: "Tu nombre", fPhone: "Teléfono", fAddress: "Dirección o vecindario", fMessage: "¿Qué necesitas hacer?",
    requestEstimate: "Pedir mi presupuesto gratis →", sending: "Enviando…",
    thanks: (c) => `✓ ¡Gracias! ${c} recibió tu solicitud y se comunicará contigo pronto.`,
    formError: "No se pudo enviar — revisa tu conexión e inténtalo de nuevo.",
    getStarted: "Empezar", requestAFree: "Pedir un presupuesto gratis",
    poweredBy: "Sitio web y reservas con tecnología de", reviews: "reseñas de Google", titleFree: "Presupuestos Gratis",
  },
};
// Spanish trade names + blurbs (what we author). Falls back to the English label/
// blurb for any trade not yet translated, so nothing ever renders blank.
const TRADE_ES = {
  "general-contractor": "Contratista general", windows: "Ventanas y puertas", roofing: "Techado", siding: "Revestimiento",
  gutters: "Canaletas", painting: "Pintura", flooring: "Pisos", concrete: "Concreto", fencing: "Cercas", decking: "Terrazas",
  drywall: "Tablaroca", doors: "Puertas", insulation: "Aislamiento", "kitchen-remodel": "Remodelación de cocina",
  "bathroom-remodel": "Remodelación de baño", landscaping: "Jardinería", framing: "Estructura", electrical: "Electricidad",
  plumbing: "Plomería", hvac: "Calefacción y aire", masonry: "Albañilería", "garage-doors": "Puertas de garaje",
  "excavation-demo": "Excavación y demolición", countertops: "Encimeras", tile: "Azulejo", staging: "Home staging",
  "interior-design": "Diseño de interiores",
};
const BLURB_ES = {
  "general-contractor": "Remodelaciones y construcciones completas, gestionadas de principio a fin.",
  windows: "Ventanas y puertas eficientes, medidas e instaladas correctamente.",
  roofing: "Techos nuevos y reemplazos hechos para durar, con un trabajo limpio.",
  siding: "Revestimiento que protege y transforma el exterior de tu casa.",
  gutters: "Canaletas sin uniones que llevan el agua a donde debe ir.",
  painting: "Pintura interior y exterior con un acabado que dura.",
  flooring: "Madera, vinil y azulejo instalados planos, nivelados y resistentes.",
  concrete: "Entradas, patios y losas vaciadas y terminadas para durar.",
  fencing: "Cercas y portones derechos, sólidos y en la línea correcta.",
  decking: "Terrazas y barandales para disfrutar por años.",
  drywall: "Colgado, encintado y texturizado — paredes y techos lisos.",
  doors: "Puertas interiores y exteriores ajustadas y bien terminadas.",
  insulation: "Aislamiento que te mantiene cómodo y baja los recibos.",
  "kitchen-remodel": "Cocinas que funcionan como cocinas — de los gabinetes a las encimeras.",
  "bathroom-remodel": "Baños bien hechos, impermeabilizados para durar.",
  landscaping: "Jardinería y paisajismo que realza toda tu propiedad.",
  framing: "Estructura sólida — los huesos de todo buen proyecto.",
  electrical: "Electricidad con licencia — contactos, iluminación, paneles y servicio.",
  plumbing: "Plomería con licencia — llaves, retubería y calentadores.",
  hvac: "Calefacción y aire dimensionados e instalados para comodidad real.",
  masonry: "Albañilería y estuco — ladrillo, block, piedra y reparación.",
  "garage-doors": "Puertas de garaje y motores instalados y reparados.",
  "excavation-demo": "Movimiento de tierra, nivelación, acarreo y demolición bien hechos.",
  countertops: "Encimeras plantilladas, fabricadas e instaladas con un trabajo limpio.",
  tile: "Azulejo bien puesto — pisos, paredes, regaderas y cenefas.",
};

export function renderContractorSite(profile = {}, opts = {}) {
  // The visitor's language ("language wheel"): a ?lang= choice the server resolves,
  // defaulting to English. Only languages we have a dictionary for are honored.
  const lang = T_STRINGS[opts.lang] ? opts.lang : "en";
  const T = T_STRINGS[lang];
  const isES = lang === "es";
  const company = esc(profile.company && profile.company !== "Your Company" ? profile.company : "Your Company");
  const initial = (company[0] || "B").toUpperCase();
  // The contractor's uploaded logo (data URL). The website header sits on a light
  // background, so prefer a dedicated dark "website logo" when set; otherwise fall
  // back to the bid/PDF logo. When present it IS the header brand; otherwise fall
  // back to an initial-in-a-square.
  const logo = String(profile.site_logo || profile.logo || "").trim();
  const brandMark = logo
    ? `<div class="brand brand-logoed"><img class="brand-logo" src="${logo}" alt="${company}"/></div>`
    : `<div class="brand"><span class="mk">${esc(initial)}</span>${company}</div>`;
  const accent = /^#[0-9a-f]{3,8}$/i.test(profile.site_color || "") ? profile.site_color : "#CF7F18";
  const phone = String(profile.phone || "").trim();
  const telHref = "tel:" + phone.replace(/[^\d+]/g, "");
  const email = esc(profile.email || "");
  const license = esc(profile.license || "");
  const area = esc(profile.region || profile.city || "");
  // Default tagline is translated; a contractor's CUSTOM tagline is shown as written.
  const defaultTagline = isES ? "Trabajo de calidad en el que puedes confiar — bien hecho y a tiempo." : "Quality work you can trust — done right, on time.";
  const tagline = esc(profile.site_tagline || defaultTagline);
  const about = esc(String(profile.site_about || "").trim());   // AI-written About paragraph (optional)
  const offer = opts.offer && opts.offer.headline ? opts.offer : null;   // funnel offer mode (Sprint 15)
  const lookup = Object.fromEntries(tradeList().map((t) => [t.key, t]));
  const services = (Array.isArray(profile.services) ? profile.services : [])
    .map((k) => lookup[k]).filter(Boolean)
    .map((t) => ({
      emoji: t.emoji,
      label: (isES && TRADE_ES[t.key]) || t.label.replace(/\s*\(.*\)$/, ""),
      blurb: (isES ? (BLURB_ES[t.key] || BLURB[t.key]) : BLURB[t.key]) || (isES ? `Trabajo profesional de ${t.label.toLowerCase()} bien hecho.` : `Professional ${t.label.toLowerCase()} done right.`),
    }));
  const rating = profile.rating ? String(profile.rating) : "";   // from Google reviews layer (#15) — omitted until real
  const reviews = profile.reviews ? String(profile.reviews) : "";
  const leadAction = opts.leadAction || "";                       // inbound-leads URL (token-authed) for the estimate form

  const svcCards = services.length
    ? services.map((s) => `<div class="card"><div class="ic">${s.emoji}</div><h3>${esc(s.label)}</h3><p>${esc(s.blurb)}</p></div>`).join("")
    : `<div class="card"><div class="ic">🔨</div><h3>${esc(T.qualityTitle)}</h3><p>${esc(T.qualityBlurb)}</p></div>`;

  const ratingBadge = rating ? `<span class="stars">★★★★★</span> <span><b>${esc(rating)}</b>${reviews ? ` · ${esc(reviews)} ${esc(T.reviews)}` : ""}</span>` : "";

  // Clean line icons (no clip-art emoji) — same stroke style as the app, brand-colored.
  const I = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICON = {
    tools: I('<path d="M14.6 6.4a3.8 3.8 0 0 1-4.9 4.9L4 17v3h3l5.7-5.7a3.8 3.8 0 0 1 4.9-4.9l-2.5 2.5-2.1-.3-.3-2.1z"/>'),
    shield: I('<path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
    clipboard: I('<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.6" width="6" height="3.2" rx="1"/><path d="M9 11.5h6M9 15.5h6"/>'),
    pin: I('<path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>'),
    star: I('<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5 6.8 19.2l1-5.8L3.6 9.3l5.8-.8z"/>'),
    bolt: I('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>'),
  };

  // The 4th stat square — only ever show something that MEANS something: the real
  // service area if set, else a real client rating, else a fast-response promise.
  // (No empty "Local" filler.)
  const stat4 = area
    ? `<div class="s"><div class="ic">${ICON.pin}</div><div class="v">${esc(area)}</div><div class="l">${esc(T.serviceArea)}</div></div>`
    : rating
    ? `<div class="s"><div class="ic">${ICON.star}</div><div class="v">${esc(rating)}</div><div class="l">${esc(T.clientRating)}</div></div>`
    : `<div class="s"><div class="ic">${ICON.bolt}</div><div class="v">${esc(T.fast)}</div><div class="l">${esc(T.response)}</div></div>`;

  // The language switcher ("wheel") — a compact selector that reloads the page in
  // the chosen language. Only shows when more than one language is available.
  const altBase = String(opts.altBase || "");   // canonical path for ?lang= links (set by server)
  const langWheel = SITE_LANGS.length > 1
    ? `<div class="lang"><span class="lang-globe" aria-hidden="true">${ICON.globe}</span><select aria-label="Language" onchange="var u=new URL(location.href);u.searchParams.set('lang',this.value);location.href=u.toString()">`
      + SITE_LANGS.map((L) => `<option value="${L.code}"${L.code === lang ? " selected" : ""}>${L.flag} ${esc(L.label)}</option>`).join("")
      + `</select></div>`
    : "";
  // hreflang alternates for SEO — tell Google we serve the page in each language.
  const hreflangs = altBase
    ? SITE_LANGS.map((L) => `<link rel="alternate" hreflang="${L.code}" href="${esc(altBase)}?lang=${L.code}" />`).join("")
    : "";

  return `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${company}${area ? ` — ${area}` : ""} | ${T.titleFree}</title>
<meta name="description" content="${company} — ${tagline} ${license ? T.licensed + "." : ""} ${T.freeEstimates}." />
<meta name="theme-color" content="${accent}" />
${hreflangs}
<meta property="og:type" content="website" /><meta property="og:title" content="${company}" />
<meta property="og:description" content="${tagline} ${T.freeEstimates}." />
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org", "@type": "GeneralContractor", name: profile.company || "Contractor",
  ...(phone ? { telephone: phone } : {}), ...(area ? { areaServed: area } : {}),
  ...(rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating, reviewCount: reviews || "1" } } : {}),
})}</script>
<style>
  :root{--accent:${accent};--ink:#1b2228;--paper:#fff;--soft:#f5f2ea;--blue:#1E4259;--muted:#5f6b73;--rule:#e7e2d6}
  *{box-sizing:border-box}html{scroll-behavior:smooth}
  body{margin:0;color:var(--ink);background:var(--paper);font-family:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
  .btn{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px 22px;font-weight:700;font-size:1rem;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.14)}
  .btn:hover{filter:brightness(1.06)}.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--rule);box-shadow:none}.btn.lg{padding:16px 28px;font-size:1.08rem}
  header.nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:saturate(160%) blur(8px);border-bottom:1px solid var(--rule)}
  .nav .wrap{display:flex;align-items:center;justify-content:space-between;padding:14px 22px}
  .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.2rem}
  .brand .mk{width:34px;height:34px;border-radius:9px;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900}
  .brand-logo{height:40px;width:auto;max-width:230px;object-fit:contain;display:block}
  @media(max-width:640px){.brand-logo{height:34px;max-width:170px}}
  .nav-r{display:flex;align-items:center;gap:14px}.nav-r .call{font-weight:700;color:var(--blue)}
  @media(max-width:640px){.nav-r .call{display:none}}
  .lang{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--rule);border-radius:10px;padding:6px 10px}
  .lang-globe svg{width:17px;height:17px;color:var(--accent);display:block}
  .lang select{border:none;background:transparent;font-family:inherit;font-size:.92rem;font-weight:700;color:var(--ink);cursor:pointer;outline:none;padding-right:2px}
  .hero{background:linear-gradient(180deg,var(--soft),#fff);padding:64px 0 48px}
  .hero h1{font-size:2.9rem;line-height:1.07;margin:0 0 14px;max-width:16ch;font-weight:800}
  .hero p.sub{font-size:1.2rem;color:var(--muted);max-width:46ch;margin:0 0 24px}
  .hero .cta{display:flex;gap:12px;flex-wrap:wrap}
  .badges{display:flex;gap:18px;flex-wrap:wrap;margin-top:26px;color:var(--muted);font-size:.92rem;font-weight:600}.badges b{color:var(--ink)}.stars{color:var(--accent)}
  .badges span{display:inline-flex;align-items:center;gap:7px}.badges svg{width:17px;height:17px;color:var(--accent);flex:0 0 auto}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:10px 0 6px}
  .stats .s{background:#fff;border:1px solid var(--rule);border-radius:16px;padding:22px 16px;text-align:center;box-shadow:0 4px 16px rgba(27,34,40,.05)}
  .stats .s .ic{height:28px;display:flex;align-items:center;justify-content:center}.stats .s .ic svg{width:27px;height:27px;color:var(--accent)}
  .stats .v{font-size:1.5rem;font-weight:800;color:var(--blue);margin-top:7px;line-height:1.12;word-break:break-word}
  .stats .l{color:var(--muted);font-size:.82rem;margin-top:4px;line-height:1.3}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr);gap:11px}.hero h1{font-size:2.1rem}}
  section{padding:58px 0}.eyebrow{color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.1em;font-size:.74rem}
  h2{font-size:2rem;margin:6px 0 8px;font-weight:800}.lead{color:var(--muted);max-width:52ch}
  .about{background:var(--soft)}.about-p{font-size:1.12rem;line-height:1.7;color:var(--ink);max-width:60ch}
  .projects{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;margin-top:26px}
  @media(max-width:760px){.projects{grid-template-columns:1fr}}
  .proj{border:1px solid var(--rule);border-radius:14px;overflow:hidden;background:#fff}
  .proj h3{margin:0;padding:16px 18px 2px;font-size:1.12rem}.proj-meta{padding:0 18px;color:var(--accent);font-weight:700;font-size:.82rem;text-transform:uppercase;letter-spacing:.04em}
  .proj-d{margin:0;padding:10px 18px 18px;color:var(--muted);font-size:.95rem}
  .ba{display:grid;grid-template-columns:1fr 1fr;gap:2px;margin-top:12px}
  .ba figure{margin:0;position:relative}.ba img{width:100%;height:170px;object-fit:cover;display:block}
  .ba figcaption{position:absolute;left:8px;bottom:8px;background:rgba(27,34,40,.82);color:#fff;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:6px}
  .gal{display:grid;grid-template-columns:repeat(2,1fr);gap:2px;margin-top:12px}.gal img{width:100%;height:150px;object-fit:cover;display:block}
  .svc{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:32px}
  .card{background:#fff;border:1px solid var(--rule);border-radius:16px;padding:26px 22px;transition:transform .16s ease,box-shadow .16s ease}
  .card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(27,34,40,.09)}
  .card .ic{width:54px;height:54px;border-radius:14px;background:var(--soft);display:flex;align-items:center;justify-content:center;font-size:1.6rem}
  .card h3{margin:15px 0 7px;font-size:1.14rem}.card p{margin:0;color:var(--muted);font-size:.96rem;line-height:1.55}
  @media(max-width:760px){.svc{grid-template-columns:1fr;gap:14px}}
  .estimate{background:var(--blue);color:#fff;border-radius:22px;padding:46px 32px;text-align:center}
  .estimate h2{color:#fff}.estimate p{color:#cdd8e0;max-width:44ch;margin:0 auto 22px}
  .form{max-width:520px;margin:0 auto;display:grid;gap:10px;text-align:left}.form .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .form input,.form textarea{width:100%;padding:13px;border-radius:10px;border:none;font-size:1rem;font-family:inherit}.form textarea{min-height:84px;resize:vertical}
  @media(max-width:560px){.form .row{grid-template-columns:1fr}}
  .ok{background:rgba(255,255,255,.16);border-radius:12px;padding:18px;font-weight:600}
  footer{border-top:1px solid var(--rule);padding:34px 0;color:var(--muted);font-size:.9rem}
  footer .grid{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}footer b{color:var(--ink)}
  .powered{margin-top:22px;text-align:center;color:var(--muted);font-size:.82rem}.powered a{color:var(--accent);font-weight:700}
</style></head><body>
<header class="nav"><div class="wrap">
  ${brandMark}
  <div class="nav-r">${phone ? `<a class="call" href="${telHref}">📞 ${esc(phone)}</a>` : ""}${langWheel}<a class="btn" href="#estimate">${esc(T.freeEstimate)}</a></div>
</div></header>

<section class="hero"><div class="wrap">
  <div class="eyebrow">${area ? esc(area) + " · " : ""}${license ? T.licensed : T.freeEstimates}</div>
  <h1>${offer && offer.headline ? esc(offer.headline) : tagline}</h1>
  <p class="sub">${offer && offer.subhead ? esc(offer.subhead) : T.heroSub(company)}</p>
  ${offer
    ? `<div class="cta"><a class="btn lg" href="#estimate">${esc(offer.cta || T.getEstimate)}</a></div>`
    : `<div class="cta"><a class="btn lg" href="#estimate">${esc(T.getEstimate)}</a>${phone ? `<a class="btn ghost lg" href="${telHref}">📞 ${esc(T.callUs)}</a>` : ""}</div>`}
  <div class="badges">${ratingBadge}${license ? `<span>${ICON.shield} ${T.licensed} · <b>${license}</b></span>` : `<span>${ICON.shield} <b>${T.licensed}</b></span>`}<span>${ICON.clipboard} <b>${T.freeEstimates}</b></span></div>
</div></section>

<div class="stats wrap"><div class="s"><div class="ic">${ICON.tools}</div><div class="v">${services.length || "✓"}</div><div class="l">${services.length === 1 ? T.serviceOffered : T.servicesOffered}</div></div>
  <div class="s"><div class="ic">${ICON.shield}</div><div class="v">✓</div><div class="l">${T.licensed}</div></div>
  <div class="s"><div class="ic">${ICON.clipboard}</div><div class="v">${T.free}</div><div class="l">${T.estimates}</div></div>
  ${stat4}</div>

<section class="wrap"><div class="eyebrow">${T.whatWeDo}</div><h2>${T.services}</h2>
  <p class="lead">${T.servicesLead(company)}</p>
  <div class="svc">${svcCards}</div></section>

${about ? `<section class="wrap about"><div class="eyebrow">${T.about}</div><h2>${T.aboutOf(company)}</h2><p class="lead about-p">${about}</p></section>` : ""}

${(Array.isArray(opts.projects) && opts.projects.length) ? `<section class="wrap work"><div class="eyebrow">${T.recentWork}</div><h2>${T.beforeAfter}</h2>
  <div class="projects">${opts.projects.map((p) => {
    const ba = (p.before && p.before.length && p.after && p.after.length)
      ? `<div class="ba"><figure><img src="${esc(p.before[0])}" alt="${esc(T.before)}"/><figcaption>${esc(T.before)}</figcaption></figure><figure><img src="${esc(p.after[0])}" alt="${esc(T.after)}"/><figcaption>${esc(T.after)}</figcaption></figure></div>`
      : `<div class="gal">${[...(p.after || []), ...(p.before || [])].slice(0, 4).map((u) => `<img src="${esc(u)}" alt="${esc(p.title)}"/>`).join("")}</div>`;
    return `<article class="proj"><h3>${esc(p.title)}</h3>${(p.service || p.area) ? `<div class="proj-meta">${esc([p.service, p.area].filter(Boolean).join(" · "))}</div>` : ""}${ba}${p.description ? `<p class="proj-d">${esc(p.description)}</p>` : ""}</article>`;
  }).join("")}</div></section>` : ""}

<section class="wrap" id="estimate"><div class="estimate">
  <div class="eyebrow" style="color:#e7b35c">${T.freeEstimate}</div>
  <h2>${T.tellUs}</h2>
  <p>${T.estimateLead(company)}</p>
  <form class="form" id="estForm">
    <div class="row"><input name="name" type="text" placeholder="${esc(T.fName)}" required /><input name="phone" type="tel" placeholder="${esc(T.fPhone)}" required /></div>
    <input name="city" type="text" placeholder="${esc(T.fAddress)}" />
    <textarea name="message" placeholder="${esc(T.fMessage)}"></textarea>
    <button class="btn lg" type="submit" style="justify-content:center">${esc(T.requestEstimate)}</button>
  </form>
  <div id="estOk" class="ok" style="display:none;margin-top:14px">${T.thanks(company)}</div>
  <div id="estErr" style="display:none;margin-top:14px;background:rgba(220,80,60,.18);border:1px solid rgba(255,160,140,.5);border-radius:12px;padding:14px;font-weight:600">${esc(T.formError)}</div>
</div></section>

<footer><div class="wrap"><div class="grid">
  <div><b>${company}</b>${area ? `<br>${esc(area)}` : ""}${phone ? `<br>📞 ${esc(phone)}` : ""}${email ? ` · ${email}` : ""}</div>
  <div><b>${T.getStarted}</b><br><a href="#estimate" style="color:var(--accent);font-weight:700">${esc(T.requestAFree)}</a></div>
  ${license ? `<div><b>${T.licensed}</b><br>${license}<br>${T.freeEstimates}</div>` : ""}
</div><div class="powered">${T.poweredBy} <a href="https://bidvoice.ai">BidVoice</a></div></div></footer>
<script>
  var f=document.getElementById('estForm'), action=${JSON.stringify(leadAction)};
  f.addEventListener('submit',function(e){ e.preventDefault();
    var fd={ name:f.name.value, phone:f.phone.value, city:f.city.value, message:f.message.value, source:'Website', job_type:'' };
    var btn=f.querySelector('button'), orig=btn.textContent; btn.disabled=true; btn.textContent=${JSON.stringify(T.sending)};
    var errEl=document.getElementById('estErr'); if(errEl) errEl.style.display='none';
    // Only claim success on a real 2xx — otherwise a blocked/failed POST would
    // tell the homeowner "Thanks!" while the lead silently vanishes.
    function ok(){ f.style.display='none'; document.getElementById('estOk').style.display='block'; }
    function fail(){ btn.disabled=false; btn.textContent=orig; if(errEl) errEl.style.display='block'; }
    if(!action){ fail(); return; }
    fetch(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fd)})
      .then(function(r){ if(r&&r.ok){ ok(); } else { fail(); } })
      .catch(fail);
  });
</script>
</body></html>`;
}
