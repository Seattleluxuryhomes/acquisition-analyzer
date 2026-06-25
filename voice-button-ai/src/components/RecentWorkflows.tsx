import { History } from 'lucide-react';
import type { Workflow } from '../types/workflow';
import { Icon } from './Icon';

/** "Recently used" list shown on Home below the action grid. */
export function RecentWorkflows({
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
        <History className="h-3.5 w-3.5" />
        Recent
      </div>
      <div className="flex flex-col gap-1.5">
        {workflows.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => onOpen(w)}
            className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05] active:scale-[0.99]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-brand-300">
              <Icon name={w.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-200">
                {w.title}
              </span>
            </span>
            <span className="font-mono text-[11px] text-zinc-600">{w.command}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
