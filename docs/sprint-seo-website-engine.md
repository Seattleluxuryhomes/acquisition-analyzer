# Sprint — AI SEO Website Engine 2.0

> **Status: ISOLATED TRACK.** Built on `claude/seo-website-engine`, never merged to
> `main` until reviewed on a preview and explicitly approved. Production rollback
> point: branch `stable/prod-2026-06-29` (commit 49e20e5).

## Mission

Every generated contractor website should feel like it was custom-built by a
$10,000 agency — premium, trustworthy, modern, and unique. A visitor's first
thought should be "these people look professional," not "this is AI."

## The one trap we must avoid (read this first)

The fastest way to make a site read as *generic AI* is to generate **walls of
text**. "1,200-char About + 300 words per service × 28 trades" is exactly what
content farms produce, and Google + humans both smell it.

Premium agencies win on the **opposite of volume**:
- **Restraint** — less copy, more whitespace, bigger type.
- **Specificity** — one *true* local detail beats ten generic sentences
  ("graded the hillside lot off Highway 9 in Snohomish" > "we provide quality
  excavation services you can trust").
- **Real proof** — the contractor's own job photos, license #, real reviews.

So the engine's hard job is **specific + restrained**, not *more*. Every quality
rule below serves that.

## Approach: prove ONE trade, then scale (no boiling the ocean)

We do **not** generate 28 trades blind. We build **excavation** end-to-end —
gorgeous, on a preview URL — and judge it against the $10k bar. Only when it's
undeniable do we templatize and mass-produce. This protects against multiplying
a mistake 28×, and it's the fastest path to a real "wow."

### Phase 1 — Excavation vertical slice (this sprint)
- Full premium layout (hero, services, process, why-us, FAQ, service areas,
  reviews, trust badges, CTA, SEO footer) for one trade.
- Content engine that produces **specific, restrained** copy with real inputs
  (company, region, license, services, a few true details the contractor gives).
- Per-render variation so two excavation sites don't read identically.
- Full SEO head: meta, OG/Twitter, LocalBusiness + trade schema, heading
  hierarchy, ALT text.
- **Deliverable: a preview link Ben reviews.** Gate before Phase 2.

### Phase 2 — Trade library (after Phase 1 is approved)
- Templatize the proven structure across all trades (electrical, plumbing,
  roofing, painting, concrete, decking, fencing, GC, kitchen/bath remodel,
  landscaping, HVAC, flooring, tile, drywall, insulation, siding, windows,
  doors, garage doors, pressure washing, tree service, junk removal, masonry,
  solar, pools, cleaning … + future).
- Trade-specific service sets (e.g. plumbing → water heater, tankless, leak
  detection, repipe, drain cleaning, emergency, commercial, residential, pipe
  repair, fixture install).

### Phase 3 — Local SEO + page generation
- Weave real local data (city, county, state, nearby cities, neighborhoods,
  ZIPs, service radius) naturally — **never keyword-stuffed**.
- Per-service and per-location pages, XML sitemap, robots.txt, internal links.
- Requires a real local-data input/source — a genuine dependency, not magic.

## Quality bar (every generated site must pass)
- [ ] Reads human, not AI — a contractor would proudly send it to a client.
- [ ] At least one *specific, true* local/job detail in the copy.
- [ ] Uses the contractor's real assets (logo, license, photos, reviews) when present.
- [ ] No two sites read or look identical (varied structure, wording, order).
- [ ] Premium visual feel — big hero, beautiful type, generous spacing, subtle motion.
- [ ] Full SEO head + schema validates.
- [ ] Bilingual-ready (rides on the EN/ES site i18n already shipped).
- [ ] Mobile-first; fast (no heavy framework — keep the no-build ethos).

## Honest constraints (so we scope with eyes open)
- **Ranking is earned over months.** A beautiful site doesn't auto-outrank; it
  wins clicks and trust. Real SEO needs the local-data inputs + time.
- **AI content costs tokens.** Generate once and **cache** per contractor; never
  regenerate on every page view.
- **Photos are the real premium signal.** The engine should make it easy/required
  to use the contractor's own job photos; stock imagery cheapens it.

## Non-goals
- Not merging into `main` until Phase 1 is reviewed and approved.
- Not a hosting/platform play. This is the website *content + design* engine.
