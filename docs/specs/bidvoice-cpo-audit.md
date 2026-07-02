# BidVoice — Pre-Launch Product Audit
### Chief Product Designer review · Full customer journey

Scope note: I still can't reach the live app from this environment, so this audit reviews the product as specified — its screens, workflows, and category — rather than pixel-auditing shipped pages. Everything below is written to be true and actionable regardless of current layout details; where I flag a likely problem, it's marked as an assumption to verify. Send screenshots and I'll convert any section into a screen-specific punch list.

Priorities used throughout, in order: trust → simplicity → professional appearance → speed → emotional experience → revenue. The recurring question: *what would Eden do instead of making the contractor do it?*

---

## The one number that decides the launch

**Time from signup to first reviewed estimate.** Everything else is secondary. A contractor who speaks a job and sees a credible, editable estimate within five minutes of creating an account has emotionally "hired Eden." A contractor who hits a settings form, a rate table, or an empty dashboard first has downloaded another app. Every P0 item below serves this number.

---

## Journey audit

### 1. First visit — Landing page
The landing page should be the product demonstrating itself, not describing itself. The strongest hero for this company is the orb plus Eden's actual first line ("Tell me about the job — I'll take it from here") and a 15-second silent loop of a real intake becoming a real proposal. Contractors don't buy "AI-powered estimating platform" language; they buy watching a guy talk for 40 seconds and a client-ready proposal coming out.

Assumptions to verify: no competing CTAs (one button: start), no feature-grid wall, pricing findable in one click, loads fast on a phone in a truck. *Eden's move:* let visitors try the intake with a sample job before signup — talking to Eden once converts better than any copy. (Revenue + trust.)

### 2. Signup
Ask for the minimum a person needs to be greeted properly: name, company, trade, phone/email. Everything else — rates, markup, license number, logo — Eden gathers conversationally when it's actually needed. Every field removed from signup shows up directly in activation rate. Company voice here (BidVoice, the B mark); Eden hasn't entered yet — meeting her should be a moment, not a form footer. (Simplicity + revenue.)

### 3. First job — the activation flow
This is where the "hired an employee" feeling is won or lost, and the biggest structural recommendation in this audit:

**Do not onboard with setup. Onboard with the first job.** After signup, land directly on the intake screen in first-visit mode (built in the v3 prototype). Eden introduces herself, the contractor talks, and during the first build Eden asks the two or three setup questions she genuinely can't price without — "What do you usually charge for tile work, roughly per hour?" — as conversation, not as a rates table. Each answer is remembered and never asked again. The price book assembles itself job by job in the background. A rate table can exist in Settings for people who want it, but it's never the front door. (Trust + simplicity + emotion, all at once.)

### 4. The estimate review — where trust is actually built
Contractors will not trust AI pricing on day one, and they shouldn't be asked to. Trust comes from three properties of the review screen:

- **Every line shows its reasoning on demand.** Tap a line item → "8 hrs labor @ $85 · tile at $4.20/sq ft from your last job · 10% waste." Not a confidence score, not "AI-generated" badges — just the math a good estimator would show you.
- **Everything is editable, and edits teach.** Change $85 to $95 and Eden acknowledges once, quietly: "Got it — $95/hr for tile from now on." This single interaction converts skeptics faster than anything else in the product, because it proves the employee listens.
- **Streaming build.** Line items appear one at a time as they're priced rather than behind a spinner. It's faster-feeling, and it's inspectable — the contractor watches the work happen. (Trust + speed + emotion.)

### 5. The proposal — the revenue moment
The document the *client* receives is the contractor's professional reputation, and it's also where BidVoice makes its money defensible. It must look like it came from a company with an office: contractor's logo and colors, clean scope language, options presented well, e-signature, and a deposit payment built into acceptance. Acceptance → deposit collected → job scheduled should be one motion.

Approval-first rule everywhere: Eden prepares, the contractor sends. "Nothing is sent to the client until you approve it" appears exactly here, at the send moment, and nowhere it isn't needed. *Eden's move:* she tracks opens ("The Hendersons opened it twice last night") and drafts the follow-up nudge — because unfollowed bids are the single biggest silent revenue leak in this trade. The contractor taps approve. (Revenue + professional appearance.)

