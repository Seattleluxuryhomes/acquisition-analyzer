import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper around the browser Web Speech API (SpeechRecognition).
 * Gracefully reports `supported: false` where unavailable (e.g. Firefox, some
 * mobile browsers) so the UI can fall back to manual text input.
 */

// The Web Speech API isn't in the standard TS lib DOM types; declare what we use.
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognition {
  const ctorRef = useRef<SpeechRecognitionCtor | null>(getCtor());
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported] = useState<boolean>(() => !!ctorRef.current);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(() => {
    if (recRef.current || !ctorRef.current) return recRef.current;
    const rec = new ctorRef.current();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      setError(null);
      setListening(true);
    };
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev ? `${prev} ${finalText}` : finalText).trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      setError(e.error || 'speech-error');
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    return rec;
  }, [lang]);

  const start = useCallback(() => {
    const rec = ensure();
    if (!rec) {
      setError('not-supported');
      return;
    }
    setInterim('');
    try {
      rec.start();
    } catch {
      // start() throws if already started — restart cleanly.
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }, [ensure]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { supported, listening, transcript, interim, error, start, stop, reset };
}
