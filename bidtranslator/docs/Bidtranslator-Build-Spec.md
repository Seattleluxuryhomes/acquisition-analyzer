# Bidtranslator — Build Spec (Prototype → Hosted App)

**Purpose.** This document tells a developer exactly what to build to turn the working Bidtranslator prototype into a real, hosted app that a contractor can log into from any device, with their jobs saved in the cloud. It is written to be quoted from. Scope is deliberately tight — ship the core loop well before adding anything else.

This is a practical spec, not a legal document. The privacy/consent section flags real obligations, but a lawyer in the operating state should review anything contractual or recording-related before launch.

---

## 1. What already exists

A single-file front-end prototype (`bidtranslator-app.html`) already defines the product's behavior. The developer should treat it as the functional reference — the screens, flow, and data shapes are real and tested. It includes:

- A three-part flow per job: **Notebook** (capture, transcript, translation, scope, assumptions, exclusions, upgrades, photos) → **Build the bid** (line items, hourly/fixed pricing, who-furnishes split, private margin, upgrades) → **Client view** (clean proposal, print/save to PDF).
- Text capture plus **voice dictation** (browser speech engine) and **photo capture** (camera on mobile, downscaled client-side).
- An **AI step** that translates a field conversation and structures it into a bid draft. In the prototype this calls a model directly from the browser, which is fine for a demo but **must move server-side** for a real product (see §7).
- Local-only persistence (browser storage). The whole point of this spec is to replace that with real accounts and cloud storage.

The job of the backend is to keep all of this behavior identical while making it multi-device, durable, secure, and shippable to an app store or the web.

## 2. Architecture overview

Three pieces:

1. **Client app** — the existing UI, refactored into a maintainable front end (see §3). Talks only to our backend, never to the AI provider directly.
2. **Backend API** — authentication, data storage, file storage, and a thin proxy for the AI translation/structuring call (so the API key is never exposed).
3. **AI provider** — a hosted LLM API used for the translate-and-structure step, called only from the backend.

```
[ Contractor's phone/web ]
        |  HTTPS (auth token)
        v
[ Bidtranslator backend API ] --- key ---> [ AI provider ]
        |                  |
   [ Database ]      [ File storage (photos, PDFs) ]
```

## 3. Recommended stack

The product is small and CRUD-shaped with one AI call. Don't over-build. Two pragmatic paths; pick one based on the developer's strengths.

**Path A — fastest to ship (recommended for v1):** a managed backend-as-a-service (e.g. Supabase or Firebase) for auth, database, and file storage, plus one small serverless function for the AI proxy. The existing HTML/JS front end can be kept close to as-is, or wrapped with Capacitor to produce iOS/Android apps from the same codebase.

**Path B — more control:** a conventional API (Node/Express or similar) with Postgres and S3-compatible object storage, deployed on any standard host. More work, more flexibility. Choose only if there's a clear reason.

For the front end, the prototype is vanilla HTML/JS. For maintainability past v1, the developer may port it to a light framework (React or similar) — acceptable as long as the screens and flow stay identical. Don't rebuild the design; reuse the existing visual language.

## 4. Accounts & auth

- Email + password sign-in, plus "sign in with Google/Apple" if cheap to add (contractors lose passwords).
- One account = one contractor (or company). No team/multi-seat in v1.
- Standard token-based sessions. Password reset by email.
- Each account owns its own jobs and settings; no cross-account access.

## 5. Data model

Mirror the prototype's shapes. Suggested tables/collections:

**user**
- `id`, `email`, `created_at`
- `company` (string), `name`, `phone`, `license` (all optional)
- `default_from_lang`, `default_to_lang`

**job**
- `id`, `user_id` (owner), `title`, `created_at`, `updated_at`
- `from_lang`, `to_lang`
- `transcript` (text, original language)
- `translation` (text)
- `summary` (text)
- `assumptions` (array of strings)
- `exclusions` (array of strings)
- `notes` (text, private)
- `margin` (number, private — never sent to client view)
- `status` (draft / sent) — see §8

