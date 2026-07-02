# BidVoice Bible — Executive Review
### Board-level review of `BIDVOICE_MASTER_SPEC.md`, presented as if before a Series-A raise

*Companion to the Bible. Written to be read by the founder and by Fable (the external product/spec
partner) to confirm the integration is faithful and to act on the open decisions. I have challenged my
own work below rather than defend it.*

---

## 1. What changed

**From a thin skeleton to a constitutional document, then to a spec-complete one.**

- **v0.1–0.3 → v0.4 (custodial rewrite):** the Bible went from a stub with "AWAITING PASTE" placeholders
  to a truthful constitutional document. Terminology drift resolved (Eden is canonical; *Bid Brain*/
  *Foreman*/*Bidtranslator* retired). Positioning reconciled (platform = AI Construction OS; Eden = the AI
  employee who behaves as a chief of staff; on estimating, an instrument not an oracle). Law XV amendment
  recorded. Four implementation-drift items corrected to truth (30-day signed URLs; live legal pages; ~6
  AI endpoints; **stateless** intake).
- **v0.5 (this pass):** the four previously-missing canonical specs arrived and were **preserved in the
  repo** (`docs/specs/`) and **integrated**. §4 Voice, §5 Intake, §11 Roadmap moved from 🔴 BLOCKED to ✅
  canonical. Added: the north-star metric, the no-autonomous-outbound invariant, the numeric-ambiguity
  rule, the component canon, and **§14 — a dedicated section that lists every conflict for founder
  decision without resolving it** (per the sprint package's own governing rule).

## 2. What improved

- **Truth over completeness.** The Bible now says what is *actually in the code* (stateless intake,
  30-day URLs, vanilla/paper app) rather than what a marketing summary would claim. A new engineer reading
  it will build the correct product, not a fictional one.
- **One source of truth, with a hierarchy.** §13 makes the Bible canonical and orders every deep doc
  beneath it; §0 settles the naming/positioning/scope questions the deep docs contradicted each other on.
- **The conflicts are surfaced, not buried.** §14 is the most valuable section for a board: it names the
  single largest decision (architecture/aesthetic) in plain terms and refuses to paper over it.
- **The canon is now version-controlled.** Seven spec files (`eden-voice-spec`, `bidvoice-cpo-audit`,
  `eden-intake-final-spec`, `bidvoice-v1-blueprint`, `sprint-package-eden-intake-voice`,
  `exec-review-response`, and the existing `eden-experience-guide`) live in `docs/specs/`, so the Bible's
  citations resolve to real files.

## 3. Challenging my own decisions (the adversarial pass)

*A board would push on these; so I did.*

- **Did I over-resolve anything?** I resolved naming, positioning, scope, Law XV, and voice-in-V1. Each
  traces to an explicit founder-approved source (brand-standard.md; the founder's Law-XV ruling; the voice
  spec's own "supersedes" language). I did **not** resolve the architecture/palette conflict — correctly,
  because the palette is protected and the stack is a founder call. **Verdict: no overreach; the one thing
  I must not decide, I didn't.**
- **Is there a contradiction left inside the Bible?** §2 states the canonical palette is paper `#F1EEE7`
  while §14.1 flags the specs' dark `#08080A`. This is intentional (flag, don't resolve), and both
  sections cross-reference. Not a latent contradiction — a surfaced one. **Verdict: consistent.**
- **Is it too complex/long for a constitution?** At ~14 sections it is comprehensive. The *constitutional
  core* is §0–§3 + §10 (identity, philosophy, trust, hard rules) — those should rarely change. §8/§9/§12
  are operational truth that will move; they're clearly labeled as such. **Verdict: acceptable, but keep
  the operational sections from calcifying into "constitution."**
- **Missing philosophy?** Cross-checked against the seven pillars (trust over automation, simplicity,
  speed, contractor-in-control, employee-not-chatbot, company-vs-employee, ten-year). All present. Two
  blueprint principles I folded in lightly and should be watched: *"delight only from first-party data —
  never surveillance"* (§11 Phase 3) and *"credibility lives in the boring surfaces"* (implicit in the
  trust surface). **Verdict: complete, with two principles worth promoting if they keep getting tested.**
- **Where has implementation drifted from the vision?** Documented honestly in §14: the shipped
  vanilla-JS/paper app vs the canonical React/dark rebuild (14.1); stateless intake vs the v4 state machine
  (14.3); and — importantly — **my own just-shipped Launch-Readiness work diverges from the now-canonical
  blueprint §5** on four points (14.4). I flagged my own code as needing rework rather than hiding it.

## 4. What remains blocked

**Not by missing document content — by decisions and by four code artifacts.**

1. **The architecture & aesthetic decision (§14.1) — the biggest one.** The canonical V1 specs describe a
   **ground-up React/TypeScript rebuild** with a **dark surface system** (`#08080A`), a canvas orb, a token
   file, and reference `.jsx` prototypes. The shipped product is a **single-file vanilla-JS app** with the
   **light paper brand palette**. The founder must choose: (a) rebuild fresh in React/TS + dark, (b)
   retrofit the specs' *behavior* into the existing vanilla/paper app, or (c) hybrid — **and** rule on
   dark-vs-paper (the palette is protected). This governs cost, timeline, and the entire V1 build plan.
2. **The four reference builds (§14.5)** — `eden-intake-v3.jsx`, `eden-intake-v4.jsx`, `eden-intake-v5.jsx`,
   `login-handoff.jsx`. The specs say "port verbatim" the orb renderer (`ORB_PARAMS`/`SPEAK_PARAMS`), the
   handoff timing, and the state machine from these files. **They were not provided.** A faithful port is
   impossible without them; I will not reconstruct the canvas orb or handoff from prose.
3. **Rework of my shipped Launch-Readiness code (§14.4):** delete needs a 30-day grace + CSV/PDF export
   (I shipped immediate hard-delete); zero `window.confirm/prompt` (I used them); voice settings to the
   user profile cross-device (I used device `localStorage`); dual email identities (client-brand vs
   BidVoice). Small, but they contradict the now-canonical blueprint and should be scheduled before a V1
   merge.
4. **Founder ratifications owed** (Appendix A): rename Bid Brain→Eden across the deep docs; merge the
   Law-XV amendment into the Interaction Constitution; add the OS-vs-Chief-of-Staff note to
   `CONSTITUTION.md`; ratify one pricing line; update `CLAUDE.md`'s stale title.

## 5. Canonical documents still required

- **The four reference builds** above (§14.5) — the only *content* still missing. Everything else the specs
  described is now in `docs/specs/`.
- Everything previously listed as blocking (`eden-intake-final-spec`, `eden-voice-spec`,
  `bidvoice-v1-blueprint`, `sprint-package`, CPO audit, exec-review) **has been received and integrated.**

## 6. Completeness estimate

**As a document: ~92%.** Every section that can be written truthfully is written and sourced. The
remaining ~8% is not prose I'm withholding — it is (a) the four reference `.jsx` builds (needed to *build*,
not to *document*) and (b) the §14 decisions, which the Bible correctly leaves to the founder.

**As a build spec: gated.** The Bible now fully *describes* V1, but V1 cannot start until §14.1
(architecture/aesthetic) is decided and §14.5 (reference builds) is resolved. Those two unlock everything.

## 7. The one thing to decide first

If the board asked me for a single next action: **rule on §14.1.** Rebuild-vs-retrofit and dark-vs-paper
is the fork that every downstream estimate, timeline, and hiring decision hangs on. It cannot be inferred
from the specs — the blueprint itself says "palette locked" *and* specifies a dark palette. Only the
founder can cut that knot. Everything else in the plan is executable once it's cut.

*— End of executive review.*
