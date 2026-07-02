# BidVoice V1 — The Blueprint
### Final pre-implementation audit · Category-defining pass

*Transcribed to the repo from the founder's canonical PDF (`bidvoice-v1-blueprint`). Reference
prototypes: `eden-intake-v3.jsx`, `login-handoff.jsx` (NOT in repo). Consolidates intake v3, the CPO
audit, and the experience guide.*

## 1. Principles, extracted — not copied
- **The product is the demo (Apple).** Never describe what Eden does where she could simply do it.
  Landing hero = a real intake becoming a real proposal. Onboarding = the first job, not a tour.
- **The intelligence is the interface (OpenAI).** The orb and the conversation are the primary surface;
  screens exist to display Eden's work and collect approvals, not to be operated. Any control that
  could be a sentence to Eden is a candidate for deletion.
- **Credibility lives in the boring surfaces (Stripe).** Contractors judge whether this is a real
  company by the receipt email, terms page, cancel flow, invoice PDF. These get the same polish as the
  orb. (This is why §5 is P0.)
- **No dead ends, everything editable (Notion).** Every figure, sentence, and schedule Eden produces
  can be changed inline, and changes teach her. Nothing Eden makes is ever locked.
- **Speed is a feature; defaults beat settings (Linear).** Opinionated defaults, instant optimistic UI,
  streaming output. If a setting exists, first ask why Eden couldn't have learned it.
- **Question the frame itself (Arc).** The biggest one: apps open to dashboards. BidVoice shouldn't.
- **Design the trust between two strangers (Airbnb).** The real transaction is contractor ↔ homeowner.
  Every client-facing artifact carries the *contractor's* brand, never BidVoice's, beyond a quiet
  "powered by" line.
- **The product improves while you sleep (Tesla).** Frame releases as employee growth — a monthly note
  in Eden's voice: "This month I learned to price trim carpentry better and I can read site photos now."

## 2. Assumptions challenged
- **"Apps open to a dashboard."** BidVoice opens to Eden. The home screen is the **Morning Briefing**:
  the orb, "Morning, Ben," and the two or three things that actually need him. One tap acts on an item;
  one tap on the orb starts a new job. The dashboard survives as a "Business" tab. *The single most
  category-defining change in V1, and it's cheap: the intake screen plus an EdenLine list.*
- **"Notifications are a feed."** Replaced by the briefing + a strict push policy: **push only for money
  and emergencies** (proposal accepted, payment received, client replied, day-of conflict). Everything
  else waits for the next briefing. The calmest notification channel in the industry is a feature.
- **"Data entry is forms."** Anything sayable is speakable, everywhere. A small orb affordance on
  Jobs/Calendar/CRM accepts voice/type input and routes it as an instruction. V1 scopes this to a fixed
  instruction set (dates, amounts, notes, reminders) behind the approval gate.
- **"The client gets a PDF."** The client gets a live proposal page under the contractor's brand:
  scope, options, e-sign, deposit. PDF remains an export.
- **"Settings."** Renamed **"Working with Eden"**: a plain-language list of what she's learned — rates,
  markup, preferences, phrasing — each line correctable. Account/billing/legal remain a conventional,
  boring, company-voice section.
- **Voice-register rule:** when **Eden** speaks, first person ("Tell me about the job."). When
  **BidVoice** points to her — buttons, empty states, emails, marketing — third person ("Talk to Eden,"
  "Eden drafted this."). **Never both registers in one block.**

## 3. Delight inventory — "it already knew"
Governing rule: **Eden may only "already know" things the contractor gave her or explicitly opted
into.** Delight that feels like surveillance destroys more trust than it builds. Examples (each grounded
in first-party data): repeat-client name recognition (CRM), "same as the Johnson deck" cloning (job
history), concrete-pour + rain flag (calendar + weather), price-drift note (price-book history),
accepted → material-list pre-draft (estimate data), calendar-window walkthrough readiness (calendar
only, no location tracking in V1), finish-talking orb flare, proposal-opened row pulse. **Two per
journey maximum. Delight is seasoning.**

## 4. Website → Login → App: one product
One token file consumed by the marketing site and the app: same surfaces (`#08080A`/`#101013`),
hairlines, radius scale, type (single family, weight-based hierarchy), one motion grammar (450–500ms
`cubic-bezier(.2,.7,.2,1)` fade-up, beats at 650ms for spoken lines). The orb appears on the marketing
site only where Eden is genuinely demonstrated.
- **Login** is company voice, orb-free, minimal: B mark, "Welcome back," "Your AI employee is ready,"
  email/password/SSO, forgot, create.
- **The handoff** (the one theatrical moment; built in `login-handoff.jsx`): first sign-in → "Welcome to
  BidVoice." → "Your AI employee is ready." → the orb blooms in → Eden's first greeting. Returning
  sign-ins skip theater and land on the briefing. *The company opens the door; the employee is standing
  there.*

