# Deploying Bidtranslator on Spaceship → bidtranslator.com

The app is one container. The recommended path on Spaceship is **Starlight
Hyperlift** (deploys a Docker image straight from a GitHub repo). A `Dockerfile`
is included, so there's nothing to build by hand.

> You can launch with **zero keys** — billing off, AI off. Contractors sign up,
> capture jobs, build bids by hand, and send PDFs. Add the Anthropic and Stripe
> keys later (just environment variables — no code change, no redeploy of code).

---

## Path A — Starlight Hyperlift (recommended)

1. In Spaceship, open **Hosting → Starlight Hyperlift → New app**.
2. **Connect GitHub** and pick the repo **`seattleluxuryhomes/acquisition-analyzer`**, branch `main` (merge the build there first) or the feature branch.
3. **Root directory:** set to **`bidtranslator`** (the app lives in that subfolder; the Dockerfile is there). If Hyperlift can't target a subdirectory, see "If subfolders aren't supported" below.
4. It auto-detects the `Dockerfile`. No build command needed.
5. **Add a persistent volume** mounted at **`/app/data`** (this holds the SQLite database and uploaded photos — without it, data resets on every redeploy).
6. **Environment variables** — at minimum set the signing secret:

   | Key | Value |
   |---|---|
   | `BT_SIGNING_SECRET` | a long random string (one was generated for you — see chat, or run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `BT_PUBLIC_URL` | `https://bidtranslator.com` |

   Add these later when you have them (optional):

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | from console.anthropic.com — turns on the AI build step |
   | `STRIPE_SECRET_KEY` | from Stripe — turns on subscriptions |
   | `STRIPE_PRICE_ID` | the monthly Price object's id in Stripe |
   | `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook endpoint |
   | `BT_TRIAL_DAYS` | `14` (default; omit to keep 14) |

7. **Deploy.** Hyperlift builds the image and gives you a URL. Open it — you should see the sign-in screen.
8. **Point the domain.** In Spaceship's domain settings for **bidtranslator.com**, follow Hyperlift's "custom domain" instructions (usually a CNAME or A record to the app, plus automatic HTTPS). Once it resolves, sign up on two phones and you'll see the same jobs sync.

### If subfolders aren't supported
Two options: (a) move the contents of `bidtranslator/` to the repo root and point Hyperlift at root, or (b) extract `bidtranslator/` into its own GitHub repo (cleaner long-term). I can do either on request.

---

## Path B — Spaceship shared hosting "Setup Node.js App" (fallback)

If you'd rather use the cPanel-style hosting:

1. **Hosting Manager → Manage → Advanced → Development Tools → Node.js App → Create.**
2. **Node.js version:** 22 or newer (the app needs the built-in `node:sqlite`, which requires Node ≥ 22).
3. **Application root:** upload the contents of `bidtranslator/`. **Startup file:** `server.js`.
4. Open the app's terminal/SSH and run `npm ci --omit=dev` in the app root.
5. Set the same environment variables as above in the Node.js App panel.
6. Make sure the app's data directory is on persistent storage (it is, on shared hosting — `./data` under the app root).
7. Start the app, then point **bidtranslator.com** at it in domain settings.

---

## Stripe webhook (only once billing is on)

After the app is live and you've added the Stripe keys:

1. In Stripe → **Developers → Webhooks → Add endpoint**: `https://bidtranslator.com/api/billing/webhook`.
2. Subscribe to events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the endpoint's **signing secret** into `STRIPE_WEBHOOK_SECRET` and redeploy/restart.

---

## Sanity checks after deploy

- `https://bidtranslator.com/api/health` → `{"ok":true,"ai":<bool>,"billing":<bool>}`.
- Sign up, create a job on phone A, sign in on phone B → same job appears.
- Send a bid → a PDF opens with your business header and no private margin/notes.

## Backups

Everything lives in the mounted volume at `/app/data` (`bidtranslator.db` + `photos/`).
Snapshot that volume periodically — that's your whole backup.
