import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store';
import { storage } from './lib/storage';
import { refreshInsights } from './lib/insights';
import './index.css';

// Give the extension popup a fixed, comfortable size (see index.css).
if (typeof location !== 'undefined' && location.protocol === 'chrome-extension:') {
  document.documentElement.classList.add('is-extension-popup');
}

// Best-effort hydrate from chrome.storage.local before first paint isn't
// required — the cache + localStorage cover the synchronous read. We still
// kick off a hydrate so an extension popup picks up data written elsewhere.
void storage.hydrateFromChrome();

// Pull the crowd's learning priors so even a first-run user is smart on tap #1.
// Best-effort: silently no-ops offline or in a pure-static deploy.
void refreshInsights();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
