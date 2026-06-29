import { Star } from 'lucide-react';
import type { Workflow } from '../types/workflow';
import { Icon } from './Icon';

/** Horizontal, swipeable strip of favorited workflows. */
export function FavoritesBar({
  workflows,
  onOpen,
}: {
  workflows: Workflow[];
  onOpen: (w: Workflow) => void;
}) {
  if (workflows.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        Favorites
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {workflows.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onOpen(w)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-2 pl-2 pr-3.5 text-sm text-zinc-200 transition-colors hover:border-brand-400/40 hover:bg-white/[0.09] active:scale-95"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500/90 to-brand-700 text-white">
              <Icon name={w.icon} className="h-3.5 w-3.5" />
            </span>
            <span className="whitespace-nowrap font-medium">{w.buttonLabel}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
