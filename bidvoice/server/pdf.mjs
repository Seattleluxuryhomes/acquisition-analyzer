/**
 * Offer package PDF.
 *
 * v0 renders a clean, broker-ready package with pdfkit:
 *   1. A Transaction Summary cover (the OUTPUT CONTRACT: every term, whether it
 *      was a default, the form set in signing order, warnings, and the
 *      human-only blanks the broker must confirm).
 *   2. One draft page per form in signing order, showing the terms that land on
 *      that form plus the sign/initial spots.
 *
 * This is a DRAFT representation. The final step — overlaying these values onto
 * the real flat NWMLS PDFs at saved x/y (coordinate_maps.md) and merging — swaps
 * in here via pdf-lib once the blank forms are available, without changing the
 * route or the data shape. "Verify, don't assert": every unverified form number
 * is flagged on the cover.
 */

import PDFDocument from 'pdfkit';
import { STANDING_IDENTITY } from './identity.mjs';

const INK = '#0b1220';
const MUTE = '#5b6472';
const ACCENT = '#4f46e5';
const LINE = '#dfe3ea';
const WARN = '#b45309';
const ERR = '#b91c1c';

const money = (n) => (n ? '$' + Number(n).toLocaleString('en-US') : '—');

function packageFilename(offer) {
  const buyers = (offer.buyers || 'Buyers').replace(/[^\w]+/g, '').slice(0, 24) || 'Buyers';
  const addr = (offer.address || 'Property').replace(/[^\w]+/g, '_').slice(0, 40) || 'Property';
  return `PSA_Package_${buyers}_${addr}.pdf`;
}

/**
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
export function buildPackagePdf(offer, broker = STANDING_IDENTITY) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: packageFilename(offer) }));

    coverPage(doc, offer, broker);
    for (const form of offer.forms || []) formPage(doc, offer, form, broker);

    doc.end();
  });
}

/* --------------------------------- cover ---------------------------------- */

function coverPage(doc, offer, broker) {
  const t = offer.terms || {};
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text('BIDVOICE  ·  TRANSACTION SUMMARY', left, 54, { characterSpacing: 1 });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text(offer.title || 'Purchase & Sale Package', { lineGap: 2 });
  doc.fillColor(MUTE).font('Helvetica').fontSize(10).text(
    `${broker.broker_name} · ${broker.brokerage} · DOL #${broker.dol_license_no}`,
    { lineGap: 2 }
  );
  doc.moveDown(0.4);
  hr(doc, left, right);
  doc.moveDown(0.6);

  const defaults = new Set((offer.defaults_applied || []).map((s) => s.toLowerCase()));
  const isDefault = (key) => [...defaults].some((d) => d.includes(key));

  const rows = [
    ['Property', offer.address || (offer.property && offer.property.parcel) || '—', ''],
    ['Buyers', offer.buyers || '—', ''],
    ['Purchase Price', money(t.purchase_price), ''],
    ['Earnest Money', `${money(t.earnest_money)} · held by ${t.earnest_holder || '—'} · ${t.earnest_days_to_deposit || '—'} days`, isDefault('earnest') ? 'default' : ''],
    ['Down Payment', t.down_payment_amount ? money(t.down_payment_amount) : t.down_payment_pct ? `${t.down_payment_pct}%` : '—', ''],
    ['Financing', cap(t.financing) + (t.lender ? ` · ${t.lender}` : ''), ''],
    ['Closing', t.closing_date || `~${t.closing_days || '—'} days`, isDefault('closing') ? 'default' : ''],
    ['Possession', t.possession || '—', isDefault('possession') ? 'default' : ''],
    ['Inspection', t.inspection_waived ? 'WAIVED' : `Form ${t.inspection_form || '35'} · ${t.inspection_days || 10} days`, ''],
    ['Title', `${t.title_paid_by || '—'}${t.title_company ? ' · ' + t.title_company : ''}`, ''],
    ['Info Verification', `${t.info_verification_days || 10} days`, isDefault('verification') ? 'default' : ''],
    ['Seller Credits', t.seller_credits || '—', ''],
    ['Buyer Brokerage', `${t.buyer_brokerage_pct || '—'}%`, isDefault('brokerage') || isDefault('compensation') ? 'default' : ''],
    ['Default Remedy', t.default_remedy || '—', isDefault('remedy') ? 'default' : ''],
    ['Offer Expires', t.expiration || '— (set a deadline)', t.expiration ? '' : 'confirm'],
  ];

  for (const [k, v, badge] of rows) summaryRow(doc, left, right, k, v, badge);

  // Form set in signing order.
  doc.moveDown(0.6);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Form package (signing order)');
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  (offer.forms || []).forEach((f, i) => {
    doc.fillColor(INK).text(`${i + 1}.  Form ${f.id} — ${f.name}`, { continued: true });
    doc.fillColor(f.verified ? MUTE : WARN).text(f.verified ? '' : '   ⚠ confirm form #');
  });

  // Warnings.
  const warns = offer.warnings || [];
  if (warns.length) {
    doc.moveDown(0.6);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Review before signing');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10);
    for (const w of warns) {
      doc.fillColor(w.severity === 'error' ? ERR : WARN).text(`${w.severity === 'error' ? '✕' : '!'}  ${w.message}`);
    }
  }

  // Open questions.
  const qs = offer.questions || [];
  if (qs.length) {
    doc.moveDown(0.6);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Open questions');
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const q of qs) doc.text(`•  ${q}`);
  }

  doc.moveDown(1);
  doc.fillColor(MUTE).font('Helvetica-Oblique').fontSize(8.5).text(
    'DRAFT for broker review. The licensed broker reviews, confirms human-only blanks, and signs in their e-sign platform. AI-applied defaults are marked; no values are invented.',
    { width: right - left }
  );
}

