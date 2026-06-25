import { Star, ChevronRight } from 'lucide-react';
import type { Workflow } from '../types/workflow';
import { Icon } from './Icon';

/**
 * A compact list-row representation of a workflow, used on the Workflows /
 * Favorites / search-results lists. Wider and more descriptive than an
 * ActionButton.
 */
export function WorkflowCard({
  workflow,
  onOpen,
  favorite,
  onToggleFavorite,
  usageCount,
}: {
  workflow: Workflow;
  onOpen: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  usageCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-brand-400/40 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500/90 to-brand-700 text-white">
        <Icon name={workflow.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {workflow.title}
          </p>
          <span className="hidden shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">
            {workflow.category}
          </span>
        </div>
        <p className="truncate text-xs text-zinc-400">{workflow.description}</p>
      </div>
      <div className="flex items-center gap-1">
        {!!usageCount && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
            {usageCount}×
          </span>
        )}
        {onToggleFavorite && (
          <span
            role="button"
            tabIndex={0}
            aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite();
              }
            }}
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:text-amber-400"
          >
            <Star className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
