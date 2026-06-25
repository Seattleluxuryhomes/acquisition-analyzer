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
  /**
   * Optional A/B prompt variants. The bandit picks among these plus the
   * baseline (`promptTemplate`, id "base") and learns which performs best.
   */
  promptVariants?: PromptVariant[];
  examples: string[];
}

/** An alternative prompt phrasing the bandit can test against the baseline. */
export interface PromptVariant {
  id: string;
  label?: string;
  promptTemplate: string;
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
  /** Which prompt variant the bandit served for this run (e.g. "base"). */
  variantId?: string;
  /** User feedback on the generated prompt, once given. */
  feedback?: 'up' | 'down';
}

/** Result of matching a transcript against the workflow library. */
export interface IntentMatch {
  workflow: Workflow;
  score: number;
}

/** User-tunable app settings (persisted locally). */
export interface Settings {
  /** Auto-open the top match when voice intent is confident. */
  autoLaunch: boolean;
  /** Speech-recognition locale. */
  voiceLang: string;
  /** Master switch for on-device learning (adaptive matcher + bandit). */
  adaptiveLearning: boolean;
}