### 6. Daily work — Dashboard, Jobs, Calendar, CRM
The dashboard's job is "what needs you today," not analytics. Lead with the Eden line (small orb + one sentence + one action): "Two estimates are waiting on your review, and the Malone quote has been sitting a week — want me to nudge them?" Then money in motion: proposals out, jobs active, invoices aging. Any stat that doesn't lead to an action gets cut.

Jobs: each row is stage + Eden's last action ("Proposal sent Tue · opened twice"), detail view is a human-readable timeline. Calendar: a calm calendar where Eden surfaces conflicts and travel-time problems in her line; no AI decoration on events themselves. CRM: contacts carry what a good employee remembers — "Prefers texts · Paid in 3 days last job" — never labeled as AI enrichment; it's just memory. (Simplicity + emotion.)

### 7. Getting paid — Payments & invoicing
Maximum plainness, company voice. Numbers, statuses, dates. Eden appears only as suggestion lines: "Invoice 214 is 12 days out — want me to send a reminder?" Auto-drafted reminders on approval, escalating politely. Deposit-on-acceptance (above) plus payment reminders are the two features with the most direct cash-flow impact for the customer, which is what earns the subscription. (Revenue + trust.)

### 8. Growth — Website Builder
Frame: "Eden drafted your site from your completed jobs — review and publish." Photos and scope descriptions the contractor already gave her become portfolio pages. Same approval gate. This turns a side feature into proof that Eden compounds: work done once keeps paying. (Emotion + revenue.)

### 9. System — Settings, Notifications, Billing
Pure BidVoice voice; the orb appears only as the avatar on Eden-authored notifications. Notification policy: only things that need action or are good news, each one a fact plus at most one action ("The Hendersons accepted. Want me to schedule the walkthrough?"). Kill everything else — a noisy notification channel destroys the calm the rest of the product builds. Billing is boring on purpose: plan, price, next charge, cancel without a maze. A company confident in its employee doesn't hide the exit. (Trust.)

