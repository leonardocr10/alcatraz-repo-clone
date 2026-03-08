import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Swords, Clock, MapPin, ChevronDown, Send, MessageCircle, BellOff, BellRing, RefreshCw, Users, Shield } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useBossNotifications } from "@/hooks/useBossNotifications";

interface Boss {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  map_level: string | null;
  map_image_url: string | null;
  drops: string | null;
}

interface BossSchedule {
  id: string;
  boss_id: string;
  spawn_time: string;
  notify_minutes_before: number;
}

interface ClassCount {
  class: string;
  count: number;
}

const HomePage = () => {
  const { isAdmin } = useAuth();
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [bossSchedules, setBossSchedules] = useState<BossSchedule[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedBoss, setExpandedBoss] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; title: string; description?: string; mapLevel?: string } | null>(null);
  const [sendingBoss, setSendingBoss] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [classCounts, setClassCounts] = useState<ClassCount[]>([]);
  const bossNotify = useBossNotifications();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchBosses = useCallback(async () => {
    const [bossRes, schedRes] = await Promise.all([
      supabase.from("bosses").select("*").order("name"),
      supabase.from("boss_schedules").select("*").order("spawn_time"),
    ]);
    setBosses((bossRes.data || []) as Boss[]);
    setBossSchedules((schedRes.data || []) as BossSchedule[]);
  }, []);

  const fetchClassCounts = useCallback(async () => {
    const { data } = await supabase
      .from("users")
      .select("class")
      .eq("approved", true)
      .not("class", "is", null);
    
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((u: any) => {
        if (u.class) {
          counts[u.class] = (counts[u.class] || 0) + 1;
        }
      });
      const sorted = Object.entries(counts)
        .map(([cls, count]) => ({ class: cls, count }))
        .sort((a, b) => b.count - a.count);
      setClassCounts(sorted);
    }
  }, []);

  useEffect(() => {
    fetchBosses();
    fetchClassCounts();
  }, [fetchBosses, fetchClassCounts]);

  useEffect(() => {
    const ch = supabase
      .channel("bosses-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bosses" }, () => fetchBosses())
      .on("postgres_changes", { event: "*", schema: "public", table: "boss_schedules" }, () => fetchBosses())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchBosses]);

  const getBrazilTime = useCallback(() => {
    const now = currentTime;
    const brazilOffset = -3 * 60;
    return new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  }, [currentTime]);

  const getBrazilTimeStr = () => {
    return getBrazilTime().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getGroupedBosses = useCallback(() => {
    const brazilTime = getBrazilTime();
    const currentMins = brazilTime.getHours() * 60 + brazilTime.getMinutes();

    return bosses.map((boss) => {
      const scheds = bossSchedules
        .filter((s) => s.boss_id === boss.id)
        .map((s) => {
          const [h, m] = s.spawn_time.split(":").map(Number);
          const spawnMins = h * 60 + m;
          let diff = spawnMins - currentMins;
          if (diff < 0) diff += 24 * 60;
          return { ...s, minutesUntil: diff };
        })
        .sort((a, b) => a.minutesUntil - b.minutesUntil);

      const nextSchedule = scheds[0] || null;
      return { boss, schedules: scheds, nextSchedule };
    }).filter((g) => g.schedules.length > 0)
      .sort((a, b) => (a.nextSchedule?.minutesUntil || 9999) - (b.nextSchedule?.minutesUntil || 9999));
  }, [bosses, bossSchedules, getBrazilTime]);

  const getTimeColor = (mins: number) => {
    if (mins <= 5) return "text-red-500 animate-pulse";
    if (mins <= 15) return "text-red-400";
    if (mins <= 30) return "text-amber-400";
    if (mins <= 60) return "text-yellow-400";
    return "text-muted-foreground";
  };

  const formatMinutesUntil = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
    return `${m}min`;
  };

  const sendBossNotify = async (bossId: string) => {
    setSendingBoss(bossId);
    try {
      const { data, error } = await supabase.functions.invoke("boss-notify", {
        body: { force: true, boss_id: bossId },
      });
      if (error) throw error;
      toast.success(data?.message || "Notificação enviada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    }
    setSendingBoss(null);
  };

  const sendAllBossNotify = async () => {
    setSendingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("boss-notify", {
        body: { force: true, all: true },
      });
      if (error) throw error;
      toast.success(data?.message || "Notificações enviadas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar");
    }
    setSendingAll(false);
  };

  const groupedBosses = getGroupedBosses();
  const totalPlayers = classCounts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-4">
      {/* Image Modal */}
      <Dialog open={!!imageModal} onOpenChange={() => setImageModal(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-4 bg-background/95">
          {imageModal && (
            <div className="text-center space-y-3">
              <p className="font-display text-lg font-extrabold">{imageModal.title}</p>
              {imageModal.mapLevel && (
                <p className="text-xs text-muted-foreground font-body flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> {imageModal.mapLevel}
                </p>
              )}
              <img src={imageModal.url} alt={imageModal.title} className="max-w-full max-h-[60vh] object-contain rounded-xl mx-auto" />
              {imageModal.description && (
                <p className="text-sm text-muted-foreground font-body text-left px-2">{imageModal.description}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Clock + BRT + Refresh */}
      <div className="glass-card p-2.5 flex items-center justify-between">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-display text-lg font-extrabold tabular-nums">{getBrazilTimeStr()}</span>
          <span className="text-[10px] text-muted-foreground font-body bg-secondary px-1.5 py-0.5 rounded-md">BRT</span>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => { fetchBosses(); fetchClassCounts(); toast.success("Atualizado!"); }}
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-primary"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Desktop Notifications */}
      {bossNotify.supported && (
        <div className="glass-card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {bossNotify.enabled ? (
              <BellRing className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <BellOff className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-display font-extrabold truncate">
                {bossNotify.enabled ? "Alertas Ativos" : "Alertas Desktop"}
              </p>
              <p className="text-[10px] text-muted-foreground/70">
                {bossNotify.enabled ? "Você receberá alertas automáticos" : "Receba alertas de spawn no desktop"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {bossNotify.enabled && isAdmin && (
              <button
                onClick={() => {
                  const ok = bossNotify.sendTestNotification();
                  if (ok) toast.success("Notificação de teste enviada!");
                  else toast.error("Permissão não concedida");
                }}
                className="text-[10px] font-display font-bold px-2 py-1.5 rounded-xl bg-gold/15 text-gold hover:bg-gold/25 transition-colors"
              >
                Testar
              </button>
            )}
            <button
              onClick={bossNotify.toggle}
              className={`text-xs font-display font-bold px-3 py-1.5 rounded-xl transition-colors ${
                bossNotify.enabled
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {bossNotify.enabled ? "Desativar" : "Ativar"}
            </button>
          </div>
        </div>
      )}

      {/* Players by Class */}
      {classCounts.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span className="font-display text-sm font-extrabold uppercase tracking-wider">Classes do Clã</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-display font-bold text-muted-foreground">{totalPlayers} jogadores</span>
            </div>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {classCounts.map(({ class: cls, count }) => (
              <div
                key={cls}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/20"
              >
                <span className="text-xs font-display font-bold text-foreground truncate">{cls}</span>
                <span className="text-sm font-display font-extrabold text-primary tabular-nums ml-2">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bosses */}
      {groupedBosses.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              <span className="font-display text-sm font-extrabold uppercase tracking-wider">Próximos Boss</span>
            </div>
            {isAdmin && (
              <button
                onClick={sendAllBossNotify}
                disabled={sendingAll}
                className="text-xs font-display font-bold text-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {sendingAll ? "..." : "Enviar Todos"}
              </button>
            )}
          </div>
          <div className="divide-y divide-border/20">
            {groupedBosses.map(({ boss, schedules, nextSchedule }) => (
              <div key={boss.id}>
                <button
                  onClick={() => setExpandedBoss(expandedBoss === boss.id ? null : boss.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                >
                  <div className="shrink-0" onClick={(e) => {
                    e.stopPropagation();
                    if (boss.image_url) setImageModal({
                      url: boss.image_url,
                      title: boss.name,
                      description: boss.description || undefined,
                      mapLevel: boss.map_level || undefined,
                    });
                  }}>
                    {boss.image_url ? (
                      <img src={boss.image_url} alt={boss.name} className="w-12 h-12 rounded-full object-cover border-2 border-border/40" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <Swords className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-display font-extrabold text-gold truncate">{boss.name}</span>
                      {boss.map_level && (
                        <span className="text-xs text-muted-foreground font-body truncate">({boss.map_level})</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Spawn às {nextSchedule?.spawn_time.substring(0, 5)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {nextSchedule && (
                      <span className={`flex items-center gap-1.5 text-sm font-bold font-display tabular-nums ${getTimeColor(nextSchedule.minutesUntil)}`}>
                        <Clock className="w-3.5 h-3.5" />
                        {formatMinutesUntil(nextSchedule.minutesUntil)}
                      </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expandedBoss === boss.id ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {expandedBoss === boss.id && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border/10 pt-3 bg-secondary/10">
                    {/* Description */}
                    {boss.description && (
                      <p className="text-xs text-muted-foreground font-body leading-relaxed">{boss.description}</p>
                    )}

                    {/* Drops */}
                    {boss.drops && (
                      <div>
                        <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-1">Drops</p>
                        <p className="text-xs text-foreground/80 font-body">{boss.drops}</p>
                      </div>
                    )}

                    {/* All spawn times */}
                    <div>
                      <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Horários de Spawn</p>
                      <div className="flex flex-wrap gap-1.5">
                        {schedules.map((sched) => {
                          const isNext = sched.id === nextSchedule?.id;
                          return (
                            <span
                              key={sched.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-display font-bold ${
                                isNext ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary/60 text-muted-foreground"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {sched.spawn_time.substring(0, 5)}
                              {isNext && <span className="text-[9px] opacity-70">← próximo</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {boss.image_url && (
                        <button
                          onClick={() => setImageModal({
                            url: boss.image_url!,
                            title: boss.name,
                            description: boss.description || undefined,
                            mapLevel: boss.map_level || undefined,
                          })}
                          className="text-xs font-body text-muted-foreground flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-secondary transition-colors border border-border/20"
                        >
                          <Swords className="w-3.5 h-3.5" /> Ver Boss
                        </button>
                      )}
                      {boss.map_image_url && (
                        <button
                          onClick={() => setImageModal({ url: boss.map_image_url!, title: `Mapa - ${boss.name}` })}
                          className="text-xs font-body text-muted-foreground flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-secondary transition-colors border border-border/20"
                        >
                          <MapPin className="w-3.5 h-3.5" /> Ver Mapa
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => sendBossNotify(boss.id)}
                          disabled={sendingBoss === boss.id}
                          className="text-xs font-body text-primary flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50 border border-primary/20"
                        >
                          <Send className={`w-3.5 h-3.5 ${sendingBoss === boss.id ? "animate-pulse" : ""}`} /> Notificar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card p-10 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Swords className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-display text-sm font-extrabold uppercase tracking-wider">Nenhum boss cadastrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-body">Configure os bosses no painel admin</p>
        </div>
      )}
    </div>
  );
};

export default HomePage;
