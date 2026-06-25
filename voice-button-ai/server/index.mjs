/**
 * Voice Button AI — server.
 *
 * Two jobs:
 *  1. Serve the built static app (dist/) in production with SPA fallback.
 *  2. Expose the key-safe Fable Execution Engine at POST /api/run (SSE stream).
 *
 * Zero web-framework dependencies — just Node's http. The only runtime
 * dependency is the Anthropic SDK, and even that is dynamically imported inside
 * the engine so this server boots (and the offline path works) without it.
 *
 *   ANTHROPIC_API_KEY   live key (server-side only; never sent to the browser)
 *   VBAI_PORT           default 8787
 *   VBAI_MOCK=1         force the simulated engine (local dev without a key)
 */

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWorkflow } from './fable.mjs';
import { record as recordAggregate, insights as getInsights } from './aggregate.mjs';
import { identityOf, canSpend, spend, status as creditStatus } from './ledger.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.VBAI_PORT || 8787);
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;
const MOCK = process.env.VBAI_MOCK === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/health') return json(res, 200, healthBody());
    if (url.pathname === '/api/run' && req.method === 'POST') return handleRun(req, res);
    if (url.pathname === '/api/credits' && req.method === 'GET') return handleCredits(req, res);
    if (url.pathname === '/api/learn' && req.method === 'POST') return handleLearn(req, res);
    if (url.pathname === '/api/insights' && req.method === 'GET') return handleInsights(res);
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    return serveStatic(url.pathname, res);
  } catch (err) {
    json(res, 500, { error: err?.message || 'server error' });
  }
});

server.listen(PORT, () => {
  const mode = MOCK ? 'SIMULATED (VBAI_MOCK)' : HAS_KEY ? 'LIVE (Fable)' : 'OFFLINE (no key)';
  console.log(`Voice Button AI server on http://localhost:${PORT}  · engine: ${mode}`);
});

/* ------------------------------- handlers -------------------------------- */

function healthBody() {
  return { ok: true, online: HAS_KEY && !MOCK, mock: MOCK, model: 'claude-fable-5' };
}

async function handleRun(req, res) {
  const body = await readJson(req).catch(() => null);
  const prompt = String(body?.prompt || '').trim();
  const effort = String(body?.effort || 'medium');

  if (!prompt) return json(res, 400, { error: 'prompt required' });
  if (prompt.length > 60_000) return json(res, 413, { error: 'prompt too large' });

  // Budget guard: refuse to start a run with no credits left.
  const id = identityOf(req);
  if (!(await canSpend(id))) {
    const st = await creditStatus(id);
    return json(res, 402, {
      error: 'quota',
      message: "You're out of free Fable runs for today. They reset at UTC midnight, or top up to keep going.",
      ...st,
    });
  }

  const send = openSse(res);
  send('meta', { online: HAS_KEY && !MOCK, model: 'claude-fable-5' });

  // Heartbeat so proxies don't close an idle "thinking" stream.
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 15_000);

  try {
    const result = await runWorkflow({ prompt, effort, onText: (t) => send('delta', { text: t }) });
    if (result.refused) {
      send('error', { message: 'The model declined this request. Try rephrasing.' });
    } else {
      const st = await spend(id, result.credits ?? 0);
      send('done', { ...result, remaining: st.remaining, plan: st.plan, resetsAt: st.resetsAt });
    }
  } catch (err) {
    send('error', { message: err?.message || 'run failed' });
  } finally {
    clearInterval(beat);
    res.end();
  }
}

async function handleCredits(req, res) {
  const st = await creditStatus(identityOf(req)).catch(() => null);
  if (!st) return json(res, 200, { plan: 'free', remaining: null });
  return json(res, 200, st);
}

async function handleLearn(req, res) {
  const body = await readJson(req).catch(() => null);
  const result = await recordAggregate(body?.events).catch(() => ({ recorded: 0 }));
  return json(res, 200, { ok: true, ...result });
}

async function handleInsights(res) {
  const data = await getInsights().catch(() => ({ runs: 0, variants: {}, tokens: {} }));
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60',
  });
  res.end(JSON.stringify(data));
}

async function serveStatic(pathname, res) {
  // Decode + strip any traversal, then resolve within DIST only.
  const rel = decodeURIComponent(pathname).replace(/\.\.(?:[/\\]|$)/g, '');
  let filePath = join(DIST, rel === '/' ? 'index.html' : rel);

  let info = await stat(filePath).catch(() => null);
  if (info?.isDirectory()) {
    filePath = join(filePath, 'index.html');
    info = await stat(filePath).catch(() => null);
  }
  // SPA fallback: unknown non-file routes serve index.html.
  if (!info) {
    filePath = join(DIST, 'index.html');
    info = await stat(filePath).catch(() => null);
  }
  if (!info) {
    return json(res, 404, {
      error: 'app not built — run `npm run build`, or use the Vite dev server',
    });
  }

  const data = await readFile(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
  });
  res.end(data);
}

/* -------------------------------- helpers -------------------------------- */

function openSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
