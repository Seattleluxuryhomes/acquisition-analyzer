/**
 * Pricing + metering for the Fable Execution Engine.
 *
 * This is the unit-economics core of the SaaS model. Model costs are real
 * (USD per 1M tokens). Retail "credits" are derived from model cost × a margin
 * multiplier so every run is profitable by construction. Swap the constants
 * to tune the business; the call sites don't change.
 */

/** Wholesale model cost, USD per 1M tokens (input / output). */
export const MODEL_PRICING = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

/** Target gross margin on inference (1.6 ⇒ ~38% of retail is COGS). */
export const MARGIN = 1.6;

/** 1 credit = $0.01 of retail value. */
export const CENTS_PER_CREDIT = 1;

/** Wholesale cost in USD for a completion. */
export function costUsd(model, inputTokens, outputTokens) {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING['claude-fable-5'];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

/** Retail credits to charge for a given wholesale cost (always ≥ 1). */
export function creditsForCost(usd) {
  return Math.max(1, Math.ceil((usd * MARGIN * 100) / CENTS_PER_CREDIT));
}

/** Convenience: full meter for one run. */
export function meter(model, inputTokens, outputTokens) {
  const usd = costUsd(model, inputTokens, outputTokens);
  return {
    model,
    inputTokens,
    outputTokens,
    costUsd: Number(usd.toFixed(6)),
    credits: creditsForCost(usd),
  };
}
