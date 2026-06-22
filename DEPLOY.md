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
2. **Connect GitHub** and pick the repo **`seattleluxuryhomes/acquisition-analyzer`**, branch `main`.
3. The app is at the **repo root** — Hyperlift auto-detects the `Dockerfile`. No root-directory and no build command needed.
4. **Add a persistent volume** mounted at **`/app/data`** (this holds the SQLite database and uploaded photos — without it, data resets on every redeploy).
5. **Environment variables** — at minimum set the signing secret:

   | Key | Value |
   |---|---|
   | `BT_SIGNING_SECRET` | a long random string (one was generated for you — see chat, or run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `BT_PUBLIC_URL` | `https://bidtranslator.com` |

   Add these later when you have them (optional):

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | from console.anthropic.com — turns on the AI build step |
   | `STRIPE_SECRET_KEY` | from Stripe — turns on subscriptions |
   | `STRIPE_PRICE_ID` | the **monthly** recurring Price id (e.g. $29.99/mo) |
   | `STRIPE_SETUP_PRICE_ID` | optional — a **one-time** Price id (e.g. $299 setup fee) charged on the first checkout only. Omit for no setup fee. |
   | `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook endpoint |
   | `BT_STRIPE_TAX` | optional — set to `1` to collect sales tax automatically (requires Stripe Tax enabled + registered). Tax is added on top of the price. |
   | `BT_TRIAL_DAYS` | `14` (default; omit to keep 14) |

6. **Deploy.** Hyperlift builds the image and gives you a URL. Open it — you should see the sign-in screen.
7. **Point the domain.** In Spaceship's domain settings for **bidtranslator.com**, follow Hyperlift's "custom domain" instructions (usually a CNAME or A record to the app, plus automatic HTTPS). Once it resolves, sign up on two phones and you'll see the same jobs sync.

---

## Path B — Spaceship shared hosting "Setup Node.js App" (fallback)

If you'd rather use the cPanel-style hosting:

1. **Hosting Manager → Manage → Advanced → Development Tools → Node.js App → Create.**
2. **Node.js version:** 22 or newer (the app needs the built-in `node:sqlite`, which requires Node ≥ 22).
3. **Application root:** upload the repo contents. **Startup file:** `server.js`.
4. Open the app's terminal/SSH and run `npm ci --omit=dev` in the app root.
5. Set the same environment variables as above in the Node.js App panel.
6. Make sure the app's data directory is on persistent storage (it is, on shared hosting — `./data` under the app root).
7. Start the app, then point **bidtranslator.com** at it in domain settings.

---

## Stripe webhook (only once billing is on)

After the app is live and you've added the Stripe keys:

1. In Stripe → **Developers → Webhooks → Add endpoint**: `https://bidtranslator.com/api/billing/webhook`.
2. Subscribe to events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. **If you also turn on "Get paid" (Stripe Connect, below):** on the *same* endpoint, also enable **"Listen to events on Connected accounts"** and add `account.updated`. (The `checkout.session.completed` event already covers homeowner payments.)
4. Copy the endpoint's **signing secret** into `STRIPE_WEBHOOK_SECRET` and redeploy/restart.

---

## Payments — contractors get paid by homeowners (Stripe Connect)

This lets each contractor connect their own Stripe account and send clients a
card-payment link from a bid. Money flows straight to the contractor; the
platform never holds it. It uses the **same `STRIPE_SECRET_KEY`** as
subscriptions — no extra keys.

1. In Stripe → **Connect → Get started**, enable Connect on your platform account
   (choose **Express** accounts when prompted).
2. Make sure the webhook above also listens to **Connected account** events
   (step 3 in the webhook section).
3. That's it — contractors will see a **"Get paid"** card in *Setup* and a
   **"Request a payment"** box on each job's *Client view*. `/api/health` will
   report `"payments":true`.
4. **Klarna / Affirm:** these are just payment methods — each contractor turns
   them on in **their own** Stripe dashboard (Settings → Payment methods). No code
   change; they'll automatically appear at checkout.

---

## Sanity checks after deploy

- `https://bidtranslator.com/api/health` → `{"ok":true,"ai":<bool>,"billing":<bool>,"payments":<bool>}`.
- Sign up, create a job on phone A, sign in on phone B → same job appears.
- Send a bid → a PDF opens with your business header and no private margin/notes.

## Backups

Everything lives in the mounted volume at `/app/data` (`bidtranslator.db` + `photos/`).
Snapshot that volume periodically — that's your whole backup.
