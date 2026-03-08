import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dices, Shield, Users, Swords, Settings, LogOut, Home, ScrollText, KeyRound, User, X, Save, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoAz from "@/assets/logo-az.jpeg";
import bgClasses from "@/assets/bg-classes.jpg";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const items: NavItem[] = [
  { label: "Início", path: "/inicio", icon: Home },
  { label: "Roleta", path: "/roleta", icon: Dices },
  { label: "Regras", path: "/regras", icon: ScrollText },
  { label: "Classes", path: "/classes", icon: Swords },
  { label: "Jogadores", path: "/jogadores", icon: Users },
  { label: "Config", path: "/config", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  // Class icon
  const [classIcon, setClassIcon] = useState<string | null>(null);
  const [playerRanking, setPlayerRanking] = useState<{ level: number | null; xp: string | null } | null>(null);

  useEffect(() => {
    if (profile?.class) {
      supabase
        .from("character_classes")
        .select("image_url")
        .eq("name", profile.class)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setClassIcon(data.image_url);
        });
    }
  }, [profile?.class]);

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from("player_rankings")
        .select("level, xp")
        .eq("user_id", profile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPlayerRanking(data);
        });
    }
  }, [profile?.id]);

  const navItems = items.filter((item) => !item.adminOnly || isAdmin);

  const onLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setShowPasswordModal(false);
      setNewPassword("");
      setCurrentPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar senha");
    }
    setChangingPw(false);
  };

  return (
    <div className="min-h-screen text-foreground relative">
      {/* Background image */}
      <div className="fixed inset-0 -z-10">
        <img src={bgClasses} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/90 to-background/95" />
      </div>

      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/60 backdrop-blur-xl">
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
            {/* Player name with dropdown */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-xl bg-background/60 backdrop-blur-md px-3 py-1.5 flex items-center gap-1.5 border border-border/30 hover:border-primary/30 transition-colors"
              >
                {classIcon ? (
                  <img src={classIcon} alt="" className="w-4 h-4 rounded object-cover" />
                ) : (
                  <Shield className="h-3 w-3 text-primary" />
                )}
                <p className="text-xs font-bold leading-none font-body">{profile?.nickname ?? "..."}</p>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 glass-card border border-border/60 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                    <button
                      onClick={() => { setShowProfileModal(true); setMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-primary" /> Meu Perfil
                    </button>
                    <button
                      onClick={() => { setShowPasswordModal(true); setMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-gold" /> Alterar Senha
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onLogout(); }}
                      className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sair
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onLogout}
              className="rounded-xl bg-background/60 backdrop-blur-md p-2 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors border border-border/30"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg px-4 py-5 pb-28">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/60 backdrop-blur-xl safe-area-bottom">
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

      {/* Profile Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Meu Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {classIcon ? (
                <img src={classIcon} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/30" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                  {profile?.nickname?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-display font-bold text-lg">{profile?.nickname}</p>
                <p className="text-xs text-muted-foreground font-body">
                  {profile?.class || "Sem classe"}
                  {profile?.role === "admin" && " • 👑 Admin"}
                </p>
                {playerRanking && (
                  <p className="text-xs font-display font-bold text-gold mt-0.5">
                    Lv.{playerRanking.level} • {playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {playerRanking && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Level</span>
                    <span className="text-sm font-display font-bold text-gold">{playerRanking.level}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/30">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">XP</span>
                    <span className="text-sm font-display font-bold text-gold">{playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center py-2 border-b border-border/30">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Telefone</span>
                <span className="text-sm font-body">{profile?.phone || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/30">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Classe</span>
                <span className="text-sm font-body flex items-center gap-1.5">
                  {classIcon && <img src={classIcon} alt="" className="w-4 h-4 rounded object-cover" />}
                  {profile?.class || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Role</span>
                <span className="text-sm font-body">{profile?.role === "admin" ? "👑 Admin" : "🎮 Jogador"}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={showPasswordModal} onOpenChange={(open) => { setShowPasswordModal(open); if (!open) { setNewPassword(""); setCurrentPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Nova Senha</span>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input-modern pr-10"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPasswordModal(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
              <button onClick={changePassword} disabled={changingPw || newPassword.length < 6} className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {changingPw ? "Salvando..." : "Alterar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
