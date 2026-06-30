# Milestone 2 — Bid Brain Companion (scope, for approval)

> **What:** evolve Bid Brain from an entry *screen* into a **persistent, floating,
> context-aware AI companion** over the whole app — Siri/Copilot, for contractors.
> **Why it's first:** it's the interaction substrate every later milestone plugs
> into (Vision, Ordering, Coach, PM all become "Bid Brain, …"). It also makes the
> product feel like an AI employee, not software — the signature experience.
> **Success metric:** a contractor can summon Bid Brain from any screen and act
> by voice — noticeably faster than navigating menus.
> **Status:** scope only. No code until approved.

## The one risk that shapes the build
Natural-language **command routing** is where these assistants feel magical or
broken. We will **not** ship "say anything and it does it." We ship a reliable
shell first, then grow a curated, tested command set. Reliability > vocabulary.

## Interaction model
- A small **glowing animated brain** (not a mic, not cartoonish — Apple-level):
  idle gentle pulse; **listening** → glow softly expands; **thinking** → neurons
  flicker; **speaking** → soft animation. SVG + CSS, no heavy deps.
- **Floating + draggable** on every authed screen; position persists; never blocks
  buttons (snaps to edges, stays out of the way).
- **Tap** → opens the Bid Brain panel (reuses M1's greeting + actions).
- **Hold** → starts listening immediately (reuses existing voice capture).
- **Double-tap** → continue last conversation / last job.

## Phasing (each production-ready before the next)

### Phase 1 — The companion shell (reliable, mostly reuse)
- Floating draggable animated brain, persistent across all screens.
- Tap → panel = **M1's Bid Brain content** (greeting, voice, cards) as an overlay.
- Hold → listen now; double-tap → continue last.
- Refinement of M1: the app no longer *force-lands* on a Bid Brain screen; the
  brain **floats over the normal app** (Ben: "add a layer, don't replace the
  workflow"). M1's `viewBrain` becomes the panel body.
- Fully EN/ES; premium animation states.

### Phase 2 — Context awareness (suggestions, reliable)
The panel knows where you are (`state.view` + `state.jobId`) and leads with the
right action — no risky free-form parsing yet:
- On an estimate → "Add to this estimate / scan materials."
- On a customer → "Call / text / follow up."
- On schedule → "Reschedule / what's next."
- On photos → "Generate the estimate."

### Phase 3 — Voice commands (curated → expanding)
A small **intent router**: (transcript + context) → an existing app action. Start
with a curated, high-value, **tested** set; expand deliberately. Examples to land
first: "add [qty] [material]" (on an estimate), "call him" (on a customer),
"move this to [day]" (on schedule), "generate the estimate" (on photos),
"translate this to Spanish," "new [trade] estimate," "find the [name] project."
Each command ships only when it executes reliably.

## Reusable components (reuse, don't rebuild)
| Need | Reuse |
|---|---|
| Panel content (greeting, cards) | M1 `viewBrain()` |
| Voice capture / listen | `micTap` / `startRecord` / recfab path |
| Memory + greeting data | M1 `memory` + `/api/brain` |
| Context | existing `state.view` / `state.jobId` |
| Command targets | existing actions (add line, call, reschedule, build, translate) |
| Continue last | jobs list / last open job |

## Architecture
- A **global overlay component** (`BidBrainDock`) rendered outside the view router
  so it persists across re-renders; fixed-position, pointer-drag, position in
  `localStorage`.
- **Brain visual**: one SVG + CSS animation states (idle/listening/thinking/speaking),
  driven by a small state machine. Respects `prefers-reduced-motion`.
- **Intent router** (Phase 3): pure function `(transcript, context) → {action,args}`
  over a curated command table; unmatched → falls back to the normal voice-estimate
  flow (never a dead end). Server-side AI assist only where needed; deterministic
  matching first for speed + reliability.
- Bid Brain memory continues learning from every interaction.

## Database changes
- None for Phase 1–2 (UI + reuse). Phase 3 adds no schema (commands are code +
  optional memory keys for learned phrasings).

## Build plan (after approval, on `claude/bid-companion`)
1. The draggable glowing brain + persistent overlay; tap opens panel (M1 content).
2. Hold-to-listen + double-tap-continue; un-force the M1 landing (brain floats over
   the normal app).
3. Context-aware panel (Phase 2).
4. Curated command router (Phase 3), commands added one tested at a time.
5. Verify end-to-end; preview before merge.

## What we will NOT do in M2
- No "say anything and it does it" — curated, reliable commands only, expanding.
- No replacing the existing workflow — the companion is an additive layer.
- No heavy animation libraries — SVG + CSS, mobile-first, performant.
