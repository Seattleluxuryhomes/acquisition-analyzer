import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Wand2, AlertCircle } from 'lucide-react';
import { MicButton, type MicState } from '../components/MicButton';
import { SearchBar } from '../components/SearchBar';
import { ActionButton } from '../components/ActionButton';
import { WorkflowCard } from '../components/WorkflowCard';
import { FavoritesBar } from '../components/FavoritesBar';
import { RecentWorkflows } from '../components/RecentWorkflows';
import { Icon } from '../components/Icon';
import { WORKFLOWS, homeButtons, getWorkflow } from '../data/workflows';
import { matchIntent } from '../lib/intentMatcher';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useWorkflowIntent } from '../hooks/useWorkflowIntent';
import { useApp } from '../store';
import type { Workflow } from '../types/workflow';

function searchWorkflows(query: string): Workflow[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const cmd = q.startsWith('/') ? q.split(/\s+/)[0] : null;
  return WORKFLOWS.map((w) => {
    let score = 0;
    if (cmd && w.command.toLowerCase().startsWith(cmd)) score += 10;
    if (w.title.toLowerCase().includes(q)) score += 5;
    if (w.buttonLabel.toLowerCase().includes(q)) score += 4;
    if (w.category.toLowerCase().includes(q)) score += 2;
    if (w.tags.some((t) => t.includes(q))) score += 3;
    if (w.description.toLowerCase().includes(q)) score += 1;
    return { w, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.w);
}

export function Home({
  onOpen,
  greeting,
}: {
  onOpen: (w: Workflow, initialInputs?: Record<string, string>) => void;
  greeting: string;
}) {
  const { favorites, recents, usage, isFavorite, toggleFavorite, settings } = useApp();
  const speech = useSpeechRecognition(settings.voiceLang);

  const [query, setQuery] = useState('');
  const [micState, setMicState] = useState<MicState>('ready');
  const [voiceText, setVoiceText] = useState('');
  const [typedIntent, setTypedIntent] = useState('');

  const intent = useWorkflowIntent(voiceText);
  const wasListening = useRef(false);

  // Mirror live transcript into voiceText while listening.
  useEffect(() => {
    if (speech.listening) {
      setVoiceText(`${speech.transcript}${speech.interim ? ` ${speech.interim}` : ''}`.trim());
    }
  }, [speech.transcript, speech.interim, speech.listening]);

  // Detect end-of-listening → run intent → maybe auto-launch.
  useEffect(() => {
    if (wasListening.current && !speech.listening) {
      const t = speech.transcript.trim();
      if (t) {
        setMicState('thinking');
        const handle = setTimeout(() => {
          setVoiceText(t);
          setMicState('workflow-ready');
          if (settings.autoLaunch) {
            const m = matchIntent(t);
            if (m.confident && m.top) openWithTranscript(m.top, t);
          }
        }, 350);
        wasListening.current = speech.listening;
        return () => clearTimeout(handle);
      }
      setMicState('ready');
    }
    wasListening.current = speech.listening;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  const openWithTranscript = (w: Workflow, transcript: string) => {
    const target = w.requiredInputs[0];
    onOpen(w, target ? { [target.key]: transcript } : undefined);
    setMicState('ready');
    setVoiceText('');
  };

  const onMicTap = () => {
    if (!speech.supported) return;
    if (speech.listening) {
      speech.stop();
      return;
    }
    speech.reset();
    setVoiceText('');
    setMicState('listening');
    speech.start();
  };

  const runTypedIntent = () => {
    const t = typedIntent.trim();
    if (!t) return;
    setVoiceText(t);
    const m = matchIntent(t);
    if (m.confident && m.top) openWithTranscript(m.top, t);
    else setMicState('workflow-ready');
  };

  const searchResults = useMemo(() => searchWorkflows(query), [query]);
  const heroButtons = useMemo(() => homeButtons(), []);
  const favWorkflows = useMemo(
    () => favorites.map(getWorkflow).filter((w): w is Workflow => Boolean(w)),
    [favorites],
  );
  const recentWorkflows = useMemo(
    () => recents.map(getWorkflow).filter((w): w is Workflow => Boolean(w)),
    [recents],
  );

  const showVoicePanel =
    voiceText.trim().length > 0 && (micState === 'workflow-ready' || !speech.listening);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-6 pt-5">
      {/* Greeting + search */}
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          {greeting}
        </h1>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* Search results take over when typing */}
      {query.trim() ? (
        <section className="flex flex-col gap-2">
          <p className="px-1 text-xs uppercase tracking-wide text-zinc-500">
            {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
          </p>
          {searchResults.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-zinc-400">
              No workflows match “{query}”.
            </p>
          ) : (
            searchResults.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                onOpen={() => onOpen(w)}
                favorite={isFavorite(w.id)}
                onToggleFavorite={() => toggleFavorite(w.id)}
                usageCount={usage[w.id]}
              />
            ))
          )}
        </section>
      ) : (
        <>
          {/* Voice hero */}
          <section className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent px-4 py-7">
            <MicButton
              state={speech.listening ? 'listening' : micState}
              onTap={onMicTap}
              disabled={!speech.supported}
            />

            {/* Live transcript / fallback input */}
            {speech.supported ? (
              voiceText && (
                <p className="max-w-md text-center text-sm italic text-zinc-300">
                  “{voiceText}”
                </p>
              )
            ) : (
              <div className="flex w-full max-w-md items-center gap-2">
                <input
                  value={typedIntent}
                  onChange={(e) => setTypedIntent(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runTypedIntent()}
                  placeholder="Voice not supported here — type what you want"
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-brand-400/60"
                />
                <button
                  type="button"
                  onClick={runTypedIntent}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white hover:bg-brand-500"
                  aria-label="Find workflow"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}

            {speech.error && speech.error !== 'not-supported' && (
              <p className="flex items-center gap-1 text-xs text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> Mic error — try again or type below.
              </p>
            )}

            {/* Intent results */}
            {showVoicePanel && intent.matches.length > 0 && (
              <div className="w-full max-w-md animate-fade-up">
                {intent.top && (
                  <button
                    type="button"
                    onClick={() => openWithTranscript(intent.top!, voiceText)}
                    className="mb-2 flex w-full items-center gap-3 rounded-xl border border-brand-400/40 bg-brand-500/10 p-3 text-left transition-transform hover:scale-[1.01]"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                      <Icon name={intent.top.icon} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs text-brand-200">
                        <Wand2 className="h-3 w-3" /> Best match
                      </span>
                      <span className="block truncate text-sm font-semibold text-zinc-100">
                        {intent.top.title}
                      </span>
                    </span>
                  </button>
                )}
                {intent.matches.length > 1 && (
                  <>
                    <p className="mb-1.5 px-1 text-[11px] uppercase tracking-wide text-zinc-500">
                      Or try
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {intent.matches.slice(1, 4).map((m) => (
                        <button
                          key={m.workflow.id}
                          type="button"
                          onClick={() => openWithTranscript(m.workflow, voiceText)}
                          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-2 pr-3 text-xs text-zinc-200 hover:border-brand-400/40"
                        >
                          <Icon name={m.workflow.icon} className="h-3.5 w-3.5 text-brand-300" />
                          {m.workflow.buttonLabel}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <FavoritesBar workflows={favWorkflows} onOpen={(w) => onOpen(w)} />

          {/* Action grid */}
          <section>
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Quick actions
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {heroButtons.map((w) => (
                <ActionButton
                  key={w.id}
                  workflow={w}
                  onOpen={() => onOpen(w)}
                  favorite={isFavorite(w.id)}
                  onToggleFavorite={() => toggleFavorite(w.id)}
                />
              ))}
            </div>
          </section>

          <RecentWorkflows workflows={recentWorkflows} onOpen={(w) => onOpen(w)} />
        </>
      )}
    </div>
  );
}
