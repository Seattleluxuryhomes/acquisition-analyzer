# CLAUDE.md — Bidtranslator

Read this first. It defines what we're building, the rules you must not break, and the order to build in.

## What this is

A mobile-first app for small contractors. A contractor captures a job conversation by voice or text, the app translates it and structures it into a bid draft, the contractor prices it, and sends a clean client proposal (PDF). Built first for bilingual residential remodelers (Spanish/English, Russian/English).

## Start from the prototype

`bidtranslator-app.html` is a working, tested front-end prototype and the functional reference for behavior, screens, and data shapes. **Keep its UI and flow.** Your job is to refactor it into a real, hosted, multi-device app — not to redesign it. Reuse the existing visual language (the design tokens and layout in that file).

`Bidtranslator-Build-Spec.md` is the detailed spec. This file is the short version of the rules.

## Stack (Path A — fastest to ship)

- Front end: keep the prototype's HTML/CSS/JS. Porting to a light framework (React) is acceptable **only if** the screens and flow stay identical. Don't rebuild the design.
- Backend: a managed service (Supabase recommended) for auth, database, and file storage.
- AI step: a single server-side function (e.g. Supabase Edge Function) that holds the provider key and exposes `/assist/build`.
- Optional later: wrap with Capacitor for iOS/Android from the same codebase.

## Hard rules — do not break these

1. **The AI key never touches the client.** The browser must never call the AI provider directly. All AI calls go through the backend function. (The prototype's `aiExtract()` calls the model from the browser — replace it.)
2. **`margin` and `notes` are private.** They must never appear in any client-facing response, the client view, or the PDF. Enforce this on the server, not just the UI.
3. **Capture works offline.** Voice, text, and photo capture must function with no connection and sync when one returns. The AI build step may require connectivity; capturing must not.
4. **The app still works if the AI is down.** A contractor can always build a bid by hand. Never let an AI outage block bidding. Degrade gracefully and tell the user.
5. **Data is isolated per user.** Enforce ownership on every endpoint. No user can read or write another user's jobs, photos, or settings.
6. **Files are private.** Photos and PDFs use signed, expiring URLs — never public links.
7. **AI prices are placeholders.** The model structures the job; it does not price it. Keep the UI clear that the contractor sets real numbers.
8. **Consent/terms text is placeholder.** Don't treat the current wording as final or legally sufficient.

## Data model

```
user = { id, email, company, name, phone, license, default_from_lang, default_to_lang }
job  = { id, user_id, title, from_lang, to_lang, transcript, translation, summary,
         assumptions[], exclusions[], notes(private), margin(private),
         status('draft'|'sent'), sent_at, created_at, updated_at }
line     = { id, job_id, position, desc, type('fixed'|'hourly'), price, hours, rate, furnished('you'|'client') }
upgrade  = { id, job_id, desc, price }
photo    = { id, job_id, url, created_at }
```

`bidTotal` = sum of line amounts where `furnished != 'client'`. An hourly line's amount is `hours * rate`; a fixed line's is `price`. Client-furnished lines show on the proposal but add $0 to the total.

## Build order

**Phase 1 (build this now, then stop):** accounts + sign-in; cloud-saved jobs synced across devices; the full Notebook → Build → Client view loop; server-side AI build; photo upload; server-rendered client PDF; offline capture with sync.

**Phase 2 (later):** contractor logo on the proposal; "sent" snapshot so a sent bid isn't silently edited; client-facing proposal translated into the client's language; saved reusable line items/rates.

**Phase 3+ (not now):** bid revisions/versioning; e-signature; optional contractor-controlled standby-cost clause; product links for client-furnished items. Do not pull these into Phase 1.

**Out of scope entirely:** any marketplace/network features. Don't add them.

## Definition of done (Phase 1)

- Sign up, sign in on a second device, see the same jobs.
- Capture a job offline (voice or text), it syncs when back online.
- AI build translates and structures the conversation; falls back to manual entry if unavailable.
- Edit lines (fixed/hourly), set who-furnishes, set a private margin, add upgrades.
- Client view and PDF show only client-facing data, with the business header and the "estimate, not a contract — valid 30 days" footer.
- Photos attach to a job and survive refresh and device switch.
- No user can access another user's data.

## Known rough edges in the prototype to clean up while refactoring

- `aiExtract()` runs client-side — move server-side (rule 1).
- Persistence is browser-local — replace with the backend.
- No input validation/error states beyond the basics — add proper handling.
- Voice uses the browser speech engine; accuracy on trade terms is rough — fine for a first draft, keep the editable transcript.

## Working style

- Make small, reviewable changes. Explain what you changed and why.
- Ask before anything destructive or anything that changes the data model in a way that drops existing fields.
- When a choice isn't specified here or in the spec, prefer the simplest option that satisfies the hard rules, and note the choice.
