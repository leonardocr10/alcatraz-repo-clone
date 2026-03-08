import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Search, Pencil, MessageCircle, Trash2, X, Save } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CharacterClass = Database["public"]["Enums"]["character_class"];
type AppRole = Database["public"]["Enums"]["app_role"];

type Player = {
  id: string;
  nickname: string;
  class: CharacterClass | null;
  phone: string | null;
  role: AppRole;
  created_at: string;
};

type ClassIcon = { name: string; image_url: string | null };

const ALL_CLASSES: CharacterClass[] = [
  "Fighter", "Mechanician", "Archer", "Pikeman",
  "Knight", "Atalanta", "Priestess", "Magician",
];

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [icons, setIcons] = useState<ClassIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit modal state
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editClass, setEditClass] = useState<CharacterClass | "">("");
  const [editRole, setEditRole] = useState<AppRole>("user");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [playersRes, iconsRes] = await Promise.all([
      supabase.from("users").select("id, nickname, class, phone, role, created_at").order("created_at", { ascending: false }),
      supabase.from("character_classes").select("name, image_url"),
    ]);
    setPlayers((playersRes.data ?? []) as Player[]);
    setIcons((iconsRes.data ?? []) as ClassIcon[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const iconMap = useMemo(() => new Map(icons.map((c) => [c.name, c.image_url])), [icons]);

  const filtered = useMemo(() => {
    if (!search.trim()) return players;
    const q = search.toLowerCase();
    return players.filter(
      (p) =>
        p.nickname.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
    );
  }, [players, search]);

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
  };

  const closeEdit = () => {
    setEditPlayer(null);
  };

  const saveEdit = async () => {
    if (!editPlayer) return;
    setSaving(true);

    const payload: Record<string, unknown> = {
      nickname: editNickname.trim(),
      class: editClass || null,
      role: editRole,
      phone: editPhone.replace(/\D/g, "") || null,
    };

    const { error } = await supabase.from("users").update(payload).eq("id", editPlayer.id);
    if (error) {
      toast.error("Erro ao salvar: " + (error.message || "Erro desconhecido"));
    } else {
      toast.success("Jogador atualizado!");
      await fetchData();
      closeEdit();
    }
    setSaving(false);
  };

  const deletePlayer = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este jogador?")) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover jogador");
    } else {
      toast.success("Jogador removido");
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const openWhatsApp = (player: Player) => {
    if (!player.phone) {
      toast.error("Jogador sem telefone cadastrado");
      return;
    }
    const digits = player.phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    const message = encodeURIComponent(`Olá ${player.nickname}! 🎮`);
    window.open(`https://wa.me/${number}?text=${message}`, "_blank");
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider">Jogadores</h2>
          <p className="text-xs text-muted-foreground font-body">{players.length} registrados</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nickname ou telefone..."
          className="input-modern pl-11"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-12 font-body">Nenhum jogador encontrado.</p>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-display">Jogador</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-display">Classe</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-display">Telefone</th>
                  {isAdmin && <th className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-display text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => {
                  const iconUrl = player.class ? iconMap.get(player.class) : null;
                  const colorClass = player.class ? classColors[player.class] || "bg-secondary text-muted-foreground" : "";

                  return (
                    <tr key={player.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {iconUrl ? (
                            <img src={iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-border/40" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                              {getInitial(player.nickname)}
                            </div>
                          )}
                          <span className="font-medium text-foreground">
                            {player.nickname}
                            {player.role === "admin" && (
                              <span className="ml-1.5 text-gold text-[10px]">👑</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {player.class ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${colorClass}`}>
                            {iconUrl && <img src={iconUrl} alt="" className="w-3.5 h-3.5 rounded object-cover" />}
                            {player.class}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-body">
                        {formatPhone(player.phone)}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(player)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openWhatsApp(player)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePlayer(player.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={closeEdit}>
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Editar Jogador</h3>
              <button onClick={closeEdit} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Nickname</span>
                <input
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="input-modern"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Classe</span>
                <select
                  value={editClass}
                  onChange={(e) => setEditClass(e.target.value as CharacterClass | "")}
                  className="input-modern"
                >
                  <option value="">Sem classe</option>
                  {ALL_CLASSES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Role</span>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AppRole)}
                  className="input-modern"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</span>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="input-modern"
                  placeholder="34999999999"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={closeEdit} className="btn-secondary flex-1 text-sm py-2">
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editNickname.trim()}
                className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
