# Billing, Referrals & Founding Members — implementation reference
### Canonical. Conforms to The Soul of BidVoice, BidVoice Bible v1.1, and Commercial Architecture v1.0.

This is the source-of-truth engineering doc for the commercial architecture as **built**. It
replaces the retired per-sub "crew network" pricing everywhere it was described. Stripe is the
source of truth for money; our tables are the source of truth for *why* a credit exists.

---

## 1. Pricing model — one subscription per company
- **Per company, unlimited internal users.** One subscription covers the whole company
  (owner, estimator, office manager, PM, foremen). There is **no per-seat charge and no
  per-seat limit** anywhere in the code. Eden works for the company, not a seat.
- **No dynamic pricing.** A company's bill never changes because another company churns. The
  old model (`−$10 per paying sub, free at five, re-synced on every churn`) is **removed**.
- **Stripe is the source of truth for price.** The app does not compute or override the charged
  price; it reads Stripe. `BT_BASE_PRICE` is only a pre-subscription display fallback.
- **Two tiers max** (Commercial Architecture §9): **Eden** (today) and **Eden Front Office**
  (the answered phone — surfaced as "coming soon"). No third tier, no seat tiers.

> Note on "internal users": the subscription is *priced* per company with unlimited users. A
> full multi-user-login-under-one-company auth system (shared accounts with roles) is a
> separate future capability, not a billing concern — nothing in billing charges or caps users,
> so the commercial rule holds today regardless. The existing crew/dispatch feature (`sub`
> table) is collaboration only and no longer touches pricing.

## 2. Referral system — give a month, get a month
- **Referred company:** first month **free** — a once-100%-off Stripe coupon (`btwelcome100`)
  applied at their checkout. Recorded in the ledger as a `referee_welcome` row (audit).
- **Referrer:** earns **one month of credit** once the referred company **pays their second
  invoice** (their first real payment, since month one was free) — i.e. they are a paying
  customer through month two. A `referrer_reward` ledger row + a Stripe **customer-balance
  credit** that auto-applies to the referrer's next invoice.
- **Cap:** **12 referrer rewards per calendar year** (`YEARLY_REWARD_CAP`). Enforced in the
  ledger before granting; surfaced in-app ("N left this year" / "you've hit this year's 12").
- **Credits never expire** while the subscription is active (they live as Stripe customer
  balance), **apply to future invoices only**, **never reduce an invoice below $0** (Stripe
  floors it; leftover rolls forward), are **non-transferable** and **never cash**.
- **No lifetime-free subscriptions. No dynamic churn pricing.** Both explicitly removed.
- **Eden never makes the referral ask** (Soul): prompts come from BidVoice UI surfaces, never
  from Eden's voice.

### The month-two trigger
On every subscription `invoice.paid` (or `invoice.payment_succeeded`) that moved **real money**
(`amount_paid > 0`), `billing.js` calls `grantReferrerReward()`. Because month one is free (the
welcome coupon), the referred company's **first `amount_paid > 0` invoice is month two** — so the
grant fires exactly when they become a paying customer. This is deliberately **not** a fragile
counter: the grant is gated by `rewardExistsFor()` + the `UNIQUE(referee_id, kind)` index, so
duplicate events (Stripe fires both `invoice.paid` *and* `invoice.payment_succeeded`), webhook
redeliveries, and later invoices are all safe no-ops, and a transient failure simply re-fires on
the next paid invoice or redelivery. `$0` invoices (the welcome invoice, prorations, plan tweaks)
never trigger it. (`user.paid_invoice_count` exists but is not part of the trigger.)

## 3. Referral credit ledger (the audit spine)
Table `referral_credit` — append-only, one immutable row per credit:

| column | meaning |
|---|---|
| `id` | `rc_…` |
| `user_id` | who the credit belongs to (referrer, or referee for a welcome) |
| `kind` | `referrer_reward` \| `referee_welcome` |
| `referee_id` | the referred company (identifies the triggering account) |
| `amount_cents` | credit value = one month, positive cents |
| `status` | `earned` → `applied` (or `void`) |
| `stripe_txn_id` | Stripe customer-balance-transaction id (for the reward) |
| `reason` | `month_two_completed` \| `signup_welcome` |
| `year` | calendar year earned — the 12/yr cap window |
| `created_at` / `applied_at` | timestamps |

