/* BidVoice front end — vanilla, mobile-first. Speak the offer, get the package. */

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const nav = $('#nav');

const state = {
  route: 'dashboard',
  broker: null,
  catalog: null, // { property_types, addenda, always_included, defaults }
  offers: [],
  offer: null, // full current offer
  signing: null,
  draft: { type: 'residential', transcript: '' },
};

/* ------------------------------- API -------------------------------------- */
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}
const money = (n) => (n ? '$' + Number(n).toLocaleString('en-US') : '—');
const cap = (s) => {
  s = String(s || '').trim();
  if (!s) return '—';
  if (['fha', 'va'].includes(s.toLowerCase())) return s.toUpperCase();
  return s[0].toUpperCase() + s.slice(1);
};
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = (ts) => {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
};

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

/* ----------------------------- Icons -------------------------------------- */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8M5 9v11h14V9"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24">${ICONS[n] || ICONS.home}</svg>`;

/* ------------------------------- Boot ------------------------------------- */
async function boot() {
  try {
    const [broker, catalog] = await Promise.all([api('GET', '/broker'), api('GET', '/forms')]);
    state.broker = broker;
    state.catalog = catalog;
    nav.hidden = false;
    nav.querySelectorAll('.nav-btn').forEach((b) =>
      b.addEventListener('click', () => go(b.dataset.route))
    );
    go('dashboard');
  } catch (e) {
    app.innerHTML = `<div class="empty"><div class="big">⚠️</div><p>${esc(e.message)}</p></div>`;
  }
}

function go(route, opts = {}) {
  state.route = route;
  Object.assign(state, opts);
  nav.querySelectorAll('.nav-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === route || (route === 'type' && b.dataset.route === 'new'))
  );
  window.scrollTo(0, 0);
  render();
}

/* ------------------------------ Header ------------------------------------ */
function header(sub) {
  return `<div class="head">
    <div class="brand"><span class="dot"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="#fff" stroke-width="1.7"/></svg></span>BidVoice</div>
    <div class="sub">${esc(sub || '')}</div>
  </div>`;
}
const backBtn = (route, label) => `<button class="back" data-go="${route}"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>${esc(label)}</button>`;

/* ------------------------------- Render ----------------------------------- */
function render() {
  const views = {
    dashboard: viewDashboard,
    type: viewType,
    capture: viewCapture,
    new: viewType,
    coordinating: viewCoordinating,
    summary: viewSummary,
    signing: viewSigning,
    settings: viewSettings,
  };
  (views[state.route] || viewDashboard)();
  app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

/* ---------------------------- Dashboard ----------------------------------- */
async function viewDashboard() {
  app.innerHTML = header('Offer dashboard') + `<div id="list"><div class="spin"></div></div>`;
  try {
    const { offers } = await api('GET', '/offers');
    state.offers = offers;
    const list = $('#list');
    if (!offers.length) {
      list.innerHTML = `<div class="empty"><div class="big">🎙️</div>
        <h2>Write your first offer</h2>
        <p class="muted">Tap the mic, speak the deal, get a complete NWMLS package.</p>
        <div style="margin-top:18px"><button class="btn" data-go="type">Start an offer</button></div></div>`;
    } else {
      list.innerHTML =
        `<button class="btn" data-go="type" style="margin-bottom:16px">+ New offer</button>` +
        offers
          .map(
            (o) => `<div class="card offer-row" data-offer="${o.id}" style="margin-bottom:10px">
        <div class="ic">${icon((state.catalog.property_types.find((p) => p.id === o.property_type) || {}).icon)}</div>
        <div class="body">
          <div class="t">${esc(o.title || 'Untitled offer')}</div>
          <div class="s">${money(o.purchase_price)} · ${ago(o.updated_at)}</div>
        </div>
        <span class="pill ${o.status}">${o.status}</span>
      </div>`
          )
          .join('');
    }
    list.querySelectorAll('[data-offer]').forEach((c) =>
      c.addEventListener('click', () => openOffer(c.dataset.offer))
    );
    list.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  } catch (e) {
    $('#list').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

async function openOffer(id) {
  try {
    const { offer, signing } = await api('GET', '/offers/' + id);
    state.offer = offer;
    state.signing = signing;
    go('summary');
  } catch (e) {
    toast(e.message);
  }
}

/* --------------------------- New: property type --------------------------- */
function viewType() {
  const types = state.catalog.property_types;
  app.innerHTML =
    header('New offer') +
    backBtn('dashboard', 'Offers') +
    `<h1>What are you buying?</h1>
     <p class="muted" style="margin:4px 2px 18px">Pick the transaction type — it sets the base NWMLS form.</p>
     <div class="grid">` +
    types
      .map(
        (t) => `<div class="type-card ${t.id === state.draft.type ? 'sel' : ''}" data-type="${t.id}">
        ${icon(t.icon)}
        <div class="l">${esc(t.label)}</div>
        <div class="n">Form ${esc(t.base)}${t.verify ? ' · confirm' : ''}</div>
      </div>`
      )
      .join('') +
    `</div>
     <div style="margin-top:22px"><button class="btn" id="toCapture">Continue<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`;

  app.querySelectorAll('[data-type]').forEach((c) =>
    c.addEventListener('click', () => {
      state.draft.type = c.dataset.type;
      app.querySelectorAll('.type-card').forEach((x) => x.classList.toggle('sel', x === c));
    })
  );
  $('#toCapture').addEventListener('click', () => go('capture'));
}

/* ------------------------------ Capture ----------------------------------- */
let recognition = null;
let recognizing = false;

function viewCapture() {
  const t = state.catalog.property_types.find((p) => p.id === state.draft.type);
  const example = `"Write an offer. Purchase price one million two fifty. Twenty percent down, conventional financing. Ten-day inspection. Five thousand earnest. Close in thirty days. Buyer pays owner's title. Offer expires tomorrow at 5 PM. Include septic, well, and utilities addenda."`;
  app.innerHTML =
    header(t.label) +
    backBtn('type', 'Property type') +
    `<h1>Speak the offer</h1>
     <p class="muted" style="margin:4px 2px 8px">Talk like you would to your TC. BidVoice structures it, picks the forms, and flags anything off.</p>
     <div class="mic-wrap">
       <button class="mic-big" id="mic"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" fill="none" stroke="#fff" stroke-width="1.7"/></svg></button>
       <div class="mic-hint" id="hint">Tap to talk</div>
     </div>
     <label class="fld" style="margin-top:14px">Transcript</label>
     <textarea id="transcript" placeholder=${JSON.stringify('Tap the mic, or type the offer here…')}>${esc(state.draft.transcript)}</textarea>
     <p class="tiny muted" style="margin:10px 2px">Example: ${esc(example)}</p>
     <div style="margin-top:8px"><button class="btn" id="build">Build the offer<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`;

  const ta = $('#transcript');
  ta.addEventListener('input', () => (state.draft.transcript = ta.value));
  $('#mic').addEventListener('click', toggleMic);
  $('#build').addEventListener('click', buildOffer);
}

function toggleMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hint = $('#hint');
  const mic = $('#mic');
  if (!SR) {
    hint.textContent = 'Voice not supported here — type the offer.';
    return;
  }
  if (recognizing) {
    recognition && recognition.stop();
    return;
  }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;
  const base = state.draft.transcript ? state.draft.transcript + ' ' : '';
  let finalText = base;
  recognition.onstart = () => {
    recognizing = true;
    mic.classList.add('rec');
    hint.textContent = 'Listening… tap to stop';
  };
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tr = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += tr + ' ';
      else interim += tr;
    }
    const ta = $('#transcript');
    ta.value = (finalText + interim).trim();
    state.draft.transcript = ta.value;
  };
  recognition.onerror = () => {
    hint.textContent = 'Mic error — you can type instead.';
  };
  recognition.onend = () => {
    recognizing = false;
    mic.classList.remove('rec');
    hint.textContent = 'Tap to talk';
  };
  recognition.start();
}

async function buildOffer() {
  const transcript = ($('#transcript').value || '').trim();
  if (transcript.length < 5) {
    toast('Say or type the offer first.');
    return;
  }
  if (recognizing && recognition) recognition.stop();
  state.draft.transcript = transcript;
  go('coordinating');
  try {
    // Create the offer, then coordinate it.
    const { offer } = await api('POST', '/offers', { propertyTypeId: state.draft.type, transcript });
    const result = await api('POST', `/offers/${offer.id}/coordinate`, { transcript, propertyTypeId: state.draft.type });
    state.offer = result.offer;
    state.signing = result.signing;
    go('summary');
  } catch (e) {
    state.offer = null;
    app.innerHTML =
      header('Couldn’t build') +
      `<div class="empty"><div class="big">⚠️</div><h2>${esc(e.message)}</h2>
       <p class="muted">${e.message.includes('not configured') ? 'The AI key isn’t set on the server yet.' : 'Try again, or adjust the transcript.'}</p>
       <div style="margin-top:18px"><button class="btn ghost" data-go="capture">Back</button></div></div>`;
    app.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  }
}

function viewCoordinating() {
  app.innerHTML =
    header('Working…') +
    `<div class="center" style="padding:60px 0">
      <div class="spin"></div>
      <h2>Reading the offer</h2>
      <p class="muted">Structuring terms · selecting NWMLS forms · checking for conflicts</p>
    </div>`;
}

/* ------------------------------ Summary ----------------------------------- */
function viewSummary() {
  const o = state.offer;
  if (!o) return go('dashboard');
  const t = o.terms || {};
  const defs = new Set((o.defaults_applied || []).map((s) => s.toLowerCase()));
  const isDef = (k) => [...defs].some((d) => d.includes(k));
  const dbadge = (k) => (isDef(k) ? '<span class="badge def">default</span>' : '');

  const rows = [
    ['Property', esc(o.address || (o.property && o.property.parcel) || '—'), ''],
    ['Buyers', esc(o.buyers || '—'), ''],
    ['Purchase price', money(t.purchase_price), ''],
    ['Earnest money', `${money(t.earnest_money)} · ${esc(t.earnest_holder || '—')} · ${t.earnest_days_to_deposit || '—'}d`, dbadge('earnest')],
    ['Down payment', t.down_payment_amount ? money(t.down_payment_amount) : t.down_payment_pct ? t.down_payment_pct + '%' : '—', ''],
    ['Financing', cap(t.financing) + (t.lender ? ' · ' + esc(t.lender) : ''), ''],
    ['Closing', esc(t.closing_date || `~${t.closing_days || '—'} days`), dbadge('closing')],
    ['Possession', esc(t.possession || '—'), dbadge('possession')],
    ['Inspection', t.inspection_waived ? 'WAIVED' : `Form ${esc(t.inspection_form || '35')} · ${t.inspection_days || 10}d`, ''],
    ['Title', esc((t.title_paid_by || '—') + (t.title_company ? ' · ' + t.title_company : '')), ''],
    ['Seller credits', esc(t.seller_credits || '—'), ''],
    ['Buyer brokerage', (t.buyer_brokerage_pct || '—') + '%', dbadge('brokerage') || dbadge('compensation')],
    ['Offer expires', esc(t.expiration || '— set a deadline'), t.expiration ? '' : '<span class="badge confirm">confirm</span>'],
  ];

  const warns = o.warnings || [];
  const errs = warns.filter((w) => w.severity === 'error');
  const advis = warns.filter((w) => w.severity !== 'error');
  const qs = o.questions || [];

  app.innerHTML =
    header('Offer summary') +
    backBtn('dashboard', 'Offers') +
    `<h1>${esc(o.title || 'Offer')}</h1>
     <div class="sec" style="margin-top:6px"><span class="pill ${o.status}">${o.status}</span></div>` +
    (errs.length
      ? `<div class="card" style="margin-bottom:14px">${errs.map((w) => `<div class="alert err"><span class="ai">✕</span><span>${esc(w.message)}</span></div>`).join('')}</div>`
      : '') +
    (qs.length
      ? `<div class="card" style="margin-bottom:14px"><h2>A few questions</h2><p class="muted tiny" style="margin:2px 0 12px">Answer by voice/text below and rebuild — only what's needed.</p>${qs
          .map((q) => `<div class="q">${esc(q)}</div>`)
          .join('')}
          <textarea id="answers" placeholder="Add the missing details…" style="margin-top:12px"></textarea>
          <button class="btn subtle sm" id="rebuild" style="margin-top:10px;width:100%">Rebuild with answers</button></div>`
      : '') +
    `<div class="card"><h2>Terms</h2><div style="margin-top:8px">${rows
      .map((r) => `<div class="sum-row"><div class="k">${r[0]}</div><div class="v">${r[1]} ${r[2]}</div></div>`)
      .join('')}</div></div>` +
    (advis.length
      ? `<div class="card" style="margin-top:14px"><h2>Review before signing</h2><div style="margin-top:8px">${advis
          .map((w) => `<div class="alert warn"><span class="ai">!</span><span>${esc(w.message)}</span></div>`)
          .join('')}</div></div>`
      : '') +
    formsCard(o) +
    `<div class="row-actions">
       <button class="btn ghost" id="pdf">PDF package</button>
       <button class="btn" id="toSign">Sign &amp; initial</button>
     </div>
     <div style="margin-top:10px"><button class="btn subtle" id="statusBtn">${o.status === 'sent' ? 'Mark accepted' : 'Mark sent to listing agent'}</button></div>`;

  // Bindings
  const reb = $('#rebuild');
  if (reb) reb.addEventListener('click', rebuildWithAnswers);
  $('#pdf').addEventListener('click', () => window.open(`/api/offers/${o.id}/pdf`, '_blank'));
  $('#toSign').addEventListener('click', () => go('signing'));
  $('#statusBtn').addEventListener('click', () => changeStatus(o.status === 'sent' ? 'accepted' : 'sent'));
  bindFormsCard();
}

function formsCard(o) {
  const selected = new Set((o.forms || []).map((f) => f.id));
  const baseId = (state.catalog.property_types.find((p) => p.id === o.property_type) || {}).base;
  const addenda = state.catalog.addenda;
  const always = state.catalog.always_included;

  const baseRow = `<div class="form-item"><div class="fid">${esc(baseId)}</div><div class="fn">Base purchase &amp; sale agreement<small>Always included for this transaction type</small></div><span class="auto-tag">BASE</span></div>`;
  const addRows = addenda
    .map((a) => {
      const on = selected.has(a.id);
      return `<div class="form-item"><div class="fid">${esc(a.id)}</div>
        <div class="fn">${esc(a.name)}${a.note ? `<small>${esc(a.note)}</small>` : ''}</div>
        ${a.autoAttach ? '<span class="auto-tag" style="margin-right:8px">AUTO</span>' : ''}
        <div class="toggle ${on ? 'on' : ''}" data-add="${esc(a.id)}"></div></div>`;
    })
    .join('');
  const alwaysRows = always
    .map((a) => `<div class="form-item"><div class="fid">${esc(a.id)}</div><div class="fn">${esc(a.name)}</div><span class="auto-tag">INCL</span></div>`)
    .join('');

  return `<div class="card" style="margin-top:14px"><h2>Forms <span class="muted tiny">· ordered by most used</span></h2>
    <div style="margin-top:6px">${baseRow}${addRows}${alwaysRows}</div></div>`;
}

function bindFormsCard() {
  app.querySelectorAll('[data-add]').forEach((tg) =>
    tg.addEventListener('click', async () => {
      tg.classList.toggle('on');
      const ids = [...app.querySelectorAll('.toggle.on')].map((x) => x.dataset.add);
      try {
        const { offer, signing } = await api('POST', `/offers/${state.offer.id}/forms`, { addenda: ids });
        state.offer = offer;
        state.signing = signing;
        // Re-render just to refresh warnings/forms order without losing scroll.
        const y = window.scrollY;
        viewSummary();
        window.scrollTo(0, y);
      } catch (e) {
        toast(e.message);
      }
    })
  );
}

async function rebuildWithAnswers() {
  const extra = ($('#answers').value || '').trim();
  if (!extra) return;
  const transcript = (state.offer.transcript || '') + '\n\nAdditional details: ' + extra;
  go('coordinating');
  try {
    const result = await api('POST', `/offers/${state.offer.id}/coordinate`, {
      transcript,
      propertyTypeId: state.offer.property_type,
    });
    state.offer = result.offer;
    state.signing = result.signing;
    go('summary');
  } catch (e) {
    toast(e.message);
    go('summary');
  }
}

async function changeStatus(status) {
  try {
    const { offer } = await api('POST', `/offers/${state.offer.id}/status`, { status });
    state.offer = offer;
    toast('Marked ' + status);
    viewSummary();
  } catch (e) {
    toast(e.message);
  }
}

/* ------------------------------ Signing ----------------------------------- */
function viewSigning() {
  const o = state.offer;
  const sg = state.signing || { items: [], remaining: 0, total: 0 };
  app.innerHTML =
    header('Sign & initial') +
    backBtn('summary', 'Summary') +
    `<h1>Sign &amp; initial</h1>
     <p class="muted" style="margin:4px 2px 14px">${sg.total - sg.remaining}/${sg.total} complete · sign and initial in the right spots on each form.</p>
     <div class="card">${
       sg.items
         .map(
           (i) => `<div class="sign-item" data-anchor="${esc(i.anchor)}" data-kind="${i.kind}">
        <div class="chk ${i.signed ? 'done' : ''}"></div>
        <div class="lbl">${esc(i.label)}<div class="kind">${i.kind}${i.signed && i.signer ? ' · ' + esc(i.signer) : ''}</div></div>
        ${i.signed ? '' : '<button class="btn sm subtle">Sign</button>'}
      </div>`
         )
         .join('') || '<p class="muted">Build an offer first.</p>'
     }</div>
     <p class="tiny muted" style="margin:14px 2px">v0 captures the mark and tracks completion. Placement on the real NWMLS PDFs at the exact spots wires in with the forms library.</p>`;

  app.querySelectorAll('.sign-item').forEach((row) => {
    const btn = row.querySelector('button');
    if (btn) btn.addEventListener('click', () => openSignPad(row.dataset.anchor, row.dataset.kind));
  });
}

function openSignPad(anchor, kind) {
  const overlay = document.createElement('div');
  overlay.className = 'card';
  overlay.style = 'position:fixed;left:14px;right:14px;bottom:90px;z-index:70;max-width:540px;margin:0 auto';
  overlay.innerHTML = `<h2>${kind === 'initial' ? 'Initial here' : 'Sign here'}</h2>
    <p class="tiny muted" style="margin:2px 0 10px">${esc(anchor)}</p>
    <canvas class="pad" id="pad"></canvas>
    <div class="row-actions">
      <button class="btn ghost" id="clear">Clear</button>
      <button class="btn" id="save">Save</button>
    </div>
    <button class="btn subtle sm" id="cancel" style="width:100%;margin-top:8px">Cancel</button>`;
  document.body.appendChild(overlay);

  const canvas = $('#pad', overlay);
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#0b1020';
  let drawing = false;
  let dirty = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };
  const start = (e) => { drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); dirty = true; e.preventDefault(); };
  const end = () => (drawing = false);
  canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start); canvas.addEventListener('touchmove', move); canvas.addEventListener('touchend', end);

  $('#clear', overlay).addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; });
  $('#cancel', overlay).addEventListener('click', () => overlay.remove());
  $('#save', overlay).addEventListener('click', async () => {
    if (!dirty) return toast('Sign first');
    try {
      const { signing } = await api('POST', `/offers/${state.offer.id}/sign`, {
        anchor,
        kind,
        png: canvas.toDataURL('image/png'),
      });
      state.signing = signing;
      overlay.remove();
      viewSigning();
    } catch (e) {
      toast(e.message);
    }
  });
}

/* ------------------------------ Settings ---------------------------------- */
function viewSettings() {
  const b = state.broker;
  const f = (k, label) => `<div class="fld-row"><label class="fld">${esc(label)}</label><input id="b_${k}" value="${esc(b[k] || '')}"/></div>`;
  app.innerHTML =
    header('Settings') +
    `<h1>Broker profile</h1>
     <p class="muted" style="margin:4px 2px 16px">This is the standing identity on every package. It’s applied silently and never invented.</p>
     <div class="card">
       ${f('broker_name', 'Broker name')}
       ${f('brokerage', 'Brokerage')}
       ${f('dol_license_no', 'DOL license #')}
       ${f('mls_office_no', 'MLS office #')}
       ${f('firm_lag_no', 'Firm LAG #')}
       ${f('email', 'Email')}
       ${f('phone', 'Phone')}
       ${f('entity', 'Legal entity')}
       ${f('address', 'Address')}
       <button class="btn" id="saveBroker" style="margin-top:16px">Save</button>
     </div>
     <p class="tiny muted center" style="margin-top:20px">BidVoice drafts; the licensed broker reviews and signs. AI prices are placeholders.</p>`;
  $('#saveBroker').addEventListener('click', async () => {
    const patch = {};
    ['broker_name', 'brokerage', 'dol_license_no', 'mls_office_no', 'firm_lag_no', 'email', 'phone', 'entity', 'address'].forEach(
      (k) => (patch[k] = $('#b_' + k).value)
    );
    try {
      state.broker = await api('PUT', '/broker', patch);
      toast('Saved');
    } catch (e) {
      toast(e.message);
    }
  });
}

boot();
