import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

const APP_CACHE_VERSION_KEY = "clan-panel-cache-version";
const RELOAD_KEY = "clan-panel-sw-reloaded";

if ("serviceWorker" in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW: (_swUrl, registration) => {
      registration?.update();
      window.setInterval(() => {
        registration?.update();
      }, 60_000);
    },
    onNeedRefresh() {
      window.location.reload();
    },
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
  });
}

if ("caches" in window) {
  const previousVersion = localStorage.getItem(APP_CACHE_VERSION_KEY);
  if (previousVersion !== __APP_VERSION__) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    localStorage.setItem(APP_CACHE_VERSION_KEY, __APP_VERSION__);
  }
}

createRoot(document.getElementById("root")!).render(<App />);