## 5. Trust launch blockers — specs
- **Email verification:** required before anything sends to a client (contractor can explore
  unverified). Branded email, one button, expiring link, resend with cooldown.
- **Change email:** verify the new address before switchover; notify the old address; sessions
  elsewhere invalidated.
- **Deactivate/Delete:** self-serve in Account. Deactivate = paused, data retained. Delete = plain
  confirmation typed ("DELETE"), **30-day grace with export offer** (jobs, estimates, contacts as
  CSV/PDF), then hard delete. No retention maze, no "call us."
- **Transparent pricing:** public page, real numbers, what's included, no "Contact sales" wall for the
  core tier.
- **AI disclaimer** (worded as accountability, not liability-flinching): client-facing docs footer
  "Prepared with Eden, BidVoice's estimating assistant. Reviewed and approved by {Contractor Name}."
  In-app, once at first estimate: "I draft, you approve — check my numbers until you trust them."
- **Terms & Privacy:** real pages, readable summaries, linked from signup, footer, settings.
- **SMS opt-in:** unchecked-by-default consent with carrier language, consent timestamp stored,
  STOP/HELP handled. Client-facing SMS requires the client to opt in via the proposal page first.
- **Branded emails — two identities:** account/system mail = BidVoice brand; client-facing mail
  (proposals, reminders, receipts) = contractor's name and logo, reply-to the contractor, quiet "Sent
  via BidVoice" footer.
- **Public email hidden by default:** contractor contact details appear on client artifacts only by
  explicit choice; proposal pages use a relay/contact form until enabled.
- **Desktop/mobile behavior:** mobile = capture and approve; desktop = review and refine. Same
  features, different defaults per device.
- **Professional modals:** a single `<Modal>`/`<Confirm>` system — title states the consequence, body
  one sentence, verb-labeled buttons, destructive style for destructive acts, focus-trapped, Esc
  closes. **Zero `window.alert/confirm/prompt` in the codebase.**

## 6. Build order (phased; each phase has ACs)
Build inside the existing project. **Brand, logo, palette, typography, navigation: locked.**
- **Phase 0 — Foundation:** (1) token file (surfaces, hairline, neutral text scale, brand-orange accent,
  radius, motion) consumed by app + marketing site — no hardcoded hex outside tokens; (2) shared
  components `EdenOrb` (176/40/24, six states, reduced-motion static frame), `EdenLine`, `ApprovalGate`,
  `Modal/Confirm`, `Beat`; (3) trust infrastructure from §5 (verification, change-email,
  deactivate/delete-with-export, legal pages, SMS consent, dual email identities, modal-replacement
  sweep) — grep for `window.confirm|alert|prompt` returns nothing.
- **Phase 1 — The core loop (this is the launch):** (4) auth → handoff per `login-handoff.jsx`; (5)
  intake per `eden-intake-v3.jsx` incl. full state machine + offline-first capture (MediaRecorder →
  IndexedDB → retry); (6) conversational first-run setup (price-book questions as follow-up chips); (7)
  estimate review — streaming line items, tap-to-expand reasoning, inline edits that recalc live and
  teach; (8) proposal — live client page under contractor brand, e-sign, deposit, PDF export,
  ApprovalGate on send, status timeline.
- **Phase 2 — The OS layer:** (9) Morning Briefing as home (orb + daypart greeting + ≤3 EdenLine items +
  tap-orb-to-start-a-job; "Business" tab holds numbers); (10) push policy (money/emergency only); (11)
  instruction input on Jobs/Calendar/CRM (fixed grammar, behind the gate); (12) "Working with Eden"
  settings surface.
- **Phase 3 — Intelligence & delight (fast follow, feature-flagged):** (13) client memory, "same as
  {past job}" cloning, weather flag, price-drift note, accepted→material-list, calendar-window
  walkthrough, proposal-opened pulse (first-party data only; ≤2 delight moments/session); (14) monthly
  "Eden's getting better" note.

## Analytics (from Phase 1)
`time_to_first_estimate_ms` (north star), `handoff_completed`, `intake_started/completed(voice|text)`,
`offline_capture_used`, `line_reasoning_opened`, `estimate_edited`, `rate_learned`,
`proposal_sent/opened/accepted`, `deposit_collected`, `briefing_item_actioned`,
`instruction_used(type)`, `nudge_approved`.

## Permanent don'ts
No waveforms, spinners, or mic icons in primary UI; no orb on company-voice surfaces; no BidVoice
branding dominating client-facing artifacts; Eden's name ≤2 mentions per screen; both voice registers
never mixed in one block; **nothing leaves the building without the approval gate**; no UI added because
space exists.

## Explicitly not in V1
Client-facing Eden chat on proposal pages; location-based triggers; open-ended natural-language
instructions beyond the fixed grammar; **voice replies from Eden** *(NOTE: superseded by
`eden-voice-spec.md`, which ships voice in V1)*. Each is a deliberate deferral.