- **Idempotency:** `UNIQUE(referee_id, kind)` — a re-delivered webhook cannot double-grant.
- **Auditability:** every earned and applied credit is a row; also included in
  `GET /api/account/export` so the contractor can audit their own credits. The Stripe side is
  independently auditable (customer balance transactions + invoices).
- **Determinism:** `src/referralCredits.js` is pure db+rules (grant, cap, summary). Stripe money
  movement lives only in `billing.js`.

## 4. Founding Member grandfathering
- On **any live subscription event while still unlocked** (`customer.subscription.created` /
  `.updated` with status active/trialing), `captureFoundingLock()` records the monthly price
  (cents) from Stripe into `user.founding_price_cents` and sets `user.founding_member = 1` — the
  **auditable record of what they locked in**. It runs on any live event (not just the exact
  none→active edge) and is idempotent, so out-of-order webhooks (`checkout.session.completed`
  arriving before `subscription.created`) can't cause it to be missed.
- **The lock is real via Stripe:** Stripe keeps an existing subscription on its original Price
  when you raise prices for new customers (point `STRIPE_PRICE_ID` at a *new* Price; never
  migrate existing subs). So the price is held **without any app-side override** and **without
  manual intervention**.
- **Cancel + return:** on full cancellation `clearFoundingLock()` nulls the lock; a returning
  customer re-checks-out at the then-current `STRIPE_PRICE_ID` = current pricing. Automatic.
- The setup fee is waived for Founding Members and referral signups.

## 5. Stripe configuration
Environment (see `.env.example`):
```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_PRICE_ID=price_…            # the CURRENT recurring monthly Price
STRIPE_WEBHOOK_SECRET=whsec_…
# optional: STRIPE_SETUP_PRICE_ID + BT_SETUP_FEE for the one-time activation fee
```
**Webhook events to enable** (Stripe Dashboard → Webhooks → your endpoint `/api/billing/webhook`):
- `checkout.session.completed`
- `customer.subscription.created`, `.updated`, `.deleted`
- `invoice.paid` **(required for the referral month-two grant)**
- (`invoice.payment_succeeded` is also handled if you prefer it)

**Coupons** are created automatically the first time they're needed (`btwelcome100`). No manual
coupon setup.

**Raising the price later (protecting Founding Members):** create a NEW Stripe Price and set
`STRIPE_PRICE_ID` to it. New signups pay the new price; existing subscriptions stay on their old
Price (Stripe never auto-migrates). Do **not** run a subscription price-migration on existing
customers.

## 6. Billing flow (happy path)
1. Contractor signs up → 14-day card-free in-app trial.
2. They subscribe → `createCheckout()`; if referred and unclaimed, the `btwelcome100` coupon
   makes month one free.
3. `checkout.session.completed` + `customer.subscription.created` → subscription recorded,
   Founding lock captured, setup fee marked paid.
4. Each `invoice.paid` increments `paid_invoice_count`. The referred company's 2nd paid invoice
   → `grantReferrerReward()` → ledger row + Stripe balance credit on the referrer.
5. The referrer's next invoice auto-applies the credit (never below $0).
6. On cancellation → Founding lock cleared; a later return gets current pricing.

## 7. Edge cases handled
- **Double-delivered / dual webhooks:** Stripe fires both `invoice.paid` and
  `invoice.payment_succeeded`, and may redeliver — all are safe no-ops via `rewardExistsFor()` +
  `UNIQUE(referee_id, kind)`. No counter to skew; no double-grant; no early grant.
- **$0 invoices don't count:** the welcome ($0) invoice, prorations, and plan-change invoices
  have `amount_paid = 0` and never trigger the reward — so the reward can't fire before a real
  payment.
