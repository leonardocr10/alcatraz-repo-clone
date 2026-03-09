import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Search, Pencil, MessageCircle, Trash2, X, Save, KeyRound, MoreVertical, RefreshCw, Trophy, Send, CheckSquare, Square } from "lucide-react";
import { getClanRoleEmoji, getClanRoleLabel, CLAN_ROLES } from "@/data/staffMembers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type CharacterClass = Database["public"]["Enums"]["character_class"];
type AppRole = Database["public"]["Enums"]["app_role"];

type Player = {
  id: string;
  nickname: string;
  class: CharacterClass | null;
  phone: string | null;
  role: AppRole;
  auth_id: string | null;
  created_at: string;
  clan_role: string | null;
  clan: string | null;
};

type ClassIcon = { name: string; image_url: string | null; description: string | null };
type Ranking = { user_id: string; level: number | null; xp: string | null; rank_position: number | null };

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Mechanician", "Archer", "Pikeman",
  "Knight", "Atalanta", "Priestess", "Magician",
];

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [icons, setIcons] = useState<ClassIcon[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("players-last-sync");
  });
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | null>(searchParams.get("class"));
  const [clanFilter, setClanFilter] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Edit modal state
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editClass, setEditClass] = useState<CharacterClass | "">("");
  const [editRole, setEditRole] = useState<AppRole>("user");
  const [editPhone, setEditPhone] = useState("");
  const [editClanRole, setEditClanRole] = useState("membro");
  const [editClan, setEditClan] = useState("AZ");
  const [saving, setSaving] = useState(false);

  // Reset password modal
  const [resetPlayer, setResetPlayer] = useState<Player | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Message modal state
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgText, setMsgText] = useState("");
  const [msgSelected, setMsgSelected] = useState<Set<string>>(new Set());
  const [msgSending, setMsgSending] = useState(false);

  // Class detail modal
  const [viewClass, setViewClass] = useState<ClassIcon | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [playersRes, iconsRes, rankingsRes] = await Promise.all([
      supabase.from("users").select("id, nickname, class, phone, role, auth_id, created_at, clan_role, clan").order("created_at", { ascending: false }),
      supabase.from("character_classes").select("name, image_url, description"),
      supabase.from("player_rankings").select("user_id, level, xp, rank_position"),
    ]);
    setPlayers((playersRes.data ?? []) as Player[]);
    setIcons((iconsRes.data ?? []) as ClassIcon[]);
    setRankings((rankingsRes.data ?? []) as Ranking[]);
    setLoading(false);
  };

  const updateLastSync = useCallback(() => {
    const value = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setLastSync(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("players-last-sync", value);
    }
  }, []);

  const [syncingPlayer, setSyncingPlayer] = useState<string | null>(null);

  const syncRankings = useCallback(async (showToast = true) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-rankings", { body: {} });
      if (error) throw error;

      const { data: newRankings } = await supabase.from("player_rankings").select("user_id, level, xp, rank_position");
      setRankings((newRankings ?? []) as Ranking[]);
      updateLastSync();

      if (showToast) {
        toast.success(`Ranking atualizado! ${data.matched} jogadores sincronizados`);
      }
    } catch (err: any) {
      if (showToast) {
        toast.error(err.message || "Erro ao sincronizar ranking");
      } else {
        console.error("Erro na sincronização automática:", err);
      }
    }
    setSyncing(false);
  }, [updateLastSync]);

  const syncSinglePlayer = useCallback(async (player: Player) => {
    setMenuOpen(null);
    setSyncingPlayer(player.id);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-rankings", {
        body: { nickname: player.nickname, userId: player.id },
      });
      if (error) throw error;
      if (data?.matched > 0) {
        const { data: newRankings } = await supabase.from("player_rankings").select("user_id, level, xp, rank_position");
        setRankings((newRankings ?? []) as Ranking[]);
        toast.success(`${player.nickname} sincronizado!`);
      } else {
        toast.error(`${player.nickname} não encontrado no ranking`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao sincronizar");
    }
    setSyncingPlayer(null);
  }, []);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      syncRankings(false);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [syncRankings]);

  const iconMap = useMemo(() => new Map(icons.map((c) => [c.name, c.image_url])), [icons]);
  const classDetailMap = useMemo(() => new Map(icons.map((c) => [c.name, c])), [icons]);
  const rankingMap = useMemo(() => new Map(rankings.map((r) => [r.user_id, r])), [rankings]);

  const filtered = useMemo(() => {
    let list = players;
    if (clanFilter) {
      list = list.filter((p) => (p.clan || "AZ") === clanFilter);
    }
    if (classFilter) {
      list = list.filter((p) => p.class === classFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) => p.nickname.toLowerCase().includes(q) || (p.phone && p.phone.includes(q))
      );
    }
    // Sort by level desc, then xp desc
    return [...list].sort((a, b) => {
      const ra = rankingMap.get(a.id);
      const rb = rankingMap.get(b.id);
      const lvlA = ra?.level ?? 0;
      const lvlB = rb?.level ?? 0;
      if (lvlB !== lvlA) return lvlB - lvlA;
      const xpA = parseFloat((ra?.xp ?? "0").replace(",", ".")) || 0;
      const xpB = parseFloat((rb?.xp ?? "0").replace(",", ".")) || 0;
      return xpB - xpA;
    });
  }, [players, search, classFilter, clanFilter, rankingMap]);

  const clearClassFilter = () => {
    setClassFilter(null);
    setSearchParams({});
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return "—";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return phone;
  };

  const openEdit = (player: Player) => {
    setEditPlayer(player);
    setEditNickname(player.nickname);
    setEditClass(player.class || "");
    setEditRole(player.role);
    setEditPhone(player.phone || "");
    setEditClanRole(player.clan_role || "membro");
    setEditClan(player.clan || "AZ");
    setMenuOpen(null);
  };

  const saveEdit = async () => {
    if (!editPlayer) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      nickname: editNickname.trim(),
      class: editClass || null,
      role: editRole,
      phone: editPhone.replace(/\D/g, "") || null,
      clan_role: editClanRole,
      clan: editClan,
    };
    const { error } = await supabase.from("users").update(payload).eq("id", editPlayer.id);
    if (error) {
      toast.error("Erro ao salvar: " + (error.message || "Erro desconhecido"));
    } else {
      toast.success("Jogador atualizado!");
      await fetchData();
      setEditPlayer(null);
    }
    setSaving(false);
  };

  const deletePlayer = async (player: Player) => {
    if (!confirm(`Tem certeza que deseja remover ${player.nickname}?`)) return;
    setMenuOpen(null);
    const { error } = await supabase.from("users").delete().eq("id", player.id);
    if (error) {
      toast.error("Erro ao remover jogador");
    } else {
      toast.success("Jogador removido");
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    }
  };

  const openWhatsApp = (player: Player) => {
    setMenuOpen(null);
    if (!player.phone) { toast.error("Jogador sem telefone cadastrado"); return; }
    const digits = player.phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(`Olá ${player.nickname}! 🎮`)}`, "_blank");
  };

  const resetPassword = async () => {
    if (!resetPlayer || !newPassword.trim()) return;
    if (newPassword.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setResetting(true);
    try {
      // Use edge function or admin API - for now use supabase auth admin
      const { error } = await supabase.functions.invoke("roulette-admin", {
        body: { action: "reset_password", auth_id: resetPlayer.auth_id, new_password: newPassword },
      });
      if (error) throw error;
      toast.success(`Senha de ${resetPlayer.nickname} resetada!`);
      setResetPlayer(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao resetar senha");
    }
    setResetting(false);
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const classColors: Record<string, string> = {
    Fighter: "bg-red-500/20 text-red-400",
    Mechanician: "bg-green-500/20 text-green-400",
    Archer: "bg-amber-500/20 text-amber-400",
    Pikeman: "bg-blue-500/20 text-blue-400",
    Knight: "bg-purple-500/20 text-purple-400",
    Atalanta: "bg-pink-500/20 text-pink-400",
    Priestess: "bg-yellow-500/20 text-yellow-400",
    Magician: "bg-cyan-500/20 text-cyan-400",
  };

  const playersWithPhone = useMemo(() => players.filter(p => p.phone && p.phone.replace(/\D/g, "").length >= 10), [players]);

  const openMsgModal = () => {
    setMsgOpen(true);
    setMsgText("");
    setMsgSelected(new Set(playersWithPhone.map(p => p.id)));
  };

  const toggleMsgPlayer = (id: string) => {
    setMsgSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllMsg = () => {
    if (msgSelected.size === playersWithPhone.length) {
      setMsgSelected(new Set());
    } else {
      setMsgSelected(new Set(playersWithPhone.map(p => p.id)));
    }
  };

  const sendMessage = async () => {
    if (!msgText.trim() || msgSelected.size === 0) return;
    setMsgSending(true);
    try {
      const phones = playersWithPhone
        .filter(p => msgSelected.has(p.id))
        .map(p => ({ phone: p.phone!, nickname: p.nickname }));
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: { phones, message: msgText.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Mensagem enviada para ${data.sent}/${data.total} jogadores!`);
      if (data?.errors?.length) {
        console.warn("Send errors:", data.errors);
      }
      setMsgOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    }
    setMsgSending(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider">Jogadores</h2>
            <p className="text-xs text-muted-foreground font-body">
              {players.length} registrados{lastSync ? ` • última sync ${lastSync}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={openMsgModal}
              className="flex flex-col items-center text-xs font-display font-bold text-primary px-3 py-1 rounded-xl hover:bg-primary/10 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Mensagem</span>
            </button>
          )}
          <button
            onClick={() => syncRankings(true)}
            disabled={syncing}
            className="flex flex-col items-center text-xs font-display font-bold text-primary px-3 py-1 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "..." : "Sincronizar"}</span>
          </button>
        </div>
      </div>
      {lastSync && (
        <p className="text-[10px] text-muted-foreground font-body text-right -mt-2">Última sync: {lastSync}</p>
      )}

      {/* Clan Filter */}
      <div className="flex gap-1.5">
        {[null, "AZ", "AZ2"].map((clan) => (
          <button
            key={clan ?? "all"}
            onClick={() => setClanFilter(clan)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-colors ${
              clanFilter === clan
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {clan ?? "Todos"}
          </button>
        ))}
        <span className="ml-auto text-xs font-display font-bold text-muted-foreground self-center">
          {filtered.length} jogadores
        </span>
      </div>

      {/* Class Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={clearClassFilter}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-colors ${
            !classFilter
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          Todas
        </button>
        {ALL_CLASSES.map((cls) => {
          const icon = iconMap.get(cls);
          const isActive = classFilter === cls;
          return (
            <button
              key={cls}
              onClick={() => {
                if (isActive) {
                  clearClassFilter();
                } else {
                  setClassFilter(cls);
                  setSearchParams({ class: cls });
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold transition-colors ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {icon && <img src={icon} alt="" className="w-4 h-4 rounded object-cover" />}
              {cls}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nickname ou telefone..." className="input-modern pl-11" />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-12 font-body">Nenhum jogador encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((player, index) => {
            const iconUrl = player.class ? iconMap.get(player.class) : null;
            const colorClass = player.class ? classColors[player.class] || "bg-secondary text-muted-foreground" : "";
            const ranking = rankingMap.get(player.id);

            return (
              <div key={player.id} className="glass-card p-3 flex items-center gap-3">
                {/* Position */}
                <span className="font-display font-extrabold text-xs text-muted-foreground w-5 text-center shrink-0">
                  {index + 1}
                </span>
                {/* Avatar - clickable to view class */}
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover border border-border/40 shrink-0 cursor-pointer active:scale-95 transition-transform"
                    onClick={() => player.class && setViewClass(classDetailMap.get(player.class) || null)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {getInitial(player.nickname)}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-display font-bold text-sm truncate">{player.nickname}</span>
                    <span className="text-[9px] font-display font-bold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{player.clan || "AZ"}</span>
                    {(() => {
                      const label = getClanRoleLabel(player.clan_role);
                      const emoji = getClanRoleEmoji(player.clan_role);
                      return (
                        <span className="text-[10px] font-display font-bold text-muted-foreground">
                          {emoji ? `${emoji} ` : ""}{label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {player.class ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colorClass}`}>
                        {iconUrl && <img src={iconUrl} alt="" className="w-3 h-3 rounded object-cover" />}
                        {player.class}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Sem classe</span>
                    )}
                  </div>
                </div>

                {/* Level/XP */}
                {ranking && (
                  <div className="text-right shrink-0">
                    <p className="font-display text-sm font-extrabold text-gold">Lv.{ranking.level}</p>
                    <p className="text-[10px] text-muted-foreground font-body">{ranking.xp?.endsWith('%') ? ranking.xp : `${ranking.xp}%`}</p>
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setMenuOpen(menuOpen === player.id ? null : player.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {menuOpen === player.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 bottom-full mb-1 z-50 w-44 glass-card border border-border/60 rounded-xl shadow-xl overflow-hidden animate-fade-in">
                          <button
                            onClick={() => openEdit(player)}
                            className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-primary" /> Editar
                          </button>
                          <button
                            onClick={() => { setResetPlayer(player); setMenuOpen(null); }}
                            className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-gold" /> Resetar Senha
                          </button>
                          <button
                            onClick={() => openWhatsApp(player)}
                            className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-green-400" /> WhatsApp
                          </button>
                          <button
                            onClick={() => syncSinglePlayer(player)}
                            disabled={syncingPlayer === player.id}
                            className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-primary ${syncingPlayer === player.id ? "animate-spin" : ""}`} /> Sincronizar
                          </button>
                          <button
                            onClick={() => deletePlayer(player)}
                            className="w-full px-4 py-2.5 text-left text-sm font-body flex items-center gap-2.5 hover:bg-destructive/10 text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remover
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editPlayer} onOpenChange={() => setEditPlayer(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Editar Jogador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Nickname</span>
              <input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} className="input-modern" />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Classe</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setEditClass("")}
                  className={`px-3 py-2 rounded-xl text-xs font-body transition-all border ${
                    editClass === "" ? "border-primary bg-primary/15 text-primary font-bold" : "border-border/40 hover:border-muted-foreground/30"
                  }`}
                >
                  Nenhuma
                </button>
                {ALL_CLASSES.map((c) => {
                  const cIcon = iconMap.get(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setEditClass(c)}
                      className={`px-3 py-2 rounded-xl text-xs font-body transition-all border flex items-center gap-1.5 ${
                        editClass === c ? "border-primary bg-primary/15 text-primary font-bold" : "border-border/40 hover:border-muted-foreground/30"
                      }`}
                    >
                      {cIcon && <img src={cIcon} alt="" className="w-4 h-4 rounded object-cover" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Role</span>
              <div className="flex gap-2">
                {(["user", "admin"] as AppRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setEditRole(r)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-display font-bold uppercase tracking-wider transition-all border ${
                      editRole === r
                        ? r === "admin" ? "border-gold bg-gold/15 text-gold" : "border-primary bg-primary/15 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {r === "admin" ? "👑 Admin" : "🎮 User"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Cargo no Clã</span>
              <div className="flex flex-wrap gap-1.5">
                {CLAN_ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setEditClanRole(r.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-display font-bold transition-all border ${
                      editClanRole === r.value
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {r.emoji ? `${r.emoji} ` : ""}{r.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Telefone</span>
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="input-modern" placeholder="34999999999" />
            </label>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditPlayer(null)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
              <button onClick={saveEdit} disabled={saving || !editNickname.trim()} className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={!!resetPlayer} onOpenChange={() => { setResetPlayer(null); setNewPassword(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Resetar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-body">
              Definir nova senha para <span className="text-foreground font-bold">{resetPlayer?.nickname}</span>
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (mín. 6 caracteres)"
              className="input-modern"
            />
            <div className="flex gap-2">
              <button onClick={() => { setResetPlayer(null); setNewPassword(""); }} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
              <button onClick={resetPassword} disabled={resetting || newPassword.length < 6} className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2">
                <KeyRound className="w-4 h-4" />
                {resetting ? "Resetando..." : "Resetar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Message Modal */}
      <Dialog open={msgOpen} onOpenChange={setMsgOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Enviar Mensagem
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Message text */}
            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Mensagem</span>
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                placeholder="Digite a mensagem..."
                className="input-modern min-h-[80px] resize-none"
                rows={3}
              />
            </label>

            {/* Player selection */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  Destinatários ({msgSelected.size}/{playersWithPhone.length})
                </span>
                <button
                  onClick={toggleAllMsg}
                  className="text-[10px] font-display font-bold text-primary hover:underline"
                >
                  {msgSelected.size === playersWithPhone.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 space-y-1 max-h-[200px] pr-1">
                {playersWithPhone.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleMsgPlayer(p.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-body transition-all border ${
                      msgSelected.has(p.id)
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/40 text-muted-foreground hover:border-muted-foreground/30"
                    }`}
                  >
                    {msgSelected.has(p.id) ? (
                      <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate font-semibold">{p.nickname}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{formatPhone(p.phone)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Send button */}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setMsgOpen(false)} className="btn-secondary flex-1 text-sm py-2.5">Cancelar</button>
              <button
                onClick={sendMessage}
                disabled={msgSending || !msgText.trim() || msgSelected.size === 0}
                className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {msgSending ? "Enviando..." : `Enviar (${msgSelected.size})`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Class Detail Modal */}
      <Dialog open={!!viewClass} onOpenChange={() => setViewClass(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="font-display text-center">{viewClass?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {viewClass?.image_url && (
              <img
                src={viewClass.image_url}
                alt={viewClass.name}
                className="w-32 h-32 rounded-2xl object-cover border-2 border-border/40"
              />
            )}
            {viewClass?.description ? (
              <p className="text-sm text-muted-foreground font-body text-center leading-relaxed">
                {viewClass.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground font-body text-center italic">
                Sem descrição disponível.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
