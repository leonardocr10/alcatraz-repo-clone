import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RouletteGamePage from "@/pages/RouletteGamePage";
import AdminPage from "@/pages/AdminPage";
import PlayersPage from "@/pages/PlayersPage";
import ClassesPage from "@/pages/ClassesPage";
import ConfigPage from "@/pages/ConfigPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  if (!authUser) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/roleta" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { authUser, loading } = useAuth();
  if (loading) return null;
  if (authUser) return <Navigate to="/roleta" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/roleta" replace />} />
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/roleta" element={<ProtectedRoute><RouletteGamePage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/jogadores" element={<ProtectedRoute><AdminRoute><PlayersPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><AdminRoute><ClassesPage /></AdminRoute></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><AdminRoute><ConfigPage /></AdminRoute></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