- **Abandoned checkout:** the welcome ledger row is written on `checkout.session.completed`, not
  at session creation, so an abandoned checkout doesn't burn the referred company's free month.
- **Out-of-order subscription events:** the Founding lock captures on any live event while
  unlocked, so `checkout.session.completed` arriving first can't cause a missed lock.
- **Transient failure at the grant:** the grant re-fires on the next paid invoice/redelivery
  (idempotent); if the ledger row is written but the Stripe credit push fails (or the referrer
  has no customer yet), the row stays `earned` and **`reconcileReferralCredits()` re-pushes it on
  the next boot** — logged, never silently lost.
- **Concurrent referees, same referrer:** the cap check and ledger insert run synchronously with
  no `await` between them (the price is resolved first), so two simultaneous grants can't both
  slip past the 12/year cap.
- **Cap reached:** the 13th referral in a calendar year records nothing (hard cap, by design) and
  the referral screen shows "you've hit this year's 12".
- **Self-referral / re-attribution:** `setReferrer()` blocks self-referral and never overwrites
  an existing attribution.
- **Credit exceeds an invoice:** Stripe floors the invoice at $0 and rolls the remainder forward.
- **Billing not configured:** all Stripe paths no-op; the app runs free/entitled.
- **Missing price at grant time:** `monthlyCentsFor()` falls back Founding → Stripe price →
  `BT_BASE_PRICE`.
- **Refunds / chargebacks (accepted limitation):** if a referred company's month-two payment is
  later refunded or disputed, the referrer keeps the credit (the ledger has a `void` status
  reserved for wiring this later). Low frequency; clawing back a granted referral credit is
  itself user-hostile, so v1 does not.

## 8. Migration strategy (existing accounts)
- **New schema is additive** (`referral_credit` table; `founding_price_cents`,
  `founding_member`, `paid_invoice_count` columns) — `ensureColumns` adds them on boot; no
  destructive migration, no downtime.
- **Existing per-sub discounts (grandfathering):** the old code applied a recurring `btref*`
  amount-off coupon to a GC's live subscription. We **stopped syncing it** — the coupon simply
  **freezes at its current value** on the subscription (it no longer moves with churn, which is
  itself the fix). No existing customer's bill goes **up** because of this change (Soul: never
  betray early customers). Optional cleanup: once comfortable, remove frozen `btref*` coupons in
  Stripe and issue the equivalent as a one-time balance credit — **not required** for launch.
- **Founding locks backfill:** existing active subscribers have `founding_price_cents = NULL`
  until their next `subscription.updated`/`invoice.paid`, at which point activation capture is a
  no-op (only captures on the none→active transition). To lock current actives immediately, run
  a one-time backfill reading each active subscription's amount into `founding_price_cents`
  (see §9). Not required — Stripe already grandfathers their Price.

## 9. Remaining manual / operational steps
1. **Set the price in Stripe** and point `STRIPE_PRICE_ID` at it (the number is a founder
   decision per the Commercial Architecture — validate in beta).
2. **Enable the webhook events** in §5 (especially `invoice.paid`).
3. **(Optional) Backfill** `founding_price_cents` for existing active subscribers and retire
   frozen `btref*` coupons — cosmetic; Stripe already holds their Price.

Reconciliation of earned-but-unpushed credits is **automatic** — `reconcileReferralCredits()`
runs on every boot and re-pushes any `referrer_reward` row with a null `stripe_txn_id` once the
referrer has a Stripe customer. No manual step.

## 10. Constitutional conformance
- **Soul:** no data hostage (ledger in export), never betray early customers (Founding lock +
  frozen discounts), peace-of-mind (no churn-driven bill swings), Eden never sells.
- **Bible v1.1:** no autonomous outbound (the subscription/deposit Checkout sites are
  `APPROVAL: contractor-action` / `client-action`, guarded by `scripts/approval-gate.mjs`).
- **Commercial Architecture v1.0:** per-company + unlimited users (§6), give-a-month/get-a-month
  capped referrals (§5), Founding Member rate-lock (§4/§10), payments untouched (§2 Layer 3),
  two-tier max, homeowners never billed.
