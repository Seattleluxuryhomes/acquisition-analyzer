# Voice Button AI

**A remote control for AI.** Voice-first and push-button command center for people
who use AI constantly but don't want to remember prompts.

You either **speak** what you want, **tap** a big button, **search**, or use a
**/slash command** — and get a clean, copy-ready prompt for Claude / ChatGPT in
under 5 seconds. No backend. No login. Local-first.

Ships as three things from one codebase:

1. A **Chrome Extension** (MV3 popup)
2. A **mobile-first responsive web app** (PWA-ready)
3. A **future-ready foundation** for a full SaaS product (storage layer is
   swappable for Supabase / cloud sync)

---

## Quick start

```bash
cd voice-button-ai
npm install
npm run dev          # http://localhost:5173
```

That's it — open the URL on desktop or phone. Voice input uses the browser
SpeechRecognition API where supported (Chrome, Edge, Safari); everywhere else it
falls back to a text box automatically.

### Build for production (web)

```bash
npm run build        # type-checks, then outputs static site to dist/
npm run preview      # serve the built site locally
```

Deploy `dist/` to any static host (Vercel, Netlify, Cloudflare Pages, S3).

### Build + load the Chrome extension

```bash
npm run build:extension   # build + copy manifest.json into dist/
```

Then:

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `voice-button-ai/dist` folder
5. Pin **Voice Button AI** and click the toolbar icon — the popup is the full Home UI

The extension stores data in `chrome.storage.local` (and mirrors to
`localStorage`), works without login, supports quick search, voice where
available, and one-tap copy.

### Regenerate icons

Icons are generated with zero dependencies (pure Node + `zlib`):

```bash
npm run icons        # writes public/icons/icon{16,48,128,192,512}.png
```

---

## How it works

- **Voice** → `useSpeechRecognition` transcribes → `intentMatcher` scores every
  workflow by tag/keyword/command overlap → confident match auto-launches, low
  confidence shows the top 3 suggestions.
- **Buttons** → big `ActionButton` cards open a `WorkflowScreen`.
- **Workflow screen** → collect inputs (typed or dictated) → `promptBuilder`
  fills the template, drops empty optional lines, appends extra details → clean
  copy-ready prompt → Copy / favorite / re-run from history.
- **Persistence** → `storage.ts` abstracts `chrome.storage.local` ⇄
  `localStorage` behind a tiny get/set API so a cloud adapter drops in later.

The intent matcher is **fully offline** — no external AI API. It uses keyword
and tag matching with hand-tuned boosts for the high-signal cases (offer,
land/zoning, debug, contractor bid, counteroffer, etc.).

### On-device learning (the jewel)

The app gets better the more you use it — privately, with no backend and no ML
libraries (`src/lib/learning.ts`):

- **Adaptive intent matcher.** Every time a spoken/typed request leads you to
  open a workflow, the words are reinforced toward that workflow
  (`recordChoice`). Those associations feed back into the matcher's score
  (`adaptiveBoost`), so it learns *your* phrasing and can eventually flip a
  wrong default. The boost is diminishing per token and capped per workflow, so
  learning nudges ranking without steamrolling the hand-tuned signals.
- **Prompt-variant bandit.** Workflows can ship alternative prompt phrasings.
  An **epsilon-greedy multi-armed bandit** with optimistic cold-start
  (`selectVariant`) serves a variant per run and learns which earns the best
  feedback — explicit (👍/👎) or implicit (copied = good, regenerated = weak
  negative). Per user, per task.

Everything persists through the local-first storage layer, is gated by a
Settings toggle, and can be reset. When cloud sync lands, this state syncs like
any other. Verified by unit checks on the matcher/bandit and an end-to-end
browser run (feedback → history → reward).

---

## Project structure

```
voice-button-ai/
├── manifest.json              Chrome Extension MV3 manifest
├── index.html                 App shell (web + extension popup)
├── vite.config.ts             Relative-base build (works in extension)
├── tailwind.config.js         Dark-first theme, brand palette, animations
├── postcss.config.js
├── tsconfig.json
├── package.json
├── scripts/
│   ├── generate-icons.mjs      Dependency-free PNG icon generator
│   └── pack-extension.mjs      Copies manifest into dist/ after build
├── public/
│   ├── pwa.webmanifest
│   └── icons/                  Generated PNGs + source SVG
└── src/
    ├── main.tsx               Entry; extension-popup detection + hydrate
    ├── App.tsx                Tab routing + workflow overlay state
    ├── store.tsx              App context: favorites, recents, history, theme
    ├── index.css              Tailwind + light-mode remap + custom utilities
    ├── components/
    │   ├── MicButton.tsx       Hero mic w/ Ready/Listening/Thinking/Ready/Copied
    │   ├── ActionButton.tsx    Big push-button workflow card
    │   ├── WorkflowCard.tsx    List-row workflow card
    │   ├── WorkflowScreen.tsx  Inputs + voice dictation + prompt + copy + history
    │   ├── SearchBar.tsx
    │   ├── FavoritesBar.tsx
    │   ├── RecentWorkflows.tsx
    │   ├── BottomNav.tsx        Mobile bottom navigation
    │   └── Icon.tsx            Tree-shakeable lucide icon registry
    ├── data/
    │   └── workflows.ts        50+ seed workflows across 8 categories
    ├── hooks/
    │   ├── useSpeechRecognition.ts
    │   ├── useLocalStorage.ts
    │   └── useWorkflowIntent.ts
    ├── lib/
    │   ├── intentMatcher.ts    Offline keyword/tag intent matching
    │   ├── promptBuilder.ts    Template → clean copy-ready prompt
    │   ├── storage.ts          Local-first storage (chrome.storage/localStorage)
    │   └── clipboard.ts
    ├── pages/
    │   ├── Home.tsx            Greeting, search, mic hero, buttons, recents
    │   ├── Workflows.tsx       Full library, category filter + search
    │   ├── Favorites.tsx
    │   └── Settings.tsx        Theme, voice language, auto-launch, data
    └── types/
        └── workflow.ts        Workflow + RunRecord + IntentMatch models
```

---

## Workflow library

50+ seed workflows across **Writing, Real Estate, Business, Coding, Marketing,
BidVoice/Contractor, Research, Productivity**. Each carries `id, title,
category, buttonLabel, description, icon, command, tags, requiredInputs,
optionalInputs, promptTemplate, examples`. Add your own by appending to
`src/data/workflows.ts` (the `wf()` / `inp()` helpers keep it terse).

> AI prices and any numbers in generated prompts are **placeholders** — the user
> sets the real values. Prompts are drafting aids, not advice.

---

## What to improve next

1. **Cloud sync** — implement a Supabase adapter behind `storage.ts` (the API is
   already abstracted) + optional auth for cross-device favorites/history.
2. **Real AI execution** — optionally POST the built prompt to an AI endpoint and
   show the response inline (keeping the API key server-side).
3. **Extension power features** — floating button on pages, inject prompt into
   the focused text box, Gmail / Claude / ChatGPT helpers (manifest scopes are
   intentionally minimal today).
4. **Full light theme** — components are dark-first; the light toggle remaps
   utilities globally, but a dedicated token pass would polish it.
5. **Smarter intent** — upgrade `intentMatcher` from keyword scoring to embeddings
   for fuzzy/long requests; add follow-up question chains per workflow.
6. **PWA install** — add a service worker + offline cache so capture works fully
   offline and the app installs to the home screen.
7. **Tests** — unit tests for `promptBuilder` and `intentMatcher`; component tests
   for the voice flow.
