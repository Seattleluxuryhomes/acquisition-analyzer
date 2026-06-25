/**
 * Core data model for Voice Button AI.
 *
 * A Workflow is a button / voice-launchable AI task. It carries everything
 * the UI needs to render a big action button, collect inputs, and build a
 * clean, copy-ready prompt — without the user ever remembering a prompt.
 */

export type WorkflowCategory =
  | 'Writing'
  | 'Real Estate'
  | 'Business'
  | 'Coding'
  | 'Marketing'
  | 'BidVoice'
  | 'Research'
  | 'Productivity';

/** A single input field a workflow asks for. */
export interface WorkflowInput {
  /** Machine key used in promptTemplate, e.g. `propertyAddress`. */
  key: string;
  /** Human label shown in the form, e.g. "Property address". */
  label: string;
  /** Optional placeholder / hint. */
  placeholder?: string;
  /** Render as a multi-line textarea instead of a single input. */
  multiline?: boolean;
}

export interface Workflow {
  id: string;
  title: string;
  category: WorkflowCategory;
  buttonLabel: string;
  description: string;
  /** lucide-react icon name, e.g. "FileSignature". */
  icon: string;
  /** Slash command, e.g. "/offer". */
  command: string;
  tags: string[];
  requiredInputs: WorkflowInput[];
  optionalInputs: WorkflowInput[];
  /**
   * Prompt template with {{key}} placeholders matching input keys.
   * A trailing `{{__details__}}` placeholder, if present, is replaced with a
   * tidy bulleted list of any inputs not referenced elsewhere.
   */
  promptTemplate: string;
  examples: string[];
}

/** A workflow run kept in history. */
export interface RunRecord {
  id: string;
  workflowId: string;
  title: string;
  command: string;
  /** ms epoch. */
  at: number;
  /** The raw input values used for the run. */
  inputs: Record<string, string>;
  /** The generated prompt. */
  prompt: string;
}

/** Result of matching a transcript against the workflow library. */
export interface IntentMatch {
  workflow: Workflow;
  score: number;
}
