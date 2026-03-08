import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Metric = { label: string; value: number };

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);

      const [users, items, sessions, bosses] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("roulette_items").select("id", { count: "exact", head: true }),
        supabase.from("roulette_sessions").select("id", { count: "exact", head: true }),
        supabase.from("bosses").select("id", { count: "exact", head: true }),
      ]);

      setMetrics([
        { label: "Jogadores", value: users.count ?? 0 },
        { label: "Itens da Roleta", value: items.count ?? 0 },
        { label: "Sessões", value: sessions.count ?? 0 },
        { label: "Bosses", value: bosses.count ?? 0 },
      ]);

      setLoading(false);
    };

    fetchMetrics();
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Visão geral do Admin</h2>
        <p className="text-sm text-muted-foreground">Restauração concluída com os módulos principais ativos.</p>
      </section>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando métricas...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{metric.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
