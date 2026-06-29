// Public, SEO-optimized "How it works + FAQ" page for Bidtranslator itself
// (product-level, not per-contractor). Served at /guide, /how-it-works, /faq.
//
// Why it exists: contractors Google "how to write a bid fast", "voice to estimate
// app", "presupuesto rápido para contratistas". This page answers those in plain
// language AND ships HowTo + FAQPage JSON-LD so Google can surface it as a rich
// result. It's a contractor-facing instruction guide and our best evergreen SEO.
//
// Pure HTML + native <details> accordions — no JS, fully crawlable, mobile-first.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// The instruction guide, as steps. Each becomes a visual card AND a HowTo step in
// the structured data — one source of truth so the page and the schema never drift.
const STEPS = [
  { n: 1, icon: "🎤", title: "Talk through the job",
    text: "Tap the mic and describe the work out loud — the way you'd tell your crew. “Dig out a 40-by-60 foundation, three feet deep, haul off the spoils, two days with the excavator.” No forms, no typing. You can speak English or Spanish." },
  { n: 2, icon: "📝", title: "It writes the bid",
    text: "Bidtranslator transcribes what you said and pulls out the scope, the materials, the labor, and the measurements — organized into a clean draft estimate. If it needs one more detail, it asks you a simple question." },
  { n: 3, icon: "🔒", title: "You set your price",
    text: "The numbers are yours. You set your prices and your margin, and your margin and private notes are never shown to the customer or printed on the proposal. The AI only drafts the scope — you own the money." },
  { n: 4, icon: "📄", title: "Send a clean proposal",
    text: "Send a professional PDF proposal with your logo, right from your phone. Your client can review it, e-sign it, and pay a deposit online — so you lock the job before you leave the driveway." },
];

// The Q&A. Real answers, written to rank — these are the questions contractors
// actually type into Google. Keep them honest; they double as our support docs.
const FAQ = [
  { q: "How do I write a bid with my voice?",
    a: "Open Bidtranslator, tap the microphone, and describe the job out loud like you'd explain it to your crew. It transcribes what you said and turns it into a structured estimate — scope, materials, and labor — in seconds. You review the price, then send it. No typing required." },
  { q: "Does it work in Spanish?",
    a: "Yes. Bidtranslator is built for bilingual contractors. You can speak the job in Spanish (or English) and send your customer a clean proposal in the language they read. It's made for residential remodelers who work across both languages every day." },
  { q: "Is my pricing and margin private from the customer?",
    a: "Always. Your margin and any private notes never appear in the customer's view or on the PDF proposal — that's enforced in the app, not just a setting. The customer sees a professional bid; your numbers stay yours." },
  { q: "Can I still build a bid by hand?",
    a: "Yes. The voice and AI step is there to save you time, but you can write, edit, or price any bid by hand at any point. If you'd rather type, type. You're always in control of the final numbers." },
  { q: "Does it work on the job site without signal?",
    a: "Capturing the job — your voice, notes, and photos — works offline and syncs automatically once you're back on signal. You can stand in an empty lot with no bars, talk through the whole job, and it'll be waiting for you." },
  { q: "How does my customer get the proposal?",
    a: "You send them a link or a PDF straight from your phone. They open it on any device, review the scope and price, e-sign to accept, and can pay a deposit online — so you can win the job on the spot instead of waiting days." },
  { q: "What trades does it work for?",
    a: "Bidtranslator handles the residential trades — excavation and dirt work, windows and doors, roofing, siding, concrete, fencing, decking, painting, flooring, drywall, electrical, plumbing, HVAC, kitchen and bath remodels, and more. It understands the right terms for each trade." },
  { q: "Do I need to type anything?",
    a: "No. The whole point is that you talk and it writes. You can review and tweak with a tap if you want, but a complete bid can come entirely from your voice." },
  { q: "How much does it cost?",
    a: "It's free to try. You can capture a job and see a real bid come out of your own words before you pay anything. Pricing for ongoing use is straightforward and built for a one-person or small crew." },
  { q: "Why should I use this instead of writing bids at night?",
    a: "Because that hour you spend at the kitchen table after dinner is time you don't get back. Bidtranslator turns a job conversation into a finished, professional proposal in a couple of minutes — so you bid faster, look sharper, and get your evenings back." },
];

