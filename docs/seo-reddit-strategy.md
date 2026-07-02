# BidVoice — Reddit & Long-Tail SEO Strategy (v1)

> **Status:** working marketing playbook (not a constitutional doc). Governed by
> `docs/product-principles.md` and `docs/brand-steward.md`. The test for every tactic
> here: *would a contractor trust us more, or less, after seeing it?* If less, we don't do it.

## The insight we're actually chasing

Contractors (and the homeowners hiring them) increasingly append **"reddit"** to Google
searches — *"best estimating app for contractors reddit"*, *"is BidVoice legit reddit"*,
*"how to bid a remodel reddit"* — because they want **honest peer opinion, not marketing**.
Google now surfaces Reddit threads near the top of many of these results.

There are only two honest ways to win that traffic:

1. **Earn a real, well-regarded presence on Reddit** so authentic threads that mention us
   rank — and say something true and good.
2. **Publish genuinely useful content of our own** (the `/guide` page, comparison posts)
   that can rank for the long-tail *and* for the `[keyword] reddit` variants.

You **cannot** win it by putting the word "Reddit" into our own meta tags or page copy.
That's keyword-stuffing a third party's brand: it doesn't rank, it risks a Google
spam-policy penalty on the whole domain, and it reads as exactly the kind of cleverness
our brand is built against. **We will not do that.** (See "What we will not do," below.)

---

## Hard guardrails (non-negotiable — these come straight from the Soul/product principles)

- **No astroturfing.** No fake accounts, no sock-puppets, no pretending to be an
  independent contractor recommending ourselves. Every account discloses affiliation.
  *Trust over cleverness; never fabricate.*
- **No review manipulation.** We never post or solicit fake "is it good?" threads or
  upvote rings. If contractors love it, they'll say so on their own.
- **Follow each subreddit's rules and the 9:1 rule.** For every one time we mention
  BidVoice, we contribute nine times with genuine help and no pitch. Most trade subs ban
  overt promotion — respect that or get the account (and the brand) burned.
- **Lead with the honest product.** Our real edges are true and worth talking about:
  voice → structured bid in ~2 min, works offline on site, bilingual (ES/EN), margin/
  notes always private, free to try. We never oversell what V1 does.
- **A ban is a brand event.** A shadowban or a "spammer" callout in r/Contractor is worse
  than zero presence. Slow, real, and useful beats fast and promotional every time.

---

## Target subreddits

| Subreddit | Who's there | How we show up (honestly) |
|---|---|---|
| r/Contractor | GCs, remodelers, subs | Answer bidding/estimating/pricing questions; mention the tool only when directly relevant and disclosed |
| r/Construction | Broad trades | Genuine help on takeoffs, scope, client proposals |
| r/smallbusiness | Owner-operators | "How I stopped writing bids at 10pm" angle — process first, tool second |
| r/Entrepreneur | Solo/founders | Building-in-public / lessons; never a straight ad |
| r/HomeImprovement | **Homeowners** | Homeowner-side value (what a good proposal/deposit flow looks like) — feeds the contractor-website channel |
| r/Roofing, r/Concrete, r/Flooring, r/HVAC, r/electricians, r/Plumbing, r/Carpentry | Trade-specific | Trade-accurate answers; our per-trade language is a real differentiator |
| r/Remodel, r/Renovations | Project owners + pros | Scope/pricing clarity questions |

**Bilingual:** small but real — r/construccion and Spanish-language contractor groups map
directly to our ES/EN differentiator. Low volume, high relevance.

Rule of thumb: **build karma and standing for 4–6 weeks before the first product mention**
in any sub. Cold-pitching a new account is the fastest way to get us banned.

---

## Long-tail keyword map (trade × intent × modifier)

We already answer the top-of-funnel questions on `/guide` (see below). The long-tail is
**trade × intent**, and each has a `... reddit` variant people actually type:

- **Intent — "how do I":** `how to write a bid fast`, `how to bid a [roofing|concrete|
  remodel|fencing] job`, `how to price a renovation`, `how to send a professional proposal
  to a client`, `how to estimate a job as a new contractor`.
