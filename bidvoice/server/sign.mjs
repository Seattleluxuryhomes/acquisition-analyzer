/**
 * Shared sign / initial system.
 *
 * One model for "a place to sign and a place to initial, in the appropriate
 * spots" — used by BidVoice (NWMLS packages) AND Bidtranslator (client
 * proposals). It is intentionally self-contained and dependency-light so it can
 * be dropped into either app.
 *
 * An ANCHOR is one required mark on a document:
 *   { anchor, form, kind, role, page, label, x, y }
 *     anchor : stable id, e.g. "21:sign:buyer1" or "22A:initial:p2"
 *     kind   : "sign" | "initial"
 *     role   : "buyer" | "buyer2" | "seller" | "broker"
 *     page   : 1-based page within that form
 *     x,y    : PDF points from bottom-left (filled from coordinate_maps.md when
 *              real forms are wired; null until then)
 *
 * The capture UI inks a PNG; saveMark() validates + stores it; signingStatus()
 * reports which anchors are still pending so the package can't be "complete"
 * with a missing signature (a Smart-Validation guarantee).
 */

import crypto from 'node:crypto';
import db from './db.mjs';

const MAX_PNG = 240 * 1024;
const PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/;

export function isValidMarkPng(png) {
  return typeof png === 'string' && PNG_RE.test(png) && png.length <= MAX_PNG && png.length > 80;
}

/**
 * Per-form anchor templates. v0 models the standard NWMLS pattern: the buyer
 * INITIALS each page and SIGNS the signature block. Exact page counts and x/y
 * come from the forms library (coordinate_maps.md) — until then a form declares
 * `everyPageInitial` and a single signature block, which is enough to drive the
 * capture UI and the "is everything signed?" check. Real coordinates slot in
 * without changing call sites.
 */
const TEMPLATES = {
  // Base PSAs get two buyer signatures + per-page initials.
  '21': { sign: ['buyer1', 'buyer2'], everyPageInitial: true },
  '25': { sign: ['buyer1', 'buyer2'], everyPageInitial: true },
  CL: { sign: ['buyer1'], everyPageInitial: true },
  // Exhibit A / Form 17 are acknowledged, not multi-signed.
  EXA: { sign: [], everyPageInitial: true },
  17: { sign: [], everyPageInitial: true, ack: true },
};

const DEFAULT_TEMPLATE = { sign: ['buyer1'], everyPageInitial: true };

/**
 * Build the full list of required marks for a resolved form package.
 * pageCounts: optional { formId: nPages } from the real PDFs; defaults to 1.
 */
export function anchorsForPackage(forms, pageCounts = {}) {
  const anchors = [];
  for (const f of forms) {
    const tpl = TEMPLATES[f.id] || DEFAULT_TEMPLATE;
    const pages = Math.max(1, Number(pageCounts[f.id]) || 1);

    if (tpl.everyPageInitial) {
      for (let pg = 1; pg <= pages; pg++) {
        anchors.push({
          anchor: `${f.id}:initial:p${pg}`,
          form: f.id,
          kind: 'initial',
          role: 'buyer',
          page: pg,
          label: `${f.id} — initial p.${pg}`,
          x: null,
          y: null,
        });
      }
    }
    for (const role of tpl.sign) {
      anchors.push({
        anchor: `${f.id}:sign:${role}`,
        form: f.id,
        kind: 'sign',
        role,
        page: pages, // signature block is on the last page in v0
        label: `${f.id} — ${role.replace('buyer', 'Buyer ')} signature`,
        x: null,
        y: null,
      });
    }
  }
  return anchors;
}

/**
 * Persist one inked mark for an anchor.
 */
export function saveMark(brokerId, offerId, { anchor, kind, signerName, png, ip, userAgent } = {}) {
  if (!anchor || typeof anchor !== 'string') {
    const e = new Error('Missing signing anchor.');
    e.status = 400;
    throw e;
  }
  if (!['sign', 'initial'].includes(kind)) {
    const e = new Error('Mark must be a signature or an initial.');
    e.status = 400;
    throw e;
  }
  if (!isValidMarkPng(png)) {
    const e = new Error("Your mark didn't come through — please sign again.");
    e.status = 400;
    throw e;
  }
  const id = crypto.randomBytes(9).toString('base64url');
  db.prepare(
    `INSERT INTO sig (id, offer_id, broker_id, anchor, kind, signer_name, image_png, ip, user_agent, signed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    offerId,
    brokerId,
    anchor.slice(0, 80),
    kind,
    String(signerName || '').slice(0, 120),
    png,
    String(ip || '').slice(0, 64),
    String(userAgent || '').slice(0, 300),
    Date.now()
  );
  return { id, anchor, kind, signed_at: Date.now() };
}

/** Map of anchor -> latest mark for an offer. */
export function marksByAnchor(offerId) {
  const rows = db
    .prepare('SELECT anchor, kind, signer_name, signed_at FROM sig WHERE offer_id=? ORDER BY signed_at ASC')
    .all(offerId);
  const map = {};
  for (const r of rows) map[r.anchor] = r;
  return map;
}

/**
 * Overall signing status for a package: which anchors are done vs pending.
 */
export function signingStatus(offerId, forms, pageCounts = {}) {
  const required = anchorsForPackage(forms, pageCounts);
  const done = marksByAnchor(offerId);
  const items = required.map((a) => ({ ...a, signed: !!done[a.anchor], signer: done[a.anchor]?.signer_name || '' }));
  const remaining = items.filter((i) => !i.signed).length;
  return { items, total: items.length, remaining, complete: remaining === 0 && items.length > 0 };
}
