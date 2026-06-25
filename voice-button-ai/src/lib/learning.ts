/**
 * On-device learning — the "jewel" of the app.
 *
 * Two cheap, fully-local learners, no backend and no ML libraries:
 *
 *  1. Adaptive intent matcher. Every time a transcript leads the user to open a
 *     workflow, we reinforce token→workflow associations. `adaptiveBoost` feeds
 *     those back into the matcher's score, so the app gets better at routing
 *     *your* phrasing over time — and can eventually flip a wrong default.
 *
 *  2. Prompt-variant bandit. Each workflow can ship alternative prompt phrasings.
 *     An epsilon-greedy multi-armed bandit (with optimistic cold-start) picks a
 *     variant per run and learns which one earns the best feedback — explicit
 *     (👍/👎) or implicit (copied vs. regenerated). Per-user, per-task.
 *
 * Everything persists through the local-first `storage` layer, so learning is
 * private to the device and survives reloads. A Settings toggle gates it, and a
 * reset clears it. When cloud sync arrives, this state syncs like any other.
 */

import { storage, KEYS } from './storage';
import { tokenize } from './intentMatcher';
import type { PromptVariant, Settings, Workflow } from '../types/workflow';

export interface VariantStat {
  /** Times this variant was served and scored. */
  n: number;
  /** Sum of rewards in [0,1]. Mean reward = reward / n. */
  reward: number;
}

export interface LearningState {
  /** token → (workflowId → reinforcement count). Drives the adaptive matcher. */
  tokenToWorkflow: Record<string, Record<string, number>>;
  /** workflowId → (variantId → stats). Drives the bandit. */
  bandit: Record<string, Record<string, VariantStat>>;
}

const EPSILON = 0.2; // exploration rate
const PER_TOKEN_CAP = 2; // max boost a single token can contribute
const PER_WORKFLOW_CAP = 6; // max total learned boost for one workflow

function freshState(): LearningState {
  return { tokenToWorkflow: {}, bandit: {} };
}

function getState(): LearningState {
  const s = storage.get<LearningState>(KEYS.learning, freshState());
  // Defensive: tolerate partially-shaped persisted data.
  return {
    tokenToWorkflow: s.tokenToWorkflow ?? {},
    bandit: s.bandit ?? {},
  };
}

function save(s: LearningState): void {
  storage.set(KEYS.learning, s);
}

/** Learning is on unless the user explicitly turned it off in Settings. */
export function isAdaptiveEnabled(): boolean {
  const s = storage.get<Partial<Settings>>(KEYS.settings, {});
  return s.adaptiveLearning !== false;
}

/* --------------------------- adaptive matcher --------------------------- */

/** Reinforce the words of `transcript` toward the workflow the user chose. */
export function recordChoice(transcript: string, workflowId: string): void {
  if (!isAdaptiveEnabled()) return;
  const tokens = tokenize(transcript);
  if (tokens.length === 0) return;
  const s = getState();
  const t2w = { ...s.tokenToWorkflow };
  for (const tok of tokens) {
    const row = { ...(t2w[tok] ?? {}) };
    row[workflowId] = (row[workflowId] ?? 0) + 1;
    t2w[tok] = row;
  }
  save({ ...s, tokenToWorkflow: t2w });
}

/**
 * Extra score for `workflowId` given the transcript `tokens`, learned from past
 * choices. Diminishing per token, capped per workflow so it nudges ranking and
 * confidence without steamrolling strong keyword matches.
 */
export function adaptiveBoost(tokens: string[], workflowId: string): number {
  if (!isAdaptiveEnabled() || tokens.length === 0) return 0;
  const { tokenToWorkflow } = getState();
  let boost = 0;
  for (const tok of tokens) {
    const count = tokenToWorkflow[tok]?.[workflowId];
    if (count) boost += Math.min(PER_TOKEN_CAP, 0.5 * count);
  }
  return Math.min(PER_WORKFLOW_CAP, boost);
}

/* ------------------------------- bandit -------------------------------- */

/** Baseline + any declared variants, baseline first as id "base". */
export function effectiveVariants(wf: Workflow): PromptVariant[] {
  const base: PromptVariant = {
    id: 'base',
    label: 'Default',
    promptTemplate: wf.promptTemplate,
  };
  return [base, ...(wf.promptVariants ?? [])];
}

/** True when a workflow actually has something to A/B test. */
export function hasVariants(wf: Workflow): boolean {
  return (wf.promptVariants?.length ?? 0) > 0;
}

/**
 * Epsilon-greedy selection with optimistic cold-start: untried variants get a
 * mean of 1.0 so they get explored before the bandit commits. Uses Math.random
 * (fine in the browser) and varies naturally across runs.
 */
export function selectVariant(wf: Workflow): PromptVariant {
  const variants = effectiveVariants(wf);
  if (variants.length === 1 || !isAdaptiveEnabled()) return variants[0];

  const stats = getState().bandit[wf.id] ?? {};

  // Explore.
  if (Math.random() < EPSILON) {
    return variants[Math.floor(Math.random() * variants.length)];
  }

  // Exploit: highest mean reward, optimistic for untried arms.
  let best = variants[0];
  let bestMean = -Infinity;
  for (const v of variants) {
    const st = stats[v.id];
    const mean = st && st.n > 0 ? st.reward / st.n : 1;
    if (mean > bestMean) {
      bestMean = mean;
      best = v;
    }
  }
  return best;
}

/** Record a reward in [0,1] for a served variant. */
export function recordReward(workflowId: string, variantId: string, reward: number): void {
  if (!isAdaptiveEnabled()) return;
  const r = Math.max(0, Math.min(1, reward));
  const s = getState();
  const bandit = { ...s.bandit };
  const wfStats = { ...(bandit[workflowId] ?? {}) };
  const cur = wfStats[variantId] ?? { n: 0, reward: 0 };
  wfStats[variantId] = { n: cur.n + 1, reward: cur.reward + r };
  bandit[workflowId] = wfStats;
  save({ ...s, bandit });
}

/* ------------------------------- admin --------------------------------- */

export interface LearningStats {
  /** Total reinforced token→workflow signals. */
  signals: number;
  /** Total bandit trials recorded. */
  trials: number;
}

export function learningStats(): LearningStats {
  const s = getState();
  const signals = Object.values(s.tokenToWorkflow).reduce(
    (acc, row) => acc + Object.values(row).reduce((a, c) => a + c, 0),
    0,
  );
  const trials = Object.values(s.bandit).reduce(
    (acc, row) => acc + Object.values(row).reduce((a, st) => a + st.n, 0),
    0,
  );
  return { signals, trials };
}

export function resetLearning(): void {
  save(freshState());
}
