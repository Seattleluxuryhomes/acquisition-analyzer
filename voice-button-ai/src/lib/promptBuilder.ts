/**
 * Prompt builder.
 *
 * Takes a workflow template + user inputs and produces a clean, copy-ready
 * prompt:
 *   1. Replaces {{key}} placeholders with provided values.
 *   2. Drops lines whose only variable was left blank (so the prompt stays tidy).
 *   3. Expands a special {{__details__}} placeholder into a bullet list of any
 *      provided inputs that weren't referenced elsewhere.
 *   4. Normalizes whitespace.
 */

import type { Workflow } from '../types/workflow';

const VAR_RE = /\{\{\s*([\w]+)\s*\}\}/g;

/** All input definitions (required + optional) for a workflow, in order. */
export function allInputs(wf: Workflow) {
  return [...wf.requiredInputs, ...wf.optionalInputs];
}

/** Which keys does this template explicitly reference? */
function referencedKeys(template: string): Set<string> {
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;
  while ((m = VAR_RE.exec(template)) !== null) keys.add(m[1]);
  return keys;
}

function labelFor(wf: Workflow, key: string): string {
  const found = allInputs(wf).find((i) => i.key === key);
  return found?.label ?? key;
}

export interface BuildResult {
  prompt: string;
  /** Required input keys the user left blank. */
  missingRequired: string[];
}

export function buildPrompt(
  workflow: Workflow,
  inputs: Record<string, string>,
): BuildResult {
  const clean = (v: string | undefined) => (v ?? '').trim();

  const missingRequired = workflow.requiredInputs
    .filter((i) => !clean(inputs[i.key]))
    .map((i) => i.key);

  const refKeys = referencedKeys(workflow.promptTemplate);

  // Build the "extra details" block from any provided-but-unreferenced inputs.
  const extras = allInputs(workflow)
    .filter((i) => i.key !== '__details__' && !refKeys.has(i.key))
    .map((i) => ({ label: i.label, value: clean(inputs[i.key]) }))
    .filter((x) => x.value);

  const detailsBlock = extras.length
    ? `\nAdditional details:\n${extras.map((x) => `- ${x.label}: ${x.value}`).join('\n')}`
    : '';

  // Replace variables. {{__details__}} gets the extras block.
  let out = workflow.promptTemplate.replace(VAR_RE, (_full, key: string) => {
    if (key === '__details__') return detailsBlock;
    return clean(inputs[key]);
  });

  // Drop lines that became "Label:" with no value (an unfilled optional input).
  out = out
    .split('\n')
    .filter((line) => !/^[A-Za-z][\w '/&.-]*:\s*$/.test(line.trim()))
    .join('\n');

  // Collapse 3+ blank lines and trim.
  out = out.replace(/\n{3,}/g, '\n\n').trim();

  return { prompt: out, missingRequired: missingRequired.map((k) => labelFor(workflow, k)) };
}

/**
 * Build a prompt directly from a free-form voice/text transcript when we don't
 * have structured inputs yet — used as a fallback so the user always gets
 * something copy-ready.
 */
export function buildFromTranscript(workflow: Workflow, transcript: string): BuildResult {
  // Seed the first required (or first) input with the transcript.
  const target = workflow.requiredInputs[0] ?? allInputs(workflow)[0];
  if (!target) {
    return {
      prompt: `${workflow.promptTemplate}\n\nUser request: ${transcript.trim()}`.trim(),
      missingRequired: [],
    };
  }
  return buildPrompt(workflow, { [target.key]: transcript.trim() });
}
