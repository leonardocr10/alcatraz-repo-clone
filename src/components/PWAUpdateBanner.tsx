import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

export function PWAUpdateBanner() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg);
      setNeedsUpdate(true);
    };

    navigator.serviceWorker.ready.then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            handleUpdate(reg);
          }
        });
      });
    });

    // Check for updates every 60 seconds
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  if (!needsUpdate) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[60] animate-fade-in">
      <div className="glass-card border border-primary/30 p-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md mx-auto">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm">Nova versão disponível!</p>
          <p className="text-xs text-muted-foreground font-body">Atualize para a versão mais recente</p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-primary text-xs px-4 py-2 shrink-0"
        >
          Atualizar
        </button>
      </div>
    </div>
  );
}
