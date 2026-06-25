import { useCallback, useRef, useState } from 'react';

/**
 * Drives a streaming run against the Fable Execution Engine (POST /api/run).
 * Parses the SSE response (meta → delta* → done|error) and exposes live state.
 * Gracefully reports when the engine isn't reachable (pure static deploy).
 */

export type RunStatus =
  | 'idle'
  | 'connecting'
  | 'thinking'
  | 'streaming'
  | 'done'
  | 'error';

export interface RunMeta {
  online: boolean;
  model: string;
}

export interface RunDone {
  ok?: boolean;
  source?: 'fable' | 'mock' | 'offline';
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  credits?: number;
}

export interface UseFableRun {
  status: RunStatus;
  output: string;
  meta: RunMeta | null;
  done: RunDone | null;
  error: string | null;
  run: (prompt: string, effort?: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useFableRun(): UseFableRun {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [output, setOutput] = useState('');
  const [meta, setMeta] = useState<RunMeta | null>(null);
  const [done, setDone] = useState<RunDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setOutput('');
    setMeta(null);
    setDone(null);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    ctrl.current?.abort();
    setStatus('idle');
  }, []);

  const run = useCallback(async (prompt: string, effort = 'medium') => {
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;

    setStatus('connecting');
    setOutput('');
    setDone(null);
    setError(null);

    const handleEvent = (rawEvent: string) => {
      let event = 'message';
      let data = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      let obj: Record<string, unknown>;
      try {
        obj = JSON.parse(data);
      } catch {
        return;
      }
      if (event === 'meta') {
        setMeta(obj as unknown as RunMeta);
        setStatus('thinking');
      } else if (event === 'delta') {
        setStatus('streaming');
        setOutput((o) => o + (typeof obj.text === 'string' ? obj.text : ''));
      } else if (event === 'done') {
        setDone(obj as unknown as RunDone);
        setStatus('done');
      } else if (event === 'error') {
        setError(typeof obj.message === 'string' ? obj.message : 'Run failed');
        setStatus('error');
      }
    };

    try {
      const resp = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, effort }),
        signal: ac.signal,
      });
      if (!resp.ok || !resp.body) {
        throw new Error(
          resp.status === 404
            ? 'Fable engine not connected. Start the server (npm run server) to run live.'
            : `Engine error (HTTP ${resp.status}).`,
        );
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (rawEvent.startsWith(':')) continue; // heartbeat
          handleEvent(rawEvent);
        }
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setError((e as Error)?.message || 'Run failed');
      setStatus('error');
    }
  }, []);

  return { status, output, meta, done, error, run, cancel, reset };
}
