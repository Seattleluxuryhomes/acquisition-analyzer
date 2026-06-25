import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { KEYS } from './lib/storage';
import type { RunRecord, Workflow } from './types/workflow';

export type Theme = 'dark' | 'light';

export interface Settings {
  autoLaunch: boolean; // auto-open top match on confident voice intent
  voiceLang: string;
}

const DEFAULT_SETTINGS: Settings = { autoLaunch: true, voiceLang: 'en-US' };
const MAX_RECENTS = 12;
const MAX_HISTORY = 60;

interface AppState {
  favorites: string[];
  recents: string[];
  usage: Record<string, number>;
  history: RunRecord[];
  theme: Theme;
  settings: Settings;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  touchWorkflow: (id: string) => void;
  recordRun: (
    workflow: Workflow,
    inputs: Record<string, string>,
    prompt: string,
  ) => void;
  clearHistory: () => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setSettings: (s: Settings | ((p: Settings) => Settings)) => void;
}

const Ctx = createContext<AppState | null>(null);

let idCounter = 0;
function runId(at: number): string {
  idCounter = (idCounter + 1) % 100000;
  return `run_${at.toString(36)}_${idCounter.toString(36)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useLocalStorage<string[]>(KEYS.favorites, []);
  const [recents, setRecents] = useLocalStorage<string[]>(KEYS.recents, []);
  const [usage, setUsage] = useLocalStorage<Record<string, number>>(KEYS.usage, {});
  const [history, setHistory] = useLocalStorage<RunRecord[]>(KEYS.history, []);
  const [theme, setTheme] = useLocalStorage<Theme>(KEYS.theme, 'dark');
  const [settings, setSettings] = useLocalStorage<Settings>(
    KEYS.settings,
    DEFAULT_SETTINGS,
  );

  // Reflect theme on <html> for Tailwind's class-based dark mode.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
  }, [theme]);

  const value = useMemo<AppState>(() => {
    const touchWorkflow = (id: string) => {
      setRecents((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENTS));
      setUsage((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    };

    return {
      favorites,
      recents,
      usage,
      history,
      theme,
      settings,
      isFavorite: (id) => favorites.includes(id),
      toggleFavorite: (id) =>
        setFavorites((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev],
        ),
      touchWorkflow,
      recordRun: (workflow, inputs, prompt) => {
        touchWorkflow(workflow.id);
        const at = Date.now();
        const record: RunRecord = {
          id: runId(at),
          workflowId: workflow.id,
          title: workflow.title,
          command: workflow.command,
          at,
          inputs,
          prompt,
        };
        setHistory((prev) => [record, ...prev].slice(0, MAX_HISTORY));
      },
      clearHistory: () => setHistory([]),
      setTheme,
      toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      setSettings,
    };
  }, [
    favorites,
    recents,
    usage,
    history,
    theme,
    settings,
    setFavorites,
    setRecents,
    setUsage,
    setHistory,
    setTheme,
    setSettings,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
