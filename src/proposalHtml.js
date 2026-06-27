// Standalone HTML proposal page for homeowners who open a shared bid link.
// Built ONLY from buildProposal() output, so margin/notes can never appear
// (hard rule #2). Mirrors the in-app client view + the PDF.
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function lineDetail(l) {
  if (l.type === "hourly") return `${l.hours || 0} hrs @ ${money(l.rate)}/hr`;
  if (l.type === "unit") { const u = l.unit || "unit"; return `${l.qty || 0} ${u} @ ${money(l.rate)}/${u}`; }
  return "";
}
function lineRow(l) {
  const sub = lineDetail(l);
  return `<div class="row"><div class="d">${esc(l.desc)}${sub ? `<small>${esc(sub)}</small>` : ""}</div><div class="a">${money(l.amount)}</div></div>`;
}

// Accept / sign / pay-deposit call-to-action on the public proposal.
function acceptSection(p, o) {
  if (!o || !o.id) return "";
  const who = o.company ? esc(o.company) : "Your contractor";
  const signed = o.signedBy ? `<div class="signedby">Signed by ${esc(o.signedBy)}${o.signedAt ? " · " + esc(o.signedAt) : ""}</div>` : "";
  // Once signed, the client can download a copy of their countersigned agreement.
  const dl = o.signedPdfUrl ? `<a class="dlbtn" href="${esc(o.signedPdfUrl)}" target="_blank" rel="noopener">⬇ Download signed agreement (PDF)</a>` : "";
  if (o.depositPaid || o.justPaid)
    return `<div class="accepted">✓ Deposit paid — thank you!<br><span style="font-weight:600">${who} will reach out to schedule your start date.</span>${signed}${dl}</div>`;
  if (o.accepted)
    return `<div class="accepted">✓ Proposal accepted &amp; signed.${signed}${o.canPay
      ? `<form method="POST" action="/p/${o.id}/accept-and-pay" class="acceptform" style="margin-top:12px"><button class="acceptbtn">💳 Pay deposit · ${money(o.deposit)}</button></form>`
      : `<br><span style="font-weight:600">${who} will be in touch to schedule.</span>`}${dl}</div>`;
  // Not yet accepted — approval checkbox + signature pad (mouse/touch/stylus).
  const cta = o.canPay ? `Accept, Sign &amp; Pay Deposit · ${money(o.deposit)}` : "Accept &amp; Sign";
  return `<div class="signbox" id="signbox">
    <h3>Approve &amp; sign</h3>
    <label class="appr"><input type="checkbox" id="apprChk"><span>I have reviewed and approve this proposal.</span></label>
    <div class="signfield"><label>Your name</label><input id="signName" type="text" autocomplete="name" placeholder="Type your full name"></div>
    <div class="signfield"><label>Email <span style="text-transform:none;letter-spacing:0;color:var(--muted)">(we'll send your signed copy)</span></label><input id="signEmail" type="email" autocomplete="email" placeholder="you@email.com"></div>
    <div class="signfield"><label>Signature</label>
      <div class="padwrap"><canvas id="sigPad"></canvas><div class="padline"></div><div class="padhint" id="padHint">Sign with your finger or mouse</div><button type="button" class="padclear" id="padClear">Clear</button></div>
    </div>
    <button class="acceptbtn signbtn" id="signSubmit" disabled>${cta}</button>
    <div class="acceptnote">${o.canPay ? "Secure deposit by Stripe — balance due per your agreement." : "Lets your contractor know you're ready to get started."}</div>
    <div class="signerr" id="signErr"></div>
  </div>`;
}

