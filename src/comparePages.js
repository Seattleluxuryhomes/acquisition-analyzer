// Public, SEO comparison pages: "BidVoice vs {tool}". Served at /compare (index) and
// /vs/:slug. Contractors search "bidvoice vs jobber", "joist alternative", "best
// estimating app vs servicetitan" — these pages answer honestly and rank on merit.
//
// EDITORIAL LAW (from the founder + docs/product-principles.md — "trust over cleverness,
// never fabricate"): we NEVER attack a competitor. Every page says who each product is
// for, where the OTHER product genuinely excels (including when to pick it over us), and
// where BidVoice is simply different — then lets the reader decide. We describe each
// competitor only at the level of its well-established market positioning; we make no
// specific pricing/feature claims that could be wrong, and we tell readers to verify
// current details on the vendor's own site. Credibility is the whole point.
//
// Pure HTML + native <details> — no JS, fully crawlable, mobile-first. Same visual
// system as guidePage.js so the brand reads as one.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// What BidVoice actually is — the honest, stable frame we compare FROM. Not "better than,"
// but "a different job": the fastest way to turn a spoken job conversation into a priced,
// professional, bilingual bid, for the person who bids a lot and runs lean.
const BIDVOICE = {
  forWho: "A solo contractor or small crew who bids a lot and wants the estimate written the moment the walkthrough ends.",
  excels: [
    "Talk the job out loud → a structured, priced bid in about two minutes",
    "Built bilingual (ES/EN) — speak it one language, send it in the client's",
    "Capture works offline on the job site, syncs when you're back on signal",
    "Your margin and private notes never appear on the client's proposal — enforced in the app",
    "Send a branded PDF, e-sign, and collect a deposit from your phone",
  ],
};

// Each competitor, described by its established positioning only. `excels` is written
// generously and honestly; `pickThemIf` names the reader straight to them when they're the
// better fit — that honesty is what makes the "where we differ" credible.
const COMPETITORS = [
  {
    slug: "jobber",
    name: "Jobber",
    tagline: "Field-service management for a growing home-service business.",
    forWho: "Service businesses that need to schedule, dispatch, and manage a team's day-to-day work, not just bid it.",
    excels: [
      "Scheduling, dispatch, and calendar for a crew",
      "Client CRM, recurring jobs, and a client hub",
      "Invoicing and payments inside a broader ops workflow",
    ],
    pickThemIf: "your bottleneck is running and scheduling the work across a team — not writing the bid.",
    differ: "BidVoice isn't a scheduling/dispatch platform. It's the fastest path from a spoken job to a finished bilingual proposal. Many contractors bid in BidVoice and run the job elsewhere.",
  },
  {
    slug: "servicetitan",
    name: "ServiceTitan",
    tagline: "An enterprise platform for established home-services companies.",
    forWho: "Larger HVAC, plumbing, and electrical companies with dispatchers, call centers, and multiple crews.",
    excels: [
      "Deep operations: dispatch, call booking, and technician management at scale",
      "Reporting and business analytics for a bigger organization",
      "A broad, mature feature set for established teams",
    ],
    pickThemIf: "you're a sizable company that needs an all-in-one operating system for a large field team.",
    differ: "BidVoice is intentionally lean and phone-first for the one-person shop or small crew. Where ServiceTitan runs a big operation, BidVoice does one thing extremely well: turn a conversation into a bid, fast.",
  },
  {
    slug: "housecall-pro",
    name: "Housecall Pro",
    tagline: "All-in-one software for small home-service businesses.",
    forWho: "Small service businesses that want scheduling, dispatch, invoicing, and payments in one place.",
    excels: [
      "Scheduling and dispatch for a small team",
      "Invoicing, online payments, and customer communication",
      "A rounded set of operations tools for service work",
    ],
    pickThemIf: "you want a single app to schedule jobs, take payments, and manage customers day to day.",
    differ: "BidVoice focuses on the estimate itself — spoken, bilingual, offline-capable, with private pricing — rather than running the whole service operation. Different job, different tool.",
  },
  {
    slug: "joist",
    name: "Joist",
    tagline: "Simple estimates and invoices on your phone.",
    forWho: "Contractors who want a straightforward way to type up estimates and invoices and get paid.",
    excels: [
      "Quick, no-frills estimates and invoices from a phone",
      "A simple, familiar workflow for creating documents",
      "Getting a bill out the door fast",
    ],
    pickThemIf: "you prefer typing a simple estimate and mainly need clean invoicing.",
    differ: "BidVoice starts from your voice instead of a form — you talk the job and it writes the structured bid, in English or Spanish, and keeps your margin private. If you'd rather type, Joist is a clean choice; if you'd rather talk, that's the whole idea of BidVoice.",
  },
];

