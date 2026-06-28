// Public, login-free scope-of-work page a sub opens from a dispatch link. Built
// ONLY from buildScope() output (work + photos), so price/margin/notes can never
// appear (hard rule #2). Chrome is bilingual (EN/ES) off the sub's language so the
// page itself is "in their language"; full scope-text translation is a later,
// AI-backed enhancement.
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Minimal i18n for the page labels. Default English; Spanish for es.
const T = {
  en: {
    scope: "Scope of work", from: "From", where: "Where", notes: "Note from the contractor",
    work: "The work", photos: "Photos", assumptions: "Good to know",
    accept: "✓ Got it — I'll do this", accepted: "Accepted", acceptedBy: "Accepted by",
    your: "Your name", confirm: "Confirm you'll take this job",
    thanks: "Thanks — the contractor has been notified you accepted.", est: "This is a scope of work, not a price.",
    bidTitle: "Send your bid", amount: "Your price ($)", bidNote: "Note (optional)",
    submitBid: "Send my bid", bidThanks: "Thanks — your bid was sent to the contractor.", bidSent: "Bid sent",
  },
  es: {
    scope: "Alcance del trabajo", from: "De", where: "Dónde", notes: "Nota del contratista",
    work: "El trabajo", photos: "Fotos", assumptions: "Bueno saber",
    accept: "✓ Entendido — yo lo hago", accepted: "Aceptado", acceptedBy: "Aceptado por",
    your: "Tu nombre", confirm: "Confirma que tomas este trabajo",
    thanks: "Gracias — el contratista fue notificado de que aceptaste.", est: "Esto es un alcance de trabajo, no un precio.",
    bidTitle: "Envía tu cotización", amount: "Tu precio ($)", bidNote: "Nota (opcional)",
    submitBid: "Enviar mi cotización", bidThanks: "Gracias — tu cotización fue enviada al contratista.", bidSent: "Cotización enviada",
  },
};

