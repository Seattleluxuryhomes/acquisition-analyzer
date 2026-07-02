# Launch Readiness Sprint — status

*Highest-priority pre-launch sprint. Production readiness only — no redesign, no new
features, no V2. Founder-approved scope. Reviewed existing implementation first;
anything already complete was left untouched.*

> **Status:** ✅ Sprint complete (code shipped to `claude/finish-building-tkauur`).
> **Governing rule for this sprint:** ship, don't redesign.

## Completed items

| # | Item | What shipped | Files |
|---|---|---|---|
| 1 | **Email verification** | `email_verified` + single-use `verify_token_hash`/`verify_token_exp` on `user`. Signup emails a 24h verify link (`Emails.verifyEmail`). `POST /api/auth/verify-confirm` (SPA `/verify` route) and `POST /api/auth/resend-verification`. In-app "verify your email" banner + Resend. | `src/db.js`, `src/auth.js`, `server.js`, `public/index.html` |
| 2 | **Change email** | `POST /api/account/email` → verify password, move address, **reset verification**, revoke other sessions, email a new verify link. Settings → "Email address" block. | `src/auth.js`, `server.js`, `public/index.html` |
| 3 | **Deactivate / delete account** | `deactivateAccount` (reversible: `status='deactivated'`, sessions revoked, sign-in blocked) and `deleteAccount` (permanent hard-delete; cascades across all 21 user-owned tables, `foreign_keys=ON`). `POST /api/account/deactivate`, `POST /api/account/delete` (requires typing `DELETE`). Settings → "Deactivate or delete account". | `src/auth.js`, `server.js`, `public/index.html` |
| 4 | **Setup-fee transparency** | Verified already handled by `src/billing.js` (`setup_fee` shown only when > 0; `setup_fee_base` drives a "waived" label for founders/referrals). Paywall + billing section already display it. **No change needed.** | `src/billing.js` (existing) |
| 5 | **Stripe fee transparency** | Disclosure line in the "Get paid" box: Stripe's standard processing fee (~2.9% + 30¢) is deducted by Stripe; **BidVoice adds nothing on top**. | `public/index.html` |
| 6 | **Public email only after verification** | New `publicProfileOf(user)` strips the contact email from the public website (`/c/:id`, `/f/:id`) until `email_verified=1`. Owner still sees their own email in Settings. | `server.js` |
| 7 | **Publish Website "Coming Soon"** | Cold-launch: the Publish button no longer flips the site live; it's clearly marked **(coming soon)** with a note that the preview works now (`View your website`). Server endpoint left intact for later. | `public/index.html` |
| 8 | **Hide desktop-only mobile prompts** | `isMobileDevice()` gate; "Add to home screen" now hidden on desktop (and when already installed). | `public/index.html` |

## Verification performed
- Inline SPA scripts parse (0 errors); `node --check` on `server.js`, `src/auth.js`, `src/db.js`.
- Server boots; `/api/health` and `/` return 200.
- **Auth-lifecycle unit test (10/10 pass):** unverified-on-signup · verify-token issue/confirm/clear · idempotent re-verify · change-email dup-rejection + address-move + verification-reset + password-required · deactivated sign-in blocked · delete hard-removes the row.
- Public site hides the email while unverified (HTTP check: 0 occurrences).
- `npm run brand-verify` clean. Headless load: all new client functions defined, 0 page errors.

## Notes / dependencies
- Email verification, welcome, change-email, and reset emails all **require `RESEND_API_KEY`** configured on the server. Without it, tokens are still created on demand (resend endpoint) but no mail is delivered — verification can't complete until mail is switched on. This is the one hard launch dependency for item 1/2/6.
- Account "reactivate" for a deactivated account is intentionally support-driven (`support@bidvoice.ai`) — no self-serve reactivation endpoint by design.
