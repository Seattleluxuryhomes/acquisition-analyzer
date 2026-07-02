# Constitutional Alignment Report — BidVoice Bible v1.0
### Reconciling the Bible and the shipped product against The Soul of BidVoice (frozen v1.0)

> **Authority.** The Soul of BidVoice (`docs/00-bidvoice-bible/the-soul-of-bidvoice-v1.0.md`, FROZEN v1.0,
> MD5 `e3453af1485dbf3d4b61d46a6de293c4`) is the supreme authority. This report documents every conflict
> found while completing **Bible v1.0**, and — per the founder's directive for the v1.0 completion window —
> **resolves each in favor of the Soul where appropriate**, so the Bible can be frozen consistent.
>
> **Go-forward protocol (now in force).** Bible v1.0 is frozen. From here, **any future conflict with the
> Soul is flagged and work stops** until an explicit founder amendment or decision. This report covers only
> the v1.0 reconciliation window.

## Method
Every chapter of `BIDVOICE_MASTER_SPEC.md`, plus the shipped product surface, was compared line-by-line
against the Soul. The Soul was preserved **unchanged** (byte-for-byte, checksum-verified). Where the Bible
or the code drifted, the Bible/code was corrected — never the Soul.

## Conflicts found and resolved

### C-1 · "One Eden" vs. the Name Trial System — RESOLVED in favor of the Soul
- **Soul (supreme):** *"there is one Eden… one character — the same employee in every truck, **never a
  brand voice to be borrowed, split into market variants, or optimized into someone else.**"*
- **Product / lower docs:** a **Name Trial System** (`AI_IDENTITIES`, `setAiIdentity`, the Settings
  identity switcher `aiIdentitySeg()`) let an account run the assistant under a different name/voice;
  `brand-standard.md` names Eden the default and public face.
- **Resolution (Soul wins):** **Eden is the one, fixed identity.** The user-facing Name Trial switcher is
  **retired** — it served its only legitimate purpose (a pre-launch experiment to *choose* the name; Eden
  won). The internal registry may remain as dead scaffolding, but **no user-facing identity variation
  ships.** *Action taken this cycle:* the identity switcher was removed from Settings; the default is Eden.
  *(Bible §14.6 updated from "flagged" to "resolved".)*

### C-2 · Mission & protected sentence — RESOLVED (Bible aligned to the Soul)
- **Soul:** mission *"Nothing falls through the cracks"*; protected sentence *"The business responded
  instantly. The human slept."*
- **Bible drift:** §1 led with the vision-doc line *"She already handled it."*
- **Resolution:** the Bible now leads with the Soul's mission and protected sentence; *"She already
  handled it"* is demoted to a supporting vision line. (§0.1, §1.)

### C-3 · Positioning altitude — RESOLVED (clarified, no contradiction)
- **Soul:** *"Not software, not automation… peace of mind… we build one thing: an employee worth
  trusting,"* and *"we will never become… a dashboard company, a feature list."*
- **Bible / brand:** *"BidVoice is the AI Construction Operating System."*
- **Resolution:** these are different altitudes. "AI Construction Operating System" is the **external
  category label**; the Soul is the **deeper truth**. The OS framing must never drift into "a dashboard
  company / a feature list," which the Soul forbids. (§0.1.)

### C-4 · Data portability — RESOLVED in favor of the Soul (code changed)
- **Soul:** *"We will never hold data hostage. Everything a contractor built with us leaves with him in
  one tap, whole,"* and *"no retention maze, no 'call us'."*
- **Shipped drift:** account delete was an **immediate** hard-delete with **no export**.
- **Resolution (Soul wins):** implemented a **full one-file export** (`GET /api/account/export`:
  profile, jobs, contacts, leads, price book, payments) and a **30-day-grace, self-serve delete** with a
  reversible window. Portability added to §10 as a **constitutional non-negotiable**. *Shipped this cycle.*

### C-5 · Approval gate, silence, honesty, openly-AI — VERIFIED ALIGNED (no change needed)
The Soul's *"never send a word or a dollar he hasn't approved,"* *"evenings returned, not time-in-app,"*
*"ship late before a guess,"* and *"an employee and an AI, openly, always"* were already embodied by the
Bible's no-autonomous-outbound invariant (§7, §10), Law XV / no-attention-farming (§1, §3), placeholder-
price / never-fabricate rules (§10), and the "employee not chatbot" identity (§3). Soul-derived rules for
*never hide a failure* and *never monetize Eden against the homeowner* were **added** to §10 for
completeness.

## Non-conflicts noted (spec-vs-code gaps, not Soul conflicts)
- **`window.confirm/alert/prompt` sweep:** the blueprint wants zero in the codebase; the sensitive account
  actions were converted to an in-app modal this cycle; **46 non-sensitive calls remain** — a bounded
  engineering follow-on with a build-failing CI grep. Not a Soul conflict.
- **Missing reference builds** (`eden-intake-v3/v4/v5.jsx`, `login-handoff.jsx`) — a delivery gap
  (Bible §14.5), not a Soul conflict.

## Outcome
With C-1…C-4 resolved in the Soul's favor and C-5 verified aligned, **BidVoice Bible v1.0 is consistent
with the Soul and is frozen.** Future conflicts: flag and stop.
