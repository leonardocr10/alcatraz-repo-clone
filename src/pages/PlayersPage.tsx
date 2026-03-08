import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Player = {
  id: string;
  nickname: string;
  class: string | null;
  role: "admin" | "user";
  created_at: string;
};

type ClassIcon = { name: string; image_url: string | null };

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [icons, setIcons] = useState<ClassIcon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [playersRes, iconsRes] = await Promise.all([
        supabase.from("users").select("id, nickname, class, role, created_at").order("created_at", { ascending: false }),
        supabase.from("character_classes").select("name, image_url"),
      ]);

      setPlayers(((playersRes.data ?? []) as Player[]));
      setIcons(((iconsRes.data ?? []) as ClassIcon[]));
      setLoading(false);
    };

    fetchData();
  }, []);

  const iconMap = useMemo(() => new Map(icons.map((c) => [c.name, c.image_url])), [icons]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Jogadores</h2>
      </div>

      {loading ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Carregando jogadores...</p>
      ) : players.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum jogador encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Nickname</th>
                <th className="px-4 py-2 font-medium">Classe</th>
                <th className="px-4 py-2 font-medium">Papel</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const iconUrl = player.class ? iconMap.get(player.class) : null;
                return (
                  <tr key={player.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{player.nickname}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt={`Ícone da classe ${player.class}`}
                            className="h-5 w-5 rounded object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <span>{player.class ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2 uppercase text-xs tracking-wide text-muted-foreground">{player.role}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
