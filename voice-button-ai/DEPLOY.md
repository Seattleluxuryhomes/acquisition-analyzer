# Put Voice Button AI on a live link (≈5 minutes, free)

Goal: a URL you can open on your phone, with the AI running for real. **Your
Anthropic key goes into the host's secret box — never into chat, never into a
file you edit.**

The easiest host for this is **Render** (free tier, no credit card to start).
Any Node host works (Railway, Fly.io); the steps are the same idea.

## Easiest — one-click Blueprint (recommended)

A `render.yaml` at the repo root configures everything (folder, build/start
commands, free plan, health check). Your only input is the key.

1. Go to **render.com** → sign up with GitHub.
2. **New → Blueprint**.
3. Connect the repo `Seattleluxuryhomes/acquisition-analyzer` (branch
   `claude/voice-button-ai-mvp-ka7a8f`). Render finds `render.yaml`.
4. It shows the **voice-button-ai** service and asks for one secret:
   **`ANTHROPIC_API_KEY`** → paste your `sk-ant-...` key (Render hides it).
5. Click **Apply**. ~3 min later you get a URL. Open it on your phone.

That's the whole job. Everything else is pre-filled by `render.yaml`.

## Manual alternative — Render web service, click by click

1. Go to **render.com** → sign up (you can use your GitHub account).
2. Click **New → Web Service**.
3. **Connect** the GitHub repo `Seattleluxuryhomes/acquisition-analyzer` and pick
   the branch `claude/voice-button-ai-mvp-ka7a8f`.
4. Fill in these fields:
   - **Root Directory:** `voice-button-ai`
   - **Runtime:** Node
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `node server/index.mjs`
   - **Instance Type:** Free
5. Open the **Environment** section and add your secret there (this is the safe
   spot — Render hides it, and it stays server-side):
   - Key: `ANTHROPIC_API_KEY`  →  Value: your `sk-ant-...` key
   - (optional) Key: `VBAI_FREE_DAILY_CREDITS`  →  Value: `60`
6. Click **Create Web Service**. Render builds it (~2–3 min) and gives you a URL
   like `https://voice-button-ai.onrender.com`. Open it on your phone.

That's it. The app serves itself and runs Fable through your key, which lives
only in Render's Environment — the browser never sees it.

> Note: the free instance sleeps after inactivity, so the first open after a
> while takes ~30s to wake. Fine for a demo; upgrade later if you want it always-on.

## Prefer Docker / another host?

A `Dockerfile` is included (build context = this folder). Any container host can
run it; set `ANTHROPIC_API_KEY` as a secret/env var there. The server reads
`PORT` automatically.

## No key yet, or want to look first?

Skip step 5. The app still works — "Run with Fable" hands you the finished
prompt to paste into Claude/ChatGPT instead of running it inline.