// Inline (no-build) signature pad + submit. Only emitted while the pad is shown.
function signatureScript(o) {
  return `<script>(function(){
  var id=${JSON.stringify(String(o.id))};
  var chk=document.getElementById('apprChk'),name=document.getElementById('signName'),emailEl=document.getElementById('signEmail');
  var pad=document.getElementById('sigPad'),hint=document.getElementById('padHint');
  var clear=document.getElementById('padClear'),submit=document.getElementById('signSubmit'),err=document.getElementById('signErr');
  if(!pad||!submit) return;
  var ctx=pad.getContext('2d'),drawing=false,hasInk=false,last=null;
  (function size(){var r=pad.getBoundingClientRect(),dpr=window.devicePixelRatio||1;pad.width=Math.round(r.width*dpr);pad.height=Math.round(r.height*dpr);ctx.scale(dpr,dpr);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#1F252C';})();
  function pt(e){var r=pad.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function ready(){return chk.checked&&name.value.trim().length>0&&hasInk;}
  function refresh(){submit.disabled=!ready();}
  pad.addEventListener('pointerdown',function(e){drawing=true;last=pt(e);if(pad.setPointerCapture){try{pad.setPointerCapture(e.pointerId);}catch(x){}}e.preventDefault();});
  pad.addEventListener('pointermove',function(e){if(!drawing)return;var p=pt(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;if(!hasInk){hasInk=true;if(hint)hint.style.display='none';refresh();}e.preventDefault();});
  window.addEventListener('pointerup',function(){drawing=false;});
  clear.addEventListener('click',function(){ctx.clearRect(0,0,pad.width,pad.height);hasInk=false;if(hint)hint.style.display='';refresh();});
  chk.addEventListener('change',function(){refresh();if(chk.checked){try{navigator.sendBeacon('/p/'+id+'/event',new Blob([JSON.stringify({name:'approval_checked'})],{type:'application/json'}));}catch(x){}}});
  name.addEventListener('input',refresh);
  submit.addEventListener('click',async function(){
    if(!ready())return;var old=submit.textContent;submit.disabled=true;submit.textContent='Submitting…';err.textContent='';
    try{
      var res=await fetch('/p/'+id+'/sign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.value.trim(),email:((emailEl&&emailEl.value)||'').trim(),signature:pad.toDataURL('image/png'),approved:true,payNow:true})});
      var data=await res.json().catch(function(){return{};});
      if(!res.ok){err.textContent=data.error||'Something went wrong — please try again.';submit.disabled=false;submit.textContent=old;return;}
      window.location=data.checkout_url||('/p/'+id);
    }catch(x){err.textContent='Network error — please try again.';submit.disabled=false;submit.textContent=old;}
  });
})();</script>`;
}

