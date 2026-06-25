import { Search, X } from 'lucide-react';

/** Search input with leading icon and clear button. */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search workflows or type a / command',
  autoFocus,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) onSubmit();
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-brand-400/60 focus:bg-white/[0.08]"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
