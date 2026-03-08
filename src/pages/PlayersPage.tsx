import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Users, Search, Eye, Pencil, Link2, Trash2 } from "lucide-react";

type Player = {
  id: string;
  nickname: string;
  class: string | null;
  phone: string | null;
  role: "admin" | "user";
  created_at: string;
};

type ClassIcon = { name: string; image_url: string | null };

export default function PlayersPage() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [icons, setIcons] = useState<ClassIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
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
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                              <Link2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deletePlayer(player.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
    </div>
  );
}
