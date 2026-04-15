import React from "react";
import ReactDOM from "react-dom/client";
import { toast } from 'sonner';
import './index.css';
import App from "@/App";

// Tag the root element when running as an installed PWA so CSS can adapt.
(function markStandalone() {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) document.documentElement.classList.add('is-standalone');
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register PWA service worker (production only)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  // When a new SW takes control, the page is running stale code — offer a refresh.
  // We skip the very first controllerchange (initial install) to avoid a false prompt.
  let refreshing = false;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    if (refreshing) return;
    refreshing = true;
    toast('A new version is available', {
      description: 'Reload to get the latest.',
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: () => window.location.reload(),
      },
    });
  });
}
