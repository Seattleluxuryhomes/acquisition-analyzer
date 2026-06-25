/**
 * Fable Execution Engine — the 2.0 leap.
 *
 * Turns a built workflow prompt into the *finished deliverable* using Claude
 * Fable 5 (Anthropic's most capable model), streaming the result back token by
 * token. The provider key lives only here, server-side — it never reaches the
 * browser (hard rule #1). If no key is configured the engine degrades
 * gracefully and returns the prompt for the user to run by hand (hard rule #4),
 * so the product never hard-depends on the AI step.
 *
 * Fable specifics honored here (per the Claude API guidance):
 *  - Model id `claude-fable-5`; thinking is always on, so the `thinking` param
 *    is omitted entirely (sending it would 400).
 *  - Depth is controlled with `output_config.effort`.
 *  - Streaming, so large/long outputs don't hit request timeouts.
 *  - Server-side refusal fallback to `claude-opus-4-8` is enabled by default,
 *    so a safety decline is transparently re-served instead of failing.
 *  - `stop_reason: "refusal"` is checked before reading content.
 */

import { meter } from './pricing.mjs';

// The model is a setting, not baked in. Defaults to Claude Opus 4.8 — top-tier
// and available on any API account today. Set VBAI_MODEL=claude-fable-5 (and a
// 30-day-retention org) once you have Fable access; nothing else changes.
const MODEL = process.env.VBAI_MODEL || 'claude-opus-4-8';
const FALLBACK = process.env.VBAI_FALLBACK_MODEL || 'claude-opus-4-8';
const IS_FABLE = MODEL.startsWith('claude-fable') || MODEL.startsWith('claude-mythos');

const SYSTEM = `You are Voice Button AI's execution engine. The user hands you a structured request. Produce the finished, ready-to-use deliverable it asks for — not a plan to make it. Lead with the result.

Rules:
- For real-estate and contractor work, treat any prices or figures as placeholders the user will set. Never expose internal margin or private notes in client-facing output.
- Be direct and concrete. No preamble like "Here is...".`;

/**
 * @param {object} opts
 * @param {string} opts.prompt    The fully-built workflow prompt.
 * @param {string} [opts.effort]  low | medium | high | xhigh | max
 * @param {(text:string)=>void} opts.onText  Streaming token sink.
 * @returns {Promise<object>} meter + status info (no generated text — that streamed)
 */
export async function runWorkflow({ prompt, effort = 'medium', onText }) {
  const key = process.env.ANTHROPIC_API_KEY;
  const forceMock = process.env.VBAI_MOCK === '1';

  if (forceMock || !key) {
    // VBAI_MOCK simulates a successful run for local dev/demo; a missing key in
    // production degrades to "offline" (returns the prompt to run by hand).
    return runSimulated({ prompt, onText, reason: forceMock ? 'mock' : 'offline' });
  }

  // Real call. Dynamically import the SDK so the server still boots (and the
  // offline path still works) when the dependency isn't installed.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key });

  const base = {
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  };

  // Fable supports server-side refusal fallback; other models use the plain
  // streaming endpoint. Both expose .on('text') and .finalMessage().
  const stream = IS_FABLE
    ? client.beta.messages.stream({
        ...base,
        betas: ['server-side-fallback-2026-06-01'],
        fallbacks: [{ model: FALLBACK }],
      })
    : client.messages.stream(base);

  stream.on('text', (t) => onText(t));
  const final = await stream.finalMessage();

  if (final.stop_reason === 'refusal') {
    return { ok: false, refused: true, model: final.model };
  }

  const u = final.usage ?? {};
  const inputTokens =
    (u.input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0) +
    (u.cache_creation_input_tokens ?? 0);
  const outputTokens = u.output_tokens ?? 0;

  return { ok: true, source: 'fable', ...meter(final.model, inputTokens, outputTokens) };
}

/* -------------------------------------------------------------------------- */
/*  Simulated path — offline fallback + local dev (VBAI_MOCK=1).               */
/* -------------------------------------------------------------------------- */

async function runSimulated({ prompt, onText, reason }) {
  const firstLine = prompt.split('\n').find((l) => l.trim()) ?? 'your request';

  const text =
    reason === 'offline'
      ? `⚠️ The AI engine isn't connected (no ANTHROPIC_API_KEY), so I can't run this for you yet.\n\nYour prompt is ready to paste into Claude or ChatGPT:\n\n${prompt}`
      : `Simulated AI run (set VBAI_MOCK=0 and ANTHROPIC_API_KEY to go live).\n\nWorking from: "${firstLine.slice(0, 80)}"\n\nThis is where the finished, ready-to-use deliverable streams in — drafted, structured, and copy-ready. With a live key, the AI produces the real output here in seconds.`;

  // Stream it in word-ish chunks so the UI exercises the real streaming path.
  for (const chunk of text.match(/\S+\s*/g) ?? [text]) {
    onText(chunk);
    await delay(12);
  }

  const inputTokens = Math.ceil(prompt.length / 4) + 200;
  const outputTokens = Math.ceil(text.length / 4);
  return {
    ok: true,
    source: reason,
    ...meter(FABLE, inputTokens, outputTokens),
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