function summaryRow(doc, left, right, key, value, badge) {
  const y = doc.y;
  doc.fillColor(MUTE).font('Helvetica-Bold').fontSize(9).text(key.toUpperCase(), left, y, { width: 150 });
  doc.fillColor(INK).font('Helvetica').fontSize(11).text(String(value), left + 160, y, { width: right - left - 160 - 60 });
  if (badge) {
    const color = badge === 'confirm' ? WARN : ACCENT;
    doc.fillColor(color).font('Helvetica-Bold').fontSize(8).text(badge.toUpperCase(), right - 58, y + 2, { width: 58, align: 'right' });
  }
  doc.moveDown(0.35);
  doc.y = Math.max(doc.y, y + 16);
}

/* ------------------------------- form pages -------------------------------- */

function formPage(doc, offer, form, broker) {
  doc.addPage();
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const t = offer.terms || {};

  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10).text(`FORM ${form.id}`, left, 54, { characterSpacing: 1 });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(form.name);
  if (!form.verified) doc.fillColor(WARN).font('Helvetica').fontSize(9).text('⚠ Confirm this form number against the NWMLS library before signing.');
  doc.moveDown(0.4);
  hr(doc, left, right);
  doc.moveDown(0.6);

  // Show the terms that belong on this form.
  const fields = formFields(form.id, t, offer);
  doc.font('Helvetica').fontSize(11);
  for (const [k, v] of fields) {
    const y = doc.y;
    doc.fillColor(MUTE).font('Helvetica-Bold').fontSize(9).text(k.toUpperCase(), left, y, { width: 170 });
    doc.fillColor(INK).font('Helvetica').fontSize(11).text(String(v), left + 180, y, { width: right - left - 180 });
    doc.moveDown(0.3);
    doc.y = Math.max(doc.y, y + 15);
  }

  // Sign / initial spots.
  doc.moveDown(1.2);
  hr(doc, left, right);
  doc.moveDown(0.6);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Signature & initials');
  doc.moveDown(0.5);
  signLine(doc, left, right, 'Buyer signature');
  doc.moveDown(0.8);
  signLine(doc, left, right, 'Buyer signature');
  doc.moveDown(0.8);
  initialBox(doc, left, 'Buyer initials');
}

function formFields(id, t, offer) {
  const base = [
    ['Buyers', offer.buyers || '—'],
    ['Property', offer.address || '—'],
  ];
  if (/^2[15]$/.test(id) || id === 'CL') {
    return [
      ...base,
      ['Purchase price', money(t.purchase_price)],
      ['Earnest money', `${money(t.earnest_money)} (${t.earnest_holder || '—'})`],
      ['Closing', t.closing_date || `~${t.closing_days || '—'} days`],
      ['Possession', t.possession || '—'],
      ['Default remedy', t.default_remedy || '—'],
      ['Offer expires', t.expiration || '—'],
    ];
  }
  if (id === '22A') return [...base, ['Financing', cap(t.financing)], ['Lender', t.lender || '—'], ['Down payment', t.down_payment_amount ? money(t.down_payment_amount) : `${t.down_payment_pct || '—'}%`]];
  if (id === '22E') return [...base, ['Loan type', cap(t.financing)], ['Lender', t.lender || '—']];
  if (id === '35' || id === '34') return [...base, ['Inspection form', id], ['Inspection period', `${t.inspection_days || 10} days`]];
  if (id === '22T') return [...base, ['Title paid by', t.title_paid_by || '—'], ['Title company', t.title_company || '—']];
  if (id === 'EXA') return [...base, ['Legal description', (offer.property && offer.property.legal_description) || 'To be attached from title.']];
  return base;
}

/* --------------------------------- atoms ---------------------------------- */

function hr(doc, left, right) {
  doc.strokeColor(LINE).lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
}

function signLine(doc, left, right, label) {
  const y = doc.y + 14;
  doc.strokeColor(INK).lineWidth(1).moveTo(left, y).lineTo(left + 300, y).stroke();
  doc.strokeColor(LINE).moveTo(right - 130, y).lineTo(right, y).stroke();
  doc.fillColor(MUTE).font('Helvetica').fontSize(8.5).text(label, left, y + 4);
  doc.fillColor(MUTE).text('Date', right - 130, y + 4);
  doc.y = y + 18;
}

function initialBox(doc, left, label) {
  const y = doc.y + 6;
  doc.strokeColor(INK).lineWidth(1).rect(left, y, 70, 34).stroke();
  doc.fillColor(MUTE).font('Helvetica').fontSize(8.5).text(label, left + 80, y + 12);
  doc.y = y + 40;
}

function cap(s) {
  s = String(s || '').trim();
  if (!s) return '—';
  if (s.toLowerCase() === 'fha' || s.toLowerCase() === 'va') return s.toUpperCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
