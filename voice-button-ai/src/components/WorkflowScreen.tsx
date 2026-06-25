import { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Star,
  Copy,
  Check,
  Sparkles,
  Mic,
  MicOff,
  History,
  RotateCcw,
} from 'lucide-react';
import type { RunRecord, Workflow, WorkflowInput } from '../types/workflow';
import { allInputs, buildPrompt } from '../lib/promptBuilder';
import { copyToClipboard } from '../lib/clipboard';
import { useApp } from '../store';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { Icon } from './Icon';

/**
 * Full-screen workflow runner: collect inputs (typed or dictated), generate a
 * clean copy-ready prompt, copy/export, favorite, and revisit run history.
 */
export function WorkflowScreen({
  workflow,
  onClose,
  initialInputs,
}: {
  workflow: Workflow;
  onClose: () => void;
  initialInputs?: Record<string, string>;
}) {
  const { isFavorite, toggleFavorite, recordRun, history, settings } = useApp();
  const speech = useSpeechRecognition(settings.voiceLang);

  const [inputs, setInputs] = useState<Record<string, string>>(
    () => initialInputs ?? {},
  );
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const baseRef = useRef('');

  const fav = isFavorite(workflow.id);
  const workflowRuns = useMemo(
    () => history.filter((h) => h.workflowId === workflow.id).slice(0, 5),
    [history, workflow.id],
  );

  // Reset when the workflow changes.
  useEffect(() => {
    setInputs(initialInputs ?? {});
    setPrompt('');
    setMissing([]);
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  // Pipe live speech into the active field.
  useEffect(() => {
    if (!activeKey) return;
    const live = `${speech.transcript}${speech.interim ? ` ${speech.interim}` : ''}`.trim();
    if (!live) return;
    setInputs((prev) => ({ ...prev, [activeKey]: `${baseRef.current}${live}`.trim() }));
  }, [speech.transcript, speech.interim, activeKey]);

  const setField = (key: string, value: string) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const toggleDictation = (key: string) => {
    if (speech.listening && activeKey === key) {
      speech.stop();
      setActiveKey(null);
      return;
    }
    setActiveKey(key);
    baseRef.current = inputs[key] ? `${inputs[key]} ` : '';
    speech.reset();
    speech.start();
  };

  const handleGenerate = () => {
    const result = buildPrompt(workflow, inputs);
    setPrompt(result.prompt);
    setMissing(result.missingRequired);
    if (result.missingRequired.length === 0) {
      recordRun(workflow, inputs, result.prompt);
    }
  };

  const handleCopy = async () => {
    const text = prompt || buildPrompt(workflow, inputs).prompt;
    if (!prompt) setPrompt(text);
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const loadRun = (run: RunRecord) => {
    setInputs(run.inputs);
    setPrompt(run.prompt);
    setMissing([]);
  };

  const renderField = (field: WorkflowInput, required: boolean) => {
    const dictating = speech.listening && activeKey === field.key;
    const common =
      'w-full rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors focus:border-brand-400/60 focus:bg-white/[0.07] ' +
      (dictating ? 'border-rose-400/60' : 'border-white/10');
    return (
      <div key={field.key}>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-300">
            {field.label}
            {required && <span className="ml-1 text-rose-400">*</span>}
          </label>
          {speech.supported && (
            <button
              type="button"
              onClick={() => toggleDictation(field.key)}
              aria-label={dictating ? 'Stop dictation' : `Dictate ${field.label}`}
              className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                dictating
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'text-zinc-500 hover:text-brand-300'
              }`}
            >
              {dictating ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
              {dictating ? 'Listening…' : 'Speak'}
            </button>
          )}
        </div>
        {field.multiline ? (
          <textarea
            rows={3}
            value={inputs[field.key] ?? ''}
            placeholder={field.placeholder}
            onFocus={() => setActiveKey(field.key)}
            onChange={(e) => setField(field.key, e.target.value)}
            className={`${common} resize-y`}
          />
        ) : (
          <input
            type="text"
            value={inputs[field.key] ?? ''}
            placeholder={field.placeholder}
            onFocus={() => setActiveKey(field.key)}
            onChange={(e) => setField(field.key, e.target.value)}
            className={common}
          />
        )}
      </div>
    );
  };

  const hasAnyInput = allInputs(workflow).length > 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950/95 backdrop-blur-sm animate-fade-up">
      {/* Header */}
      <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Icon name={workflow.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-zinc-100">
              {workflow.title}
            </h2>
            <span className="font-mono text-[11px] text-brand-300">{workflow.command}</span>
          </div>
          <p className="line-clamp-2 text-xs text-zinc-400">{workflow.description}</p>
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(workflow.id)}
          aria-label={fav ? 'Remove favorite' : 'Add to favorites'}
          className="rounded-lg p-2 text-zinc-400 hover:text-amber-400"
        >
          <Star className={`h-5 w-5 ${fav ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {workflow.examples.length > 0 && (
            <p className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs italic text-zinc-400">
              e.g. “{workflow.examples[0]}”
            </p>
          )}

          {/* Required inputs */}
          {workflow.requiredInputs.length > 0 && (
            <div className="flex flex-col gap-3.5">
              {workflow.requiredInputs.map((f) => renderField(f, true))}
            </div>
          )}

          {/* Optional / suggested inputs */}
          {workflow.optionalInputs.length > 0 && (
            <div className="flex flex-col gap-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Suggested details (optional)
              </p>
              {workflow.optionalInputs.map((f) => renderField(f, false))}
            </div>
          )}

          {!hasAnyInput && (
            <p className="text-sm text-zinc-400">
              This workflow needs no inputs — just generate the prompt.
            </p>
          )}

          {/* Missing required warning */}
          {missing.length > 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Add these to get the best result: {missing.join(', ')}
            </p>
          )}

          {/* Generated prompt */}
          {prompt && (
            <div className="rounded-xl border border-brand-400/30 bg-brand-500/[0.06]">
              <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-brand-200">
                  <Sparkles className="h-3.5 w-3.5" /> Generated prompt
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-100 hover:bg-white/20"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-3.5 py-3 text-xs leading-relaxed text-zinc-200">
                {prompt}
              </pre>
            </div>
          )}

          {/* Run history for this workflow */}
          {workflowRuns.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <History className="h-3.5 w-3.5" /> Run history
              </p>
              <div className="flex flex-col gap-1.5">
                {workflowRuns.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => loadRun(run)}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-400 hover:border-brand-400/30 hover:text-zinc-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{run.prompt.slice(0, 80) || 'Empty run'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action bar */}
      <footer
        className="border-t border-white/10 bg-zinc-950/90 px-4 py-3"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-2xl gap-2.5">
          <button
            type="button"
            onClick={handleGenerate}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 py-3 text-sm font-semibold text-white shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <Sparkles className="h-4 w-4" /> Generate prompt
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/10"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
