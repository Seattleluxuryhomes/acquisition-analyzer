import { useMemo, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { WorkflowCard } from '../components/WorkflowCard';
import { CATEGORIES, WORKFLOWS } from '../data/workflows';
import { useApp } from '../store';
import type { Workflow, WorkflowCategory } from '../types/workflow';

/** Browse the full workflow library by category, with search. */
export function Workflows({ onOpen }: { onOpen: (w: Workflow) => void }) {
  const { isFavorite, toggleFavorite, usage } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WorkflowCategory | 'All'>('All');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return WORKFLOWS.filter((w: Workflow) => {
      if (category !== 'All' && w.category !== category) return false;
      if (!q) return true;
      return (
        w.title.toLowerCase().includes(q) ||
        w.buttonLabel.toLowerCase().includes(q) ||
        w.command.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.tags.some((t: string) => t.includes(q))
      );
    });
  }, [query, category]);

  const chips: (WorkflowCategory | 'All')[] = ['All', ...CATEGORIES];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold tracking-tight text-zinc-100">All workflows</h1>
      <SearchBar value={query} onChange={setQuery} placeholder="Search the library" />

      {/* Category filter */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => {
          const on = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={[
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                on
                  ? 'bg-brand-600 text-white'
                  : 'border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]',
              ].join(' ')}
            >
              {c}
            </button>
          );
        })}
      </div>

      <p className="px-1 text-xs text-zinc-500">{filtered.length} workflows</p>

      <div className="flex flex-col gap-2">
        {filtered.map((w: Workflow) => (
          <WorkflowCard
            key={w.id}
            workflow={w}
            onOpen={() => onOpen(w)}
            favorite={isFavorite(w.id)}
            onToggleFavorite={() => toggleFavorite(w.id)}
            usageCount={usage[w.id]}
          />
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-zinc-400">
            Nothing here yet. Try another category or search.
          </p>
        )}
      </div>
    </div>
  );
}
