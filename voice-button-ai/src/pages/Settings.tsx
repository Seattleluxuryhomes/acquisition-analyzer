import { useEffect, useState } from 'react';
import { Moon, Sun, Mic, Zap, Trash2, Info, Brain, Sparkles, Globe, CreditCard } from 'lucide-react';
import { useApp } from '../store';
import { WORKFLOWS } from '../data/workflows';
import { learningStats } from '../lib/learning';
import { globalRuns } from '../lib/insights';
import { getClientId } from '../lib/identity';

interface CreditStatus {
  plan?: string;
  dailyAllowance?: number;
  remaining?: number | null;
  resetsAt?: string;
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-brand-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-400">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? 'bg-brand-600' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** App settings: theme, voice, behavior, learning, data. */
export function Settings() {
  const { theme, toggleTheme, settings, setSettings, history, clearHistory, resetLearning } =
    useApp();
  // Learning stats aren't React state (they live in the storage layer), so we
  // bump a counter to re-read them after a reset.
  const [statsTick, setStatsTick] = useState(0);
  void statsTick;
  const stats = learningStats();

  const [credits, setCredits] = useState<CreditStatus | null>(null);
  useEffect(() => {
    let on = true;
    fetch('/api/credits', { headers: { 'x-vbai-client': getClientId() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (on && d) setCredits(d);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-6 pt-5">
      <h1 className="text-xl font-bold tracking-tight text-zinc-100">Settings</h1>

      {credits && credits.remaining != null && (
        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Plan</p>
          <Row
            icon={<CreditCard className="h-4.5 w-4.5" />}
            title="Fable credits"
            desc={`${credits.remaining} of ${credits.dailyAllowance} daily credits left · resets at UTC midnight`}
          >
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium capitalize text-zinc-300">
              {credits.plan ?? 'free'}
            </span>
          </Row>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <Row
          icon={theme === 'dark' ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
          title="Appearance"
          desc={theme === 'dark' ? 'Dark mode' : 'Light mode'}
        >
          <Toggle on={theme === 'dark'} onChange={toggleTheme} />
        </Row>

        <Row
          icon={<Zap className="h-4.5 w-4.5" />}
          title="Auto-launch on voice"
          desc="Open the best workflow automatically when intent is clear"
        >
          <Toggle
            on={settings.autoLaunch}
            onChange={(v) => setSettings((p) => ({ ...p, autoLaunch: v }))}
          />
        </Row>

        <Row
          icon={<Mic className="h-4.5 w-4.5" />}
          title="Voice language"
          desc="Speech recognition locale"
        >
          <select
            value={settings.voiceLang}
            onChange={(e) => setSettings((p) => ({ ...p, voiceLang: e.target.value }))}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs text-zinc-100 outline-none"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="es-ES">Español</option>
            <option value="es-MX">Español (MX)</option>
            <option value="fr-FR">Français</option>
            <option value="pt-BR">Português (BR)</option>
          </select>
        </Row>
      </section>

      <section className="flex flex-col gap-2.5">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Learning
        </p>
        <Row
          icon={<Brain className="h-4.5 w-4.5" />}
          title="On-device learning"
          desc="Adapt intent matching to your phrasing and learn your best prompts — privately, on this device"
        >
          <Toggle
            on={settings.adaptiveLearning}
            onChange={(v) => setSettings((p) => ({ ...p, adaptiveLearning: v }))}
          />
        </Row>
        <Row
          icon={<Sparkles className="h-4.5 w-4.5" />}
          title="What it has learned"
          desc={`${stats.signals} intent signal${stats.signals === 1 ? '' : 's'} · ${stats.trials} prompt trial${stats.trials === 1 ? '' : 's'}`}
        >
          <button
            type="button"
            onClick={() => {
              resetLearning();
              setStatsTick((t) => t + 1);
            }}
            disabled={stats.signals === 0 && stats.trials === 0}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            Reset
          </button>
        </Row>
        <Row
          icon={<Globe className="h-4.5 w-4.5" />}
          title="Improve the shared library"
          desc={
            globalRuns() > 0
              ? `Anonymous signals only — never prompts or inputs. Learning from ${globalRuns().toLocaleString()} shared runs.`
              : 'Contribute anonymous signals (which buttons/variants work — never your prompts or inputs) so the library gets smarter for everyone.'
          }
        >
          <Toggle
            on={settings.shareLearning}
            onChange={(v) => setSettings((p) => ({ ...p, shareLearning: v }))}
          />
        </Row>
      </section>

      <section className="flex flex-col gap-2.5">
        <p className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Data</p>
        <Row
          icon={<Trash2 className="h-4.5 w-4.5" />}
          title="Run history"
          desc={`${history.length} saved prompt run${history.length === 1 ? '' : 's'} on this device`}
        >
          <button
            type="button"
            onClick={clearHistory}
            disabled={history.length === 0}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          >
            Clear
          </button>
        </Row>
      </section>

      <section className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs text-zinc-400">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
        <p>
          Voice Button AI — {WORKFLOWS.length} workflows. Everything is stored locally on
          this device (localStorage / chrome.storage). No account required. Built to drop in
          cloud sync later.
        </p>
      </section>
    </div>
  );
}
