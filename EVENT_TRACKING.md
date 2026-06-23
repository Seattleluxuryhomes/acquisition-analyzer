# Event Tracking & Observability

The goal of this layer is simple: **understand exactly how contractors use
Bidtranslator and where they stop.** We can't improve what we can't measure.

## Architecture

```
call site ──▶ track(userId, name, props) ──▶  event table  (source of truth)
                                          └─▶ forwardToSinks()  ──▶ Mixpanel / PostHog / Segment / warehouse
```

- **One write path.** Everything goes through `track()` in `src/analytics.js`.
  Call sites never know or care where events end up.
- **Local-first.** Every event lands in the `event` table (`src/db.js`), so the
  founder dashboard is accurate immediately — no third party required.
- **Sink-pluggable.** `forwardToSinks()` is the single place to fan out to
  **Mixpanel**, **PostHog**, **Segment**, or a **warehouse**. It's a no-op until
  the matching env var (`POSTHOG_KEY`, `MIXPANEL_TOKEN`, `SEGMENT_WRITE_KEY`) is
  set — so adding a provider later touches *one function*, not 30 call sites.
- **Never blocks a request.** `track()` swallows its own errors and the sinks are
  fire-and-forget. Analytics can never break the product.

### `event` table

| column | meaning |
|---|---|
| `id` | autoincrement |
| `user_id` | the contractor (nullable — system events) |
| `name` | event name (snake_case) |
| `props` | JSON blob of context |
| `created_at` | epoch ms |

### Funnel & dashboard metrics

The **funnel** and **overview** are *derived from the real tables*
(`user`, `job`, `payment_request`) — not only from events — so they're correct
**retroactively** and don't depend on events having been collected first. Events
add behavioural detail (page views, feature usage, where a session stalls) on
top.

## Event catalog

✅ = emitted today · ⏳ = reserved (emit when the feature exists)

### AUTH
| event | when | props | status |
|---|---|---|---|
| `user_registered` | sign up | `email` | ✅ |
| `user_logged_in` | sign in | — | ✅ |
| `user_logged_out` | sign out | — | ✅ |

### ONBOARDING
| event | when | props | status |
|---|---|---|---|
| `onboarding_started` | first profile edit | — | ⏳ |
| `onboarding_completed` | company set or logo uploaded | — | ✅ |
| `logo_uploaded` | logo saved | — | ✅ |
| `services_added` | trade/services saved | — | ⏳ (no services model yet) |

### LEADS
| event | when | props | status |
|---|---|---|---|
| `lead_created` | a job is created | `jobId` | ✅ |
| `lead_viewed` | a job is opened | `jobId` | ⏳ |
| `lead_updated` | a job is edited | `jobId` | ⏳ |

### BIDS
| event | when | props | status |
|---|---|---|---|
| `bid_created` | job created with line items | `jobId`, `lines` | ✅ |
| `bid_edited` | line items changed | `jobId` | ⏳ |
| `bid_sent` | share link generated / status → sent | `jobId`, `via` | ✅ |
| `bid_viewed` | customer opens the public proposal | `jobId` | ✅ |
| `bid_accepted` | status → signed | `jobId` | ✅ |
| `bid_rejected` | status → rejected | `jobId` | ⏳ (no reject flow yet) |

### PAYMENTS
| event | when | props | status |
|---|---|---|---|
| `payment_link_created` | payment request created | `jobId` | ✅ |
| `deposit_requested` | payment request created | `jobId`, `amount` | ✅ |
| `deposit_paid` | Stripe `checkout.session.completed` | `jobId`, `amount` | ✅ |
| `invoice_paid` | full invoice paid | `jobId`, `amount` | ⏳ (alias of deposit_paid today) |

### JOBS
| event | when | props | status |
|---|---|---|---|
| `job_created` | — | | ⏳ (≈ `lead_created` today) |
| `job_scheduled` | status → scheduled | `jobId` | ✅ |
| `job_completed` | status → completed | `jobId` | ⏳ (no completed status yet) |

### SYSTEM
| event | when | props | status |
|---|---|---|---|
| `page_view` | any view change | `view` | ✅ |
| `dashboard_viewed` | dashboard opened | — | ✅ |
| `feature_used` | notable feature used (e.g. trade template) | `feature`, … | ✅ |

## Founder dashboard

A private admin view (📊 **Founder** in the top nav) shows:

- **Top-line:** contractors, active (today / 7d), new users, onboarded, bids
  created/sent, accepted, deposits paid (count + $), pipeline won $, active subs.
- **Contractor funnel** with per-stage counts + drop-off %, and a callout for the
  **single biggest drop** ("where contractors stop"):
  `Sign up → Onboarding → First lead → First bid → Proposal sent → Accepted → First payment`
- **Contractors list** — per user: company, email, last login, leads, bids,
  accepted, revenue collected, pipeline won, subscription status.
- **Feature adoption** — event counts + distinct users.

### Enabling it

Set the env var to your email — only that account sees the dashboard and the
`/api/admin/*` endpoints:

```
BT_ADMIN_EMAIL=ben@benmortongroup.com
```

`/api/admin/*` returns **403** for everyone else; the nav item is hidden.

## Adding a real analytics provider later

1. `npm i posthog-node` (or Mixpanel/Segment SDK).
2. Initialise it in `src/analytics.js`.
3. Implement `forwardToSinks(userId, name, props)`.
4. Set the provider's env var. Done — every existing event flows through.
