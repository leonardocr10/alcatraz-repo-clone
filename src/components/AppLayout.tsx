import { useNavigate, useLocation } from "react-router-dom";
import { Dices, Shield, Users, Swords, Settings, LogOut, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import logoAz from "@/assets/logo-az.jpeg";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const items: NavItem[] = [
  { label: "Roleta", path: "/roleta", icon: Dices },
  { label: "Gerenciar", path: "/admin", icon: Crown, adminOnly: true },
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
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <img src={logoAz} alt="AZ" className="w-9 h-9 rounded-xl border border-primary/30 shadow-md" />
            <div>
              <h1 className="font-display text-sm font-extrabold tracking-wide leading-none">
                PAINEL <span className="text-primary">AZ</span>
              </h1>
              <p className="text-[10px] text-muted-foreground font-body">Sistema de Gestão</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-secondary/80 px-3 py-1.5 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary" />
              <p className="text-xs font-bold leading-none font-body">{profile?.nickname ?? "..."}</p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl bg-secondary/80 p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg px-4 py-5 pb-28">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl safe-area-bottom">
        <div className="mx-auto flex w-full max-w-lg">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-bold transition-all",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className={cn(
                  "rounded-xl p-1.5 transition-all",
                  active && "bg-primary/15"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="font-display">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