- **Intent — "app / software for":** `estimate app for contractors`, `bid app from my
  phone`, `contractor proposal software for small business`, `voice to estimate app`,
  `estimating app that works offline`, `free contractor estimate app`.
- **Intent — "best / vs / legit" (the reddit-modified core):** `best estimating app for
  contractors reddit`, `best bidding software for small contractors reddit`, `[competitor]
  alternative reddit`, `is BidVoice legit reddit`.
- **Bilingual:** `presupuesto rápido para contratistas`, `app para hacer presupuestos de
  construcción`, `cómo hacer un estimado para un cliente`.

**Where each lives:**
- *How-to & app-for* intents → on-page, honest, in the `/guide` FAQ (shipped; expanded).
- *Best/vs/legit reddit* intents → **off-site**: real Reddit threads + (optionally) an
  honest, non-gimmicky comparison page that earns the ranking on merit.

---

## On-page support already shipped (this change)

- **`/guide` FAQ expanded** with real long-tail questions (`src/guidePage.js`): best
  phone estimate app, free-to-try, bidding as a new contractor, pricing a remodel, sending
  a proposal from your phone, fast on-site estimating. Each is an honest answer that
  doubles as a support doc **and** feeds the `FAQPage` structured data (more rich-result
  surface). No brand-stuffing, no invented claims.
- **`/guide` added to `sitemap.xml`** — our best evergreen page was previously missing from
  the sitemap entirely. `/how-it-works` and `/faq` are aliases that share `/guide`'s
  canonical, so only `/guide` is listed (no duplicate-content signal).

### Known white-hat gaps to decide on next (not done here — your call)
- **Domain drift:** `sitemap.xml` and `robots.txt` hardcode `bidvoice.ai`, while the app
  serves from a dynamic base URL and there's history around `bidtranslator.com`. A sitemap
  pointing at the wrong host is worse than none — confirm the one canonical domain before
  we drive links to it.
- **Per-trade / per-city landing pages** (`/estimates/roofing`, etc.): high long-tail
  upside, but it's net-new surface — a post-beta decision, not an RC-window change.

---

## Content plan & cadence (lightweight, sustainable)

1. **Be useful first.** One genuinely helpful Reddit answer/comment most days in a target
   sub — no link, no pitch. This is 90% of the work and builds the standing everything else
   depends on.
2. **Evergreen owned content.** Keep `/guide` fresh; consider one honest, well-researched
   comparison post ("what contractors actually recommend for estimating") only if we can
   make it genuinely fair — including where we're *not* the best fit.
3. **Real stories, disclosed.** When a beta contractor has a real win, a *disclosed*
   build-in-public post can be honest and welcome. Never fabricated.
4. **Answer the branded questions truthfully.** When "is BidVoice any good?" shows up,
   a disclosed, straight answer (including limits) beats silence or spin.

---

## Measurement

- **Referral traffic** from `reddit.com` and Google (segment by landing page).
- **Branded-search lift:** are more people googling "BidVoice" over time?
- **Signup source:** we already capture `ref`/role at signup — attribute reddit-driven
  signups where we can and watch their week-2 retention (our beta north-star metric).
- **Reputation, not just clicks:** the sentiment of BidVoice mentions in target subs is the
  real KPI. One "these folks actually helped me" thread is worth more than 100 clicks.

---

## What we will NOT do (explicit)

- ❌ Put the literal word "Reddit" into our meta tags, keywords, or page copy to try to
  rank for it. (Spam-policy risk + off-brand; it doesn't even work.)
- ❌ Create fake accounts, fake reviews, upvote rings, or pretend to be independent users.
- ❌ Cold-pitch the product in subs where we haven't earned standing, or ignore a sub's
  self-promo rules.
- ❌ Overstate what V1 does. Every claim we make on or off Reddit has to survive a real
  contractor testing it the next day.

The whole point of the "reddit" search is that people trust it *because it isn't
marketing.* The only durable way to win there is to deserve it.
