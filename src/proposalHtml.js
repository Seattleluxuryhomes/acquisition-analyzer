// Standalone HTML proposal page for homeowners who open a shared bid link.
// Built ONLY from buildProposal() output, so margin/notes can never appear
// (hard rule #2). Mirrors the in-app client view + the PDF.
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function lineRow(l) {
  const sub = l.type === "hourly" ? `${l.hours || 0} hrs @ ${money(l.rate)}/hr` : "";
  return `<div class="row"><div class="d">${esc(l.desc)}${sub ? `<small>${esc(sub)}</small>` : ""}</div><div class="a">${money(l.amount)}</div></div>`;
}

export function renderProposalHTML(p) {
  const scope = (p.sections && p.sections.length)
    ? p.sections.map((g) => `<div class="grp"><div class="grp-h">${esc(g.name)}</div>
        ${g.lines.map(lineRow).join("")}
        <div class="row sub"><div class="d">${esc(g.name)} subtotal</div><div class="a">${money(g.subtotal)}</div></div></div>`).join("")
    : (p.scope.length ? p.scope.map(lineRow).join("") : `<div class="muted">No items yet.</div>`);

  // Contact block for the footer — pulled from the contractor's Setup profile.
  const contact = [p.business.company, p.business.name, p.business.phone, p.business.email,
    p.business.license ? "Lic. " + p.business.license : ""].filter(Boolean).map(esc).join("  ·  ");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} — Estimate</title>
<style>
  :root{--ink:#1F252C;--amber:#CF7F18;--blue:#1E4259;--paper:#F3EEE3;--muted:#8a7f68;--rule:#e0d8c6}
  *{box-sizing:border-box}
  body{margin:0;background:#ece5d6;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
  .wrap{max-width:640px;margin:0 auto;background:#fff;min-height:100vh;box-shadow:0 0 40px rgba(0,0,0,.08)}
  .head{background:var(--ink);color:#F3EEE3;padding:30px 24px;text-align:center;border-bottom:3px solid var(--amber)}
  .head .logo{max-height:60px;max-width:72%;margin:0 auto 8px;display:block}
  .head .co{font-size:1.4rem;font-weight:800}
  .head .meta{font-size:.82rem;color:#b9c2cc;margin-top:6px}
  .body{padding:22px 24px}
  .eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);margin:18px 0 6px}
  h1{font-size:1.25rem;margin:2px 0 0}
  .date{color:var(--muted);font-size:.85rem;margin-top:2px}
  .grp{margin-bottom:6px}
  .grp-h{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);font-weight:700;margin:16px 0 4px}
  .row{display:flex;justify-content:space-between;gap:14px;padding:10px 0;border-bottom:1px solid #efe9dc;font-size:.97rem}
  .row .d{color:var(--ink)}
  .row .d small{display:block;color:var(--muted);font-size:.72rem;margin-top:2px}
  .row .a{font-weight:600;white-space:nowrap}
  .row.sub{border-bottom:none}
  .row.sub .d{color:var(--muted);font-style:italic}
  .row.sub .a{color:#5a5240}
  .total{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:14px;border-top:2px solid var(--ink)}
  .total .l{font-weight:800;font-size:1.05rem}
  .total .v{font-weight:900;font-size:1.5rem;color:var(--blue)}
  .upg{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #efe9dc;font-size:.95rem}
  .upg .a{color:var(--amber);font-weight:600;white-space:nowrap}
  .note,.excl{font-size:.9rem;color:#5a5240;padding:3px 0}
  .muted{color:var(--muted)}
  .foot{padding:18px 24px;border-top:1px solid var(--rule);color:var(--muted);font-size:.78rem}
  .foot .contact{color:var(--ink);font-weight:600;font-size:.86rem;margin-bottom:6px}
</style></head>
<body><div class="wrap">
  <div class="head">${p.business.logo && /^data:image\//.test(p.business.logo) ? `<img class="logo" src="${esc(p.business.logo)}" alt="">` : `<div class="co">${esc(p.business.company)}</div>`}</div>
  <div class="body">
    <div class="eyebrow">Prepared for</div>
    <h1>${esc(p.customer || p.title)}</h1>${p.customer ? `<div class="muted" style="font-size:.92rem;margin-top:2px">${esc(p.title)}</div>` : ""}<div class="date">${esc(p.date)}</div>

    <div class="eyebrow">Scope of work</div>
    ${scope}
    <div class="total"><span class="l">Total</span><span class="v">${money(p.total)}</span></div>

    ${p.clientFurnished.length ? `<div class="eyebrow">Provided by client</div>${p.clientFurnished.map((l) => `<div class="row"><div class="d">${esc(l.desc)}</div><div class="a muted">by client</div></div>`).join("")}` : ""}
    ${p.upgrades.length ? `<div class="eyebrow">Optional upgrades</div>${p.upgrades.map((u) => `<div class="upg"><span>${esc(u.desc)}</span><span class="a">+ ${money(u.price)}</span></div>`).join("")}` : ""}
    ${p.exclusions.length ? `<div class="eyebrow">Not included</div>${p.exclusions.map((e) => `<div class="excl">✗ ${esc(e)}</div>`).join("")}` : ""}
    ${p.assumptions.length ? `<div class="eyebrow">Notes</div>${p.assumptions.map((a) => `<div class="note">• ${esc(a)}</div>`).join("")}` : ""}
  </div>
  <div class="foot">${contact ? `<div class="contact">${contact}</div>` : ""}<div>${esc(p.footer)}</div></div>
</div></body></html>`;
}
