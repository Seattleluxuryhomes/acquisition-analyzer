# Referral Migration Plan — perpetual credit ladder → capped give-a-month/get-a-month
### ✅ IMPLEMENTED (2026-07-02). Conforms to the Soul + Commercial Architecture v1.0.

> **Status: shipped.** The founder ratified all open decisions below and directed full
> implementation. Built as: `src/referralCredits.js` (ledger), `src/billing.js` (Stripe wiring
> + Founding lock), schema in `src/db.js`, UI in `public/index.html`. Engineering reference and
> operational runbook: **`docs/billing-and-referrals.md`**. Founder decisions as built: crew/
> network model **replaced** (per-company, unlimited users); referee reward = **first month
> free**; month-two trigger = **2nd paid invoice**; cap = **12/calendar year**; existing per-sub
> discounts **frozen in place** (never raised). The plan text below is kept as the design record.

## 1. Why
The Commercial Architecture (`docs/00-bidvoice-bible/bidvoice-commercial-architecture-v1.0.md`, §5)
**rejects** the currently-shipped referral mechanic and prescribes a bounded replacement.

- **Shipped today (`src/referrals.js`):** `effectiveMonthly = base − $10 × (active paying subs)`, floored at
  $0 (free at 5). The credit is **perpetual and reactive** — if a referred/crew sub churns, the credit comes
  off and **the GC's bill rises again.**
- **The doc's objection (verbatim):** *"someone's bill changes when someone else churns —
  anti-peace-of-mind."* A company selling peace of mind cannot send a bill that moves because of a third
  party's action.
- **Prescribed model:** *give a month, get a month* — the referred company gets their **first month
  credited**; the referrer gets **one month credited per referral that converts and completes month two**,
  **capped at 12 credits/year.** Bounded liability, both sides win, fraud limited by the cap + month-two
  condition.

## 2. Scope & a naming clarification (needs a founder call — see §7)
The shipped code overloads one mechanism for **two different jobs**:
1. **Referral reward** (task #10) — thanking a GC for bringing another *company* onto BidVoice.
2. **Crew/network discount** (task #11) — "free while your crew is active," where a GC's *subs* are separate
   paying accounts that discount the GC.

The Commercial Architecture treats these as distinct: referrals become **capped month-credits**, and team
members become **"per company, unlimited people"** (a crew is just users under one company, not a discount
lever). This plan migrates the **referral reward**; it *flags* the crew-discount/network-engine question as
a separate, larger decision (§7) rather than silently unwinding task #11.

## 3. Target model (referral reward)
- **Unit of value:** a **month credit** = one month of the account's own effective base price, applied to the
  next invoice (Stripe `customer_balance` / coupon or an internal ledger that nets against `effectiveMonthly`).
- **Referred company (referee):** first month credited automatically on conversion (their first paid month is
  $0), **or** $1,500-Hiring-Eden → the doc suggests "$199 off Hiring Eden" as the *better* referee reward
  because it funds activation. (Founder choice — §7.)
- **Referrer:** **+1 month credit** when a referred company (a) converts to paid **and** (b) completes
  **month two** (i.e., a second successful invoice). **Cap: 12 credits / rolling 12 months.**
- **Never reactive:** once granted, a credit is **permanent** — a later churn by the referee does **not**
  claw it back. This is the whole point (peace of mind).
- **Eden's voice excluded (constitutional):** referral prompts fire only from BidVoice UI surfaces at moments
  of earned pride (proposal accepted, payment landed) — **never** spoken by Eden. (Already the pattern; keep
  it.)

## 4. Schema changes
New table (append-only ledger — auditable, never mutated in place):
```
referral_credit(
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,        -- who receives the credit (referrer or referee)
  kind          TEXT NOT NULL,        -- 'referrer_reward' | 'referee_welcome'
  referee_id    TEXT,                 -- the referred company (for referrer_reward)
  months        INTEGER NOT NULL,     -- +1 (grant) ; ledger stays positive, consumption tracked separately
  reason        TEXT,                 -- 'month_two_completed' | 'signup_welcome' | 'grandfather'
  created_at    INTEGER NOT NULL,
  consumed_at   INTEGER               -- null until applied to an invoice
)
```
- Keep `user.referred_by`, `user.referral_code` (attribution unchanged).
- Add `user.grandfathered_monthly` (INTEGER, nullable) — see §5.
- Retire (or freeze) `BT_REFERRAL_CREDIT` per-sub math from `effectiveMonthly` **only after** §7 is decided.

## 5. Grandfathering (Soul: never betray early customers)
Some live accounts currently pay a **reduced** effective price from the per-sub ladder. Yanking that to full
base would be exactly the betrayal the Soul forbids.
- **On migration:** for every account whose `effectiveMonthly < base` today, **freeze their current effective
  rate** into `grandfathered_monthly` (functions like a mini Founding-Member lock). Their price never rises
  because of this change.
- New referral credits stack **on top** of the grandfathered rate.
- Emit a one-time in-app note: *"Your crew discount is now locked in — it can't go up."* (peace of mind made
  visible).

## 6. Credit-grant trigger (month-two condition)
- Hook the existing Stripe webhook (`invoice.paid` / `invoice.payment_succeeded`).
- On a referee's **second** successful paid invoice: if the referrer is under the 12/rolling-12-mo cap, insert
  one `referrer_reward` credit; else record `capped` (surface "cap reached" in the referrer's UI, no silent
  drop — the doc's no-silent-cap spirit).
- Referee welcome credit inserted at **first** paid invoice (or at signup if founder prefers first-month-free
  up front).
- `effectiveMonthly()` becomes: `grandfathered_monthly ?? base`, then **consume any unconsumed month credit**
  for the current cycle (mark `consumed_at`). Pure function + ledger read; still no Stripe inside referrals.js.

## 7. Open founder decisions (blockers before code)
1. **Referee reward:** first-month-free **or** "$199 off Hiring Eden"? (Doc leans Hiring-Eden because it funds
   activation; but Hiring Eden isn't built yet → first-month-free is the buildable V1.)
2. **Crew/network engine (task #11):** does "per company, unlimited people" **replace** the subs-as-separate-
   paying-accounts model, or do both coexist? This is the bigger architectural fork and affects
   `payingReferrals`, the sub dispatch flow, and the paywall ladder UI. **Recommend: keep task #11 as-is for
   beta, migrate only the referral reward now, revisit the network engine post-beta** (it's working revenue;
   don't unwind it under launch pressure).
3. **Cap window:** rolling 12 months vs. calendar year (recommend rolling — no year-end cliff).
4. **Existing pending "almost-free" accounts:** confirm the grandfather freeze (§5) is the desired kindness.

## 8. Rollout (once §7 answered)
1. Migration: add table + columns; backfill `grandfathered_monthly` for discounted accounts; one-time note.
2. Ledger read in `effectiveMonthly` + `referralStatus` (UI shows credits balance + cap, not a per-sub ladder).
3. Webhook grant on month-two; referee welcome credit.
4. Retire per-sub credit math (gated on §7.2).
5. Paywall/settings copy: "Give a month, get a month · up to 12 a year."
6. Tests: month-two grant, cap enforcement, no-clawback-on-churn, grandfather freeze, self-referral block.

## 9. What does NOT change
Attribution (`referral_code`/`referred_by`), founder rate-lock (`locked_monthly`), agent free-year channel,
Stripe-Connect payout economics, and the constitutional rule that **Eden never makes the referral ask.**
