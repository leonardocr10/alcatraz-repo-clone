import { useEffect, useMemo, useState } from "react";
import { Clock, ScrollText, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type BossScheduleRow = {
  id: string;
  spawn_time: string;
  notify_minutes_before: number;
  boss_id: string;
  bosses: {
    name: string;
    map_level: string | null;
    map_image_url: string | null;
  } | null;
};

type NextBoss = {
  id: string;
  bossName: string;
  spawnTime: string;
  minutesUntil: number;
  mapLevel: string | null;
  mapImageUrl: string | null;
};

const getBrazilNow = () => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc - 3 * 60 * 60000);
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export default function RouletteGamePage() {
  const [now, setNow] = useState(getBrazilNow());
  const [rulesOpen, setRulesOpen] = useState(true);
  const [nextBosses, setNextBosses] = useState<NextBoss[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(getBrazilNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchBosses = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("boss_schedules")
        .select("id, spawn_time, notify_minutes_before, boss_id, bosses(name, map_level, map_image_url)")
        .order("spawn_time", { ascending: true });

      const rows = (data ?? []) as unknown as BossScheduleRow[];
      const currentMinutes = getBrazilNow().getHours() * 60 + getBrazilNow().getMinutes();

      const nearestByBoss = new Map<string, NextBoss>();

      for (const row of rows) {
        const spawnMins = toMinutes(row.spawn_time);
        let diff = spawnMins - currentMinutes;
        if (diff < 0) diff += 24 * 60;

        const candidate: NextBoss = {
          id: row.id,
          bossName: row.bosses?.name ?? "Boss",
          spawnTime: row.spawn_time.slice(0, 5),
          minutesUntil: diff,
          mapLevel: row.bosses?.map_level ?? null,
          mapImageUrl: row.bosses?.map_image_url ?? null,
        };

        const existing = nearestByBoss.get(row.boss_id);
        if (!existing || candidate.minutesUntil < existing.minutesUntil) {
          nearestByBoss.set(row.boss_id, candidate);
        }
      }

      setNextBosses(Array.from(nearestByBoss.values()).sort((a, b) => a.minutesUntil - b.minutesUntil).slice(0, 8));
      setLoading(false);
    };

    fetchBosses();
  }, []);

  const timeLabel = useMemo(
    () => now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    [now],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <p className="text-lg font-semibold">{timeLabel} <span className="text-xs text-muted-foreground">BRT</span></p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <button
          onClick={() => setRulesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 hover:bg-secondary/40"
        >
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Regras do Clã</h2>
          </div>
          {rulesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {rulesOpen ? (
          <div className="space-y-3 border-t border-border px-4 py-4 text-sm text-card-foreground">
            <p className="text-muted-foreground">
              Para manter um ambiente saudável e o crescimento de todos os membros, pedimos que todos respeitem as regras abaixo:
            </p>
            <div className="space-y-2">
              <p><strong>🤝 Respeito entre os membros</strong><br />Todos os integrantes devem manter respeito uns com os outros. Discussões, ofensas ou atitudes tóxicas não serão toleradas.</p>
              <p><strong>🕊️ Clã Pacífico (até o nível 105)</strong><br />Nosso clã tem postura pacífica até o nível 105, com foco total em upar e fortalecer os membros. No entanto, caso sejamos atacados, é permitido revidar.</p>
              <p><strong>⚠️ Evitar conflitos desnecessários</strong><br />Não iniciar confusões ou guerras com outros jogadores ou clãs. Uma guerra neste momento pode prejudicar o progresso e o up de outros membros do clã.</p>
              <p><strong>💰 Prioridade de comércio dentro do clã</strong><br />Sempre que possível, priorize vender ou trocar itens primeiro com membros do clã. Caso ninguém tenha interesse, então negocie com jogadores de fora.</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Próximos Boss</h2>
        </div>

        {loading ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Carregando...</p>
        ) : nextBosses.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum boss agendado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {nextBosses.map((boss) => (
              <li key={boss.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{boss.bossName}</p>
                  <p className="text-xs text-muted-foreground">Spawn às {boss.spawnTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-primary">{boss.minutesUntil}min</p>
                  <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {boss.mapLevel ?? "Local não informado"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
