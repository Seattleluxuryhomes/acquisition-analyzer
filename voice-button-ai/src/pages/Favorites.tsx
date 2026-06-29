import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { WorkflowCard } from '../components/WorkflowCard';
import { getWorkflow } from '../data/workflows';
import { useApp } from '../store';
import type { Workflow } from '../types/workflow';

/** Saved favorites list. */
export function Favorites({ onOpen }: { onOpen: (w: Workflow) => void }) {
  const { favorites, isFavorite, toggleFavorite, usage } = useApp();

  const favWorkflows = useMemo(
    () => favorites.map(getWorkflow).filter((w): w is Workflow => Boolean(w)),
    [favorites],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold tracking-tight text-zinc-100">Favorites</h1>

      {favWorkflows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/5">
            <Star className="h-6 w-6 text-zinc-500" />
          </span>
          <p className="text-sm font-medium text-zinc-200">No favorites yet</p>
          <p className="max-w-xs text-xs text-zinc-400">
            Tap the star on any workflow to pin it here for one-tap access.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {favWorkflows.map((w) => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              onOpen={() => onOpen(w)}
              favorite={isFavorite(w.id)}
              onToggleFavorite={() => toggleFavorite(w.id)}
              usageCount={usage[w.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
