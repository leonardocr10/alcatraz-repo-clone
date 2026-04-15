import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Dices, Shield, Users, Settings, LogOut, Home, ScrollText, KeyRound, User, X, Save, Eye, EyeOff, History, UsersRound, UserCircle, Camera, Loader2, Calendar, Info } from "lucide-react";
import { StaffModal } from "@/components/StaffModal";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import logoClanPanel from "@/assets/logo-clan-panel.png";
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
  { label: "Info", path: "/info", icon: Info },
  { label: "Char", path: "/char", icon: UserCircle },
  { label: "Histórico", path: "/historico", icon: History },
  { label: "Roleta", path: "/roleta", icon: Dices },
  { label: "Eventos", path: "/eventos", icon: Calendar },
  { label: "Jogadores", path: "/jogadores", icon: Users },
  { label: "Config", path: "/config", icon: Settings, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin, isLeader, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileAvatarExpanded, setProfileAvatarExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [visibleMenus, setVisibleMenus] = useState<string[]>(["/inicio", "/info", "/char", "/historico", "/eventos", "/roleta", "/jogadores"]);
  const [brandName, setBrandName] = useState("Clan Panel");
  const [brandLogo, setBrandLogo] = useState<string>(logoClanPanel);
  const [brandPrimaryColor, setBrandPrimaryColor] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loginAnnouncement, setLoginAnnouncement] = useState<any | null>(null);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [acknowledgingAnnouncement, setAcknowledgingAnnouncement] = useState(false);
  const profileAvatarInputRef = useRef<HTMLInputElement>(null);

  // Class icon
  const [classIcon, setClassIcon] = useState<string | null>(null);
  const [playerRanking, setPlayerRanking] = useState<{ level: number | null; xp: string | null } | null>(null);
  const profileImage = profile?.avatar_url || classIcon || null;

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

    // Load visible menus
    supabase
      .from("app_config")
      .select("visible_menus")
      .eq("id", "main")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.visible_menus) {
          setVisibleMenus(data.visible_menus as string[]);
        }
      });
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

  useEffect(() => {
    if (!profile?.clan) return;
    (supabase as any).from("clan_identity").select("display_name, logo_url, primary_color").eq("clan", profile.clan).limit(1).maybeSingle().then(({ data }: any) => {
      if (data?.display_name) setBrandName(data.display_name);
      else setBrandName(profile.clan || "Clan Panel");
      if (data?.logo_url) setBrandLogo(data.logo_url);
      else setBrandLogo(logoClanPanel);
      setBrandPrimaryColor(data?.primary_color || "190 85% 48%");
    });
  }, [profile?.clan]);

  useEffect(() => {
    if (!isAdmin && !isLeader) {
      setPendingApprovals(0);
      return;
    }

    const loadPendingApprovals = async () => {
      let query = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("approved", false);

      if (!isAdmin && profile?.clan) {
        query = query.eq("clan", profile.clan);
      }

      const { count, error } = await query;
      if (!error) {
        setPendingApprovals(count || 0);
      }
    };

    loadPendingApprovals();

    const channel = supabase
      .channel("layout-pending-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        loadPendingApprovals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, isLeader, profile?.clan, location.pathname]);

  const loadUnreadAnnouncement = useCallback(async () => {
    if (!profile?.id || !profile?.clan) {
      setLoginAnnouncement(null);
      setShowAnnouncementModal(false);
      return;
    }

    const { data: announcements, error: announcementsError } = await (supabase as any)
      .from("clan_announcements")
      .select("id, title, content, clan, is_active, require_ack, created_at")
      .eq("is_active", true)
      .eq("clan", profile.clan)
      .order("created_at", { ascending: false });

    if (announcementsError || !announcements?.length) {
      setLoginAnnouncement(null);
      setShowAnnouncementModal(false);
      return;
    }

    const ackRequired = announcements.filter((item: any) => item.require_ack !== false);
    if (ackRequired.length === 0) {
      setLoginAnnouncement(null);
      setShowAnnouncementModal(false);
      return;
    }

    const ids = ackRequired.map((item: any) => item.id);
    const { data: reads } = await (supabase as any)
      .from("clan_announcement_reads")
      .select("announcement_id")
      .eq("user_id", profile.id)
      .in("announcement_id", ids);

    const readSet = new Set((reads || []).map((item: any) => item.announcement_id));
    const firstUnread = ackRequired.find((item: any) => !readSet.has(item.id)) || null;

    setLoginAnnouncement(firstUnread);
    setShowAnnouncementModal(Boolean(firstUnread));
  }, [profile?.id, profile?.clan]);

  useEffect(() => {
    loadUnreadAnnouncement();
  }, [loadUnreadAnnouncement, location.pathname]);

  const acknowledgeAnnouncement = async () => {
    if (!loginAnnouncement?.id || !profile?.id) return;
    setAcknowledgingAnnouncement(true);
    const { error } = await (supabase as any).from("clan_announcement_reads").upsert(
      {
        announcement_id: loginAnnouncement.id,
        user_id: profile.id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,user_id" }
    );
    if (error) {
      toast.error(error.message || "Erro ao registrar ciência");
      setAcknowledgingAnnouncement(false);
      return;
    }
    toast.success("Ciência registrada!");
    setAcknowledgingAnnouncement(false);
    await loadUnreadAnnouncement();
  };

  useEffect(() => {
    if (!brandPrimaryColor) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", brandPrimaryColor);
    root.style.setProperty("--ring", brandPrimaryColor);
    root.style.setProperty("--sidebar-primary", brandPrimaryColor);
    root.style.setProperty("--sidebar-ring", brandPrimaryColor);
  }, [brandPrimaryColor]);

  const navItems = items.filter((item) => {
    if (item.path === "/config") return isAdmin || isLeader;
    if (item.adminOnly && !isAdmin) return false; // Not admin, hide config
    if (item.adminOnly && isAdmin) return true;   // Admin sees config
    return visibleMenus.includes(item.path);      // Regular items depend on config
  });

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

  const handleProfileAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateErr } = await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);
      if (updateErr) throw updateErr;

      toast.success("Foto atualizada!");
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto");
    }
    setUploadingAvatar(false);
    e.target.value = "";
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
            <img src={brandLogo} alt={brandName} className="w-9 h-9 rounded-xl border border-primary/30 shadow-md object-cover" />
            <div>
              <h1 className="font-display text-sm font-extrabold tracking-wide leading-none">
                <span className="text-primary">{brandName}</span>
              </h1>
              <p className="text-[10px] text-muted-foreground font-body">Gerencie, Domine, Conquiste</p>
            </div>
            
          </div>

          <div className="flex items-center gap-2">
            {/* Rules button */}
            <button
              onClick={() => navigate("/regras")}
              className={cn(
                "rounded-xl bg-background/60 backdrop-blur-md p-2 transition-colors border border-border/30",
                location.pathname === "/regras"
                  ? "text-primary border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/80"
              )}
            >
              <ScrollText className="h-4 w-4" />
            </button>
            {/* Staff button */}
            <button
              onClick={() => setShowStaffModal(true)}
              className="rounded-xl bg-background/60 backdrop-blur-md p-2 transition-colors border border-border/30 text-muted-foreground hover:text-foreground hover:bg-background/80"
            >
              <UsersRound className="h-4 w-4" />
            </button>
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
                {playerRanking?.level && (
                  <span className="text-[9px] font-display font-bold text-gold leading-none">Lv.{playerRanking.level}</span>
                )}
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
                  "relative rounded-xl p-1.5 transition-all",
                  active && "bg-primary/15"
                )}>
                  <item.icon className="h-5 w-5" />
                  {item.path === "/jogadores" && pendingApprovals > 0 && (isAdmin || isLeader) && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive border border-background" />
                  )}
                </div>
                <span className="font-display">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile Modal */}
      <Dialog
        open={showProfileModal}
        onOpenChange={(open) => {
          setShowProfileModal(open);
          if (!open) setProfileAvatarExpanded(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Meu Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={profileAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingAvatar}
              onChange={handleProfileAvatarUpload}
            />

            <div className="flex items-center gap-4">
              <div>
                {profileImage ? (
                  <button
                    type="button"
                    onClick={() => setProfileAvatarExpanded(true)}
                    className="block"
                    title="Ver imagem completa"
                  >
                    <img src={profileImage} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/30" />
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                    {profile?.nickname?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
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
                <button
                  type="button"
                  onClick={() => profileAvatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-display font-bold text-xs uppercase tracking-wider hover:bg-primary/30 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  {uploadingAvatar ? "Enviando..." : "Mudar Foto"}
                </button>
              </div>
            </div>

            {profileImage && profileAvatarExpanded && (
              <div
                className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
                onClick={() => setProfileAvatarExpanded(false)}
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4" onClick={(e) => e.stopPropagation()}>
                  <img
                    src={profileImage}
                    alt={profile?.nickname || "Avatar"}
                    className="max-w-[92vw] md:max-w-[70vw] max-h-[80vh] rounded-2xl object-contain border-2 border-primary/30 shadow-2xl bg-background/50"
                  />
                  <div className="w-full md:w-48">
                    <button
                      type="button"
                      onClick={() => profileAvatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="w-full px-3 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-display font-bold text-xs uppercase tracking-wider hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                      {uploadingAvatar ? "Enviando..." : "Mudar Foto"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileAvatarExpanded(false)}
                    className="text-xs text-muted-foreground hover:text-white transition-colors font-display uppercase tracking-wider"
                    title="Fechar"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}

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

      {/* Staff Modal */}
      <StaffModal open={showStaffModal} onOpenChange={setShowStaffModal} />

      <Dialog open={showAnnouncementModal} onOpenChange={(open) => { if (open) setShowAnnouncementModal(true); }}>
        <DialogContent className="max-w-sm [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Comunicado</DialogTitle>
          </DialogHeader>
          {loginAnnouncement && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
                <p className="font-display font-bold text-sm">{loginAnnouncement.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(loginAnnouncement.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{loginAnnouncement.content}</p>
              <button
                onClick={acknowledgeAnnouncement}
                disabled={acknowledgingAnnouncement}
                className="btn-primary w-full text-sm py-2.5"
              >
                {acknowledgingAnnouncement ? "Registrando..." : "Li e estou ciente"}
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