export function renderProposalHTML(p, opts = {}) {
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
  .taxrow{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--rule);font-size:.95rem;color:var(--ink)}
  .taxrow.tax{margin-top:4px;padding-top:0;border-top:none;color:var(--muted)}
  .total{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:12px;border-top:2px solid var(--ink)}
  .total .l{font-weight:800;font-size:1.05rem}
  .total .v{font-weight:900;font-size:1.5rem;color:var(--blue)}
  .upg{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #efe9dc;font-size:.95rem}
  .upg .a{color:var(--amber);font-weight:600;white-space:nowrap}
  .note,.excl{font-size:.9rem;color:#5a5240;padding:3px 0}
  .muted{color:var(--muted)}
  .acceptform{margin:18px 0 6px;text-align:center}
  .acceptbtn{display:inline-block;width:100%;max-width:440px;background:var(--amber);color:#1F252C;border:none;border-radius:11px;padding:17px;font-size:1.06rem;font-weight:800;cursor:pointer}
  .acceptbtn:hover{filter:brightness(1.04)}
  .acceptnote{color:var(--muted);font-size:.78rem;margin-top:9px}
  .acceptbtn:disabled{opacity:.45;cursor:not-allowed}
  .signbox{margin:18px 0 6px;border:1px solid var(--rule);border-radius:12px;padding:16px;background:#fbf9f3}
  .signbox h3{margin:0 0 12px;font-size:1.02rem}
  .appr{display:flex;gap:10px;align-items:flex-start;font-size:.93rem;cursor:pointer;margin-bottom:14px;line-height:1.35}
  .appr input{width:21px;height:21px;margin:1px 0 0;flex:none}
  .signfield{margin-bottom:13px}
  .signfield label{display:block;font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:5px}
  .signfield input{width:100%;padding:12px;border:1px solid var(--rule);border-radius:9px;font-size:1rem;background:#fff;color:var(--ink)}
  .padwrap{position:relative;border:1px dashed #c9bfa8;border-radius:10px;background:#fff;touch-action:none}
  .padwrap canvas{display:block;width:100%;height:180px;border-radius:10px;cursor:crosshair}
  .padline{position:absolute;left:16px;right:16px;bottom:36px;border-bottom:1px solid #e7ddc6;pointer-events:none}
  .padhint{position:absolute;left:18px;bottom:14px;color:#c2b491;font-size:.82rem;pointer-events:none}
  .padclear{position:absolute;right:9px;top:8px;background:#f0ead9;border:1px solid var(--rule);border-radius:7px;font-size:.74rem;padding:5px 10px;cursor:pointer;color:#6b6249}
  .signbtn{margin-top:14px}
  .signerr{color:#b5341f;font-size:.85rem;margin-top:9px;min-height:1em;text-align:center}
  .signedby{font-weight:600;font-size:.87rem;margin-top:6px}
  .gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:6px}
  .gallery img{width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--rule);display:block}
  .accepted{margin:18px 0 6px;background:#eaf5ee;border:1px solid #b6dcc4;color:#2f6a44;border-radius:11px;padding:16px;text-align:center;font-weight:700}
  .dlbtn{display:inline-block;margin-top:14px;background:var(--blue);color:#fff;text-decoration:none;border-radius:10px;padding:13px 18px;font-weight:700;font-size:.95rem}
  .dlbtn:hover{filter:brightness(1.08)}
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
    ${p.tax > 0 ? `<div class="taxrow"><span>Subtotal</span><span>${money(p.subtotal)}</span></div>
    <div class="taxrow tax"><span>Sales tax (${p.taxRate}%)</span><span>${money(p.tax)}</span></div>` : ""}
    <div class="total"><span class="l">Total</span><span class="v">${money(p.total)}</span></div>
    ${acceptSection(p, opts)}
    ${(opts.photos && opts.photos.length) ? `<div class="eyebrow">Photos</div><div class="gallery">${opts.photos.map((ph) => `<img src="${esc(ph.url)}" alt="Project photo" loading="lazy">`).join("")}</div>` : ""}

    ${p.clientFurnished.length ? `<div class="eyebrow">Provided by client</div>${p.clientFurnished.map((l) => `<div class="row"><div class="d">${esc(l.desc)}</div><div class="a muted">by client</div></div>`).join("")}` : ""}
    ${p.upgrades.length ? `<div class="eyebrow">Optional upgrades</div>${p.upgrades.map((u) => `<div class="upg"><span>${esc(u.desc)}</span><span class="a">+ ${money(u.price)}</span></div>`).join("")}` : ""}
    ${p.exclusions.length ? `<div class="eyebrow">Not included</div>${p.exclusions.map((e) => `<div class="excl">✗ ${esc(e)}</div>`).join("")}` : ""}
    ${p.assumptions.length ? `<div class="eyebrow">Notes</div>${p.assumptions.map((a) => `<div class="note">• ${esc(a)}</div>`).join("")}` : ""}
    ${(p.terms && p.terms.length) ? `<div class="eyebrow">Terms &amp; protections</div>${p.terms.map((t) => `<div class="note">• ${esc(t)}</div>`).join("")}` : ""}
  </div>
  <div class="foot">${contact ? `<div class="contact">${contact}</div>` : ""}<div>${esc(p.footer)}</div></div>
</div>
${(opts.id && !opts.accepted && !opts.depositPaid && !opts.justPaid) ? signatureScript(opts) : ""}
</body></html>`;
}
