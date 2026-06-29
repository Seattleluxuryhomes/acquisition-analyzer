/**
 * Aggregate-learning client: the crowd's priors, blended into local learning.
 *
 * Fetches /api/insights (best-effort, cached locally so it works offline and in
 * the extension popup), and exposes two priors the local learner blends in:
 *   - globalTokenPrior: how strongly the crowd routes a word to a workflow.
 *   - globalVariantMean: the crowd's mean reward for a prompt variant.
 *
 * This is what makes a brand-new user smart on tap #1 — the cold-start problem,
 * solved — while every device keeps its own data private.
 */

import { storage, KEYS } from './storage';

export interface Insights {
  runs: number;
  variants: Record<string, Record<string, { n: number; mean: number | null }>>;
  tokens: Record<string, { workflowId: string; weight: number; n: number }>;
}

const EMPTY: Insights = { runs: 0, variants: {}, tokens: {} };

let cache: Insights | null = null;

function get(): Insights {
  if (cache) return cache;
  cache = storage.get<Insights>(KEYS.insights, EMPTY);
  return cache;
}

/** Pull the latest aggregate priors. Silent on any failure (offline / no server). */
export async function refreshInsights(): Promise<void> {
  try {
    const resp = await fetch('/api/insights');
    if (!resp.ok) return;
    const data = (await resp.json()) as Insights;
    if (data && typeof data === 'object') {
      cache = { runs: data.runs ?? 0, variants: data.variants ?? {}, tokens: data.tokens ?? {} };
      storage.set(KEYS.insights, cache);
    }
  } catch {
    /* keep whatever is cached */
  }
}

/** 0..1 — how dominantly the crowd routes `token` to `workflowId`. */
export function globalTokenPrior(token: string, workflowId: string): number {
  const t = get().tokens[token];
  return t && t.workflowId === workflowId ? t.weight : 0;
}

/** Crowd mean reward for a variant, or null when the crowd hasn't tried it. */
export function globalVariantMean(workflowId: string, variantId: string): number | null {
  const v = get().variants[workflowId]?.[variantId];
  return v && v.n > 0 ? v.mean : null;
}

/** How many shared runs the library has learned from (for the Settings readout). */
export function globalRuns(): number {
  return get().runs;
}
