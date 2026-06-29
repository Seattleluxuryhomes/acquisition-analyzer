/**
 * The transaction coordinator — BidVoice's brain.
 *
 * Takes the broker's spoken offer and a property type, and returns a fully
 * structured, validated offer: every term, the required NWMLS forms, the
 * defaults it applied, the conflicts it caught, and the *only* questions still
 * needed. It reasons like an experienced WA managing broker / TC — it does not
 * keyword-match.
 *
 * Hard rules honored:
 *  - The provider key lives only here, server-side (never reaches the browser).
 *  - It DRAFTS; the broker reviews and signs. No values are invented — unknown
 *    numbers become questions, not guesses.
 *  - Defaults are applied but always flagged.
 *  - If the key is unset / the call fails, callers fall back to manual entry.
 */

import { ADDENDA, ALWAYS_INCLUDED, propertyType } from './forms.mjs';
import { DEFAULTS, STANDING_IDENTITY } from './identity.mjs';

const MODEL = process.env.BIDVOICE_MODEL || 'claude-opus-4-8';

export function aiConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function formsCatalog() {
  return ADDENDA.map(
    (a) => `${a.id} — ${a.name}${a.autoAttach ? ' (auto-attaches on its trigger)' : ''}`
  ).join('\n');
}

function systemPrompt() {
  return [
    'You are BidVoice, an expert Washington State managing broker and transaction',
    'coordinator. You draft NWMLS purchase & sale packages from a broker speaking',
    'naturally. You DRAFT only — the licensed broker reviews and signs. NEVER invent',
    'a price, value, name, or comp; if a required number is unknown, ask for it.',
    '',
    'Your job: read the spoken offer + the property type, then return structured',
    'JSON. Think about contingency logic, contract sequencing, and which NWMLS forms',
    'the deal requires. Apply the standing defaults silently, but list every default',
    'you applied so it can be shown to the broker.',
    '',
    'STANDING DEFAULTS (apply unless the broker overrides):',
    `- Earnest money $${DEFAULTS.earnest_money.amount} held by ${DEFAULTS.earnest_money.holder}, ${DEFAULTS.earnest_money.days_to_deposit} days to deposit.`,
    `- Default remedy: ${DEFAULTS.default_remedy}.`,
    `- Closing ~${DEFAULTS.closing_days_out} days out. Possession ${DEFAULTS.possession}.`,
    `- Information verification period ${DEFAULTS.info_verification_days} days.`,
    `- Buyer brokerage compensation ${DEFAULTS.buyer_brokerage_compensation_pct}% (both blanks).`,
    `- Inspection: Form 34 (review of seller report) if a recent seller inspection exists, else Form 35 at ${DEFAULTS.inspection.default_days} days.`,
    `- FIRPTA: seller "${DEFAULTS.firpta.form21_para14}" (Form 21 ¶14).`,
    '',
    'ADDENDA YOU CAN REQUIRE (use these exact ids):',
    formsCatalog(),
    'Exhibit A (legal description) and Form 17 acknowledgement are ALWAYS included.',
    '',
    'Respond with ONLY valid minified JSON, no markdown, matching exactly:',
    '{"property":{"address":string,"parcel":string,"county":string,"legal_description":string},',
    '"terms":{"purchase_price":number,"earnest_money":number,"earnest_holder":string,"earnest_days_to_deposit":number,',
    '"down_payment_pct":number,"down_payment_amount":number,"financing":string,"lender":string,',
    '"closing_date":string,"closing_days":number,"possession":string,',
    '"inspection_form":string,"inspection_days":number,"inspection_waived":boolean,',
    '"title_paid_by":string,"title_company":string,"info_verification_days":number,',
    '"seller_credits":string,"buyer_brokerage_pct":number,"default_remedy":string,',
    '"expiration":string,"escalation":string},',
    '"addenda":[string],',
    '"defaults_applied":[string],',
    '"questions":[string],',
    '"warnings":[{"severity":"error"|"warn","message":string}],',
    '"summary_note":string}',
    '',
    'RULES:',
    '- financing is one of: cash, conventional, fha, va, seller. If cash, do NOT add 22A.',
    '- addenda: include every required form id (auto-attached + anything the broker named).',
    '- questions: ONLY genuinely missing info needed to complete the offer. If nothing is',
    '  missing, return []. Keep each question one short sentence.',
    '- warnings: flag conflicts (e.g. closing date before inspection ends, earnest deposit',
    '  past closing, FHA financing without 22E, inspection waived but contingency requested,',
    '  expired/short timelines). severity "error" blocks a clean package; "warn" is advisory.',
    '- Use only facts the broker stated. Mark any value you defaulted in defaults_applied.',
    `- The broker is ${STANDING_IDENTITY.broker_name}, ${STANDING_IDENTITY.brokerage}.`,
  ].join('\n');
}

