import { Home, LayoutGrid, Star, Settings } from 'lucide-react';

export type Tab = 'home' | 'workflows' | 'favorites' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'workflows', label: 'Workflows', icon: LayoutGrid },
  { id: 'favorites', label: 'Favorites', icon: Star },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/** Mobile-first bottom navigation. Sticky, safe-area aware. */
export function BottomNav({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav
      className="sticky bottom-0 z-20 border-t border-white/10 bg-zinc-950/80 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={on ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                on ? 'text-brand-300' : 'text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              <Icon
                className={`h-5 w-5 ${on ? 'fill-brand-400/20' : ''}`}
                strokeWidth={on ? 2.4 : 2}
              />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
