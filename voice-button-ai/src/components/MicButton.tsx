import { Mic, Loader2, Check, Sparkles } from 'lucide-react';

export type MicState =
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'workflow-ready'
  | 'copied';

const STATE_LABEL: Record<MicState, string> = {
  ready: 'Tap to speak',
  listening: 'Listening…',
  thinking: 'Thinking…',
  'workflow-ready': 'Workflow ready',
  copied: 'Copied!',
};

/**
 * The hero microphone button. Large circular touch target with clear status
 * states and an animated ring while listening.
 */
export function MicButton({
  state,
  onTap,
  disabled,
}: {
  state: MicState;
  onTap: () => void;
  disabled?: boolean;
}) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const done = state === 'copied' || state === 'workflow-ready';

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="relative">
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-brand-500/40 animate-pulse-ring" />
            <span
              className="absolute inset-0 rounded-full bg-brand-500/30 animate-pulse-ring"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}
        <button
          type="button"
          onClick={onTap}
          disabled={disabled}
          aria-label={STATE_LABEL[state]}
          aria-pressed={listening}
          className={[
            'relative grid place-items-center rounded-full transition-all duration-300',
            'h-32 w-32 sm:h-36 sm:w-36',
            'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-400/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            listening
              ? 'bg-gradient-to-br from-rose-500 to-brand-600 shadow-glow scale-105'
              : done
                ? 'bg-gradient-to-br from-emerald-500 to-brand-600 shadow-glow'
                : 'bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow hover:scale-105 active:scale-95',
          ].join(' ')}
        >
          {thinking ? (
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          ) : state === 'copied' ? (
            <Check className="h-12 w-12 text-white" />
          ) : state === 'workflow-ready' ? (
            <Sparkles className="h-12 w-12 text-white" />
          ) : (
            <Mic className="h-12 w-12 text-white" />
          )}
        </button>
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-zinc-100">{STATE_LABEL[state]}</p>
        <p className="text-xs text-zinc-400">
          {state === 'ready' ? 'Say what you want — we’ll find the workflow' : ' '}
        </p>
      </div>
    </div>
  );
}