export function renderScopeHTML(scope, opts = {}) {
  const t = T[opts.lang === "es" ? "es" : "en"];
  const company = esc(opts.company || "Your contractor");
  const accepted = opts.status === "accepted";

  const sections = (scope.sections && scope.sections.length)
    ? scope.sections.map((g) => `
        <div class="grp"><div class="grp-h">${esc(g.name)}</div>
          ${g.items.map((i) => `<div class="item"><span>${esc(i.desc)}</span>${i.qty ? `<b>${esc(i.qty)} ${esc(i.unit || "")}</b>` : ""}</div>`).join("")}
        </div>`).join("")
    : (scope.items || []).map((i) => `<div class="item"><span>${esc(i.desc)}</span>${i.qty ? `<b>${esc(i.qty)} ${esc(i.unit || "")}</b>` : ""}</div>`).join("");

  const photos = (opts.photos && opts.photos.length)
    ? `<div class="sec"><div class="sec-h">${t.photos}</div><div class="photos">${opts.photos.map((p) => `<a href="${esc(p.url)}" target="_blank"><img src="${esc(p.url)}" alt=""/></a>`).join("")}</div></div>`
    : "";

  const assumptions = (scope.assumptions && scope.assumptions.length)
    ? `<div class="sec"><div class="sec-h">${t.assumptions}</div><ul>${scope.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>`
    : "";

  const isRfq = opts.kind === "rfq";
  const alreadyBid = opts.status === "bid";
  const acceptBlock = accepted
    ? `<div class="accepted">✓ ${t.accepted}${opts.acceptedBy ? ` · ${t.acceptedBy} ${esc(opts.acceptedBy)}` : ""}</div>`
    : isRfq
      ? (alreadyBid
          ? `<div class="accepted">✓ ${t.bidSent}${opts.bidAmount ? ` · $${esc(opts.bidAmount)}` : ""}</div>`
          : `<div class="acceptbox"><div class="bidh">${t.bidTitle}</div>
               <input id="who" class="in" placeholder="${t.your}" value="${esc(opts.subName || "")}"/>
               <input id="amt" class="in" type="number" inputmode="numeric" placeholder="${t.amount}"/>
               <textarea id="bnote" class="in" placeholder="${t.bidNote}" style="min-height:64px"></textarea>
               <button id="bidBtn" class="btn" onclick="sendBid()">${t.submitBid}</button></div>`)
      : `<div class="acceptbox">
           <input id="who" class="in" placeholder="${t.your}" value="${esc(opts.subName || "")}"/>
           <button id="acceptBtn" class="btn" onclick="accept()">${t.accept}</button>
           <div class="fine">${t.confirm}</div>
         </div>`;

  return `<!doctype html><html lang="${opts.lang === "es" ? "es" : "en"}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t.scope} — ${company}</title>
<style>
  :root{--ink:#1F252C;--paper:#F3EEE3;--amber:#CF7F18;--blue:#1E4259;--muted:#6B6F5C;--rule:#e2dac9;--card:#fff}
  *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.5}
  .wrap{max-width:640px;margin:0 auto;padding:20px 16px 60px}
  .card{background:var(--card);border:1px solid var(--rule);border-radius:16px;padding:20px;box-shadow:0 14px 40px rgba(31,37,44,.07)}
  .eyebrow{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);font-weight:800}
  h1{font-size:1.5rem;margin:4px 0 2px}
  .meta{color:var(--muted);font-size:.92rem;margin-bottom:4px}
  .note{background:#fbf6ea;border:1px solid var(--rule);border-radius:10px;padding:10px 12px;margin:14px 0;font-size:.95rem}
  .sec{margin-top:20px}.sec-h{font-weight:800;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-bottom:8px}
  .grp{margin-bottom:14px}.grp-h{font-weight:700;margin:0 0 4px}
  .item{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #efe9dc;font-size:.98rem}
  .item b{font-weight:700;white-space:nowrap;color:var(--blue)}
  ul{margin:6px 0 0;padding-left:18px;color:var(--muted);font-size:.9rem}li{margin:3px 0}
  .photos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.photos img{width:100%;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--rule)}
  .acceptbox{margin-top:24px;border-top:2px solid var(--ink);padding-top:18px}
  .bidh{font-weight:800;font-size:1.05rem;margin-bottom:10px}
  .acceptbox .in{margin-bottom:10px}
  .in{width:100%;padding:13px;border:1px solid var(--rule);border-radius:10px;font-size:1rem;margin-bottom:10px}
  .btn{width:100%;background:var(--amber);color:#1F252C;border:none;border-radius:10px;padding:15px;font-weight:800;font-size:1.05rem;cursor:pointer}
  .btn:disabled{opacity:.6}.fine{color:var(--muted);font-size:.8rem;text-align:center;margin-top:8px}
  .accepted{margin-top:24px;background:rgba(62,125,90,.14);color:#2f6d4a;border-radius:10px;padding:14px;text-align:center;font-weight:700}
  .est{color:var(--muted);font-size:.8rem;text-align:center;margin-top:18px}
</style></head><body>
<div class="wrap"><div class="card">
  <div class="eyebrow">${t.scope}</div>
  <h1>${esc(scope.title)}</h1>
  <div class="meta">${t.from}: <b>${company}</b></div>
  ${scope.address ? `<div class="meta">${t.where}: ${esc(scope.address)}</div>` : ""}
  ${opts.note ? `<div class="note"><b>${t.notes}:</b> ${esc(opts.note)}</div>` : ""}
  <div class="sec"><div class="sec-h">${t.work}</div>${sections || `<div class="item"><span>—</span></div>`}</div>
  ${photos}
  ${assumptions}
  <div id="acceptRegion">${acceptBlock}</div>
  ${isRfq ? "" : `<div class="est">${t.est}</div>`}
</div></div>
<script>
  var ID=${JSON.stringify(opts.id || "")};
  function accept(){
    var btn=document.getElementById('acceptBtn'); var who=(document.getElementById('who')||{}).value||'';
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    fetch('/s/'+ID+'/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:who})})
      .then(function(r){return r.json()}).then(function(){
        document.getElementById('acceptRegion').innerHTML='<div class="accepted">✓ '+${JSON.stringify(t.thanks)}+'</div>';
      }).catch(function(){ if(btn){ btn.disabled=false; btn.textContent=${JSON.stringify(t.accept)}; } });
  }
  function sendBid(){
    var btn=document.getElementById('bidBtn');
    var amt=(document.getElementById('amt')||{}).value||'', who=(document.getElementById('who')||{}).value||'', note=(document.getElementById('bnote')||{}).value||'';
    if(!amt){ var a=document.getElementById('amt'); if(a){ a.focus(); } return; }
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    fetch('/s/'+ID+'/bid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:amt,note:(who?('['+who+'] '):'')+note})})
      .then(function(r){return r.json()}).then(function(){
        document.getElementById('acceptRegion').innerHTML='<div class="accepted">✓ '+${JSON.stringify(t.bidThanks)}+'</div>';
      }).catch(function(){ if(btn){ btn.disabled=false; btn.textContent=${JSON.stringify(t.submitBid)}; } });
  }
  // beacon: mark viewed
  try{ fetch('/s/'+ID+'/viewed',{method:'POST'}); }catch(e){}
</script>
</body></html>`;
}