const byslug = Object.fromEntries(COMPETITORS.map((c) => [c.slug, c]));
export function comparisonSlugs() { return COMPETITORS.map((c) => c.slug); }

// Shared page chrome — same palette/type as the guide page so the brand is one system.
function shell({ title, desc, canonical, ld, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"/>
<link rel="canonical" href="${esc(canonical)}"/>
<meta property="og:type" content="article"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(desc)}"/>
<meta property="og:url" content="${esc(canonical)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(desc)}"/>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
<style>
  :root{ --amber:#CF7F18; --ink:#1b1b1f; --muted:#5b5b66; --line:#e9e6e0; --bg:#faf8f4; }
  *{ box-sizing:border-box; }
  html{ -webkit-text-size-adjust:100%; }
  body{ margin:0; font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
  a{ color:inherit; }
  .wrap{ max-width:760px; margin:0 auto; padding:0 20px; }
  header.top{ background:#fff; border-bottom:1px solid var(--line); }
  .top .wrap{ display:flex; align-items:center; justify-content:space-between; height:60px; }
  .brand{ display:flex; align-items:center; gap:10px; font-weight:800; letter-spacing:-.2px; text-decoration:none; }
  .brand .mk{ width:30px; height:30px; border-radius:8px; background:var(--amber); color:#fff; display:grid; place-items:center; font-weight:900; }
  .nav-cta{ background:var(--amber); color:#fff; text-decoration:none; font-weight:700; padding:9px 16px; border-radius:10px; font-size:14px; }
  .hero{ padding:48px 0 20px; }
  .hero .eyebrow{ color:var(--amber); font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-size:13px; }
  h1{ font-size:32px; line-height:1.18; letter-spacing:-.5px; margin:12px 0 12px; }
  .hero p.lede{ font-size:18px; color:var(--muted); margin:0; }
  .cta-row{ margin:22px 0 6px; }
  .btn{ display:inline-block; background:var(--amber); color:#fff; text-decoration:none; font-weight:800; padding:13px 24px; border-radius:12px; font-size:16px; box-shadow:0 6px 20px rgba(207,127,24,.28); }
  section{ padding:26px 0; }
  h2{ font-size:23px; letter-spacing:-.3px; margin:0 0 6px; }
  h3{ font-size:18px; margin:18px 0 6px; }
  .section-sub{ color:var(--muted); margin:0 0 18px; }
  .cols{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px; }
  .card h3{ margin:0 0 8px; font-size:17px; }
  .card.me{ border-color:rgba(207,127,24,.5); box-shadow:0 6px 20px rgba(207,127,24,.10); }
  ul.ticks{ list-style:none; margin:8px 0 0; padding:0; }
  ul.ticks li{ padding:5px 0 5px 26px; position:relative; color:var(--muted); }
  ul.ticks li::before{ content:"→"; position:absolute; left:0; color:var(--amber); font-weight:800; }
  .decide{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px; }
  .decide p{ margin:0 0 10px; }
  .decide .pick{ display:flex; gap:12px; align-items:flex-start; padding:10px 0; border-top:1px solid var(--line); }
  .decide .pick:first-of-type{ border-top:0; }
  .decide .pick .who{ flex:0 0 108px; font-weight:800; }
  .faqs{ display:grid; gap:10px; }
  details.faq{ background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  details.faq summary{ list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; font-weight:700; }
  details.faq summary::-webkit-details-marker{ display:none; }
  details.faq .chev{ flex:0 0 auto; width:24px; height:24px; border-radius:50%; background:var(--bg); display:grid; place-items:center; font-weight:800; color:var(--amber); transition:transform .15s; }
  details.faq[open] .chev{ transform:rotate(45deg); }
  details.faq .faq-a{ padding:0 18px 18px; color:var(--muted); }
  .band{ background:var(--ink); color:#fff; border-radius:20px; padding:32px 24px; text-align:center; margin:14px 0; }
  .band h2{ color:#fff; } .band p{ color:#d4d2cc; margin:6px 0 18px; }
  .band .btn{ box-shadow:none; }
  .note{ color:var(--muted); font-size:13px; margin-top:18px; }
  .more{ display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
  .more a{ text-decoration:none; border:1px solid var(--line); background:#fff; border-radius:999px; padding:8px 14px; font-weight:700; font-size:14px; }
  footer{ border-top:1px solid var(--line); padding:26px 0 50px; color:var(--muted); font-size:14px; text-align:center; }
  footer a{ text-decoration:none; color:var(--amber); font-weight:700; }
  @media(max-width:540px){ h1{ font-size:26px; } .cols{ grid-template-columns:1fr; } .decide .pick{ flex-direction:column; gap:2px; } .decide .pick .who{ flex-basis:auto; } }
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><span class="mk">B</span>BidVoice</a>
  <a class="nav-cta" href="/">Try it free</a>
</div></header>
<main class="wrap">
${body}
</main>
<footer><div class="wrap">
  &copy; BidVoice · <a href="/compare">Compare tools</a> · <a href="/guide">How it works</a> · <a href="/">Open the app</a>
</div></footer>
</body>
</html>`;
}

// A single "BidVoice vs {name}" page.
export function renderComparisonPage(slug, opts = {}) {
  const c = byslug[String(slug || "").toLowerCase()];
  if (!c) return null;
  const base = String(opts.baseUrl || "").replace(/\/$/, "");
  const canonical = base + "/vs/" + c.slug;

  const title = `BidVoice vs ${c.name}: an honest comparison for contractors`;
  const desc = `How BidVoice and ${c.name} compare — who each is for, where ${c.name} excels, and where BidVoice is different (voice-first, bilingual bids in minutes). You decide.`;

  // Honest FAQPage schema — real questions people search, answered without spin.
  const faq = [
    { q: `Is BidVoice a good ${c.name} alternative?`,
      a: `It depends on the job you're hiring the software for. ${c.name} is strong when ${c.pickThemIf} BidVoice is built for one thing: turning a spoken job conversation into a priced, professional, bilingual bid in a couple of minutes. If that's your bottleneck, it's a great fit — and you can try it free before deciding.` },
    { q: `What does BidVoice do that's different?`,
      a: `You talk the job out loud and BidVoice writes the structured estimate — in English or Spanish — with your margin and private notes kept off the client's proposal. Capture works offline on the job site, and you can send a branded PDF, e-sign, and collect a deposit from your phone.` },
    { q: `Can I use both?`,
      a: `Many contractors do. Bid the job in BidVoice for speed and a clean bilingual proposal, and run the rest of your operation wherever you run it today. They're not mutually exclusive.` },
  ];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Compare", item: base + "/compare" },
        { "@type": "ListItem", position: 2, name: `BidVoice vs ${c.name}`, item: canonical },
      ] },
      { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
  };

  const body = `
  <div class="hero">
    <div class="eyebrow">Honest comparison</div>
    <h1>BidVoice vs ${esc(c.name)}</h1>
    <p class="lede">${esc(c.tagline)} Here's who each one is for, where ${esc(c.name)} genuinely shines, and where BidVoice is different — so you can pick the right tool for the job you actually have.</p>
    <div class="cta-row"><a class="btn" href="/">Try BidVoice free</a></div>
  </div>

  <section>
    <h2>Who each one is for</h2>
    <div class="cols">
      <div class="card me">
        <h3>BidVoice</h3>
        <p>${esc(BIDVOICE.forWho)}</p>
      </div>
      <div class="card">
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.forWho)}</p>
      </div>
    </div>
  </section>

  <section>
    <h2>Where each one excels</h2>
    <div class="cols">
      <div class="card me">
        <h3>BidVoice is built for the bid</h3>
        <ul class="ticks">${BIDVOICE.excels.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
      <div class="card">
        <h3>${esc(c.name)} is strong at</h3>
        <ul class="ticks">${c.excels.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>
    </div>
  </section>

  <section>
    <h2>Where BidVoice is different</h2>
    <p class="section-sub">${esc(c.differ)}</p>
  </section>

  <section>
    <h2>So which should you pick?</h2>
    <div class="decide">
      <div class="pick"><div class="who">Pick ${esc(c.name)}</div><div>if ${esc(c.pickThemIf)}</div></div>
      <div class="pick"><div class="who">Pick BidVoice</div><div>if what slows you down is writing the estimate — especially across English and Spanish, on site, without giving up your private pricing.</div></div>
      <p class="note" style="margin-top:14px">The honest answer is that they're often not competing for the same job. The best way to know if BidVoice fits is to talk one real bid through it — it's free to try.</p>
    </div>
  </section>

  <section>
    <h2>Questions, answered</h2>
    <div class="faqs">${faq.map((f) => `
      <details class="faq"><summary><span>${esc(f.q)}</span><span class="chev" aria-hidden="true">+</span></summary>
      <div class="faq-a"><p>${esc(f.a)}</p></div></details>`).join("")}</div>
  </section>

  <div class="band">
    <h2>See your own words become a bid</h2>
    <p>Capture one real job by voice and watch the estimate come out. Free to try.</p>
    <a class="btn" href="/">Try BidVoice free</a>
  </div>

  <p class="note">Comparisons reflect each product's general market positioning and can change — always check the vendor's own site for their current features and pricing. This page is meant to help you choose, not to knock anyone: ${esc(c.name)} is a good product for the job it's built for.</p>

  <section>
    <h2>Compare with others</h2>
    <div class="more">${COMPETITORS.filter((o) => o.slug !== c.slug).map((o) => `<a href="/vs/${o.slug}">BidVoice vs ${esc(o.name)}</a>`).join("")}</div>
  </section>`;

  return shell({ title, desc, canonical, ld, body });
}

// The /compare index — links to every comparison, honest framing up top.
export function renderCompareIndex(opts = {}) {
  const base = String(opts.baseUrl || "").replace(/\/$/, "");
  const canonical = base + "/compare";
  const title = "BidVoice vs Jobber, ServiceTitan, Housecall Pro & Joist — honest comparisons";
  const desc = "Straight, no-spin comparisons of BidVoice and the tools contractors ask about. Who each is for, where each excels, and where BidVoice is different. You decide.";
  const ld = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: COMPETITORS.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: `BidVoice vs ${c.name}`, url: base + "/vs/" + c.slug })),
  };
  const cards = COMPETITORS.map((c) => `
    <a class="card" href="/vs/${c.slug}" style="text-decoration:none; display:block">
      <h3>BidVoice vs ${esc(c.name)}</h3>
      <p style="color:var(--muted); margin:0">${esc(c.tagline)}</p>
    </a>`).join("");
  const body = `
  <div class="hero">
    <div class="eyebrow">Honest comparisons</div>
    <h1>How BidVoice compares</h1>
    <p class="lede">No mudslinging. For each tool: who it's for, where it genuinely excels, and where BidVoice is simply different. The goal is to help you pick the right tool for the job you actually have.</p>
  </div>
  <section>
    <div class="cols">${cards}</div>
  </section>
  <div class="band">
    <h2>The fastest way to find out</h2>
    <p>Talk one real job through BidVoice and see the bid. Free to try — no credit card.</p>
    <a class="btn" href="/">Try BidVoice free</a>
  </div>`;
  return shell({ title, desc, canonical, ld, body });
}