### 10. Cross-cutting quality bar
- **Offline-first capture.** Job sites have bad signal. Voice notes must record and persist locally, syncing when connectivity returns — "Saved. I'll get to work as soon as we're back online." A lost recording is a fired employee. This is P0. (Trust + speed.)
- One surface system product-wide (the intake's `#08080A / #101013 / hairline` scale); orange reserved for Eden's presence and primary actions — more than two oranges on a screen means one is wrong.
- No spinners anywhere: skeletons for layout, the orb or checklists for Eden's work, streaming for estimates.
- Empty states are Eden offering to do the thing ("No jobs yet — tell me about one and I'll set everything up"), never gray illustrations.
- Every screen answers "who is speaking?" — Eden (first person, working) or BidVoice (plain, system). Mixed voice on one screen is a bug.

---

## Prioritized punch list

**P0 — launch blockers:** first-visit intake flow as the post-signup landing (v3 prototype); conversational setup during first build (no upfront rate forms); estimate review with per-line reasoning + edit-and-learn; streaming estimate build; offline-safe voice capture; proposal send with approval gate; product-wide copy replacement pass; one surface/token system.

**P1 — first month:** proposal open-tracking + approved nudges; deposit-on-acceptance; Eden line on Dashboard and Jobs; notification policy rewrite with orb avatars; empty-state pass; payment reminders.

**P2 — fast follow:** calendar conflict detection; CRM memory fields; website builder "drafted from your jobs" flow; landing-page try-before-signup intake.

---

## Instructions for Claude Code

Work inside the existing project. No new brand assets, palette, fonts, nav, or architecture. Reference implementations: `eden-intake-v3.jsx` (screen + orb), `eden-experience-guide.md` (identity rules, copy table, orb spec). Build in this order; each item lists acceptance criteria.

**1. Shared components (build first, reuse everywhere)**
- `<EdenOrb state level size />` — port the canvas renderer from v3 unchanged. Sizes: 176 (intake), 40 (Eden line), 24 (avatar/pill). At ≤40px drop filaments, run two currents at half energy. Static single frame under `prefers-reduced-motion`. AC: six states distinguishable; 60fps on mid-range mobile; no layout shift.
- `<EdenLine text action onAction />` — small orb + one sentence + max one action button; renders nothing if there's nothing worth saying. AC: never stacks more than one instance per screen.
- `<ApprovalGate summary onApprove onEdit />` — the send-anything pattern: shows what's about to go out, "Send to {client}" primary, "Make changes" secondary, footer line "Nothing is sent until you approve it." Used by proposals, invoices, reminders, nudges. AC: no outbound communication in the codebase bypasses this component.
- Design tokens: `bg-app #08080A`, `bg-surface #101013`, `bg-raised #16161B`, `hairline #1C1C22`, `text 100/300/500/600 neutral scale`, `accent = existing brand orange token`. Replace ad-hoc hex values project-wide. AC: grep for hardcoded oranges returns only the token file.

**2. Intake (per v3 prototype)**
- State machine: `ready → listening → thinking → followup(×≤3) → building → review`, single reducer, no standalone booleans. Edge transitions: mic denied → Eden explains + auto-expand text input (the only permitted mic glyph, in the fix explanation); 8s silence → "Still here whenever you're ready"; 20s → auto-advance; offline → persist locally, "Saved. I'll get to work as soon as we're back online."
- Greeting beats: lines reveal sequentially, 650ms apart, 500ms ease; first-visit variant (name intro + one trust sentence) vs returning variant ("Morning, Ben. What are we working on?") keyed on `user.hasCompletedIntake`; daypart from local time. Typing fallback fades in only after the last beat.
- Chrome: no bordered cards on this screen — hairline dividers and spacing only, exactly as v3.
- **Offline capture (P0):** record via MediaRecorder to IndexedDB before any upload attempt; upload queue with retry/backoff; never lose audio on refresh or signal loss. AC: airplane-mode test — record, kill app, restore signal, estimate arrives.

**3. Conversational first-run setup**
- During the first `building` phase, if required pricing inputs are missing (labor rate for the detected trade, markup, tax region), Eden asks them as followup-style questions — same chip UI. Answers write to the price book. Never ask a question twice; never show a setup form before the first estimate. AC: fresh account → spoken job → reviewed estimate with zero forms.

**4. Estimate review screen**
- Line items stream in as priced (server-sent events or polling; append with the same fade-up motion).
- Each line expands to a reasoning row: quantities × rates × sources, plain language ("8 hrs @ $85 · tile $4.20/sq ft · 10% waste"). No confidence scores, no "AI" labels.
- Inline edit on any figure → recalculate totals live → one-time quiet toast when the edit implies a preference: "Got it — $95/hr for tile from now on," with an undo. Persist to price book. AC: edit → new job of same trade uses the learned rate.

**5. Proposal flow**
- Compose from estimate → client-ready document (contractor logo/colors from profile) → `ApprovalGate` → send → status timeline on the job (sent/opened/accepted). Open events generate an Eden-line suggestion after 3 quiet days: drafted nudge behind the same gate. Acceptance triggers optional deposit collection (existing payments rails) and a "schedule the walkthrough?" suggestion. AC: send→accept→deposit works end-to-end in staging with a test client email.

**6. Copy pass (cheap, ship early)**
- Apply the replacement table in `eden-experience-guide.md` §3 through the string layer. Additional strings from this audit: building sub-line "This takes me about a minute."; review "Take a look whenever you're ready — nothing goes to {client} until you say so."; offline save line above; empty states per §10; notification format "{fact}. {optional question}?" AC: grep for "Processing", "Submitting", "Transcript", "Recording" in user-facing strings returns nothing.

**7. Dashboard & notifications**
- Dashboard order: EdenLine → needs-you-today list (reviews pending, proposals aging, invoices due) → money in motion. Remove non-actionable stats.
- Notifications: Eden-authored items use the 24px orb avatar and the fact+question format; system items use the B mark and plain voice. Add a "needs action / everything else" split. AC: no notification fires without an associated action or a materially good event.

**8. Analytics**
- Events: `signup_completed`, `first_intake_started/completed`, `time_to_first_estimate_ms` (north star), `line_reasoning_opened`, `estimate_edited`, `rate_learned`, `proposal_sent/opened/accepted`, `deposit_collected`, `nudge_suggested/approved`, `offline_capture_used`, `type_fallback_used`, `mic_denied`.

**Don'ts (unchanged and permanent):** no waveforms; no spinners; no mic icon in primary UI; no new colors/fonts/logos; Eden's name ≤2 mentions per screen; no UI added because space exists; nothing sends without the approval gate.
