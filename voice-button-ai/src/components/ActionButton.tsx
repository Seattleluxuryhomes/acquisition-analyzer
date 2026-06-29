import { Star } from 'lucide-react';
import type { Workflow } from '../types/workflow';
import { Icon } from './Icon';

/**
 * Big push-button card for a workflow — the primary tappable target on Home.
 * Generous size for mobile, smooth hover/active states.
 */
export function ActionButton({
  workflow,
  onOpen,
  favorite,
  onToggleFavorite,
}: {
  workflow: Workflow;
  onOpen: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-400/40 hover:bg-white/[0.07] hover:shadow-card active:translate-y-0 active:scale-[0.98] min-h-[112px]"
    >
      <div className="flex w-full items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-brand-500/90 to-brand-700 text-white shadow-sm transition-transform group-hover:scale-110">
          <Icon name={workflow.icon} className="h-5 w-5" />
        </span>
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
            className="rounded-md p-1 text-zinc-500 transition-colors hover:text-amber-400"
          >
            <Star
              className={`h-4 w-4 ${favorite ? 'fill-amber-400 text-amber-400' : ''}`}
            />
          </span>
        )}
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-zinc-100">
          {workflow.buttonLabel}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
          {workflow.description}
        </p>
      </div>
    </button>
  );
}
