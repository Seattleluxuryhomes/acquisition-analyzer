/**
 * Aggregate Learning Flywheel — the moat.
 *
 * The on-device learner makes the app better for one person. This makes it
 * better for *everyone*, while keeping each person's data on their device.
 *
 * What crosses the wire (opt-in, and only when sharing is on):
 *   - generic intent words already tokenized client-side ("offer", "bid")
 *   - workflow ids, variant ids, and a numeric reward in [0,1]
 * What never crosses the wire:
 *   - prompt text, input field values, transcripts, identifiers, anything PII.
 *
 * The server keeps only aggregate counts. `insights()` ships the crowd's
 * priors back to every client, so a brand-new user benefits from everyone's
 * learning on their first tap — the cold-start problem, solved.
 *
 * Storage is a JSON file (pluggable). In production swap `load`/`persist` for a
 * database; the call sites don't change.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '.data', 'aggregate.json');

// Sanitization — the server trusts nothing the client sends.
const TOKEN_RE = /^[a-z0-9][a-z0-9 ]{0,30}$/;
const ID_RE = /^[a-z0-9-]{1,64}$/;
const MAX_EVENTS = 50;
const MAX_TOKENS = 12;

let state = null;
let dirty = false;

async function load() {
  if (state) return state;
  try {
    state = JSON.parse(await readFile(DATA, 'utf8'));
  } catch {
    state = { tokenToWorkflow: {}, bandit: {}, runs: 0 };
  }
  state.tokenToWorkflow ??= {};
  state.bandit ??= {};
  state.runs ??= 0;
  return state;
}

async function persist() {
  if (!dirty) return;
  dirty = false;
  try {
    await mkdir(dirname(DATA), { recursive: true });
    await writeFile(DATA, JSON.stringify(state));
  } catch {
    /* read-only FS — aggregation still works in-memory for this process */
  }
}

/** Fold a batch of anonymous events into the aggregate. Returns a count. */
export async function record(events) {
  const s = await load();
  let n = 0;

  for (const e of Array.isArray(events) ? events.slice(0, MAX_EVENTS) : []) {
    if (!e || typeof e.workflowId !== 'string' || !ID_RE.test(e.workflowId)) continue;

    if (e.type === 'choice') {
      const toks = (Array.isArray(e.tokens) ? e.tokens : [])
        .filter((t) => typeof t === 'string' && TOKEN_RE.test(t))
        .slice(0, MAX_TOKENS);
      for (const t of toks) {
        const row = (s.tokenToWorkflow[t] ??= {});
        row[e.workflowId] = (row[e.workflowId] || 0) + 1;
        n++;
      }
    } else if (e.type === 'reward') {
      if (typeof e.variantId !== 'string' || !ID_RE.test(e.variantId)) continue;
      const r = Number(e.reward);
      if (!Number.isFinite(r)) continue;
      const arms = (s.bandit[e.workflowId] ??= {});
      const st = (arms[e.variantId] ??= { n: 0, reward: 0 });
      st.n += 1;
      st.reward += Math.max(0, Math.min(1, r));
      n++;
    }
  }

  if (n > 0) {
    s.runs += 1;
    dirty = true;
    await persist();
  }
  return { recorded: n, runs: s.runs };
}

/** The crowd's priors, shaped for the client to blend with local learning. */
export async function insights() {
  const s = await load();

  const variants = {};
  for (const [wf, arms] of Object.entries(s.bandit)) {
    variants[wf] = {};
    for (const [v, st] of Object.entries(arms)) {
      variants[wf][v] =
        st.n > 0 ? { n: st.n, mean: Number((st.reward / st.n).toFixed(3)) } : { n: 0, mean: null };
    }
  }

  // For each token, expose only the single dominant workflow + its share —
  // small payload, and nothing reconstructable about any individual.
  const tokens = {};
  for (const [t, wfs] of Object.entries(s.tokenToWorkflow)) {
    let bestWf = null;
    let best = 0;
    let total = 0;
    for (const [wf, c] of Object.entries(wfs)) {
      total += c;
      if (c > best) {
        best = c;
        bestWf = wf;
      }
    }
    if (bestWf && total >= 2) {
      tokens[t] = { workflowId: bestWf, weight: Number((best / total).toFixed(3)), n: total };
    }
  }

  return { runs: s.runs, variants, tokens };
}
