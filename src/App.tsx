import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import RouletteGamePage from "@/pages/RouletteGamePage";
import AdminPage from "@/pages/AdminPage";
import PlayersPage from "@/pages/PlayersPage";
import ClassesPage from "@/pages/ClassesPage";
import ConfigPage from "@/pages/ConfigPage";
import RulesPage from "@/pages/RulesPage";
import NotFound from "@/pages/NotFound";


const queryClient = new QueryClient();

const App = () => {
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { authUser, loading } = useAuth();
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!authUser) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  function AdminRoute({ children }: { children: React.ReactNode }) {
    const { isAdmin, loading } = useAuth();
    if (loading) return null;
    if (!isAdmin) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  }

  function PublicRoute({ children }: { children: React.ReactNode }) {
    const { authUser, loading } = useAuth();
    if (loading) return null;
    if (authUser) return <Navigate to="/inicio" replace />;
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
            <Route path="/" element={<Navigate to="/inicio" replace />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/inicio" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
            <Route path="/roleta" element={<ProtectedRoute><AppLayout><RouletteGamePage /></AppLayout></ProtectedRoute>} />
            <Route path="/regras" element={<ProtectedRoute><AppLayout><RulesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AppLayout><AdminPage /></AppLayout></ProtectedRoute>} />
            <Route path="/jogadores" element={<ProtectedRoute><AppLayout><PlayersPage /></AppLayout></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><AppLayout><ClassesPage /></AppLayout></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><AdminRoute><AppLayout><ConfigPage /></AppLayout></AdminRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PWAInstallBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