**line** (belongs to job)
- `id`, `job_id`, `position` (for ordering)
- `desc`, `type` ("fixed" | "hourly")
- `price`, `hours`, `rate`
- `furnished` ("you" | "client")

**upgrade** (belongs to job)
- `id`, `job_id`, `desc`, `price`

**photo** (belongs to job)
- `id`, `job_id`, `url` (points to file storage), `created_at`

Lines and upgrades can be embedded as JSON on the job if using a document store — either is fine for this size. Keep `margin` and `notes` server-side-private: they must never appear in any client-facing response or PDF.

## 6. API endpoints

Keep it small and RESTful. All require auth except sign-up/sign-in.

```
POST   /auth/signup
POST   /auth/signin
POST   /auth/reset

GET    /jobs                 list current user's jobs (summary fields)
POST   /jobs                 create a job
GET    /jobs/:id             full job with lines, upgrades, photos
PATCH  /jobs/:id             update job fields / lines / upgrades
DELETE /jobs/:id

POST   /jobs/:id/photos      upload a photo (returns stored URL)
DELETE /jobs/:id/photos/:pid

POST   /assist/build         AI translate + structure (see §7)
GET    /jobs/:id/pdf         render client proposal as PDF (see §9)

GET    /me                   settings
PATCH  /me                   update settings
```

## 7. The AI step (server-side)

This is the one piece that must change from the prototype. Today the browser calls the model directly; in production the API key lives only on the backend.

**Endpoint:** `POST /assist/build`
**Input:** `{ text, from_lang, to_lang }`
**Output:** `{ translation, summary, lines[], assumptions[], exclusions[], upgrades[] }` — the same JSON shape the prototype already consumes.

Behavior:
- Backend holds the AI provider key as a secret (environment variable, never shipped to the client).
- Backend sends the conversation with a fixed instruction: translate from `from_lang` to `to_lang`, and return only the structured JSON (translation, short scope summary, up to ~6 line items tagged fixed/hourly, assumptions, exclusions, and up to ~4 upgrade suggestions). Client-supplied materials become exclusions.
- Validate and sanitize the model's JSON before returning it. If parsing fails, return a clear error so the client can fall back to manual entry.
- **Prices from the AI are rough placeholders.** Make this explicit in the UI; the contractor sets real numbers. The AI structures the job; it does not price it.
- Add a simple per-user rate limit and a monthly call cap to control cost (see §13).

The rest of the app must work with this endpoint unavailable — a contractor can always build a bid by hand. Never let an AI outage block bidding.

## 8. Bid status & "sent" record

The prototype builds and previews; production should record when a bid was sent.

- Add `status` (draft / sent) and a `sent_at` timestamp.
- When the contractor exports or sends, snapshot the proposal so the record of what the client received doesn't silently change if the contractor later edits the job. A simple approach: store the generated PDF (or a frozen JSON copy) at send time.
- Full revision history is **not** in v1 — just don't let "what was sent" get overwritten.

## 9. Client proposal & PDF

- The client view already exists in the prototype; reuse its layout exactly.
- Render it server-side to a clean PDF (`GET /jobs/:id/pdf`) so it's consistent across phones and easy to email. The prototype's browser-print path can remain as a fallback.
- The PDF and client view must show only client-facing data: scope lines, client-furnished items, optional upgrades, exclusions, assumptions, total, the contractor's business header, and the "estimate, not a contract — valid 30 days" footer. **Never** the margin or private notes.
- Company name, contact, and (later) logo come from the user's settings.

## 10. Offline & sync (field reality)

Jobsites have bad signal. This matters more than it looks.

- **Capture must work offline.** Voice dictation, typing, and photo capture should all function with no connection and sync when one returns.
- Queue unsynced changes locally and push them when online; last-write-wins is acceptable for a single-user account in v1.
- The AI build step requires connectivity — that's fine, since the contractor can capture offline and run the build later.

## 11. Security & privacy

The product records client conversations and stores business data. Handle this carefully — it's also part of the trust promise.

