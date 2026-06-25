/**
 * Lightweight, offline intent matcher.
 *
 * No external AI. Scores each workflow against a spoken/typed transcript using
 * tag, title, command, and keyword overlap. Returns a ranked list so the UI can
 * either auto-launch the top match (high confidence) or offer the top 3
 * (low confidence).
 */

import type { IntentMatch, Workflow } from '../types/workflow';
import { WORKFLOWS } from '../data/workflows';
import { adaptiveBoost } from './learning';

/** Words too common to carry intent. */
const STOP = new Set([
  'a', 'an', 'the', 'i', 'to', 'for', 'of', 'and', 'or', 'my', 'me', 'on',
  'in', 'it', 'is', 'with', 'need', 'want', 'help', 'please', 'can', 'you',
  'how', 'do', 'this', 'that', 'about', 'some', 'get', 'make', 'write', 'a',
  'have', 'just', 'let', 'us', 'we', 'be', 'am',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/**
 * Hand-tuned keyword → workflowId boosts for the high-signal cases called out
 * in the spec. These add confidence on top of generic tag matching.
 */
const KEYWORD_BOOSTS: Array<{ words: string[]; id: string; weight: number }> = [
  { words: ['offer', 'buyer', 'purchase', 'terms'], id: 'real-estate-offer', weight: 4 },
  { words: ['counter', 'counteroffer'], id: 'counteroffer', weight: 5 },
  { words: ['land', 'zoning', 'development', 'lots', 'parcel', 'acre'], id: 'land-analysis', weight: 4 },
  { words: ['bug', 'error', 'broken', 'crash', 'not working', 'exception'], id: 'debug', weight: 5 },
  { words: ['contractor', 'bid', 'estimate', 'quote'], id: 'contractor-bid', weight: 4 },
  { words: ['counteroffer', 'explain', 'client', 'simple', 'plain'], id: 'client-summary', weight: 3 },
  { words: ['listing', 'mls'], id: 'listing', weight: 4 },
  { words: ['follow', 'followup', 'check in'], id: 'follow-up', weight: 3 },
  { words: ['hook', 'hooks'], id: 'hooks', weight: 4 },
  { words: ['viral'], id: 'viral-post', weight: 4 },
  { words: ['refactor'], id: 'refactor', weight: 5 },
  { words: ['automate', 'automation'], id: 'automate', weight: 4 },
  { words: ['summarize', 'summary', 'tldr', 'digest'], id: 'digest', weight: 3 },
  { words: ['compare', 'versus', 'vs'], id: 'compare', weight: 4 },
  { words: ['negotiate', 'negotiation'], id: 'negotiation', weight: 4 },
  { words: ['price', 'pricing'], id: 'pricing', weight: 3 },
];

function scoreWorkflow(wf: Workflow, tokens: string[], raw: string): number {
  let score = 0;
  const tokenSet = new Set(tokens);

  // Slash command exact / prefix match is a strong signal.
  if (raw.trim().startsWith('/')) {
    const cmd = raw.trim().split(/\s+/)[0].toLowerCase();
    if (wf.command.toLowerCase() === cmd) return 100;
    if (wf.command.toLowerCase().startsWith(cmd)) score += 8;
  }

  // Tag overlap (tags can be multi-word phrases).
  for (const tag of wf.tags) {
    const tagLc = tag.toLowerCase();
    if (raw.includes(tagLc)) score += 3;
    for (const w of tagLc.split(/\s+/)) {
      if (tokenSet.has(w)) score += 1.5;
    }
  }

  // Title / buttonLabel words.
  for (const w of tokenize(`${wf.title} ${wf.buttonLabel}`)) {
    if (tokenSet.has(w)) score += 2;
  }

  // Category match.
  for (const w of tokenize(wf.category)) {
    if (tokenSet.has(w)) score += 1.5;
  }

  // Hand-tuned boosts.
  for (const boost of KEYWORD_BOOSTS) {
    if (boost.id !== wf.id) continue;
    for (const phrase of boost.words) {
      if (raw.includes(phrase)) score += boost.weight;
    }
  }

  return score;
}

export interface MatchResult {
  /** Best match, or undefined if nothing scored. */
  top?: Workflow;
  /** True when we're confident enough to auto-launch the top match. */
  confident: boolean;
  /** Ranked matches (highest first), already filtered to score > 0. */
  matches: IntentMatch[];
}

export function matchIntent(transcript: string): MatchResult {
  const raw = ` ${transcript.toLowerCase().trim()} `;
  const tokens = tokenize(transcript);

  const matches: IntentMatch[] = WORKFLOWS.map((workflow) => ({
    workflow,
    // Base score (hand-tuned) + per-user learned boost from past choices.
    score: scoreWorkflow(workflow, tokens, raw) + adaptiveBoost(tokens, workflow.id),
  }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = matches[0];
  const second = matches[1];

  // Confident when the top score is meaningful AND clearly ahead of #2.
  const confident =
    !!top &&
    top.score >= 5 &&
    (!second || top.score - second.score >= 3);

  return {
    top: top?.workflow,
    confident,
    matches: matches.slice(0, 6),
  };
}

/** Top-N suggestions for the "low confidence" UI. */
export function suggestWorkflows(transcript: string, n = 3): Workflow[] {
  return matchIntent(transcript).matches.slice(0, n).map((m) => m.workflow);
}