export function renderGuidePage(opts = {}) {
  const base = String(opts.baseUrl || "").replace(/\/$/, "");
  const appUrl = base ? base + "/" : "/";
  const canonical = base + "/guide";
  const title = "How to Write a Bid by Voice — Bidtranslator Guide & FAQ";
  const desc = "Talk through a job and Bidtranslator writes the bid. Step-by-step guide and answers for contractors: voice estimates, Spanish, private pricing, e-sign, and deposits.";

  // HowTo + FAQPage structured data, generated from the same STEPS/FAQ above.
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        "name": "How to write a contractor bid with your voice",
        "description": "Turn a job conversation into a professional proposal in minutes with Bidtranslator.",
        "totalTime": "PT2M",
        "step": STEPS.map((s) => ({ "@type": "HowToStep", "position": s.n, "name": s.title, "text": s.text })),
      },
      {
        "@type": "FAQPage",
        "mainEntity": FAQ.map((f) => ({
          "@type": "Question", "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  };

  const stepCards = STEPS.map((s) => `
    <li class="step">
      <div class="step-n"><span class="step-ic">${s.icon}</span><span class="step-num">${s.n}</span></div>
      <div class="step-b"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>
    </li>`).join("");

  const faqItems = FAQ.map((f) => `
    <details class="faq">
      <summary><span>${esc(f.q)}</span><span class="chev" aria-hidden="true">+</span></summary>
      <div class="faq-a"><p>${esc(f.a)}</p></div>
    </details>`).join("");

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
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  :root{ --amber:#CF7F18; --ink:#1b1b1f; --muted:#5b5b66; --line:#e9e6e0; --bg:#faf8f4; }
  *{ box-sizing:border-box; }
  html{ -webkit-text-size-adjust:100%; }
  body{ margin:0; font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
  a{ color:inherit; }
  .wrap{ max-width:760px; margin:0 auto; padding:0 20px; }
  header.top{ background:#fff; border-bottom:1px solid var(--line); }
  .top .wrap{ display:flex; align-items:center; justify-content:space-between; height:60px; }
  .brand{ display:flex; align-items:center; gap:10px; font-weight:800; letter-spacing:-.2px; }
  .brand .mk{ width:30px; height:30px; border-radius:8px; background:var(--amber); color:#fff; display:grid; place-items:center; font-weight:900; }
  .nav-cta{ background:var(--amber); color:#fff; text-decoration:none; font-weight:700; padding:9px 16px; border-radius:10px; font-size:14px; }
  .hero{ padding:54px 0 30px; text-align:center; }
  .hero .eyebrow{ color:var(--amber); font-weight:800; letter-spacing:.06em; text-transform:uppercase; font-size:13px; }
  h1{ font-size:34px; line-height:1.15; letter-spacing:-.5px; margin:12px 0 14px; }
  .hero p.lede{ font-size:18px; color:var(--muted); max-width:560px; margin:0 auto; }
  .cta-row{ margin:26px 0 6px; }
  .btn{ display:inline-block; background:var(--amber); color:#fff; text-decoration:none; font-weight:800; padding:14px 26px; border-radius:12px; font-size:16px; box-shadow:0 6px 20px rgba(207,127,24,.28); }
  .sub{ color:var(--muted); font-size:14px; margin-top:10px; }
  section{ padding:30px 0; }
  h2{ font-size:24px; letter-spacing:-.3px; margin:0 0 6px; }
  .section-sub{ color:var(--muted); margin:0 0 22px; }
  ol.steps{ list-style:none; margin:0; padding:0; display:grid; gap:14px; }
  .step{ display:flex; gap:16px; background:#fff; border:1px solid var(--line); border-radius:16px; padding:18px 18px; }
  .step-n{ flex:0 0 auto; width:50px; text-align:center; }
  .step-ic{ font-size:26px; display:block; }
  .step-num{ display:inline-grid; place-items:center; width:24px; height:24px; margin-top:6px; border-radius:50%; background:var(--amber); color:#fff; font-size:13px; font-weight:800; }
  .step-b h3{ margin:2px 0 6px; font-size:18px; }
  .step-b p{ margin:0; color:var(--muted); }
  .faqs{ display:grid; gap:10px; }
  details.faq{ background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden; }
  details.faq summary{ list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 18px; font-weight:700; }
  details.faq summary::-webkit-details-marker{ display:none; }
  details.faq .chev{ flex:0 0 auto; width:24px; height:24px; border-radius:50%; background:var(--bg); display:grid; place-items:center; font-weight:800; color:var(--amber); transition:transform .15s; }
  details.faq[open] .chev{ transform:rotate(45deg); }
  details.faq .faq-a{ padding:0 18px 18px; color:var(--muted); }
  details.faq .faq-a p{ margin:0; }
  .band{ background:var(--ink); color:#fff; border-radius:20px; padding:34px 24px; text-align:center; margin:14px 0; }
  .band h2{ color:#fff; }
  .band p{ color:#d4d2cc; margin:6px 0 20px; }
  .band .btn{ box-shadow:none; }
  footer{ border-top:1px solid var(--line); padding:26px 0 50px; color:var(--muted); font-size:14px; text-align:center; }
  footer a{ text-decoration:none; color:var(--amber); font-weight:700; }
  @media(max-width:540px){ h1{ font-size:28px; } .hero{ padding:38px 0 20px; } }
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="${esc(appUrl)}" style="text-decoration:none"><span class="mk">B</span>Bidtranslator</a>
  <a class="nav-cta" href="${esc(appUrl)}">Try it free</a>
</div></header>

<main class="wrap">
  <div class="hero">
    <div class="eyebrow">For contractors</div>
    <h1>Talk through the job. We write the bid.</h1>
    <p class="lede">Stop writing estimates at the kitchen table at night. Describe the work out loud — in English or Spanish — and Bidtranslator turns it into a professional proposal in about two minutes.</p>
    <div class="cta-row"><a class="btn" href="${esc(appUrl)}">Start a bid free</a></div>
    <div class="sub">No credit card to try · Works by voice or typing · Your prices stay private</div>
  </div>

  <section>
    <h2>How it works</h2>
    <p class="section-sub">Four steps, start to finish — all from your phone.</p>
    <ol class="steps">${stepCards}</ol>
  </section>

  <section>
    <h2>Questions, answered</h2>
    <p class="section-sub">The stuff contractors actually ask before they try it.</p>
    <div class="faqs">${faqItems}</div>
  </section>

  <div class="band">
    <h2>Your evenings back, starting today</h2>
    <p>Capture one real job with your voice and watch the bid come out. Free to try.</p>
    <a class="btn" href="${esc(appUrl)}">Try Bidtranslator free</a>
  </div>
</main>

<footer><div class="wrap">
  &copy; Bidtranslator · <a href="${esc(appUrl)}">Open the app</a>
</div></footer>
</body>
</html>`;
}
