/**
 * Deterministic resolution + validation.
 *
 * The coordinator (AI) proposes; this layer GUARANTEES. It resolves the final
 * form set from triggers in the transcript and the structured terms, computes
 * the signing order, and re-checks the conflicts that must never slip through
 * regardless of what the model returned. Code is the backstop, not the model.
 *
 * "If one form affects another, the system updates everything automatically" —
 * that wiring lives here.
 */

import {
  ADDENDA,
  ALWAYS_INCLUDED,
  BASE_FORMS,
  addendumById,
  propertyType,
  signingOrder,
} from './forms.mjs';

function matchesTrigger(addendum, haystack) {
  return (addendum.trigger || []).some((t) => haystack.includes(t));
}

/**
 * Resolve the complete, ordered form package for an offer.
 * @param {object} offer  sanitized coordinator output
 * @param {string} transcript  raw spoken text (for trigger detection)
 * @returns {{ forms: object[], order: string[], warnings: object[] }}
 */
export function resolvePackage(offer, transcript = '') {
  const ptype = propertyType(offer.property.type);
  const terms = offer.terms;
  const hay = `${transcript} ${terms.seller_credits} ${terms.escalation}`.toLowerCase();

  const ids = new Set();

  // 1. Base PSA for the property type.
  const baseId = ptype.base;
  ids.add(baseId);

  // 2. Auto-attach addenda by trigger (transcript) + structured signals.
  for (const a of ADDENDA) {
    if (a.autoAttach && matchesTrigger(a, hay)) ids.add(a.id);
  }

  // 3. Financing-driven attachment (the relationships the spec calls out).
  const fin = (terms.financing || '').toLowerCase();
  if (fin && fin !== 'cash') ids.add('22A'); // any financed deal needs 22A
  if (fin === 'fha' || fin === 'va') ids.add('22E');
  if (fin === 'seller') ids.add('22C');

  // 4. Inspection path: honor the AI's chosen form, else default unless waived.
  if (!terms.inspection_waived) {
    if (terms.inspection_form === '34') ids.add('34');
    else ids.add('35');
  }

  // 5. Land/acreage base pulls the land addendum.
  if (ptype.id === 'land' || ptype.id === 'development') ids.add('22L&A');

  // 6. Anything the coordinator explicitly required.
  for (const id of offer.addenda || []) ids.add(id);

  // 7. Always-included supporting docs.
  for (const a of ALWAYS_INCLUDED) ids.add(a.id);

  // Cash deals never carry a financing addendum.
  if (fin === 'cash') {
    ids.delete('22A');
    ids.delete('22E');
  }

  const order = signingOrder([...ids]);
  const forms = order.map((id) => {
    const meta = addendumById(id) || BASE_FORMS[id] || { id, name: id, verified: false };
    return {
      id,
      name: meta.name,
      category: meta.category || (BASE_FORMS[id] ? 'base' : 'addendum'),
      verified: meta.verified !== false,
      note: meta.note || '',
    };
  });

  return { forms, order, warnings: validate(offer, forms) };
}

/**
 * Build a package from an explicit addenda selection (the broker's manual
 * picker choices), keeping base + always-included and re-running validation.
 * This is what powers the "choose the appropriate addendums" toggles.
 */
export function packageFromAddenda(offer, addendaIds = []) {
  const ptype = propertyType((offer.property && offer.property.type) || offer.property_type);
  const ids = new Set([ptype.base]);
  for (const id of addendaIds) if (addendumById(id)) ids.add(id);
  for (const a of ALWAYS_INCLUDED) ids.add(a.id);

  const order = signingOrder([...ids]);
  const forms = order.map((id) => {
    const meta = addendumById(id) || BASE_FORMS[id] || { id, name: id, verified: false };
    return {
      id,
      name: meta.name,
      category: meta.category || (BASE_FORMS[id] ? 'base' : 'addendum'),
      verified: meta.verified !== false,
      note: meta.note || '',
    };
  });
  return { forms, order, warnings: validate(offer, forms) };
}

/**
 * Deterministic conflict checks layered on top of the AI's warnings.
 */
export function validate(offer, forms) {
  const t = offer.terms;
  const out = [];
  const ids = new Set(forms.map((f) => f.id));
  const fin = (t.financing || '').toLowerCase();

  if (!t.purchase_price) {
    out.push({ severity: 'error', message: 'No purchase price — the offer cannot be completed without it.' });
  }
  if (fin === 'cash' && ids.has('22A')) {
    out.push({ severity: 'error', message: 'Cash offer should not include the 22A financing addendum.' });
  }
  if ((fin === 'fha' || fin === 'va') && !ids.has('22E')) {
    out.push({ severity: 'error', message: `${fin.toUpperCase()} financing requires the 22E addendum.` });
  }
  if (fin && fin !== 'cash' && fin !== 'seller' && !t.lender) {
    out.push({ severity: 'warn', message: 'Financing selected but no lender named.' });
  }
  if (t.inspection_waived && (ids.has('35') || ids.has('34'))) {
    out.push({ severity: 'error', message: 'Inspection is waived but an inspection contingency is attached.' });
  }
  if (t.earnest_days_to_deposit && t.closing_days && t.earnest_days_to_deposit > t.closing_days) {
    out.push({ severity: 'error', message: 'Earnest money deposit window is later than closing.' });
  }
  if (!t.expiration) {
    out.push({ severity: 'warn', message: 'No offer expiration set — defaulting is risky; confirm a deadline.' });
  }
  if (t.escalation && !ids.has('35E')) {
    out.push({ severity: 'warn', message: 'Escalation language mentioned but Form 35E is not attached.' });
  }
  if (!offer.property.address && !offer.property.parcel) {
    out.push({ severity: 'warn', message: 'No property address or parcel — needed for Exhibit A / legal description.' });
  }

  // Surface any unverified form numbers so the broker confirms before signing.
  const unverified = forms.filter((f) => !f.verified).map((f) => f.id);
  if (unverified.length) {
    out.push({
      severity: 'warn',
      message: `Confirm form number(s) against the NWMLS library: ${unverified.join(', ')}.`,
    });
  }

  return out;
}

/**
 * Merge AI warnings + deterministic warnings, de-duped, errors first.
 */
export function mergeWarnings(aiWarnings = [], detWarnings = []) {
  const seen = new Set();
  const all = [...detWarnings, ...aiWarnings].filter((w) => {
    const k = (w.message || '').toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return all.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
}