function parseModelJSON(txt) {
  let t = String(txt || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf('{');
    const b = t.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error('Could not parse an offer from the AI response.');
  }
}

const str = (v, n = 200) => String(v ?? '').slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function sanitize(d, ptype) {
  d = d && typeof d === 'object' ? d : {};
  const t = d.terms && typeof d.terms === 'object' ? d.terms : {};
  const p = d.property && typeof d.property === 'object' ? d.property : {};
  const knownAddenda = new Set([...ADDENDA, ...ALWAYS_INCLUDED].map((a) => a.id));
  return {
    property: {
      type: ptype.id,
      address: str(p.address),
      parcel: str(p.parcel, 60),
      county: str(p.county, 60),
      legal_description: str(p.legal_description, 600),
    },
    terms: {
      purchase_price: num(t.purchase_price),
      earnest_money: num(t.earnest_money) || DEFAULTS.earnest_money.amount,
      earnest_holder: str(t.earnest_holder) || DEFAULTS.earnest_money.holder,
      earnest_days_to_deposit: num(t.earnest_days_to_deposit) || DEFAULTS.earnest_money.days_to_deposit,
      down_payment_pct: num(t.down_payment_pct),
      down_payment_amount: num(t.down_payment_amount),
      financing: str(t.financing, 30).toLowerCase() || 'conventional',
      lender: str(t.lender, 120),
      closing_date: str(t.closing_date, 40),
      closing_days: num(t.closing_days) || DEFAULTS.closing_days_out,
      possession: str(t.possession, 60) || DEFAULTS.possession,
      inspection_form: str(t.inspection_form, 8),
      inspection_days: num(t.inspection_days),
      inspection_waived: !!t.inspection_waived,
      title_paid_by: str(t.title_paid_by, 40),
      title_company: str(t.title_company, 120),
      info_verification_days: num(t.info_verification_days) || DEFAULTS.info_verification_days,
      seller_credits: str(t.seller_credits, 200),
      buyer_brokerage_pct: num(t.buyer_brokerage_pct) || DEFAULTS.buyer_brokerage_compensation_pct,
      default_remedy: str(t.default_remedy, 60) || DEFAULTS.default_remedy,
      expiration: str(t.expiration, 60),
      escalation: str(t.escalation, 200),
    },
    addenda: (Array.isArray(d.addenda) ? d.addenda : []).map((x) => str(x, 8)).filter((x) => knownAddenda.has(x)),
    defaults_applied: (Array.isArray(d.defaults_applied) ? d.defaults_applied : []).map((x) => str(x, 120)).slice(0, 20),
    questions: (Array.isArray(d.questions) ? d.questions : []).map((x) => str(x, 200)).filter(Boolean).slice(0, 8),
    warnings: (Array.isArray(d.warnings) ? d.warnings : [])
      .map((w) => ({ severity: w && w.severity === 'error' ? 'error' : 'warn', message: str(w && w.message, 240) }))
      .filter((w) => w.message)
      .slice(0, 12),
    summary_note: str(d.summary_note, 400),
  };
}

/**
 * Run the coordinator. Returns the structured, sanitized offer.
 * @param {{ transcript: string, propertyTypeId: string }} input
 */
export async function coordinate({ transcript, propertyTypeId }) {
  if (!aiConfigured()) {
    const e = new Error('The AI coordinator is not configured (no ANTHROPIC_API_KEY).');
    e.status = 503;
    e.code = 'AI_UNCONFIGURED';
    throw e;
  }
  const text = String(transcript || '').trim();
  if (text.length < 5) {
    const e = new Error('Say the offer first.');
    e.status = 400;
    throw e;
  }
  const ptype = propertyType(propertyTypeId);

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system: systemPrompt(),
        messages: [
          {
            role: 'user',
            content: `PROPERTY TYPE: ${ptype.label} (base form ${ptype.base})\n\nSPOKEN OFFER:\n${text.slice(0, 8000)}`,
          },
        ],
      }),
    });
  } catch {
    const e = new Error('Could not reach the AI provider.');
    e.status = 502;
    throw e;
  }
  if (!res.ok) {
    const e = new Error('AI provider error (' + res.status + ').');
    e.status = 502;
    throw e;
  }
  const out = await res.json();
  const txt = (out.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return sanitize(parseModelJSON(txt), ptype);
}
