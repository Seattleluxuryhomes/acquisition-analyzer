import type {
  PromptVariant,
  Workflow,
  WorkflowCategory,
  WorkflowInput,
} from '../types/workflow';

/* -------------------------------------------------------------------------- */
/*  Authoring helpers — keep the seed data terse and readable.                 */
/* -------------------------------------------------------------------------- */

/** Build an input from a `key|Label|placeholder|ml` shorthand string. */
function inp(spec: string): WorkflowInput {
  const [key, label, placeholder, ml] = spec.split('|');
  return {
    key,
    label: label || key,
    placeholder: placeholder || undefined,
    multiline: ml === 'ml',
  };
}

interface WfSpec {
  id: string;
  title: string;
  category: WorkflowCategory;
  buttonLabel: string;
  description: string;
  icon: string;
  command: string;
  tags: string[];
  required?: string[];
  optional?: string[];
  promptTemplate: string;
  /** Optional alternative phrasings the bandit A/B-tests against the baseline. */
  variants?: Array<{ id: string; label?: string; promptTemplate: string }>;
  examples?: string[];
}

function wf(s: WfSpec): Workflow {
  const promptVariants: PromptVariant[] | undefined = s.variants?.map((v) => ({
    id: v.id,
    label: v.label,
    promptTemplate: v.promptTemplate.trim(),
  }));
  return {
    id: s.id,
    title: s.title,
    category: s.category,
    buttonLabel: s.buttonLabel,
    description: s.description,
    icon: s.icon,
    command: s.command,
    tags: s.tags,
    requiredInputs: (s.required || []).map(inp),
    optionalInputs: (s.optional || []).map(inp),
    promptTemplate: s.promptTemplate.trim(),
    ...(promptVariants && promptVariants.length ? { promptVariants } : {}),
    examples: s.examples || [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Seed library                                                               */
/* -------------------------------------------------------------------------- */

export const WORKFLOWS: Workflow[] = [
  /* ----------------------------- WRITING -------------------------------- */
  wf({
    id: 'write',
    title: 'Write Anything',
    category: 'Writing',
    buttonLabel: 'Write',
    description: 'Turn a rough idea into clear, well-structured writing.',
    icon: 'PenLine',
    command: '/write',
    tags: ['write', 'writing', 'draft', 'content', 'email', 'essay'],
    required: ['topic|What are you writing?|e.g. a follow-up email to a lead'],
    optional: [
      'audience|Audience|who is this for?',
      'tone|Tone|e.g. warm, direct, professional',
      'length|Length|e.g. short, 200 words, one page',
    ],
    promptTemplate: `
You are an expert writer and editor. Write a {{tone}} piece for me.

What to write: {{topic}}
Audience: {{audience}}
Target length: {{length}}

Make it clear, specific, and easy to skim. Avoid filler and clichés. Return only the finished writing, ready to use.
{{__details__}}`,
    variants: [
      {
        id: 'role-expert',
        label: 'Role + constraints',
        promptTemplate: `
Act as a senior copywriter. Produce a {{tone}} piece.

Brief: {{topic}}
Audience: {{audience}}
Length: {{length}}

Constraints: lead with the single most important point, one idea per paragraph, concrete over abstract, zero clichés. Output only the finished piece.
{{__details__}}`,
      },
    ],
    examples: ['Write a thank-you note to a client after closing'],
  }),
  wf({
    id: 'improve',
    title: 'Improve Writing',
    category: 'Writing',
    buttonLabel: 'Improve',
    description: 'Sharpen any text — clearer, tighter, stronger.',
    icon: 'Sparkles',
    command: '/improve',
    tags: ['improve', 'edit', 'rewrite', 'better', 'clarity', 'tighten'],
    required: ['text|Paste the text to improve||ml'],
    optional: ['goal|What should it do better?|e.g. more persuasive, shorter', 'tone|Desired tone|'],
    promptTemplate: `
You are a world-class editor. Improve the text below without changing its meaning.

Goal: {{goal}}
Desired tone: {{tone}}

Text:
"""
{{text}}
"""

Return: (1) the improved version, then (2) a short bullet list of what you changed and why.`,
    variants: [
      {
        id: 'two-pass',
        label: 'Two-pass edit',
        promptTemplate: `
You are a world-class editor. Improve the text below in two passes without changing its meaning.

Goal: {{goal}}
Desired tone: {{tone}}

Text:
"""
{{text}}
"""

Pass 1 — structure: fix flow, order, and clarity.
Pass 2 — line edit: tighten wording, cut filler, strengthen verbs.
Return only the final improved version, then 3 bullets on the biggest changes.`,
      },
    ],
  }),
  wf({
    id: 'humanize',
    title: 'Humanize Text',
    category: 'Writing',
    buttonLabel: 'Humanize',
    description: 'Make AI-sounding text read like a real, natural human wrote it.',
    icon: 'Smile',
    command: '/humanize',
    tags: ['humanize', 'natural', 'authentic', 'voice', 'rewrite'],
    required: ['text|Paste the text to humanize||ml'],
    optional: ['voice|Voice to match|e.g. casual founder, friendly agent'],
    promptTemplate: `
Rewrite the text below so it sounds genuinely human — natural rhythm, plain words, varied sentence length, no robotic phrasing or AI tells.

Voice to match: {{voice}}

Text:
"""
{{text}}
"""

Keep the meaning. Cut clichés ("in today's fast-paced world", "delve", "moreover"). Return only the rewritten text.`,
  }),
  wf({
    id: 'polish',
    title: 'Polish & Proofread',
    category: 'Writing',
    buttonLabel: 'Polish',
    description: 'Final proofread — grammar, flow, and a crisp finish.',
    icon: 'Wand2',
    command: '/polish',
    tags: ['polish', 'proofread', 'grammar', 'final', 'cleanup'],
    required: ['text|Paste the text to polish||ml'],
    promptTemplate: `
Proofread and polish the text below. Fix grammar, spelling, punctuation, and awkward flow. Keep the author's voice and meaning intact — light touch only.

Text:
"""
{{text}}
"""

Return the polished text, then list any meaningful corrections.`,
  }),
  wf({
    id: 'follow-up',
    title: 'Follow Up Message',
    category: 'Writing',
    buttonLabel: 'Follow Up',
    description: 'Write a perfectly-timed, non-pushy follow-up.',
    icon: 'Send',
    command: '/followup',
    tags: ['follow up', 'followup', 'reminder', 'check in', 'email', 'nudge'],
    required: ['context|What is the follow-up about?||ml'],
    optional: [
      'recipient|Who are you following up with?|',
      'channel|Channel|email, text, DM',
      'tone|Tone|friendly, professional',
    ],
    promptTemplate: `
Write a follow-up message that moves things forward without sounding pushy.

Channel: {{channel}}
Recipient: {{recipient}}
Tone: {{tone}}
Context / last interaction: {{context}}

Keep it short, give an easy next step, and add a clear call to action. Provide 2 variations (one warmer, one more direct).`,
  }),
  wf({
    id: 'client-summary',
    title: 'Client Summary',
    category: 'Writing',
    buttonLabel: 'Client Summary',
    description: 'Explain something complex to a client in plain language.',
    icon: 'MessageSquareText',
    command: '/summary',
    tags: ['client', 'summary', 'explain', 'simple', 'counteroffer', 'plain language'],
    required: ['situation|What do you need to explain to the client?||ml'],
    optional: [
      'clientName|Client name|',
      'reading|Reading level|e.g. simple, no jargon',
      'next|Desired next step|',
    ],
    promptTemplate: `
You are helping me explain something to a client in clear, simple language.

Client: {{clientName}}
Situation to explain: {{situation}}
Keep it at this reading level: {{reading}}
Next step I want them to take: {{next}}

Write a short client-ready message: warm opening, plain-language explanation, what it means for them, and a clear next step. No jargon.`,
    examples: ['Explain a seller counteroffer to my buyer in simple language'],
  }),

  /* --------------------------- REAL ESTATE ------------------------------ */
  wf({
    id: 'real-estate-offer',
    title: 'Real Estate Offer Writer',
    category: 'Real Estate',
    buttonLabel: 'Offer',
    description: 'Creates a strong real estate offer prompt from deal terms.',
    icon: 'FileSignature',
    command: '/offer',
    tags: ['real estate', 'offer', 'buyer', 'contract', 'purchase', 'terms'],
    required: [
      'propertyAddress|Property address|123 Main St',
      'buyerName|Buyer name|',
      'offerPrice|Offer price|$',
      'financing|Financing|cash, conventional, FHA',
      'inspectionPeriod|Inspection period|e.g. 10 days',
    ],
    optional: [
      'sellerConcerns|Seller concerns|',
      'specialTerms|Special terms|',
      'closingDate|Closing date|',
    ],
    promptTemplate: `
You are an expert real estate transaction strategist. Help me draft and analyze an offer for {{propertyAddress}}.

Buyer: {{buyerName}}
Offer price: {{offerPrice}}
Financing: {{financing}}
Inspection period: {{inspectionPeriod}}
Target closing: {{closingDate}}
Special terms: {{specialTerms}}
Known seller concerns: {{sellerConcerns}}

Deliver: (1) a clean offer summary, (2) the strongest 3 negotiation angles given these terms, (3) likely seller objections and how to counter, and (4) a short, persuasive cover note to the listing agent.
{{__details__}}`,
    variants: [
      {
        id: 'leverage-first',
        label: 'Leverage-first',
        promptTemplate: `
You are a sharp buyer's-agent strategist. Build the winning play for an offer on {{propertyAddress}}.

Buyer: {{buyerName}}
Offer price: {{offerPrice}}
Financing: {{financing}}
Inspection period: {{inspectionPeriod}}
Target closing: {{closingDate}}
Special terms: {{specialTerms}}
Known seller concerns: {{sellerConcerns}}

Start with leverage: what does this seller most want, and which non-price term wins it? Then give the offer summary, an escalation guardrail, the 3 objections most likely to kill it with counters, and a 4-sentence cover note to the listing agent.
{{__details__}}`,
      },
    ],
    examples: ['Offer on 14 Pine St, cash, 7-day inspection'],
  }),
  wf({
    id: 'counteroffer',
    title: 'Counteroffer Strategist',
    category: 'Real Estate',
    buttonLabel: 'Counteroffer',
    description: 'Build a smart counteroffer and the reasoning behind it.',
    icon: 'Repeat',
    command: '/counter',
    tags: ['real estate', 'counteroffer', 'counter', 'negotiate', 'seller'],
    required: [
      'propertyAddress|Property address|',
      'currentOffer|Current offer on the table|',
      'goal|Your goal|e.g. net $X, faster close',
    ],
    optional: ['constraints|Constraints|', 'leverage|Your leverage|'],
    promptTemplate: `
Act as a real estate negotiation strategist. Help me craft a counteroffer for {{propertyAddress}}.

Current offer: {{currentOffer}}
My goal: {{goal}}
My constraints: {{constraints}}
My leverage: {{leverage}}

Give me: a recommended counter (price + terms), the rationale, and a concise message I can send that frames it as a win-win.`,
  }),
  wf({
    id: 'listing',
    title: 'Listing Description',
    category: 'Real Estate',
    buttonLabel: 'Listing',
    description: 'Write a magnetic MLS listing that sells.',
    icon: 'Home',
    command: '/listing',
    tags: ['real estate', 'listing', 'mls', 'description', 'sell', 'marketing'],
    required: ['propertyAddress|Property address|', 'features|Key features||ml'],
    optional: ['price|List price|', 'audience|Target buyer|', 'tone|Tone|'],
    promptTemplate: `
Write a compelling MLS listing for {{propertyAddress}}.

Key features: {{features}}
List price: {{price}}
Target buyer: {{audience}}
Tone: {{tone}}

Deliver: a headline, a 150-word emotional-but-accurate description, a bulleted feature list, and 3 social caption variations. Stay fair-housing compliant.`,
  }),
  wf({
    id: 'cma',
    title: 'CMA Helper',
    category: 'Real Estate',
    buttonLabel: 'CMA',
    description: 'Structure a comparative market analysis and pricing story.',
    icon: 'BarChart3',
    command: '/cma',
    tags: ['real estate', 'cma', 'comps', 'pricing', 'valuation', 'analyze'],
    required: ['subject|Subject property|', 'comps|Comparable sales||ml'],
    optional: ['market|Market conditions|', 'goal|Seller goal|'],
    promptTemplate: `
Act as a listing agent preparing a CMA.

Subject property: {{subject}}
Comparable sales / data: {{comps}}
Market conditions: {{market}}
Seller goal: {{goal}}

Produce: a suggested price range with reasoning, adjustments vs. each comp, a pricing strategy (aggressive / market / patient), and a clear narrative I can present to the seller.`,
  }),
  wf({
    id: 'buyer-strategy',
    title: 'Buyer Strategy',
    category: 'Real Estate',
    buttonLabel: 'Buyer Strategy',
    description: 'A game plan to win the home in a competitive market.',
    icon: 'Target',
    command: '/buyer',
    tags: ['real estate', 'buyer', 'strategy', 'win', 'competitive'],
    required: ['buyerGoals|Buyer goals & budget||ml', 'market|Market situation|'],
    optional: ['property|Target property|', 'competition|Competing offers?|'],
    promptTemplate: `
You are a buyer's agent strategist. Build a plan to help my buyer win.

Buyer goals & budget: {{buyerGoals}}
Market situation: {{market}}
Target property: {{property}}
Competition: {{competition}}

Deliver a step-by-step strategy: offer structure, terms that stand out (non-price), escalation guidance, and risks to flag.`,
  }),
  wf({
    id: 'seller-strategy',
    title: 'Seller Strategy',
    category: 'Real Estate',
    buttonLabel: 'Seller Strategy',
    description: 'Maximize price and minimize days on market.',
    icon: 'TrendingUp',
    command: '/seller',
    tags: ['real estate', 'seller', 'strategy', 'list', 'maximize'],
    required: ['property|Property & condition||ml', 'goal|Seller goal|'],
    optional: ['timeline|Timeline|', 'market|Market|'],
    promptTemplate: `
Act as a top listing strategist for the seller.

Property & condition: {{property}}
Seller goal: {{goal}}
Timeline: {{timeline}}
Market: {{market}}

Give: prep & staging priorities, pricing strategy, marketing plan, and an offer-review framework to maximize net proceeds.`,
  }),
  wf({
    id: 'land-analysis',
    title: 'Land Analysis',
    category: 'Real Estate',
    buttonLabel: 'Land',
    description: 'Evaluate raw land: zoning, use, and upside.',
    icon: 'Map',
    command: '/land',
    tags: ['land', 'zoning', 'development', 'lots', 'parcel', 'acreage'],
    required: ['parcel|Parcel / location||', 'details|Size, zoning, utilities||ml'],
    optional: ['intent|Intended use|', 'price|Asking price|'],
    promptTemplate: `
You are a land acquisition and entitlement expert. Analyze this parcel.

Parcel / location: {{parcel}}
Details (size, zoning, utilities, access): {{details}}
Intended use: {{intent}}
Asking price: {{price}}

Deliver: highest-and-best-use assessment, zoning/entitlement considerations, key due-diligence questions, red flags, and a rough go / no-go recommendation.`,
    examples: ['Analyze 5 acres zoned R-1, no sewer, possible subdivision'],
  }),
  wf({
    id: 'development-feasibility',
    title: 'Development Feasibility',
    category: 'Real Estate',
    buttonLabel: 'Feasibility',
    description: 'Pencil out a development pro forma and risks.',
    icon: 'Building2',
    command: '/feasibility',
    tags: ['real estate', 'development', 'feasibility', 'pro forma', 'build'],
    required: ['project|Project concept||ml', 'site|Site & constraints||ml'],
    optional: ['costs|Known costs|', 'exit|Exit / revenue assumptions|'],
    promptTemplate: `
Act as a real estate development analyst. Pencil out feasibility.

Project concept: {{project}}
Site & constraints: {{site}}
Known costs: {{costs}}
Exit / revenue assumptions: {{exit}}

Provide: a simple pro forma outline (costs, revenue, margin), key assumptions to validate, major risks, and what would make this a strong vs. weak deal. Note: all figures are placeholders for me to verify.`,
  }),
  wf({
    id: 'due-diligence',
    title: 'Due Diligence Checklist',
    category: 'Real Estate',
    buttonLabel: 'Due Diligence',
    description: 'A tailored due-diligence checklist for a deal.',
    icon: 'ClipboardCheck',
    command: '/dd',
    tags: ['real estate', 'due diligence', 'checklist', 'inspection', 'risk'],
    required: ['deal|Deal type & property||ml'],
    optional: ['concerns|Specific concerns|', 'timeline|DD timeline|'],
    promptTemplate: `
Create a thorough due-diligence checklist for this deal.

Deal type & property: {{deal}}
Specific concerns: {{concerns}}
DD timeline: {{timeline}}

Organize by category (title, physical, financial, legal/zoning, environmental, tenant/lease). For each item: what to verify, who provides it, and the deal-killer flags to watch for.`,
  }),
  wf({
    id: 'investor-summary',
    title: 'Investor Summary',
    category: 'Real Estate',
    buttonLabel: 'Investor',
    description: 'A crisp deal summary that gets investors to yes.',
    icon: 'Briefcase',
    command: '/investor',
    tags: ['real estate', 'investor', 'summary', 'deal', 'pitch', 'capital'],
    required: ['deal|The deal||ml', 'returns|Projected returns|'],
    optional: ['structure|Deal structure|', 'ask|Capital ask|'],
    promptTemplate: `
Write an investor-ready one-pager for this deal.

The deal: {{deal}}
Projected returns: {{returns}}
Structure: {{structure}}
Capital ask: {{ask}}

Deliver: a punchy summary, the numbers that matter, the risk/mitigation, and a clear ask. Confident but honest — returns are projections, not promises.`,
  }),

  /* ----------------------------- BUSINESS ------------------------------- */
  wf({
    id: 'ceo-mode',
    title: 'CEO Mode',
    category: 'Business',
    buttonLabel: 'CEO Mode',
    description: 'Think like a sharp CEO about your biggest problem.',
    icon: 'Crown',
    command: '/ceo',
    tags: ['business', 'ceo', 'strategy', 'leadership', 'decision'],
    required: ['situation|Your situation / decision||ml'],
    optional: ['goals|Goals|', 'constraints|Constraints|'],
    promptTemplate: `
Act as a seasoned CEO and advisor. Cut through the noise on this.

Situation: {{situation}}
Goals: {{goals}}
Constraints: {{constraints}}

Give: the real problem (not the symptom), the 3 highest-leverage moves, what to ignore, and the single most important thing to do this week.`,
  }),
  wf({
    id: 'founder-strategy',
    title: 'Founder Strategy',
    category: 'Business',
    buttonLabel: 'Strategy',
    description: 'Strategic plan for a founder-stage decision.',
    icon: 'Rocket',
    command: '/strategy',
    tags: ['business', 'founder', 'strategy', 'startup', 'plan', 'growth'],
    required: ['challenge|The strategic challenge||ml'],
    optional: ['stage|Company stage|', 'resources|Resources|', 'horizon|Time horizon|'],
    promptTemplate: `
You are a startup strategy advisor. Help me think this through.

Challenge: {{challenge}}
Company stage: {{stage}}
Resources: {{resources}}
Time horizon: {{horizon}}

Deliver: a framing of the decision, 2–3 strategic options with tradeoffs, a recommendation, and the leading indicators that tell me it's working.`,
  }),
  wf({
    id: 'pricing',
    title: 'Pricing Strategy',
    category: 'Business',
    buttonLabel: 'Pricing',
    description: 'Find the price that captures value and converts.',
    icon: 'DollarSign',
    command: '/pricing',
    tags: ['business', 'pricing', 'price', 'monetization', 'packaging'],
    required: ['offer|What you sell||ml', 'customer|Customer|'],
    optional: ['costs|Costs|', 'competitors|Competitor pricing|', 'goal|Pricing goal|'],
    promptTemplate: `
Act as a pricing strategist.

What I sell: {{offer}}
Customer: {{customer}}
Costs: {{costs}}
Competitor pricing: {{competitors}}
Goal: {{goal}}

Recommend: a pricing model, 2–3 packaging tiers, the value metric to charge on, and how to test it. Flag psychological pricing wins. All numbers are starting points for me to validate.`,
  }),
  wf({
    id: 'sales-page',
    title: 'Sales Page',
    category: 'Business',
    buttonLabel: 'Sales Page',
    description: 'A high-converting long-form sales page.',
    icon: 'Megaphone',
    command: '/salespage',
    tags: ['business', 'sales', 'copy', 'conversion', 'landing', 'offer'],
    required: ['product|Product / offer||ml', 'audience|Audience|'],
    optional: ['pain|Core pain|', 'proof|Proof / results|', 'price|Price & guarantee|'],
    promptTemplate: `
Write a high-converting sales page.

Product / offer: {{product}}
Audience: {{audience}}
Core pain: {{pain}}
Proof / results: {{proof}}
Price & guarantee: {{price}}

Structure: hook headline, problem agitation, the offer, benefits-as-outcomes, objection handling, proof, FAQ, and a strong CTA. Persuasive but honest.`,
  }),
  wf({
    id: 'negotiation',
    title: 'Negotiation Playbook',
    category: 'Business',
    buttonLabel: 'Negotiate',
    description: 'A plan, scripts, and BATNA for any negotiation.',
    icon: 'Handshake',
    command: '/negotiate',
    tags: ['business', 'negotiation', 'deal', 'batna', 'leverage'],
    required: ['situation|The negotiation||ml', 'goal|Your goal|'],
    optional: ['other|Other party & interests|', 'leverage|Your leverage|', 'walkaway|Walk-away point|'],
    promptTemplate: `
Act as a master negotiator. Build my playbook.

Situation: {{situation}}
My goal: {{goal}}
Other party & interests: {{other}}
My leverage: {{leverage}}
Walk-away point: {{walkaway}}

Deliver: my BATNA, anchor and target, the other side's likely moves, word-for-word scripts for the key moments, and traps to avoid.`,
  }),
  wf({
    id: 'swot',
    title: 'SWOT Analysis',
    category: 'Business',
    buttonLabel: 'SWOT',
    description: 'Strengths, weaknesses, opportunities, threats — fast.',
    icon: 'Grid2x2',
    command: '/swot',
    tags: ['business', 'swot', 'analysis', 'strategy'],
    required: ['subject|Company / product / decision||ml'],
    optional: ['context|Context|', 'goal|Goal|'],
    promptTemplate: `
Run a sharp SWOT analysis.

Subject: {{subject}}
Context: {{context}}
Goal: {{goal}}

Give 3–5 specific, non-generic items per quadrant (Strengths, Weaknesses, Opportunities, Threats), then a "so what" — the 2 strategic priorities this SWOT implies.`,
  }),
  wf({
    id: 'red-team',
    title: 'Red Team',
    category: 'Business',
    buttonLabel: 'Red Team',
    description: 'Attack your own plan to find what breaks it.',
    icon: 'ShieldAlert',
    command: '/redteam',
    tags: ['business', 'red team', 'critique', 'risk', 'stress test'],
    required: ['plan|The plan / idea to attack||ml'],
    optional: ['context|Context|'],
    promptTemplate: `
You are a ruthless but fair red-teamer. Try to break this plan.

Plan / idea: {{plan}}
Context: {{context}}

Deliver: the strongest case against it, the top 5 failure modes ranked by likelihood × impact, hidden assumptions, and what would have to be true for it to work. End with the single change that most de-risks it.`,
  }),
  wf({
    id: 'next-move',
    title: 'Next Move',
    category: 'Business',
    buttonLabel: 'Next Move',
    description: 'Stuck? Get the clearest next action.',
    icon: 'MoveRight',
    command: '/next',
    tags: ['business', 'next move', 'decision', 'stuck', 'action'],
    required: ['situation|Where you are right now||ml'],
    optional: ['goal|Where you want to be|', 'blockers|Blockers|'],
    promptTemplate: `
I'm deciding what to do next. Be a decisive advisor.

Current situation: {{situation}}
Goal: {{goal}}
Blockers: {{blockers}}

Give me: the single best next move, why it beats the alternatives, the first concrete step I can take today, and how I'll know it worked.`,
  }),

  /* ------------------------------ CODING -------------------------------- */
  wf({
    id: 'build-app',
    title: 'Build App',
    category: 'Coding',
    buttonLabel: 'Build',
    description: 'Spec and scaffold a new app or feature.',
    icon: 'Hammer',
    command: '/build',
    tags: ['code', 'build', 'app', 'feature', 'scaffold', 'create'],
    required: ['idea|What to build||ml'],
    optional: ['stack|Preferred stack|', 'constraints|Constraints|', 'users|Users|'],
    promptTemplate: `
You are a senior full-stack engineer. Help me build this.

What to build: {{idea}}
Preferred stack: {{stack}}
Constraints: {{constraints}}
Users: {{users}}

Deliver: a tight MVP scope (and what to cut), recommended architecture, file/module layout, the data model, and a step-by-step build order. Then write the first key file. Prioritize working software.`,
  }),
  wf({
    id: 'debug',
    title: 'Debug It',
    category: 'Coding',
    buttonLabel: 'Debug',
    description: 'Find and fix a bug from symptoms or an error.',
    icon: 'Bug',
    command: '/debug',
    tags: ['code', 'debug', 'bug', 'error', 'not working', 'fix', 'broken'],
    required: ['problem|What is going wrong?||ml'],
    optional: ['code|Relevant code||ml', 'error|Error message|', 'tried|What you tried|'],
    promptTemplate: `
Act as an expert debugger. Find the root cause.

Symptom: {{problem}}
Error message: {{error}}
What I already tried: {{tried}}
Relevant code:
"""
{{code}}
"""

Walk through likely causes ranked by probability, the fastest way to confirm each, the fix, and how to prevent it next time.`,
    variants: [
      {
        id: 'hypothesis-driven',
        label: 'Hypothesis-driven',
        promptTemplate: `
Act as an expert debugger. Work the problem like a scientist.

Symptom: {{problem}}
Error message: {{error}}
What I already tried: {{tried}}
Relevant code:
"""
{{code}}
"""

1. Restate the expected vs. actual behavior in one line.
2. List 3–5 ranked hypotheses for the root cause.
3. For the top hypothesis, give the single fastest experiment to confirm or kill it.
4. Provide the fix once confirmed, plus a regression guard to keep it fixed.`,
      },
    ],
    examples: ['My login button does nothing and throws a 500 error'],
  }),
  wf({
    id: 'refactor',
    title: 'Refactor',
    category: 'Coding',
    buttonLabel: 'Refactor',
    description: 'Clean up code without changing behavior.',
    icon: 'Wrench',
    command: '/refactor',
    tags: ['code', 'refactor', 'clean', 'improve', 'tidy'],
    required: ['code|Code to refactor||ml'],
    optional: ['goal|Refactor goal|readability, performance, testability', 'lang|Language / framework|'],
    promptTemplate: `
Refactor the code below. Preserve behavior exactly.

Goal: {{goal}}
Language / framework: {{lang}}
Code:
"""
{{code}}
"""

Return the refactored code, a bullet list of what changed and why, and any risks or follow-ups. Keep it idiomatic.`,
  }),
  wf({
    id: 'ship-it',
    title: 'Ship It',
    category: 'Coding',
    buttonLabel: 'Ship It',
    description: 'A pre-launch checklist to ship with confidence.',
    icon: 'Ship',
    command: '/ship',
    tags: ['code', 'ship', 'deploy', 'launch', 'release', 'checklist'],
    required: ['what|What you are shipping||ml'],
    optional: ['stack|Stack / platform|', 'risks|Known risks|'],
    promptTemplate: `
I'm about to ship. Be my release checklist.

Shipping: {{what}}
Stack / platform: {{stack}}
Known risks: {{risks}}

Give a pre-launch checklist (tests, edge cases, security, performance, rollback, monitoring, comms), the top 3 things most likely to break, and a go/no-go call.`,
  }),
  wf({
    id: 'architecture',
    title: 'Architecture Review',
    category: 'Coding',
    buttonLabel: 'Architecture',
    description: 'Design or review a system architecture.',
    icon: 'Network',
    command: '/architecture',
    tags: ['code', 'architecture', 'system design', 'scale', 'design'],
    required: ['system|System & requirements||ml'],
    optional: ['scale|Scale / load|', 'constraints|Constraints|'],
    promptTemplate: `
Act as a principal engineer / architect.

System & requirements: {{system}}
Scale / load: {{scale}}
Constraints: {{constraints}}

Deliver: a recommended architecture with a component diagram (described), data flow, the key tradeoffs, failure modes, and what I'd change at 10x scale.`,
  }),
  wf({
    id: 'api-builder',
    title: 'API Builder',
    category: 'Coding',
    buttonLabel: 'API Builder',
    description: 'Design a clean, well-documented API.',
    icon: 'Plug',
    command: '/api',
    tags: ['code', 'api', 'rest', 'endpoints', 'backend', 'build'],
    required: ['resource|What the API does||ml'],
    optional: ['style|Style|REST, GraphQL', 'auth|Auth model|', 'lang|Language / framework|'],
    promptTemplate: `
Design an API for this.

What it does: {{resource}}
Style: {{style}}
Auth model: {{auth}}
Language / framework: {{lang}}

Deliver: the endpoint list with methods, request/response schemas, error handling, auth approach, and example code for the two most important endpoints.`,
  }),
  wf({
    id: 'automate',
    title: 'Automate It',
    category: 'Coding',
    buttonLabel: 'Automate',
    description: 'Turn a repetitive task into an automation.',
    icon: 'Cog',
    command: '/automate',
    tags: ['code', 'automate', 'automation', 'workflow', 'script', 'zapier'],
    required: ['task|The repetitive task||ml'],
    optional: ['tools|Tools you use|', 'trigger|Trigger|', 'frequency|How often|'],
    promptTemplate: `
Help me automate this away.

Repetitive task: {{task}}
Tools I use: {{tools}}
Trigger: {{trigger}}
Frequency: {{frequency}}

Deliver: the simplest automation that works (no-code or code), the exact steps to set it up, the trigger→action flow, and where it could break. Start with the 80/20 version.`,
  }),

  /* ---------------------------- MARKETING ------------------------------- */
  wf({
    id: 'hooks',
    title: 'Hook Generator',
    category: 'Marketing',
    buttonLabel: 'Hooks',
    description: 'Scroll-stopping hooks for any post or video.',
    icon: 'Zap',
    command: '/hooks',
    tags: ['marketing', 'hooks', 'hook', 'attention', 'opening'],
    required: ['topic|Topic / offer||ml'],
    optional: ['platform|Platform|', 'audience|Audience|'],
    promptTemplate: `
Write 15 scroll-stopping hooks.

Topic / offer: {{topic}}
Platform: {{platform}}
Audience: {{audience}}

Mix the angles: curiosity, contrarian, fear/loss, transformation, list, and bold claim. Keep each under 15 words. No clickbait that can't be backed up.`,
  }),
  wf({
    id: 'viral-post',
    title: 'Viral Post',
    category: 'Marketing',
    buttonLabel: 'Viral Post',
    description: 'A post engineered for shares and saves.',
    icon: 'Flame',
    command: '/viral',
    tags: ['marketing', 'viral', 'post', 'social', 'content'],
    required: ['idea|Core idea / message||ml'],
    optional: ['platform|Platform|', 'audience|Audience|', 'cta|Call to action|'],
    promptTemplate: `
Write a post engineered to spread.

Core idea: {{idea}}
Platform: {{platform}}
Audience: {{audience}}
Call to action: {{cta}}

Deliver the full post with a strong hook, high-retention structure (short lines, tension, payoff), a reason to share or save, and the CTA. Add 5 hashtag/keyword suggestions.`,
  }),
  wf({
    id: 'caption',
    title: 'Caption Writer',
    category: 'Marketing',
    buttonLabel: 'Caption',
    description: 'Captions that match the image and drive action.',
    icon: 'Image',
    command: '/caption',
    tags: ['marketing', 'caption', 'instagram', 'social', 'post'],
    required: ['subject|What the post is about||ml'],
    optional: ['platform|Platform|', 'tone|Tone|', 'cta|CTA|'],
    promptTemplate: `
Write 5 caption options.

Post is about: {{subject}}
Platform: {{platform}}
Tone: {{tone}}
CTA: {{cta}}

Vary length (one-liner to mini-story). Each should hook in the first line and end with a clear next step. Suggest relevant hashtags.`,
  }),
  wf({
    id: 'landing-page',
    title: 'Landing Page Copy',
    category: 'Marketing',
    buttonLabel: 'Landing Page',
    description: 'Conversion-focused landing page copy.',
    icon: 'LayoutTemplate',
    command: '/landing',
    tags: ['marketing', 'landing', 'page', 'copy', 'conversion'],
    required: ['offer|Offer / product||ml', 'audience|Audience|'],
    optional: ['benefit|Main benefit|', 'cta|Primary CTA|'],
    promptTemplate: `
Write landing page copy that converts.

Offer / product: {{offer}}
Audience: {{audience}}
Main benefit: {{benefit}}
Primary CTA: {{cta}}

Sections: hero (headline + subhead + CTA), 3 benefit blocks, social proof placeholder, objection-busting FAQ, and a closing CTA. Clear over clever.`,
  }),
  wf({
    id: 'ad-copy',
    title: 'Ad Copy',
    category: 'Marketing',
    buttonLabel: 'Ad Copy',
    description: 'Paid ad variations ready to test.',
    icon: 'BadgeDollarSign',
    command: '/ad',
    tags: ['marketing', 'ad', 'ads', 'copy', 'facebook', 'google'],
    required: ['product|Product / offer||ml', 'audience|Audience|'],
    optional: ['platform|Ad platform|', 'angle|Angle|', 'cta|CTA|'],
    promptTemplate: `
Write ad copy I can test.

Product / offer: {{product}}
Audience: {{audience}}
Platform: {{platform}}
Angle: {{angle}}
CTA: {{cta}}

Deliver 5 primary-text variations, 5 headlines, and 3 descriptions. Lead with the hook, focus on outcomes, comply with ad policies (no false claims).`,
  }),
  wf({
    id: 'story-sell',
    title: 'Story Sell',
    category: 'Marketing',
    buttonLabel: 'Story Sell',
    description: 'Sell through a story that builds trust.',
    icon: 'BookOpen',
    command: '/story',
    tags: ['marketing', 'story', 'narrative', 'sell', 'brand'],
    required: ['offer|What you are selling||ml'],
    optional: ['hero|Who the story is about|', 'transformation|Transformation|', 'audience|Audience|'],
    promptTemplate: `
Write a short story that sells without feeling salesy.

What I'm selling: {{offer}}
Story is about: {{hero}}
Transformation: {{transformation}}
Audience: {{audience}}

Use a relatable struggle → turning point → result arc, weave the offer in naturally, and land on a soft CTA. Keep it under 250 words.`,
  }),
  wf({
    id: 'angles',
    title: 'Marketing Angles',
    category: 'Marketing',
    buttonLabel: 'Angles',
    description: 'Fresh angles to market the same thing.',
    icon: 'Compass',
    command: '/angles',
    tags: ['marketing', 'angles', 'positioning', 'messaging', 'ideas'],
    required: ['offer|Offer / product||ml', 'audience|Audience|'],
    optional: ['current|Current angle|'],
    promptTemplate: `
Give me 10 distinct marketing angles.

Offer / product: {{offer}}
Audience: {{audience}}
Current angle: {{current}}

For each: the angle name, the core message, who it hits hardest, and a sample hook. Range from rational to emotional to status-driven.`,
  }),

  /* ------------------------ BIDVOICE / CONTRACTOR ----------------------- */
  wf({
    id: 'contractor-bid',
    title: 'Contractor Bid',
    category: 'BidVoice',
    buttonLabel: 'Contractor Bid',
    description: 'Turn a job conversation into a structured bid.',
    icon: 'Ruler',
    command: '/bid',
    tags: ['contractor', 'bid', 'estimate', 'quote', 'construction', 'remodel'],
    required: ['job|Describe the job||ml'],
    optional: ['scope|Scope items|', 'materials|Materials|', 'timeline|Timeline|', 'client|Client name|'],
    promptTemplate: `
You are an experienced contractor estimator. Turn this into a structured bid.

Job: {{job}}
Scope items: {{scope}}
Materials: {{materials}}
Timeline: {{timeline}}
Client: {{client}}

Deliver: an organized scope of work, a line-item structure (labor, materials, permits, contingency) with placeholder amounts for me to fill, assumptions & exclusions, and a clean client-facing summary. All prices are placeholders I will set.`,
    variants: [
      {
        id: 'private-vs-client',
        label: 'Private + client split',
        promptTemplate: `
You are an experienced contractor estimator. Turn this into a bid with a clear private/client split.

Job: {{job}}
Scope items: {{scope}}
Materials: {{materials}}
Timeline: {{timeline}}
Client: {{client}}

Produce TWO clearly separated sections:
A) INTERNAL (private — never shown to the client): line items for labor, materials, permits, contingency, and a margin placeholder for me to set.
B) CLIENT-FACING: a clean scope of work, total placeholder, assumptions & exclusions, and next steps.
Keep all pricing as placeholders. Never put margin or internal notes in the client-facing section.`,
      },
    ],
    examples: ['Bathroom remodel: new tile, vanity, lighting, 2 weeks'],
  }),
  wf({
    id: 'bidvoice-app',
    title: 'BidVoice Workflow',
    category: 'BidVoice',
    buttonLabel: 'BidVoice',
    description: 'Capture a spoken job note and structure it into a bid draft.',
    icon: 'Mic',
    command: '/bidvoice',
    tags: ['contractor', 'bidvoice', 'voice', 'bid', 'capture', 'remodel'],
    required: ['transcript|Spoken job notes||ml'],
    optional: ['client|Client|', 'address|Job address|'],
    promptTemplate: `
Take these spoken job notes and structure them into a bid draft.

Client: {{client}}
Job address: {{address}}
Spoken notes: {{transcript}}

Deliver: cleaned-up scope of work, organized line items (labor / materials / other) with placeholder pricing, open questions to confirm with the client, and a short client-ready proposal summary. Keep margin and internal notes separate from the client summary.`,
  }),
  wf({
    id: 'contractor-ad',
    title: 'Contractor Ad',
    category: 'BidVoice',
    buttonLabel: 'Contractor Ad',
    description: 'Local ad that books more jobs.',
    icon: 'Wrench',
    command: '/contractorad',
    tags: ['contractor', 'ad', 'marketing', 'local', 'leads'],
    required: ['service|Service & area||ml'],
    optional: ['offer|Offer / promo|', 'audience|Ideal customer|', 'platform|Where it runs|'],
    promptTemplate: `
Write a local ad for a contractor.

Service & area: {{service}}
Offer / promo: {{offer}}
Ideal customer: {{audience}}
Where it runs: {{platform}}

Deliver: a headline, primary text, and CTA focused on trust, speed, and quality. Add 3 variations and a short script for a 15-second video. Keep claims honest and licensed/insured if applicable.`,
  }),
  wf({
    id: 'quickbooks-workflow',
    title: 'QuickBooks Workflow',
    category: 'BidVoice',
    buttonLabel: 'QuickBooks',
    description: 'Streamline bookkeeping for a contractor.',
    icon: 'Calculator',
    command: '/quickbooks',
    tags: ['contractor', 'quickbooks', 'accounting', 'bookkeeping', 'invoicing'],
    required: ['goal|What you want to set up or fix||ml'],
    optional: ['business|Business type|', 'pain|Current pain|'],
    promptTemplate: `
Act as a bookkeeping advisor for a contractor using QuickBooks.

Goal: {{goal}}
Business type: {{business}}
Current pain: {{pain}}

Deliver: a simple step-by-step setup/workflow, the chart-of-accounts items that matter for contractors, how to track job costing and invoices, and 3 time-saving tips. Note where a CPA should review.`,
  }),
  wf({
    id: 'crm-flow',
    title: 'CRM Flow',
    category: 'BidVoice',
    buttonLabel: 'CRM Flow',
    description: 'Design a simple CRM pipeline that gets used.',
    icon: 'Users',
    command: '/crm',
    tags: ['contractor', 'crm', 'pipeline', 'leads', 'follow up', 'sales'],
    required: ['business|Your business & sales process||ml'],
    optional: ['tools|Tools you have|', 'volume|Lead volume|'],
    promptTemplate: `
Design a dead-simple CRM flow I'll actually use.

Business & sales process: {{business}}
Tools I have: {{tools}}
Lead volume: {{volume}}

Deliver: pipeline stages, what triggers each move, the follow-up cadence with message templates, and the 3 metrics to watch. Optimize for "takes 2 minutes a day".`,
  }),
  wf({
    id: 'lead-machine',
    title: 'Lead Machine',
    category: 'BidVoice',
    buttonLabel: 'Lead Machine',
    description: 'A repeatable system to generate leads.',
    icon: 'Magnet',
    command: '/leads',
    tags: ['contractor', 'leads', 'lead gen', 'marketing', 'growth'],
    required: ['business|Business & service area||ml'],
    optional: ['budget|Budget|', 'channels|Channels you like|', 'goal|Lead goal|'],
    promptTemplate: `
Build me a lead-generation system.

Business & service area: {{business}}
Budget: {{budget}}
Preferred channels: {{channels}}
Lead goal: {{goal}}

Deliver: the 3 highest-ROI channels for my situation, a weekly action plan, the offer/hook to lead with, and how to track cost-per-lead. Start with what works fastest.`,
  }),
  wf({
    id: 'customer-onboarding',
    title: 'Customer Onboarding',
    category: 'BidVoice',
    buttonLabel: 'Onboarding',
    description: 'A smooth onboarding that wows new clients.',
    icon: 'UserCheck',
    command: '/onboarding',
    tags: ['contractor', 'onboarding', 'customer', 'experience', 'process'],
    required: ['business|Your business & service||ml'],
    optional: ['steps|Current steps|', 'goal|Goal|'],
    promptTemplate: `
Design a customer onboarding experience.

Business & service: {{business}}
Current steps: {{steps}}
Goal: {{goal}}

Deliver: a step-by-step onboarding flow from "yes" to project start, the message templates for each touchpoint, what to set expectations on, and the moments to create delight. Keep it repeatable.`,
  }),
  wf({
    id: 'demo-script',
    title: 'Demo Script',
    category: 'BidVoice',
    buttonLabel: 'Demo Script',
    description: 'A persuasive product/service demo script.',
    icon: 'Presentation',
    command: '/demo',
    tags: ['contractor', 'demo', 'script', 'sales', 'pitch', 'presentation'],
    required: ['product|What you are demoing||ml', 'audience|Who you are demoing to|'],
    optional: ['goal|Demo goal|', 'objections|Likely objections|'],
    promptTemplate: `
Write a demo script that closes.

Demoing: {{product}}
Audience: {{audience}}
Goal: {{goal}}
Likely objections: {{objections}}

Structure: hook, the problem they feel, the demo flow (show outcomes not features), objection handling, and a clear close with next step. Include suggested talk tracks.`,
  }),

  /* ----------------------------- RESEARCH ------------------------------- */
  wf({
    id: 'deep-dive',
    title: 'Deep Dive',
    category: 'Research',
    buttonLabel: 'Deep Dive',
    description: 'A thorough, structured deep dive on any topic.',
    icon: 'Search',
    command: '/deepdive',
    tags: ['research', 'deep dive', 'learn', 'explain', 'topic'],
    required: ['topic|Topic to research||ml'],
    optional: ['focus|Specific focus|', 'level|Depth / level|', 'use|How you will use it|'],
    promptTemplate: `
Do a structured deep dive.

Topic: {{topic}}
Specific focus: {{focus}}
Depth / level: {{level}}
How I'll use it: {{use}}

Deliver: a clear overview, the key concepts, the nuances and debates, practical implications, and 5 things most people get wrong. Cite the type of source for any claim that needs verification.`,
  }),
  wf({
    id: 'fact-check',
    title: 'Fact Check',
    category: 'Research',
    buttonLabel: 'Fact Check',
    description: 'Pressure-test a claim for accuracy.',
    icon: 'CheckCircle2',
    command: '/factcheck',
    tags: ['research', 'fact check', 'verify', 'true', 'accuracy'],
    required: ['claim|Claim to check||ml'],
    optional: ['context|Context|'],
    promptTemplate: `
Fact-check this carefully and honestly.

Claim: {{claim}}
Context: {{context}}

Deliver: a verdict (true / partly true / misleading / false / unverifiable), the reasoning, what's accurate vs. not, what would confirm it, and the caveat that I should verify time-sensitive facts against a current source.`,
  }),
  wf({
    id: 'compare',
    title: 'Compare Options',
    category: 'Research',
    buttonLabel: 'Compare',
    description: 'A clear side-by-side comparison and recommendation.',
    icon: 'Columns3',
    command: '/compare',
    tags: ['research', 'compare', 'vs', 'options', 'decision'],
    required: ['options|What to compare||ml'],
    optional: ['criteria|What matters most|', 'context|Your context|'],
    promptTemplate: `
Compare these options for me.

Options: {{options}}
What matters most: {{criteria}}
My context: {{context}}

Deliver: a comparison table across the criteria that matter, the best pick for my situation with reasoning, when each alternative wins, and the one factor most likely to change the answer.`,
  }),
  wf({
    id: 'dossier',
    title: 'Dossier',
    category: 'Research',
    buttonLabel: 'Dossier',
    description: 'A briefing dossier on a person, company, or market.',
    icon: 'FileText',
    command: '/dossier',
    tags: ['research', 'dossier', 'briefing', 'company', 'person', 'background'],
    required: ['subject|Subject||ml'],
    optional: ['purpose|Purpose|meeting prep, deal, hire', 'focus|Focus areas|'],
    promptTemplate: `
Build a concise briefing dossier.

Subject: {{subject}}
Purpose: {{purpose}}
Focus areas: {{focus}}

Deliver: a snapshot summary, key facts, what they likely care about, talking points, smart questions to ask, and what I still need to verify from a live source.`,
  }),
  wf({
    id: 'trend-scan',
    title: 'Trend Scan',
    category: 'Research',
    buttonLabel: 'Trend Scan',
    description: 'Spot the trends and what they mean for you.',
    icon: 'LineChart',
    command: '/trends',
    tags: ['research', 'trends', 'market', 'scan', 'future'],
    required: ['area|Industry / area||ml'],
    optional: ['horizon|Time horizon|', 'goal|Why it matters to you|'],
    promptTemplate: `
Scan the trends shaping this area.

Industry / area: {{area}}
Time horizon: {{horizon}}
Why it matters to me: {{goal}}

Deliver: 5–7 trends with the signal behind each, who wins and loses, the opportunities for me, and what to watch as a leading indicator. Flag which trends are speculative.`,
  }),
  wf({
    id: 'extract',
    title: 'Extract',
    category: 'Research',
    buttonLabel: 'Extract',
    description: 'Pull structured info out of messy text.',
    icon: 'ScanText',
    command: '/extract',
    tags: ['research', 'extract', 'parse', 'data', 'structure', 'summary'],
    required: ['text|Paste the source text||ml'],
    optional: ['want|What to extract|names, dates, action items, numbers', 'format|Output format|table, list, JSON'],
    promptTemplate: `
Extract the important information from the text below.

What to extract: {{want}}
Output format: {{format}}

Text:
"""
{{text}}
"""

Be accurate and complete. If something isn't present, say so rather than guessing.`,
  }),
  wf({
    id: 'digest',
    title: 'Digest',
    category: 'Research',
    buttonLabel: 'Digest',
    description: 'Summarize long content into a tight digest.',
    icon: 'AlignLeft',
    command: '/digest',
    tags: ['research', 'digest', 'summary', 'tldr', 'summarize'],
    required: ['content|Paste the content to digest||ml'],
    optional: ['length|Desired length|', 'audience|For whom|'],
    promptTemplate: `
Summarize the content below into a useful digest.

Desired length: {{length}}
For whom: {{audience}}

Content:
"""
{{content}}
"""

Deliver: a one-line TL;DR, the 5 key points, any action items, and one thing worth a closer look. No fluff.`,
  }),

  /* --------------------------- PRODUCTIVITY ----------------------------- */
  wf({
    id: 'today',
    title: 'Plan My Day',
    category: 'Productivity',
    buttonLabel: 'Today',
    description: 'Turn your todo chaos into a focused day plan.',
    icon: 'CalendarCheck',
    command: '/today',
    tags: ['productivity', 'today', 'plan', 'day', 'schedule', 'priorities'],
    required: ['tasks|Your tasks & commitments||ml'],
    optional: ['energy|Time / energy available|', 'priority|Top priority|'],
    promptTemplate: `
Help me plan a focused, realistic day.

Tasks & commitments: {{tasks}}
Time / energy available: {{energy}}
Top priority: {{priority}}

Deliver: the 1–3 things that actually matter today, a time-blocked plan, what to defer or drop, and the single task to do first. Be realistic, not aspirational.`,
  }),
  wf({
    id: 'focus',
    title: 'Focus Now',
    category: 'Productivity',
    buttonLabel: 'Focus',
    description: 'Cut the noise and lock in on one thing.',
    icon: 'Crosshair',
    command: '/focus',
    tags: ['productivity', 'focus', 'concentrate', 'deep work', 'distraction'],
    required: ['situation|What you need to focus on (and what is pulling you away)||ml'],
    optional: ['deadline|Deadline|', 'time|Time you have|'],
    promptTemplate: `
I need to focus. Help me lock in.

What I need to focus on (and what's distracting me): {{situation}}
Deadline: {{deadline}}
Time I have: {{time}}

Deliver: the one thing to focus on, a 25-minute kickoff plan, distractions to kill right now, and a "done is" definition so I know when to stop.`,
  }),
  wf({
    id: 'decision',
    title: 'Decision Helper',
    category: 'Productivity',
    buttonLabel: 'Decision',
    description: 'Make a clear decision you can stand behind.',
    icon: 'Scale',
    command: '/decide',
    tags: ['productivity', 'decision', 'choose', 'decide', 'stuck'],
    required: ['decision|The decision you face||ml'],
    optional: ['options|Options|', 'criteria|What matters|', 'gut|Your gut says|'],
    promptTemplate: `
Help me make this decision clearly.

The decision: {{decision}}
Options: {{options}}
What matters to me: {{criteria}}
My gut says: {{gut}}

Deliver: the real question behind the decision, each option's upside/downside, a recommendation with reasoning, a reversibility check, and how to decide if I'm still torn.`,
  }),
  wf({
    id: 'simplify',
    title: 'Simplify',
    category: 'Productivity',
    buttonLabel: 'Simplify',
    description: 'Make something complicated simple.',
    icon: 'Minimize2',
    command: '/simplify',
    tags: ['productivity', 'simplify', 'clarify', 'explain', 'simple'],
    required: ['thing|What to simplify||ml'],
    optional: ['audience|For whom|', 'goal|Goal|'],
    promptTemplate: `
Simplify this for me.

What to simplify: {{thing}}
For whom: {{audience}}
Goal: {{goal}}

Deliver: the plain-English version, an analogy that makes it click, the 3 things that actually matter, and what I can safely ignore. Use short sentences.`,
  }),
  wf({
    id: 'delegate',
    title: 'Delegate',
    category: 'Productivity',
    buttonLabel: 'Delegate',
    description: 'Hand off a task cleanly with a clear brief.',
    icon: 'UserPlus',
    command: '/delegate',
    tags: ['productivity', 'delegate', 'handoff', 'team', 'brief'],
    required: ['task|The task to delegate||ml'],
    optional: ['who|Who you are handing it to|', 'standard|Definition of done|', 'deadline|Deadline|'],
    promptTemplate: `
Help me delegate this cleanly.

Task: {{task}}
Handing it to: {{who}}
Definition of done: {{standard}}
Deadline: {{deadline}}

Deliver: a crisp delegation brief (context, outcome, constraints, resources), the check-in points, and the questions they'll probably ask — answered in advance.`,
  }),
  wf({
    id: 'cleanup',
    title: 'Cleanup',
    category: 'Productivity',
    buttonLabel: 'Cleanup',
    description: 'Declutter a backlog, inbox, or list.',
    icon: 'Eraser',
    command: '/cleanup',
    tags: ['productivity', 'cleanup', 'declutter', 'organize', 'backlog', 'inbox'],
    required: ['mess|The list / backlog / mess||ml'],
    optional: ['goal|Goal|', 'criteria|Keep / cut criteria|'],
    promptTemplate: `
Help me clean this up.

The list / backlog / mess: {{mess}}
Goal: {{goal}}
Keep / cut criteria: {{criteria}}

Deliver: a sorted result (do now / schedule / delegate / delete), what to cut without guilt, and a 10-minute action plan to get to zero-ish.`,
  }),
];

/* -------------------------------------------------------------------------- */
/*  Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

export const CATEGORIES: WorkflowCategory[] = [
  'Writing',
  'Real Estate',
  'Business',
  'Coding',
  'Marketing',
  'BidVoice',
  'Research',
  'Productivity',
];

/** The buttons surfaced on the Home hero grid (curated "most common"). */
export const HOME_BUTTON_IDS: string[] = [
  'write',
  'build-app',
  'deep-dive',
  'real-estate-offer',
  'land-analysis',
  'angles',
  'debug',
  'founder-strategy',
  'swot',
  'improve',
  'follow-up',
  'client-summary',
  'bidvoice-app',
  'contractor-bid',
  'automate',
  'today',
];

/** Workflows for the Home hero grid, in curated order, skipping any unknown ids. */
export function homeButtons(): Workflow[] {
  return HOME_BUTTON_IDS.map(getWorkflow).filter((w): w is Workflow => Boolean(w));
}

export function getWorkflow(id: string): Workflow | undefined {
  return WORKFLOWS.find((w) => w.id === id);
}

export function workflowsByCategory(category: WorkflowCategory): Workflow[] {
  return WORKFLOWS.filter((w) => w.category === category);
}
