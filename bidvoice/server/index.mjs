/**
 * BidVoice HTTP server — node:http, no framework (same lean approach as the
 * rest of the stack). Serves the mobile-first PWA and a small JSON API.
 *
 * v0 is a single broker (the standing identity); brokerId is resolved per
 * request from the one broker row. The shape is multi-tenant-ready: swap
 * resolveBroker() for a real session lookup and every route already scopes by
 * broker_id.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBroker, updateBroker } from './db.mjs';
import { PROPERTY_TYPES, addendaByPopularity, ALWAYS_INCLUDED } from './forms.mjs';
import { coordinate, aiConfigured } from './coordinator.mjs';
import { resolvePackage, mergeWarnings, packageFromAddenda } from './validate.mjs';
import {
  createOffer,
  getOffer,
  listOffers,
  saveCoordinated,
  setForms,
  setStatus,
  deleteOffer,
} from './offers.mjs';
import { buildPackagePdf } from './pdf.mjs';
import { signingStatus, saveMark } from './sign.mjs';
import { DEFAULTS } from './identity.mjs';
import { logEvent } from './db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || process.env.BIDVOICE_PORT || 8788;
const MAX_BODY = 2 * 1024 * 1024; // 2MB (inked PNGs / transcripts)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/* ------------------------------- helpers ---------------------------------- */

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      parts.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(parts).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function resolveBroker() {
  // v0: the one broker. Becomes a session lookup for multi-tenant.
  return getBroker();
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

/* -------------------------------- routes ---------------------------------- */

async function api(req, res, url) {
  const broker = resolveBroker();
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const method = req.method;

  // GET /api/health
  if (parts[1] === 'health') {
    return send(res, 200, { ok: true, ai: aiConfigured(), service: 'bidvoice' });
  }

  // GET /api/forms — property types + addenda ordered by popularity
  if (parts[1] === 'forms' && method === 'GET') {
    return send(res, 200, {
      property_types: PROPERTY_TYPES,
      addenda: addendaByPopularity(),
      always_included: ALWAYS_INCLUDED,
      defaults: DEFAULTS,
    });
  }

  // /api/broker
  if (parts[1] === 'broker') {
    if (method === 'GET') return send(res, 200, publicBroker(broker));
    if (method === 'PUT') {
      const body = await readBody(req);
      return send(res, 200, publicBroker(updateBroker(broker.id, body)));
    }
  }

  // /api/offers ...
  if (parts[1] === 'offers') {
    const id = parts[2];

    if (!id) {
      if (method === 'GET') return send(res, 200, { offers: listOffers(broker.id) });
      if (method === 'POST') {
        const body = await readBody(req);
        const offer = createOffer(broker.id, {
          propertyTypeId: body.propertyTypeId,
          transcript: body.transcript || '',
        });
        return send(res, 201, { offer });
      }
    }

    if (id) {
      const action = parts[3];

      // POST /api/offers/:id/coordinate — the brain
      if (action === 'coordinate' && method === 'POST') {
        const body = await readBody(req);
        const existing = getOffer(broker.id, id);
        if (!existing) return send(res, 404, { error: 'Offer not found.' });
        const transcript = String(body.transcript || existing.transcript || '');
        const propertyTypeId = body.propertyTypeId || existing.property_type;
        let coordinated;
        try {
          coordinated = await coordinate({ transcript, propertyTypeId });
        } catch (err) {
          return send(res, err.status || 500, { error: err.message, code: err.code });
        }
        const pkg = resolvePackage(coordinated, transcript);
        pkg.warnings = mergeWarnings(coordinated.warnings, pkg.warnings);
        const saved = saveCoordinated(broker.id, id, { coordinated, pkg });
        return send(res, 200, { offer: saved, signing: signingStatus(id, saved.forms) });
      }

      // POST /api/offers/:id/forms — manual addenda picker
      if (action === 'forms' && method === 'POST') {
        const offer = getOffer(broker.id, id);
        if (!offer) return send(res, 404, { error: 'Offer not found.' });
        const body = await readBody(req);
        const pkg = packageFromAddenda(offer, Array.isArray(body.addenda) ? body.addenda : []);
        const saved = setForms(broker.id, id, pkg);
        return send(res, 200, { offer: saved, signing: signingStatus(id, saved.forms) });
      }

      // POST /api/offers/:id/status
      if (action === 'status' && method === 'POST') {
        const body = await readBody(req);
        const updated = setStatus(broker.id, id, String(body.status || ''));
        if (!updated) return send(res, 400, { error: 'Invalid status or offer.' });
        return send(res, 200, { offer: updated });
      }

      // GET /api/offers/:id/signing
      if (action === 'signing' && method === 'GET') {
        const offer = getOffer(broker.id, id);
        if (!offer) return send(res, 404, { error: 'Offer not found.' });
        return send(res, 200, signingStatus(id, offer.forms));
      }

      // POST /api/offers/:id/sign — capture one sign/initial mark
      if (action === 'sign' && method === 'POST') {
        const offer = getOffer(broker.id, id);
        if (!offer) return send(res, 404, { error: 'Offer not found.' });
        const body = await readBody(req);
        try {
          const mark = saveMark(broker.id, id, {
            anchor: body.anchor,
            kind: body.kind,
            signerName: body.signerName || broker.broker_name,
            png: body.png,
            ip: clientIp(req),
            userAgent: req.headers['user-agent'],
          });
          logEvent(id, 'signed', body.anchor);
          return send(res, 200, { mark, signing: signingStatus(id, offer.forms) });
        } catch (err) {
          return send(res, err.status || 400, { error: err.message });
        }
      }

      // GET /api/offers/:id/pdf — the package
      if (action === 'pdf' && method === 'GET') {
        const offer = getOffer(broker.id, id);
        if (!offer) return send(res, 404, { error: 'Offer not found.' });
        const { buffer, filename } = await buildPackagePdf(offer, broker);
        logEvent(id, 'generated', filename);
        return send(res, 200, buffer, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
        });
      }

      // GET / DELETE /api/offers/:id
      if (!action) {
        if (method === 'GET') {
          const offer = getOffer(broker.id, id);
          if (!offer) return send(res, 404, { error: 'Offer not found.' });
          return send(res, 200, { offer, signing: signingStatus(id, offer.forms) });
        }
        if (method === 'DELETE') {
          return send(res, deleteOffer(broker.id, id) ? 200 : 404, { ok: true });
        }
      }
    }
  }

  return send(res, 404, { error: 'Not found' });
}

function publicBroker(b) {
  return {
    id: b.id,
    broker_name: b.broker_name,
    brokerage: b.brokerage,
    mls_office_no: b.mls_office_no,
    firm_lag_no: b.firm_lag_no,
    dol_license_no: b.dol_license_no,
    email: b.email,
    phone: b.phone,
    entity: b.entity,
    address: b.address,
  };
}

/* ------------------------------- static ----------------------------------- */

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback to index.html for client routes.
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, html) => {
        if (e2) return send(res, 404, { error: 'Not found' });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ------------------------------- server ----------------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    return send(res, err.status || 500, { error: err.message || 'Server error' });
  }
});

// Ensure the broker row exists at boot.
getBroker();

server.listen(PORT, () => {
  console.log(`BidVoice listening on :${PORT}  (AI ${aiConfigured() ? 'live' : 'not configured'})`);
});
