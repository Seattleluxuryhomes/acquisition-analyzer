// Public, login-free change-order page the client opens to review and E-SIGN the
// extra/changed work (and pay, if a Stripe Connect link is present). Client-facing
// amounts only — no margin/notes (hard rule #2).
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(Number(n) || 0)).toLocaleString("en-US");

export function renderChangeOrderHTML(co, opts = {}) {
  const company = esc(opts.company || "Your contractor");
  const title = esc(opts.jobTitle || "Project");
  const approved = co.status === "approved" || co.status === "paid";
  const paid = co.status === "paid";
  const declined = co.status === "declined";

  const items = (co.line_items && co.line_items.length)
    ? `<div class="lines">${co.line_items.map((l) => `<div class="ln"><span>${esc(l.desc)}</span><b>${money(l.amount)}</b></div>`).join("")}</div>`
    : "";

  const action = paid
    ? `<div class="ok">✓ Paid — thank you.</div>`
    : approved
      ? `<div class="ok">✓ Approved${co.signed_by ? ` by ${esc(co.signed_by)}` : ""}.</div>${co.checkout_url ? `<a class="btn pay" href="${esc(co.checkout_url)}">Pay ${money(co.amount)} now</a>` : ""}`
      : declined
        ? `<div class="no">This change order was declined. Contact ${company} with any questions.</div>`
        : `<div class="who"><input id="who" class="in" placeholder="Type your full name to approve"/></div>
           <button id="approveBtn" class="btn" onclick="approve()">✓ Approve &amp; e-sign</button>
           ${co.checkout_url ? `<a class="btn pay" href="${esc(co.checkout_url)}">Approve &amp; pay ${money(co.amount)}</a>` : ""}
           <button class="btn ghost" onclick="decline()">Decline</button>
           <div class="fine">Approving authorizes this change to the original agreement and the amount shown.</div>`;

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Change order #${co.number} — ${company}</title>
<style>
  :root{--ink:#1F252C;--paper:#F3EEE3;--amber:#CF7F18;--blue:#1E4259;--muted:#6B6F5C;--rule:#e2dac9;--card:#fff;--green:#2f6d4a;--red:#a3431f}
  *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
  .wrap{max-width:640px;margin:0 auto;padding:20px 16px 60px}
  .card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:22px;box-shadow:0 14px 40px rgba(31,37,44,.07)}
  .eyebrow{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);font-weight:800}
  h1{font-size:1.35rem;margin:4px 0 2px}
  .meta{color:var(--muted);font-size:.92rem}
  .desc{background:#fbf6ea;border:1px solid var(--rule);border-radius:10px;padding:12px;margin:14px 0;font-size:.96rem;white-space:pre-wrap}
  .lines{margin:14px 0;border-top:1px solid var(--rule)}
  .ln{display:flex;justify-content:space-between;gap:12px;padding:10px 2px;border-bottom:1px solid var(--rule);font-size:.96rem}
  .ln b{white-space:nowrap}
  .total{display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 2px}
  .total .amt{font-size:2rem;font-weight:900;color:var(--blue)}
  .total .lbl{font-weight:800;text-transform:uppercase;font-size:.78rem;letter-spacing:.06em;color:var(--muted)}
  .actionbox{margin-top:22px;border-top:2px solid var(--ink);padding-top:18px}
  .in{width:100%;padding:13px;border:1px solid var(--rule);border-radius:10px;font-size:1rem;margin-bottom:10px}
  .btn{display:block;width:100%;text-align:center;background:var(--blue);color:#fff;border:none;border-radius:10px;padding:15px;font-weight:800;font-size:1.05rem;cursor:pointer;text-decoration:none;margin-bottom:10px}
  .btn.pay{background:var(--amber);color:#1F252C}
  .btn.ghost{background:transparent;color:var(--muted);border:1px solid var(--rule);font-weight:600;font-size:.95rem;padding:11px}
  .fine{color:var(--muted);font-size:.8rem;text-align:center}
  .ok{background:rgba(47,109,74,.12);color:var(--green);border-radius:10px;padding:14px;text-align:center;font-weight:700;margin-bottom:10px}
  .no{background:rgba(163,67,31,.1);color:var(--red);border-radius:10px;padding:14px;text-align:center;font-weight:600}
  .est{color:var(--muted);font-size:.8rem;text-align:center;margin-top:18px}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="eyebrow">Change order #${co.number}</div>
  <h1>${co.title ? esc(co.title) : "Change to your project"}</h1>
  <div class="meta">${title} · from <b>${company}</b></div>
  ${co.description ? `<div class="desc">${esc(co.description)}</div>` : ""}
  ${items}
  <div class="total"><span class="lbl">${co.amount < 0 ? "Credit to you" : "Additional cost"}</span><span class="amt">${money(co.amount)}</span></div>
  <div id="actionRegion" class="actionbox">${action}</div>
  <div class="est">Review the change, then approve${co.checkout_url ? " or pay" : ""}. This adds to your original agreement.</div>
</div></div>
<script>
  var ID=${JSON.stringify(opts.id || "")};
  function approve(){
    var btn=document.getElementById('approveBtn'); var who=(document.getElementById('who')||{}).value||'';
    if(!who.trim()){ alert('Please type your name to approve.'); return; }
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    fetch('/co/'+ID+'/approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:who})})
      .then(function(r){return r.json()}).then(function(){
        document.getElementById('actionRegion').innerHTML='<div class="ok">✓ Approved &amp; signed — the contractor has been notified.</div>'+${JSON.stringify(co.checkout_url ? `'<a class="btn pay" href="${esc(co.checkout_url)}">Pay ${money(co.amount)} now</a>'` : "''")};
      }).catch(function(){ if(btn){ btn.disabled=false; btn.textContent='✓ Approve & e-sign'; } });
  }
  function decline(){
    if(!confirm('Decline this change order?')) return;
    fetch('/co/'+ID+'/decline',{method:'POST'}).then(function(){
      document.getElementById('actionRegion').innerHTML='<div class="no">Declined. The contractor has been notified.</div>';
    });
  }
</script>
</body></html>`;
}
