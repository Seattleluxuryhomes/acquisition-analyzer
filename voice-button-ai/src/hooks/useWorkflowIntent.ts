import { useMemo } from 'react';
import { matchIntent, type MatchResult } from '../lib/intentMatcher';

/**
 * React wrapper around the intent matcher. Recomputes the ranked match list
 * whenever the transcript changes. Pure + memoized — no side effects.
 */
export function useWorkflowIntent(transcript: string): MatchResult {
  return useMemo(() => {
    const t = transcript.trim();
    if (!t) return { top: undefined, confident: false, matches: [] };
    return matchIntent(t);
  }, [transcript]);
}
