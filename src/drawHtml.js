// Public, login-free draw-review page the property owner or bank/lender opens.
// Shows the documented progress (amount + description + photos) and lets them
// APPROVE (and pay, if a Stripe Connect link is present). No private bid data.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

export function renderDrawHTML(draw, opts = {}) {
  const company = esc(opts.company || "Your contractor");
  const title = esc(opts.jobTitle || "Project");
  const approved = draw.status === "approved" || draw.status === "paid";
  const paid = draw.status === "paid";
  const photos = (opts.photos && opts.photos.length)
    ? `<div class="photos">${opts.photos.map((p) => `<a href="${esc(p.url)}" target="_blank"><img src="${esc(p.url)}" alt="work completed"/></a>`).join("")}</div>`
    : "";

  const action = paid
    ? `<div class="ok">✓ Paid — thank you.</div>`
    : approved
      ? `<div class="ok">✓ Approved${draw.approved_by ? ` by ${esc(draw.approved_by)}` : ""}.</div>${draw.checkout_url ? `<a class="btn pay" href="${esc(draw.checkout_url)}">Pay ${money(draw.amount)} now</a>` : ""}`
      : `<div class="who"><input id="who" class="in" placeholder="Your name"/></div>
         <button id="approveBtn" class="btn" onclick="approve()">✓ Approve this draw</button>
         ${draw.checkout_url ? `<a class="btn pay" href="${esc(draw.checkout_url)}">Approve &amp; pay ${money(draw.amount)}</a>` : ""}
         <div class="fine">Approving confirms the work shown is complete to date.</div>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Draw request — ${company}</title>
<style>
  :root{--ink:#1F252C;--paper:#F3EEE3;--amber:#CF7F18;--blue:#1E4259;--muted:#6B6F5C;--rule:#e2dac9;--card:#fff;--green:#2f6d4a}
  *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
  .wrap{max-width:640px;margin:0 auto;padding:20px 16px 60px}
  .card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:22px;box-shadow:0 14px 40px rgba(31,37,44,.07)}
  .eyebrow{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);font-weight:800}
  h1{font-size:1.4rem;margin:4px 0 2px}
  .meta{color:var(--muted);font-size:.92rem}
  .amt{font-size:2.2rem;font-weight:900;color:var(--blue);margin:14px 0 2px}
  .amt span{font-size:.9rem;font-weight:600;color:var(--muted)}
  .desc{background:#fbf6ea;border:1px solid var(--rule);border-radius:10px;padding:12px;margin:14px 0;font-size:.96rem}
  .sec-h{font-weight:800;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin:18px 0 8px}
  .photos{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.photos img{width:100%;height:150px;object-fit:cover;border-radius:10px;border:1px solid var(--rule)}
  .actionbox{margin-top:22px;border-top:2px solid var(--ink);padding-top:18px}
  .in{width:100%;padding:13px;border:1px solid var(--rule);border-radius:10px;font-size:1rem;margin-bottom:10px}
  .btn{display:block;width:100%;text-align:center;background:var(--blue);color:#fff;border:none;border-radius:10px;padding:15px;font-weight:800;font-size:1.05rem;cursor:pointer;text-decoration:none;margin-bottom:10px}
  .btn.pay{background:var(--amber);color:#1F252C}
  .fine{color:var(--muted);font-size:.8rem;text-align:center}
  .ok{background:rgba(47,109,74,.12);color:var(--green);border-radius:10px;padding:14px;text-align:center;font-weight:700;margin-bottom:10px}
  .est{color:var(--muted);font-size:.8rem;text-align:center;margin-top:18px}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="eyebrow">Draw request</div>
  <h1>${title}</h1>
  <div class="meta">From <b>${company}</b></div>
  <div class="amt">${money(draw.amount)}<span> — progress draw</span></div>
  ${draw.description ? `<div class="desc">${esc(draw.description)}</div>` : ""}
  ${photos ? `<div class="sec-h">Work completed</div>${photos}` : ""}
  <div id="actionRegion" class="actionbox">${action}</div>
  <div class="est">Review the work shown, then approve${draw.checkout_url ? " or pay" : ""}.</div>
</div></div>
<script>
  var ID=${JSON.stringify(opts.id || "")};
  function approve(){
    var btn=document.getElementById('approveBtn'); var who=(document.getElementById('who')||{}).value||'';
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    fetch('/d/'+ID+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:who})})
      .then(function(r){return r.json()}).then(function(){
        document.getElementById('actionRegion').innerHTML='<div class="ok">✓ Approved — the contractor has been notified.</div>'+${JSON.stringify(draw.checkout_url ? `'<a class="btn pay" href="${esc(draw.checkout_url)}">Pay ${money(draw.amount)} now</a>'` : "''")};
      }).catch(function(){ if(btn){ btn.disabled=false; btn.textContent='✓ Approve this draw'; } });
  }
</script>
</body></html>`;
}
