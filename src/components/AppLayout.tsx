import { useNavigate, useLocation } from "react-router-dom";
import { Dices, Layers, Users, Swords, Settings, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const items: NavItem[] = [
  { label: "Roleta", path: "/roleta", icon: Dices },
  { label: "Admin", path: "/admin", icon: Layers, adminOnly: true },
  { label: "Jogadores", path: "/jogadores", icon: Users, adminOnly: true },
  { label: "Classes", path: "/classes", icon: Swords, adminOnly: true },
  { label: "Config", path: "/config", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = items.filter((item) => !item.adminOnly || isAdmin);

  const onLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Painel AZ</p>
            <h1 className="text-sm font-semibold">Centro de Controle</h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-border bg-card px-3 py-1.5 text-right">
              <p className="text-xs font-medium leading-none">{profile?.nickname ?? "Sem perfil"}</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {isAdmin ? <Shield className="h-3 w-3" /> : null}
                {isAdmin ? "Admin" : "Membro"}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 px-2 py-3 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
