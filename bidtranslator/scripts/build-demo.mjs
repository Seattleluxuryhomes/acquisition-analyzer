// Regenerates docs/Bidtranslator-Demo.html: the real public/index.html with an
// in-browser mock backend + seed data, so the whole UI (including the trial chip,
// paywall, and subscription panel) can be clicked through offline. Run: node scripts/build-demo.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root,'public/index.html'),'utf8');

const photoSVG = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='240' height='240' fill='#2E5C7E'/><rect x='30' y='150' width='180' height='70' fill='#1E4259'/><circle cx='180' cy='60' r='28' fill='#EE9B2E'/><text x='20' y='130' font-family='monospace' font-size='15' fill='#E7D8B6'>bathroom · before</text></svg>`);
const now = Date.now();

const mock = `
<script>
/* ===== OFFLINE DEMO SHIM — mocks the backend in-browser so this single file
   shows the finished UI with sample data + a simulated free trial. The app code
   below is byte-for-byte the real public/index.html. ===== */
(function(){
  localStorage.setItem('bt_token','demo-token');
  localStorage.setItem('bt_user', JSON.stringify({id:'u1',email:'demo@bidtranslator.com',company:'Martinez & Sons Remodeling',name:'Luis Martinez',phone:'(206) 555-0142',license:'WA-CCB-218845',default_from_lang:'es',default_to_lang:'en'}));
  localStorage.setItem('bt_settings', JSON.stringify({company:'Martinez & Sons Remodeling',name:'Luis Martinez',phone:'(206) 555-0142',license:'WA-CCB-218845',from:'es',to:'en'}));
  localStorage.removeItem('bt_jobs'); localStorage.removeItem('bt_billing');
  const rid=()=>Math.random().toString(36).slice(2,10);
  function USER(){return {id:'u1',email:'demo@bidtranslator.com',company:STORE.settings.company,name:STORE.settings.name,phone:STORE.settings.phone,license:STORE.settings.license,default_from_lang:STORE.settings.from,default_to_lang:STORE.settings.to};}
  const TRIAL_END=${now}+9*86400000; // ~9 days left, in trial
  const STORE = {
    settings:{company:'Martinez & Sons Remodeling',name:'Luis Martinez',phone:'(206) 555-0142',license:'WA-CCB-218845',from:'es',to:'en'},
    billing:{configured:true,entitled:true,status:'none',in_trial:true,trial_ends_at:TRIAL_END,current_period_end:null,has_subscription:false},
    jobs:[
      { id:'reyes01', title:'Reyes — Bathroom Remodel', from:'es', to:'en',
        transcript:'La señora quiere un baño nuevo. Quitar la bañera vieja y poner una ducha grande con azulejo. Cambiar el lavabo y las luces. Ella compra la grifería.',
        translation:'The client wants a new bathroom. Remove the old tub and install a large tiled shower. Replace the sink and lighting. She will buy the faucet/fixtures herself.',
        summary:'Full bathroom remodel: demo old tub, build tiled walk-in shower, replace vanity and lighting. Client supplies the faucet/fixtures.',
        assumptions:['Work completed within 3 weeks of start','Water shut-off accessible','Client items on site before install'],
        exclusions:['Faucet & fixtures (client-supplied)','Permits','Mold remediation if found'],
        lines:[{id:rid(),desc:'Demo existing tub & surround',type:'fixed',price:680,hours:0,rate:0,furn:'you'},
          {id:rid(),desc:'Build tiled walk-in shower',type:'fixed',price:3200,hours:0,rate:0,furn:'you'},
          {id:rid(),desc:'Replace vanity, sink & lighting',type:'hourly',price:0,hours:12,rate:65,furn:'you'},
          {id:rid(),desc:'Repair damaged subfloor',type:'fixed',price:540,hours:0,rate:0,furn:'you'},
          {id:rid(),desc:'Client-supplied faucet & fixtures',type:'fixed',price:0,hours:0,rate:0,furn:'client'}],
        upgrades:[{id:rid(),desc:'Heated tile floor',price:1200},{id:rid(),desc:'Frameless glass shower door',price:950}],
        notes:'PRIVATE: tight budget — hold firm on shower price.', margin:28, status:'draft',
        created_at:${now}-86400000, updated_at:${now}-86400000,
        photos:[{id:rid(), url:${JSON.stringify(photoSVG)}}] },
      { id:'martinez01', title:'Martinez — Kitchen & Bath', from:'es', to:'en',
        transcript:'El cliente quiere rehacer el baño completo y pintar la cocina con una isla nueva. Él compra los azulejos.',
        translation:'The client wants to redo the full bathroom and paint the kitchen with a new island. He will buy the tile.',
        summary:'Full bath remodel plus kitchen paint and a new island. Client supplies tile.',
        assumptions:['Standard fixtures unless noted'], exclusions:['Bathroom tile (client-supplied)','Permits'],
        lines:[{id:rid(),desc:'Demo existing bathroom',type:'fixed',price:640,hours:0,rate:0,furn:'you'},
          {id:rid(),desc:'Install tile — floor & walls',type:'fixed',price:2150,hours:0,rate:0,furn:'you'},
          {id:rid(),desc:'Paint kitchen',type:'hourly',price:0,hours:14,rate:55,furn:'you'},
          {id:rid(),desc:'Build & install kitchen island',type:'fixed',price:1850,hours:0,rate:0,furn:'you'}],
        upgrades:[{id:rid(),desc:'Quartz island countertop',price:950}],
        notes:'', margin:22, status:'sent', created_at:${now}-3600000, updated_at:${now}-3600000, photos:[] }
    ]
  };
  const find=(id)=>STORE.jobs.find(j=>j.id===id);
  const summ=(j)=>{const c=Object.assign({},j);delete c.photos;return c;};
  const full=(j)=>Object.assign({},j,{photos:(j.photos||[]).map(p=>({id:p.id,url:p.url}))});
  function fromPayload(b){return {id:b.id||rid(),title:b.title||'Untitled job',from:b.from||'es',to:b.to||'en',
    transcript:b.transcript||'',translation:b.translation||'',summary:b.summary||'',
    assumptions:b.assumptions||[],exclusions:b.exclusions||[],lines:b.lines||[],upgrades:b.upgrades||[],
    notes:b.notes||'',margin:+b.margin||0,status:b.status||'draft',
    created_at:b.created_at||Date.now(),updated_at:b.updated_at||Date.now(),photos:[]};}
  function CANNED(b){return {
    translation:'The client wants a new bathroom. Remove the old tub and install a large tiled shower. Replace the sink and the lights. She will buy the faucet herself. Wants it done before the holidays.',
    summary:'Bathroom remodel: remove tub, build tiled shower, replace vanity and lighting, repair damaged floor. Client supplies the faucet. Target: before the holidays.',
    lines:[{desc:'Demo old tub & surround',type:'fixed',price:680,hours:0,rate:0},
      {desc:'Build large tiled shower',type:'fixed',price:3000,hours:0,rate:0},
      {desc:'Replace vanity, sink & lighting',type:'hourly',price:0,hours:12,rate:60},
      {desc:'Repair damaged floor',type:'fixed',price:500,hours:0,rate:0}],
    assumptions:['Finish before the holidays','Water shut-off accessible'],
    exclusions:['Faucet/fixtures (client-supplied)','Permits'],
    upgrades:[{desc:'Heated tile floor',price:1100},{desc:'Glass shower door',price:900}] };}
  const J=(body,status)=>new Response(body==null?'':JSON.stringify(body),{status:status||200,headers:{'Content-Type':'application/json'}});
  const realFetch=window.fetch?window.fetch.bind(window):null;
  window.fetch=function(url,opts){
    opts=opts||{}; const u=typeof url==='string'?url:(url&&url.url)||'';
    if(!u.startsWith('/api/')) return realFetch?realFetch(url,opts):Promise.reject(new Error('no net'));
    const method=(opts.method||'GET').toUpperCase();
    let body=null; try{ body=opts.body?JSON.parse(opts.body):null; }catch(e){}
    const q=u.indexOf('?'); const p=q>=0?u.slice(0,q):u;
    if(p==='/api/health') return Promise.resolve(J({ok:true,ai:true,billing:true}));
    if(p==='/api/auth/signin'||p==='/api/auth/signup') return Promise.resolve(J({token:'demo-token',user:USER()}));
    if(p==='/api/auth/signout'||p==='/api/auth/reset') return Promise.resolve(J({ok:true}));
    if(p==='/api/billing/status') return Promise.resolve(J(STORE.billing));
    if(p==='/api/billing/checkout') return Promise.resolve(J({error:'This is a static demo — in the live app, Stripe Checkout opens here to start the subscription.'},400));
    if(p==='/api/billing/portal') return Promise.resolve(J({error:'This is a static demo — in the live app, the Stripe billing portal opens here.'},400));
    if(p==='/api/me'&&method==='GET') return Promise.resolve(J({user:USER(),settings:STORE.settings,billing:STORE.billing}));
    if(p==='/api/me'&&method==='PATCH'){ Object.assign(STORE.settings,body||{}); return Promise.resolve(J({user:USER(),settings:STORE.settings})); }
    if(p==='/api/jobs'&&method==='GET') return Promise.resolve(J({jobs:STORE.jobs.map(summ)}));
    if(p==='/api/jobs'&&method==='POST'){ const j=fromPayload(body); STORE.jobs.unshift(j); return Promise.resolve(J({job:full(j)})); }
    let m;
    if(m=p.match(/^\\/api\\/jobs\\/([^/]+)$/)){ const j=find(m[1]);
      if(method==='GET') return Promise.resolve(j?J({job:full(j)}):J({error:'Job not found.'},404));
      if(method==='PATCH'){ if(!j)return Promise.resolve(J({error:'Job not found.'},404)); Object.assign(j,body||{}); j.updated_at=(body&&body.updated_at)||Date.now(); return Promise.resolve(J({job:full(j)})); }
      if(method==='DELETE'){ STORE.jobs=STORE.jobs.filter(x=>x.id!==m[1]); return Promise.resolve(J({ok:true})); } }
    if(m=p.match(/^\\/api\\/jobs\\/([^/]+)\\/photos$/)){ if(method==='POST'){ const j=find(m[1]); const pid=rid(); if(j){(j.photos=j.photos||[]).push({id:pid,url:body.dataUrl});} return Promise.resolve(J({photo:{id:pid,url:body.dataUrl}})); } }
    if(m=p.match(/^\\/api\\/jobs\\/([^/]+)\\/photos\\/([^/]+)$/)){ if(method==='DELETE'){ const j=find(m[1]); if(j)j.photos=(j.photos||[]).filter(x=>x.id!==m[2]); return Promise.resolve(J({ok:true})); } }
    if(p==='/api/assist/build'&&method==='POST') return new Promise(r=>setTimeout(()=>r(J(CANNED(body))),900));
    if(/\\/pdf$/.test(p)) return Promise.resolve(J({error:'demo'},503));
    return Promise.resolve(J({error:'Not found'},404));
  };
})();
</script>
`;
const marker = '<script>\n/* ============ config / state ============ */';
if(!html.includes(marker)){ console.error('marker not found'); process.exit(1); }
const out = html.replace(marker, mock + marker).replace('<title>Bidtranslator</title>','<title>Bidtranslator — Demo</title>');
fs.writeFileSync(path.join(root,'docs/Bidtranslator-Demo.html'), out);
console.log('wrote docs/Bidtranslator-Demo.html', out.length, 'bytes');