- All traffic over HTTPS. Secrets (AI key, DB credentials) server-side only.
- Each user can access only their own data; enforce ownership on every endpoint.
- Photos and PDFs in private storage with signed, expiring URLs — not public links.
- **Recording consent.** Capturing conversations can carry consent obligations that vary by state and country. The app should make it easy for the contractor to do the right thing (e.g. a clear note that captured content is theirs and a reminder to inform the other party where required). Get this reviewed by a lawyer in the operating state before launch.
- Be explicit in plain language that recordings, transcripts, and bids belong to the contractor, how they're stored, and how to delete them. Provide account and data deletion.
- Don't retain conversation text with the AI provider beyond what's needed for the single call; confirm the provider's data-handling terms.

## 12. Non-functional requirements

- **Performance:** job list and job open should feel instant; the AI build step may take a few seconds and must show a clear loading state (the prototype already does).
- **Reliability:** no data loss. A created or edited job must survive app close, refresh, and device switch.
- **Cost guardrails:** per-user rate limit and monthly cap on AI calls; downscale photos before upload (the prototype already does this) to keep storage small.
- **Accessibility & mobile:** keyboard focus visible, works one-handed on a phone, respects reduced-motion. Keep the existing standards.

## 13. Cost notes (rough, verify current rates)

- AI translate/structure: a small number of cents per build at current hosted-model rates; the monthly cap keeps this predictable. Treat as low but non-zero.
- Managed backend (Path A) typically has a free or low tier that comfortably covers an early user base, scaling with usage.
- File storage for downscaled photos and PDFs is minor at this scale.
These are order-of-magnitude only; confirm against live pricing before committing.

## 14. Build phases

**Phase 1 — Hosted core (the milestone that lets Koi use it for real)**
Accounts, cloud-saved jobs, the full Notebook → Build → Client view loop, server-side AI build, photo upload, server-rendered PDF, offline capture with sync. This is the whole product. Ship this and stop.

**Phase 2 — Polish that earns trust**
Contractor logo on the proposal; "sent" snapshot/record; client-facing proposal in the client's language (translate the client view, not just the notes); saved "common items" / reusable rates.

**Phase 3 — Only after real adoption**
Bid revisions/versioning; e-signature; the optional standby-cost clause (contractor-controlled, never auto-imposed); split-bid product links for client-furnished items.

**Later — not in this spec**
Builder Box and the homeowner directory. These are network features that only make sense once there's a density of active contractors. Don't let them pull scope into Phase 1.

## 15. Acceptance criteria (Phase 1 "done")

- A contractor can sign up, sign in on a second device, and see the same jobs.
- They can capture a job by voice or text offline, and it syncs when back online.
- The build step translates and structures the conversation, and degrades gracefully to manual entry if the AI is unavailable.
- They can edit lines (fixed/hourly), set the who-furnishes split, set a private margin, and add upgrades.
- The client view and PDF show only client-facing data and carry the contractor's business header and the estimate/validity footer.
- Photos attach to a job and survive a refresh and a device switch.
- No user can access another user's data.

## 16. Open decisions to confirm before building

- **App store vs. web-first?** Web-first is faster and cheaper to iterate; native apps (via the same codebase) help with camera/mic reliability and credibility. Recommendation: web-first for Phase 1, wrap for app stores in Phase 2.
- **Which managed backend** (if Path A) — pick based on the developer's familiarity.
- **AI provider and model** — confirm one with acceptable quality on construction Spanish/Russian and clear data-handling terms.
- **Consent wording and recording rules** for the launch state — lawyer review.
- **Where signups/leads go** if the marketing page ships alongside (separate from this app spec).

---

### One-line summary for the developer

Build a small, single-user, cloud-synced CRUD app around an existing, tested front end: accounts, jobs (notebook + bid lines + upgrades + photos), a server-side AI proxy that translates and structures a conversation into a bid draft, and a server-rendered client PDF — with offline capture, strict data privacy, and the margin kept off anything the client ever sees. Ship that core well; everything else waits.
