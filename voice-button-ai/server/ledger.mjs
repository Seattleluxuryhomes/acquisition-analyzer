/**
 * Credits ledger + budget guard — the monetization spine (and the abuse
 * throttle, for free).
 *
 * Every Fable run is metered to credits (server/pricing.mjs). This enforces a
 * per-identity **free daily allowance**, draws from any purchased **balance**
 * after that, and refuses to start a run when nothing's left — returning a 402
 * with the reset time. That single mechanism gives us: a free taste that
 * converts, overage billing, and a rate limit that stops a single client from
 * running up the model bill.
 *
 * Identity today is a soft, client-supplied id (good enough to meter and
 * throttle pre-auth). When real auth lands, swap `identityOf` for the user id —
 * nothing else changes. Storage is a JSON file, pluggable for a DB.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '.data', 'ledger.json');

/** Free Fable credits per UTC day before a run is refused. Env-tunable. */
export const FREE_DAILY_CREDITS = Number(process.env.VBAI_FREE_DAILY_CREDITS || 30);

let state = null;
let dirty = false;

async function load() {
  if (state) return state;
  try {
    state = JSON.parse(await readFile(DATA, 'utf8'));
  } catch {
    state = { identities: {} };
  }
  state.identities ??= {};
  return state;
}

async function persist() {
  if (!dirty) return;
  dirty = false;
  try {
    await mkdir(dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify(state));
  } catch {
    /* read-only FS — ledger still enforced in-memory for this process */
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function nextResetIso() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0); // next UTC midnight
  return d.toISOString();
}

/** Get (and lazily roll over) an identity's ledger entry. */
function entry(s, id) {
  const e = (s.identities[id] ??= { date: today(), usedToday: 0, balance: 0 });
  if (e.date !== today()) {
    e.date = today();
    e.usedToday = 0;
    dirty = true;
  }
  return e;
}

/** Derive a stable identity from the request (soft, pre-auth). */
export function identityOf(req) {
  const h = req.headers['x-vbai-client'];
  if (typeof h === 'string' && /^[a-z0-9-]{8,64}$/i.test(h)) return h;
  return `ip:${req.socket?.remoteAddress || 'unknown'}`;
}

export async function status(id) {
  const s = await load();
  const e = entry(s, id);
  await persist();
  const freeRemaining = Math.max(0, FREE_DAILY_CREDITS - e.usedToday);
  return {
    plan: 'free',
    dailyAllowance: FREE_DAILY_CREDITS,
    usedToday: e.usedToday,
    freeRemaining,
    balance: e.balance,
    remaining: freeRemaining + e.balance,
    resetsAt: nextResetIso(),
  };
}

/** Is there any budget left to start a run? */
export async function canSpend(id) {
  return (await status(id)).remaining > 0;
}

/** Debit credits (free allowance first, then purchased balance). */
export async function spend(id, credits) {
  const s = await load();
  const e = entry(s, id);
  let c = Math.max(0, Math.round(credits));
  const free = Math.max(0, FREE_DAILY_CREDITS - e.usedToday);
  const fromFree = Math.min(free, c);
  e.usedToday += fromFree;
  c -= fromFree;
  if (c > 0) e.balance = Math.max(0, e.balance - c);
  dirty = true;
  await persist();
  return status(id);
}

/** Add purchased credits (the hook a real checkout flow would call). */
export async function grant(id, credits) {
  const s = await load();
  const e = entry(s, id);
  e.balance += Math.max(0, Math.round(credits));
  dirty = true;
  await persist();
  return status(id);
}
