# BidVoice — The AI Operating System for Home-Service Businesses

> Not an estimating app. Not a CRM. Not a website builder. **An AI employee.**
> Every release must increase the value of every subscription.

**The filter (apply to every idea):** Does it **Save Time** or **Make More Money**?
If not, it doesn't ship. Period.

---

## The keystone architecture (the one move everything hangs on)

The website stops being something we *render on demand* and becomes a **living
entity the business writes to**:

```
structured content (profile + projects + pages + reviews)  →  rendered live
            ^ stored & grows                                   ^ always current
```

This resolves the "stored HTML vs. self-updating" contradiction: the **data** is
stored and accumulates; the **HTML** is always regenerated from it. So it's both
"stored" and "updates itself forever" — and portable later, because content is
clean data, not tangled markup.

Every future capability is just another **reader/writer of that spine**:
`company.bidvoice.ai`, project galleries, AI marketing, growth score, hosting,
custom domains, analytics, chatbot — all the same shape.

**Today:** `/c/:id` renders from profile. `site_about` (AI-written) is the first
piece of *stored structured content*. The spine has begun.

---

## Sequence (by Save Time / Make Money / risk — not by excitement)

### ✅ Shipped — the first dominoes
- Free site at `/c/:id` from the profile (hero, services, contact, lead form, SEO).
- **AI writes the site copy** (hero + About) from profile facts — anti-fabrication
  guardrails (no invented years/awards/reviews).
- Lead capture → contractor notified (in-app + email + webhook).
- "Request a custom site" demand signal (founder-visible) — the $500 upsell probe.

### NOW (low risk, high ROI) — finish the living website
- **Publish a finished job → portfolio.** On job completion: "Publish this project
  to your website?" One tap → AI writes a project description, photos become a
  before/after gallery, a `site_project` row is appended, the homepage/portfolio
  re-render. *The website updates itself.* (Design note: published-project photos
  need stable PUBLIC URLs — a deliberate, separate path from the app's expiring
  signed URLs. Get this right; don't rush it.)
- **AI Growth Score.** A coaching surface: ✅ website live · ✅ projects added ·
  ⚠ no reviews · ⚠ missing photos · ⚠ no recent content. Pure read of existing
  data, no AI dependency. Drives the behaviors that feed everything else.

### NEXT (after first real users)
- `company.bidvoice.ai` subdomains (subdomain routing → the same site entity).
- Reviews import (Google Places — read-only, display top reviews + rating).
- AI Marketing Manager — **approval-only** nudges: "I drafted a blog post from your
  last project," "spring promo page," "your GBP needs photos." Never auto-posts.
- Job-completion fan-out: review request sent · social drafts · follow-up +
  maintenance reminders scheduled — all from completing one job, all drafts.

### REVENUE LAYER (recurring upsell)
- Hosting + **custom domains + SSL** + website analytics. The DNS/SSL-provisioning
  infra project — real work, do it once a contractor has *paid* (the $500/▮mo tier).

### ARCHITECTURE-ONLY (build the seam, not the thing — yet)
- **Property intelligence** (ATTOM-style): sqft, lot, year built, parcel/tax →
  auto-populate jobs/estimates. Modular provider adapter; off until cost justifies.
- **Material intelligence partnerships** (Sherwin-Williams etc.): the camera scanner
  already exists; partnerships plug in as **optional, modular** providers — never
  hard-code one manufacturer.
- Integrations bus: Google Maps/Calendar/Gmail, Stripe, QBO, AI phone, route
  optimization, homeowner/agent/supplier portals — each a module on the spine.

---

## Where we deliberately push back (the discipline)
- **AI phone answering** & **full auto social posting**: high-effort, integration-
  heavy, lower near-term ROI than the website→portfolio→reviews loop. Earn later.
- **Auto-posting anything** without approval = brand/legal risk. AI generates a
  draft; the contractor approves. Always.
- **Frozen AI-generated HTML**: rejected — it can't self-update and can fabricate
  claims on a live page. AI writes *content into the template*, not raw markup.

---

## Sprint 12 — AI Website Engine (status)

**Built & shipped (real, tested):**
- `site_project` entity — a finished job published to the website (AI write-up +
  before/after photo refs). The spine now *accumulates content*.
- **"Publish this project to your website"** on a job → AI writes an SEO project
  description → chosen photos become a Before & After gallery on `/c/:id`.
- **Safe public photos** — `/pub/photo/:id` serves a photo ONLY if it's attached to
  a published project (`isPhotoPublic` gate). Private job photos still require the
  HMAC route. *Verified: an unpublished photo is 404 via /pub.*
- **Publish Website** button + branded slug (`<slug>.<BT_SITE_DOMAIN>`), site resolves
  by id **or** slug. **Connect Custom Domain** = UI stub (coming soon).
- **Name-agnostic:** base domain is one env knob (`BT_SITE_DOMAIN`) so locking the
  brand (BidVoice / Bidtranslator / …) is a one-line change — no rebuild.

**Architecture only — NOT built (per the ticket):**
- *Subdomain deploy* (`johnsfencing.bidvoice.ai`): wildcard DNS `*.<domain>` → our
  reverse proxy → resolve subdomain to `site_slug` → already-rendered `/c/:slug`.
  No new "deploy" step needed — the site is live the moment a project is published;
  the subdomain is just a vanity route over the same entity.
- *Custom domains + SSL*: contractor adds a CNAME → on-demand cert (Cloudflare/host
  ACME) → map hostname → `site_slug`. The recurring-revenue tier.
- *Portability / hosting providers* (Spaceship/Cloudflare/Netlify/static export):
  because content is **clean structured data**, a static-export adapter can render
  the same entity to flat HTML for any host later. Seam exists; not implemented.

**Decision blocking the deploy layer:** the **name** (`*.bidvoice.ai` vs
`*.bidtranslator.com`). The engine is built to flip on one env var once decided.

---

## The principle that keeps it alive
Every month, the contractor should feel their subscription got **meaningfully more
valuable** — a new draft, a better score, a published project, a fresh page — with
**one-tap approval**, never homework. The product should feel like an employee who
shows up having already done the work and just needs a yes.
