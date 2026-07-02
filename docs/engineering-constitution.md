# The BidVoice Engineering Constitution
### Constitution → tests. Every principle maps to a build-failing test, or a named human owner.

> **Purpose (Operational Mandate, Deliverable 1).** This is how we ensure every line of code
> behaves like the Soul. Each constitutional principle below is mapped to an **automated,
> build-failing test** — or, where genuinely untestable, a **named human owner.** If it's not
> enforced by a test or owned by a person, it falls through the cracks. That's the whole point.
>
> **Status key:** ✅ ENFORCED (build-failing test, in `npm run verify` + CI) · ⚠️ GAP (test not
> yet built — the engineering backlog, ordered below) · 👤 OWNER (judgment/process, not testable).
> Sources: The Soul v1.0, the Data Constitution, the Bible, sprint acceptance criteria 1–25.
> Changes only with a principle or test change.

## A. Enforced today (build-failing — run `npm run verify`)

| # | Principle | Source | Test | Status |
|---|-----------|--------|------|--------|
| 1 | The Soul is never altered without a recorded amendment | Soul (frozen) | `scripts/soul-guard.mjs` (MD5 pin + `AMENDMENT:` gate) | ✅ |
| 2 | No autonomous outbound — nothing (word or dollar) leaves without the contractor's sign-off | Soul; Bible §3.7; Data §6 | `scripts/approval-gate.mjs` (17 send/charge/webhook sites, each classified) | ✅ |
| 3 | No pricing leakage — `margin`/`notes` never reach the client | Soul; hard-rule #2 | `scripts/constitution-tests.mjs` (public proposal leak check) | ✅ |
| 4 | Portability — the full record exports in one tap | Data §2 | `scripts/constitution-tests.mjs` (export completeness + scope) | ✅ |
| 5 | Isolation — no cross-tenant reads, ever | Data §3 | `scripts/constitution-tests.mjs` (cross-tenant read/patch/delete → 404; export scoped) | ✅ |
| 6 | Deletion is a 30-day grace + export, never an instant irreversible wipe | Data §5; Bible §14.4 | `scripts/constitution-tests.mjs` (grace window assertion) | ✅ |
| 7 | In-app modals only — zero `window.alert/confirm/prompt` | Bible §14.4 | `scripts/no-native-dialogs.mjs` | ✅ |
| 8 | Brand integrity — no retired name/domain, no wordmark drift | brand-steward | `scripts/brand-check.mjs` | ✅ |
| 9 | The app builds a bid by hand if AI is down | hard-rule #4 | `scripts/constitution-tests.mjs` (job created + priced with no AI key) | ✅ |
| 10 | One Eden — no user-facing identity variation ships | Soul; §14.6 (C-1) | `scripts/static-invariants.mjs` (fails if `aiIdentitySeg()` is called) | ✅ |
| 11 | The AI/provider key never reaches the browser | hard-rule #1 | `scripts/static-invariants.mjs` (bans secret key VALUES in `public/`) | ✅ |
| 12 | Photos/PDFs private via signed, expiring URLs | hard-rule #6 | `scripts/constitution-tests.mjs` (unsigned proposal PDF → 403) | ✅ |
| 13 | Beta decision metrics fire + aggregate | Mandate D2; AC19 | `Analytics.betaMetrics()` → `/api/admin/overview.beta` (instrumented events) | ✅ |
| 14 | Trust line renders exactly twice per account, never spoken | AC4 | `trustReviewOnce()` + greeting; render-count = 2 (manual/grep) | ✅ |

## B. Gaps — build these next (each becomes a build-failing test)

| # | Principle | Source | Planned test | Priority |
|---|-----------|--------|--------------|----------|
| 15 | Voice has ONE grep-verifiable dispatch site | sprint AC 14–16 | grep guard: exactly one speech-dispatch call site (`speechSynthesis.speak` is at one site today) | P2 |
| 16 | Every spoken string appears verbatim in the copy register (§6) | AC 16 | grep guard: spoken strings ⊆ the register | P2 |
| 17 | AI behavior regression — golden transcripts diffed on every model change | Mandate | fixture suite: canned transcripts → asserted structured output; needs an AI key in CI | P2 |
| 18 | Offline capture kill-test: record → kill app → restore signal → estimate arrives | hard-rule #3; AC 8 | device/browser harness (Playwright) | P2 |
| 19 | <100ms interruption: any tap/talk cancels audio, action proceeds | AC 11 | device/browser harness | P3 |
| 20 | Approval audit trail retained 7 years, visible to the contractor | Data §6 | test: signature/approval rows persist + are surfaced; retention policy check | P3 |

## C. Human owners — judgment/process, not testable

| # | Principle | Source | Owner |
|---|-----------|--------|-------|
| 19 | The content/telemetry line — where ambiguous, it is content | Data §4 | Ben (doc owner) + engineering lead |
| 20 | Model training on customer content only with explicit, unbundled, default-off opt-in; pricing never trains shared models | Data §4 | Ben — no shared-model training exists today; any proposal routes through Ben before code |
| 21 | Homeowner never contacted, marketed to, profiled, or built into an audience | Data §7; Soul | Ben — no homeowner-outreach surface exists; guard if one is ever proposed |
| 22 | Homeowner legal-request handling (access/deletion), notice to contractor | Data §7 | Ben + counsel |
| 23 | Subprocessor public list; announce before new processors touch content | Data §10 | Ben |
| 24 | Breach disclosure — contractors hear it from us first, plainly (incident process) | Soul; Data §9 | Ben — **process not yet written (Fable gap); owed a one-page runbook** |
| 25 | Consent/Terms/Privacy/AUP legal review before launch | hard-rule #8 | Ben + counsel |

---

**How this is run.** Section A is `npm run verify` (and the Quality CI workflow) — a red bar blocks the
build. Section B is the engineering backlog, ordered by priority. Section C items are named humans; each
must be able to answer "how is this enforced?" without pointing at memory. This document amends only when
a principle or a test changes.
