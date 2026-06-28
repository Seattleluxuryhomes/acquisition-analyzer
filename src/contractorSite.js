// Live, custom customer-facing website for a contractor, rendered from their own
// Bidtranslator profile (company, trades, contact, brand color). Served at /c/:id.
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

export function renderContractorSite(profile = {}, opts = {}) {
  const company = esc(profile.company && profile.company !== "Your Company" ? profile.company : "Your Company");
  const initial = (company[0] || "B").toUpperCase();
  const accent = /^#[0-9a-f]{3,8}$/i.test(profile.site_color || "") ? profile.site_color : "#CF7F18";
  const phone = String(profile.phone || "").trim();
  const telHref = "tel:" + phone.replace(/[^\d+]/g, "");
  const email = esc(profile.email || "");
  const license = esc(profile.license || "");
  const area = esc(profile.region || profile.city || "");
  const tagline = esc(profile.site_tagline || "Quality work you can trust — done right, on time.");
  const about = esc(String(profile.site_about || "").trim());   // AI-written About paragraph (optional)
  const offer = opts.offer && opts.offer.headline ? opts.offer : null;   // funnel offer mode (Sprint 15)
  const lookup = Object.fromEntries(tradeList().map((t) => [t.key, t]));
  const services = (Array.isArray(profile.services) ? profile.services : [])
    .map((k) => lookup[k]).filter(Boolean)
    .map((t) => ({ emoji: t.emoji, label: t.label.replace(/\s*\(.*\)$/, ""), blurb: BLURB[t.key] || `Professional ${t.label.toLowerCase()} done right.` }));
  const rating = profile.rating ? String(profile.rating) : "";   // from Google reviews layer (#15) — omitted until real
  const reviews = profile.reviews ? String(profile.reviews) : "";
  const leadAction = opts.leadAction || "";                       // inbound-leads URL (token-authed) for the estimate form

  const svcCards = services.length
    ? services.map((s) => `<div class="card"><div class="ic">${s.emoji}</div><h3>${esc(s.label)}</h3><p>${esc(s.blurb)}</p></div>`).join("")
    : `<div class="card"><div class="ic">🔨</div><h3>Quality craftsmanship</h3><p>Skilled, licensed work you can count on — ask us about your project.</p></div>`;

  const ratingBadge = rating ? `<span class="stars">★★★★★</span> <span><b>${esc(rating)}</b>${reviews ? ` · ${esc(reviews)} Google reviews` : ""}</span>` : "";

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${company}${area ? ` — ${area}` : ""} | Free Estimates</title>
<meta name="description" content="${company} — ${tagline} ${license ? "Licensed &amp; insured." : ""} Free estimates." />
<meta name="theme-color" content="${accent}" />
<meta property="og:type" content="website" /><meta property="og:title" content="${company}" />
<meta property="og:description" content="${tagline} Free estimates." />
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
  .nav-r{display:flex;align-items:center;gap:14px}.nav-r .call{font-weight:700;color:var(--blue)}
  @media(max-width:640px){.nav-r .call{display:none}}
  .hero{background:linear-gradient(180deg,var(--soft),#fff);padding:64px 0 48px}
  .hero h1{font-size:2.9rem;line-height:1.07;margin:0 0 14px;max-width:16ch;font-weight:800}
  .hero p.sub{font-size:1.2rem;color:var(--muted);max-width:46ch;margin:0 0 24px}
  .hero .cta{display:flex;gap:12px;flex-wrap:wrap}
  .badges{display:flex;gap:18px;flex-wrap:wrap;margin-top:26px;color:var(--muted);font-size:.92rem;font-weight:600}.badges b{color:var(--ink)}.stars{color:var(--accent)}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--rule);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
  .stats .s{background:#fff;padding:22px 14px;text-align:center}.stats .v{font-size:1.5rem;font-weight:800;color:var(--blue)}.stats .l{color:var(--muted);font-size:.84rem}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}.hero h1{font-size:2.1rem}}
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
  .svc{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:30px}
  .card{background:#fff;border:1px solid var(--rule);border-radius:14px;padding:22px}.card .ic{font-size:1.7rem}.card h3{margin:10px 0 6px;font-size:1.12rem}.card p{margin:0;color:var(--muted);font-size:.95rem}
  @media(max-width:760px){.svc{grid-template-columns:1fr}}
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
  <div class="brand"><span class="mk">${esc(initial)}</span>${company}</div>
  <div class="nav-r">${phone ? `<a class="call" href="${telHref}">📞 ${esc(phone)}</a>` : ""}<a class="btn" href="#estimate">Free estimate</a></div>
</div></header>

<section class="hero"><div class="wrap">
  <div class="eyebrow">${area ? esc(area) + " · " : ""}${license ? "Licensed &amp; insured" : "Free estimates"}</div>
  <h1>${offer && offer.headline ? esc(offer.headline) : tagline}</h1>
  <p class="sub">${offer && offer.subhead ? esc(offer.subhead) : `Get a free, no-pressure estimate from ${company} — fast.`}</p>
  ${offer
    ? `<div class="cta"><a class="btn lg" href="#estimate">${esc(offer.cta || "Get my free estimate")}</a></div>`
    : `<div class="cta"><a class="btn lg" href="#estimate">Get your free estimate</a>${phone ? `<a class="btn ghost lg" href="${telHref}">📞 Call us</a>` : ""}</div>`}
  <div class="badges">${ratingBadge}${license ? `<span>🛡️ Licensed &amp; insured · <b>${license}</b></span>` : `<span>🛡️ <b>Licensed &amp; insured</b></span>`}<span>📋 <b>Free estimates</b></span></div>
</div></section>

<div class="stats wrap"><div class="s"><div class="v">${services.length || "✓"}</div><div class="l">Services offered</div></div>
  <div class="s"><div class="v">✓</div><div class="l">Licensed &amp; insured</div></div>
  <div class="s"><div class="v">Free</div><div class="l">Estimates</div></div>
  <div class="s"><div class="v">${area ? esc(area) : "Local"}</div><div class="l">Service area</div></div></div>

<section class="wrap"><div class="eyebrow">What we do</div><h2>Services</h2>
  <p class="lead">Skilled, licensed work from ${company} — one team, one point of contact, one clean job.</p>
  <div class="svc">${svcCards}</div></section>

${about ? `<section class="wrap about"><div class="eyebrow">About</div><h2>About ${company}</h2><p class="lead about-p">${about}</p></section>` : ""}

${(Array.isArray(opts.projects) && opts.projects.length) ? `<section class="wrap work"><div class="eyebrow">Recent work</div><h2>Before &amp; After</h2>
  <div class="projects">${opts.projects.map((p) => {
    const ba = (p.before && p.before.length && p.after && p.after.length)
      ? `<div class="ba"><figure><img src="${esc(p.before[0])}" alt="Before"/><figcaption>Before</figcaption></figure><figure><img src="${esc(p.after[0])}" alt="After"/><figcaption>After</figcaption></figure></div>`
      : `<div class="gal">${[...(p.after || []), ...(p.before || [])].slice(0, 4).map((u) => `<img src="${esc(u)}" alt="${esc(p.title)}"/>`).join("")}</div>`;
    return `<article class="proj"><h3>${esc(p.title)}</h3>${(p.service || p.area) ? `<div class="proj-meta">${esc([p.service, p.area].filter(Boolean).join(" · "))}</div>` : ""}${ba}${p.description ? `<p class="proj-d">${esc(p.description)}</p>` : ""}</article>`;
  }).join("")}</div></section>` : ""}

<section class="wrap" id="estimate"><div class="estimate">
  <div class="eyebrow" style="color:#e7b35c">Free estimate</div>
  <h2>Tell us about your project</h2>
  <p>Send a few details and ${company} will get you a clean, priced estimate — fast. No pressure, no obligation.</p>
  <form class="form" id="estForm">
    <div class="row"><input name="name" type="text" placeholder="Your name" required /><input name="phone" type="tel" placeholder="Phone" required /></div>
    <input name="city" type="text" placeholder="Address or neighborhood" />
    <textarea name="message" placeholder="What are you looking to do?"></textarea>
    <button class="btn lg" type="submit" style="justify-content:center">Request my free estimate →</button>
  </form>
  <div id="estOk" class="ok" style="display:none;margin-top:14px">✓ Thanks! ${company} got your request and will reach out shortly.</div>
</div></section>

<footer><div class="wrap"><div class="grid">
  <div><b>${company}</b>${area ? `<br>${esc(area)}` : ""}${phone ? `<br>📞 ${esc(phone)}` : ""}${email ? ` · ${email}` : ""}</div>
  <div><b>Get started</b><br><a href="#estimate" style="color:var(--accent);font-weight:700">Request a free estimate</a></div>
  ${license ? `<div><b>Licensed &amp; insured</b><br>${license}<br>Free estimates</div>` : ""}
</div><div class="powered">Website &amp; booking powered by <a href="https://bidtranslator.com">Bidtranslator</a></div></div></footer>
<script>
  var f=document.getElementById('estForm'), action=${JSON.stringify(leadAction)};
  f.addEventListener('submit',function(e){ e.preventDefault();
    var fd={ name:f.name.value, phone:f.phone.value, city:f.city.value, message:f.message.value, source:'Website', job_type:'' };
    var btn=f.querySelector('button'); btn.disabled=true; btn.textContent='Sending…';
    function done(){ f.style.display='none'; document.getElementById('estOk').style.display='block'; }
    if(!action){ done(); return; }
    fetch(action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(fd)})
      .then(done).catch(function(){ done(); });
  });
</script>
</body></html>`;
}
