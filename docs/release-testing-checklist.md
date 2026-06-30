# Release Testing Checklist — every surface, every release

> Bid Brain / Bidtranslator is used and *shared* across many surfaces. A feature
> isn't "shipped" until it works **and unfurls** everywhere a contractor or a
> homeowner will encounter it. Run this list before each release.

## 1. App surfaces (does the feature work?)
- [ ] **Website** (desktop Chrome, Safari, Firefox)
- [ ] **iPhone** — Safari + installed PWA (home-screen)
- [ ] **Android** — Chrome + installed PWA
- [ ] **Voice path** — record → transcribe → AI build (real mic, both EN + ES)
- [ ] **Offline** — capture works with no network, syncs on reconnect
- [ ] **Hand-built path** — the same job can be built without the AI step

## 2. Share / unfurl surfaces (does the link look right?)
Paste `https://bidtranslator.com/` (and a contractor site link) into each and
confirm the OG card renders: image, title, description.
- [ ] **Facebook** (feed + Messenger)
- [ ] **Instagram** (bio/DM link preview)
- [ ] **LinkedIn**
- [ ] **X / Twitter** (summary_large_image)
- [ ] **iMessage** (rich link)
- [ ] **WhatsApp**
- [ ] **Discord / Slack**
- [ ] **Email** (Gmail, Apple Mail — image loads, not blocked)
- [ ] **SMS** (link is clean, no broken preview)

## 3. Refreshing cached previews
Social platforms cache OG data by URL. After changing the share image/copy,
bump the asset query (`og.png?v=N`) **and** re-scrape:
- [ ] Facebook/Messenger — [Sharing Debugger](https://developers.facebook.com/tools/debug/) → "Scrape Again"
- [ ] LinkedIn — [Post Inspector](https://www.linkedin.com/post-inspector/)
- [ ] X/Twitter — post a fresh link (Card Validator is retired; cache ~7 days)
- [ ] iMessage — caches aggressively; test from a device that hasn't seen the link

## 4. Money + privacy gates (never regress these)
- [ ] `margin` and `notes` never appear in the client view or the PDF
- [ ] Photos/PDFs only reachable via signed, expiring URLs
- [ ] Each account sees only its own data (ownership enforced server-side)
- [ ] AI provider key never reaches the browser (all AI via `/api/assist/*`)

---
_Owner: founder + Claude. Keep this list short enough that it actually gets run._
