# BidVoice — Production Trust, Onboarding & Compliance Audit

*Date: 2026-07-02. Pre-launch pass. Legend: ✅ done · ◑ started/partial · 🔲 needs founder decision or infra/counsel.*

## 1. Branded emails ✅ (system) / ◑ (wiring)
- **New premium email system** (`src/emails.js`): shared responsive, dark-mode-friendly, table-based
  shell with the BidVoice logo, amber CTA, and a Terms/Privacy/Support footer — rendered and verified.
- **All 8 templates built:** Verify Email · Welcome · Password Reset · Invitation · Estimate Shared ·
  Proposal Viewed · Proposal Signed · Deposit Received. Each returns `{subject, html, text}`.
- **Wired to live send points:** ✅ Password Reset (`/api/auth/reset`) · ✅ Invitation (contractor
  onboarding) · ✅ Welcome (on signup, fire-and-forget). These replace the old plain templates.
- ◑ **Ready to wire (event points exist; not yet hooked):** Verify Email (needs a verification flow —
  see §5), Estimate/Proposal Shared (on proposal send), Proposal Viewed (on client open), Proposal
  Signed (e-sign webhook), Deposit Received (payment webhook). Templates are production-ready; wiring
  each is a 1–3 line call at the existing handler.
- 🔲 Requires `RESEND_API_KEY` + a verified `bidvoice.ai` sending domain to actually deliver (env-gated
  — nothing breaks without it; emails simply no-op).

## 2. Legal pages ✅
- **5 pages live, branded, crawlable, no dead links:** `/terms`, `/privacy`, `/acceptable-use`,
  `/cookies`, `/disclaimer` (`src/legal.js` + routes in `server.js`, registered before the SPA
  fallback). Responsive + dark-mode-friendly; each carries a truthful trust strip and a footer.
- **Professional starter content** written for a US SaaS serving contractors, with an honest
  "Starter document — not yet reviewed by counsel" banner on every page. 🔲 **Needs legal review**
  before launch (as the founder acknowledged).

## 3. SMS / TCPA compliance ✅
- Added the exact opt-in disclosure wherever the **contractor provides their own** mobile number:
  onboarding phone field and Settings → Phone. Text: *"By providing your mobile number, you agree to
  receive transactional and account-related text messages from BidVoice. Message and data rates may
  apply. Reply STOP to unsubscribe or HELP for assistance."* (EN + ES.)
- Also stated in the Privacy Policy. Note: customer/sub/vendor numbers a contractor enters are
  third-party — consent for those is the contractor's responsibility, disclosed in Terms/AUP.
- 🔲 If **marketing** texts are ever enabled, add a **separate** marketing-consent checkbox (kept
  distinct from transactional per the founder's instruction).

## 4. Footer ✅
- Legal footer added to **every public page**: landing (EN + ES) and the app's login/signup screen.
  Includes **Privacy Policy · Terms of Service · Contact · Support · © BidVoice AI**.

## 5. Authentication ◑
- ✅ **Session expiration** — sessions carry `expires_at`; expired tokens return 401 and are purged.
- ✅ **Password reset** — full flow: request → single-use token (1h) → new password → all sessions
  revoked. Present on the **login screen** ("Forgot password?").
- ✅ **Failed login handling** — generic error, no account enumeration; reset endpoint never reveals
  whether an account exists.
- ✅ **Account/invite confirmation** — 7-day set-password invite link.
- ◑ **"Secure cookies"** — N/A as written: auth uses a **bearer token in localStorage**, not cookies.
  This is a valid model; there are no insecure cookies to fix. (If we ever move to cookie sessions,
  set `HttpOnly; Secure; SameSite=Lax`.)
- 🔲 **Email verification required** — **not implemented**, and it's a **product decision**: mandatory
  verification adds friction that fights the "ready in 60 seconds" onboarding. Recommended:
  *verify-on-first-send* (let them in immediately; require a verified email before sending proposals
  or receiving payouts). The **Verify Email** template is already built for whichever path is chosen.

## 6. Trust ✅
- Truthful trust strip on all legal pages: **🔒 SSL secured · 🛡️ Encrypted in transit (TLS) · 👤 Your
  data stays private · ⚡ AI-powered by Eden.** Only claims we can stand behind — no fabricated
  certifications (no "SOC 2 / HIPAA" etc. until real).

## 7. Contact ✅ (referenced) / 🔲 (delivery)
- `support@bidvoice.ai`, `privacy@bidvoice.ai`, `legal@bidvoice.ai` referenced in legal pages, footers,
  and emails. 🔲 These are **placeholders until DNS + inboxes exist** — set up mailboxes/forwarding
  before launch so they're monitored.

## 8. Production audit (codebase scan) ✅ — clean
Searched user-facing files for: TODO, FIXME, Lorem Ipsum, Placeholder, Example Company, Test, Dummy,
BidTranslator, broken/temporary assets, old logos.
- **No real placeholders or unfinished user-facing copy.** Findings were all false positives:
  - `todo` → Spanish "todo" (= "all/everything") and `todayKey()`/`todayISO()`.
  - `ACME` → the Let's Encrypt **ACME** SSL challenge path (`/.well-known/acme-challenge/`), not a
    placeholder company.
  - `bidtranslator` → allowlisted **internal** names only (SQLite filename, dev signing seed,
    FollowUpBoss/QuickBooks system keys) — never user-facing; guarded by `brand-check`.
  - `Your Company` → the contractor's own **default** company name until they set theirs (replaced on
    setup); shown as "Your business" on the dashboard fallback.
- **Old logo / favicon:** fixed this pass — favicon reverted to the transparent orange B; app-icon
  square tile retained only for PWA/home-screen.
- `npm run brand-verify` (retired-branding + wordmark audit **and** asset-drift) → **clean**.

---

### Launch blockers that are NOT code (founder/infra/counsel)
1. **Deploy the branch** (everything above is invisible until live — still the #1 issue).
2. **Legal review** of the 5 starter pages.
3. **Email domain** (`RESEND_API_KEY` + verified `bidvoice.ai`) and the three **contact mailboxes**.
4. **Decide the email-verification policy** (recommend verify-on-first-send).
