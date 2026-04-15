import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { PlaySchedulePrompt } from "@/components/PlaySchedulePrompt";
import { PWAUpdateBanner } from "@/components/PWAUpdateBanner";
import { EventPresencePrompt } from "@/components/events/EventPresencePrompt";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import InfoPage from "@/pages/InfoPage";
import RouletteGamePage from "@/pages/RouletteGamePage";
import AdminPage from "@/pages/AdminPage";
import PlayersPage from "@/pages/PlayersPage";
import ClassesPage from "@/pages/ClassesPage";
import ConfigPage from "@/pages/ConfigPage";
import RulesPage from "@/pages/RulesPage";
import HistoryPage from "@/pages/HistoryPage";
import CharPage from "@/pages/CharPage";
import EquipmentCatalogPage from "@/pages/EquipmentCatalogPage";
import EventsPage from "@/pages/EventsPage";
import NotFound from "@/pages/NotFound";
import { useEffect, useState } from "react";


const queryClient = new QueryClient();

function MobileOrientationGuard() {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    const isMobileDevice = () =>
      window.matchMedia("(max-width: 1024px)").matches ||
      /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const update = () => {
      const landscape = window.matchMedia("(orientation: landscape)").matches;
      setBlocked(isMobileDevice() && !isStandalone() && landscape);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    if (screen.orientation?.lock) {
      screen.orientation.lock("portrait").catch(() => {
        // Browser mode may reject orientation lock; fallback is the overlay block.
      });
    }

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!blocked) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-background/95 backdrop-blur flex items-center justify-center p-6 text-center">
      <div className="glass-card max-w-sm p-5 space-y-2">
        <p className="font-display text-lg font-extrabold uppercase tracking-wide text-primary">Modo Retrato</p>
        <p className="text-sm text-muted-foreground">
          Para usar no navegador mobile, mantenha o celular na vertical.
        </p>
      </div>
    </div>
  );
}

const App = () => {
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { authUser, loading, isApproved } = useAuth();
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!authUser) return <Navigate to="/login" replace />;
    if (!isApproved) return <Navigate to="/login?pending=1" replace />;
    return <>{children}</>;
  }

  function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, loading } = useAuth();
    if (loading) return null;
    if (!isAdmin) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  }

  function ConfigRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, isLeader, loading } = useAuth();
    if (loading) return null;
    if (!isAdmin && !isLeader) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  }

  function PublicRoute({ children }: { children: React.ReactNode }) {
    const { authUser, loading, isApproved } = useAuth();
    if (loading) return null;
    if (authUser && isApproved) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MobileOrientationGuard />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/" element={<Navigate to="/inicio" replace />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/inicio" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
            <Route path="/info" element={<ProtectedRoute><AppLayout><InfoPage /></AppLayout></ProtectedRoute>} />
            <Route path="/roleta" element={<ProtectedRoute><AppLayout><RouletteGamePage /></AppLayout></ProtectedRoute>} />
            <Route path="/regras" element={<ProtectedRoute><AppLayout><RulesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><AppLayout><HistoryPage /></AppLayout></ProtectedRoute>} />
            <Route path="/eventos" element={<ProtectedRoute><AppLayout><EventsPage /></AppLayout></ProtectedRoute>} />
            
            <Route path="/char" element={<ProtectedRoute><AppLayout><CharPage /></AppLayout></ProtectedRoute>} />
            <Route path="/equipment/:slot" element={<ProtectedRoute><AppLayout><EquipmentCatalogPage /></AppLayout></ProtectedRoute>} />
            <Route path="/jogadores" element={<ProtectedRoute><AppLayout><PlayersPage /></AppLayout></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><AppLayout><ClassesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><ConfigRoute><AppLayout><ConfigPage /></AppLayout></ConfigRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallBanner />
          <PWAUpdateBanner />
          <PlaySchedulePrompt />
          <EventPresencePrompt />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
