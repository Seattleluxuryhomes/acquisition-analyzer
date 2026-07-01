# Bidtranslator

A mobile-first app for small contractors: capture a job conversation by voice or
text, translate + structure it into a bid draft, price it privately, and send a
clean client proposal (PDF). First users are bilingual residential remodelers.

This repo **is** the app (Node/Express + built-in `node:sqlite`, no build step).
Start with `README.md` for how it's structured and `DEPLOY.md` to ship it.

> **Ship discipline:** all dev stays on the feature branch until the founder
> explicitly approves a merge — never merge to `main` without it. Run the
> `docs/release-checklist.md` review before every merge, and own quality
> continuously (audit + fix inconsistencies before being asked).
>
> **North star:** `docs/product-principles.md` governs every product decision —
> Bid Brain isn't a chatbot, it's the smartest employee in the company. The test
> for any feature: *would a contractor tell another contractor about this?* Trust
> over cleverness (never fabricate); remove work, don't add it; conversation
> absorbs complexity so the app gets *simpler* as it grows.

## Run

```bash
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY + a BT_SIGNING_SECRET (both optional to start)
npm start              # http://localhost:4000
```

## Hard rules (do not break)

1. The AI provider key never reaches the browser — all AI goes through `/api/assist/build`.
2. `margin` and `notes` are private — never in the client view or PDF. Enforced server-side via `src/proposal.js` `buildProposal()`.
3. Capture (voice/text/photos) works offline and syncs later.
4. The app still builds bids by hand if the AI step is down.
5. Each user can access only their own data — ownership checked on every endpoint.
6. Photos/PDFs are private — signed, expiring URLs only.
7. AI prices are placeholders; the contractor sets real numbers.
8. Consent/terms text is placeholder — needs legal review before launch.

## Layout

```
server.js            Express app + routes
src/                 db, auth, jobs, assist (AI proxy), proposal, pdf, files, billing
public/index.html    the offline-first front end
scripts/build-demo.mjs   regenerates the offline clickable demo
docs/                build spec, founder brief, prototype, demo, sample PDF
Dockerfile           production image (deploy via DEPLOY.md)
```

Build order and scope live in `docs/Bidtranslator-Rules-CLAUDE.md` and
`docs/Bidtranslator-Build-Spec.md`. Subscriptions (Stripe) are optional and
env-gated; see `README.md`.
