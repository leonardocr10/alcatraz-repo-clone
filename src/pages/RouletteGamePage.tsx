import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Swords, SkipForward, Trophy, Clock, Crown, Users, Zap, MapPin, ChevronDown, Send, X, MessageCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SessionItem {
  id: string;
  session_id: string;
  item_id: string;
  order_index: number;
  round_duration_seconds: number;
  round_started_at: string | null;
  round_ends_at: string | null;
  is_open: boolean;
  closed_at: string | null;
  winner_user_id: string | null;
  winner_number: number | null;
  roulette_items: { name: string; image_url: string; description: string | null };
}

interface Winner {
  id: string;
  item_id: string;
  number: number;
  created_at: string;
  users: { nickname: string };
  roulette_items: { name: string; image_url: string };
}

interface Play {
  id: string;
  user_id: string;
  number: number;
  users: { nickname: string };
}

interface Boss {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  map_level: string | null;
  map_image_url: string | null;
}

interface BossSchedule {
  id: string;
  boss_id: string;
  spawn_time: string;
  notify_minutes_before: number;
}

const RouletteGamePage = () => {
  const { profile, isAdmin } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [currentItem, setCurrentItem] = useState<SessionItem | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [myNumber, setMyNumber] = useState<number | null>(null);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [roundClosed, setRoundClosed] = useState(false);
  const [plays, setPlays] = useState<Play[]>([]);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<{ nickname: string; itemName: string; number: number } | null>(null);
  const [processingRound, setProcessingRound] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  // Boss state
  const [bosses, setBosses] = useState<Boss[]>([]);
  const [bossSchedules, setBossSchedules] = useState<BossSchedule[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedBoss, setExpandedBoss] = useState<string | null>(null);
  const [imageModal, setImageModal] = useState<{ url: string; title: string; description?: string; mapLevel?: string } | null>(null);
  const [sendingBoss, setSendingBoss] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchBosses = async () => {
      const [bossRes, schedRes] = await Promise.all([
        supabase.from("bosses").select("*").order("name"),
        supabase.from("boss_schedules").select("*").order("spawn_time"),
      ]);
      setBosses((bossRes.data || []) as Boss[]);
      setBossSchedules((schedRes.data || []) as BossSchedule[]);
    };
    fetchBosses();
  }, []);

  const getBrazilTime = useCallback(() => {
    const now = currentTime;
    const brazilOffset = -3 * 60;
    return new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
  }, [currentTime]);

  const getBrazilTimeStr = () => {
    return getBrazilTime().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // Group bosses with their schedules and find next spawn
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

  const formatMinutesUntil = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
    return `${m}min`;
  };

  // Send WhatsApp for specific boss
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

  // Send WhatsApp for all bosses
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

  // === ROULETTE LOGIC ===
  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase.from("roulette_sessions").select("*").eq("is_running", true).limit(1).maybeSingle();
    setSession(data);
    return data;
  }, []);

  const fetchCurrentItem = useCallback(async (sess: any) => {
    if (!sess) return;
    const { data } = await supabase.from("roulette_session_items").select("*, roulette_items(name, image_url, description)").eq("session_id", sess.id).eq("order_index", sess.current_item_index).maybeSingle();
    setCurrentItem(data as any);
    if (data) {
      setRoundClosed(!data.is_open && data.closed_at !== null);
      if (data.round_ends_at && data.is_open) {
        const ends = new Date(data.round_ends_at).getTime();
        const started = new Date(data.round_started_at!).getTime();
        setTotalTime(Math.round((ends - started) / 1000));
      }
    }
  }, []);

  const checkIfPlayed = useCallback(async (sess: any, item: any) => {
    if (!sess || !item || !profile) return;
    const { data } = await supabase.from("roulette_plays").select("number").eq("session_id", sess.id).eq("item_id", item.item_id).eq("user_id", profile.id).maybeSingle();
    if (data) { setHasPlayed(true); setMyNumber(data.number); } else { setHasPlayed(false); setMyNumber(null); }
  }, [profile]);

  const fetchWinners = useCallback(async (sessId: string) => {
    const { data } = await supabase.from("roulette_winners").select("*, users(nickname), roulette_items(name, image_url)").eq("session_id", sessId).order("created_at", { ascending: false });
    setWinners((data as any) || []);
  }, []);

  const fetchTotalItems = useCallback(async (sessId: string) => {
    const { count } = await supabase.from("roulette_session_items").select("id", { count: "exact", head: true }).eq("session_id", sessId);
    setTotalItems(count || 0);
  }, []);

  const fetchPlays = useCallback(async (sessId: string, itemId: string) => {
    const { data } = await supabase.from("roulette_plays").select("id, user_id, number, users(nickname)").eq("session_id", sessId).eq("item_id", itemId).order("number", { ascending: false });
    setPlays((data as any) || []);
  }, []);

  useEffect(() => {
    const load = async () => {
      const sess = await fetchActiveSession();
      if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); await fetchTotalItems(sess.id); }
    };
    load();
  }, [fetchActiveSession, fetchCurrentItem, fetchWinners]);

  useEffect(() => { if (session && currentItem) fetchPlays(session.id, currentItem.item_id); }, [session, currentItem, fetchPlays]);
  useEffect(() => { if (session && currentItem) checkIfPlayed(session, currentItem); }, [session, currentItem, checkIfPlayed]);

  useEffect(() => {
    if (session) return;
    const poll = async () => { const sess = await fetchActiveSession(); if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); } };
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session, fetchActiveSession, fetchCurrentItem, fetchWinners]);

  useEffect(() => {
    const ch = supabase.channel("global-session-watch").on("postgres_changes", { event: "UPDATE", schema: "public", table: "roulette_sessions" }, async (payload: any) => {
      if (payload.new?.is_running) { const sess = await fetchActiveSession(); if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); } }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchActiveSession, fetchCurrentItem, fetchWinners]);

  useEffect(() => {
    if (!currentItem?.round_ends_at || !currentItem.is_open) { setTimeLeft(0); return; }
    const tick = () => {
      const now = Date.now();
      const ends = new Date(currentItem.round_ends_at!).getTime();
      const remaining = Math.max(0, Math.ceil((ends - now) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0 && !processingRound) {
        setProcessingRound(true);
        const savedSessionId = session.id;
        const savedItemId = currentItem.item_id;
        const savedItemName = currentItem.roulette_items.name;
        const closeAndAdvance = async () => {
          for (let attempt = 0; attempt < 3; attempt++) {
            try { await supabase.functions.invoke("roulette-cron"); break; } catch (e) { await new Promise(r => setTimeout(r, 500)); }
          }
          let winnerData = null;
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 800));
            const { data } = await supabase.from("roulette_winners").select("*, users(nickname), roulette_items(name)").eq("session_id", savedSessionId).eq("item_id", savedItemId).maybeSingle();
            if (data) { winnerData = data; break; }
          }
          if (winnerData) {
            setWinnerAnnouncement({ nickname: (winnerData as any).users?.nickname || "???", itemName: (winnerData as any).roulette_items?.name || savedItemName, number: winnerData.number });
          }
          setTimeout(async () => {
            setWinnerAnnouncement(null); setHasPlayed(false); setMyNumber(null); setPlays([]); setProcessingRound(false);
            const sess = await fetchActiveSession();
            if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); } else { setSession(null); setCurrentItem(null); }
          }, 4000);
        };
        closeAndAdvance();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentItem, session, processingRound, fetchActiveSession, fetchCurrentItem, fetchWinners]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel("game-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_sessions", filter: `id=eq.${session.id}` }, async (payload: any) => {
        if (payload.new && !payload.new.is_running && payload.new.ended_at) { setSession(null); setCurrentItem(null); return; }
        const sess = await fetchActiveSession(); if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_session_items", filter: `session_id=eq.${session.id}` }, async () => {
        const sess = await fetchActiveSession(); if (sess) { await fetchCurrentItem(sess); await fetchWinners(sess.id); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roulette_winners", filter: `session_id=eq.${session.id}` }, async () => { await fetchWinners(session.id); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roulette_plays", filter: `session_id=eq.${session.id}` }, async () => {
        if (currentItem) await fetchPlays(session.id, currentItem.item_id);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, currentItem, fetchActiveSession, fetchCurrentItem, fetchWinners, fetchPlays]);

  const invokePlay = async (action: string, sessionId: string, itemId: string) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) throw new Error("Não autenticado");
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/roulette-play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action, session_id: sessionId, item_id: itemId }),
    });
    const body = await resp.json();
    if (!resp.ok) throw new Error(body.error || "Erro na operação");
    return body;
  };

  const handleSpin = async () => {
    if (!session || !currentItem || !profile || hasPlayed || spinning) return;
    setSpinning(true); setHasPlayed(true);
    try { const data = await invokePlay("spin", session.id, currentItem.item_id); setMyNumber(data.number); toast.success(`Seu número: ${data.number}`); }
    catch (err: any) { setHasPlayed(false); toast.error(err.message || "Erro ao aceitar"); }
    finally { setSpinning(false); }
  };

  const handleSkip = async () => {
    if (!session || !currentItem || !profile || hasPlayed) return;
    try { await invokePlay("skip", session.id, currentItem.item_id); setMyNumber(0); setHasPlayed(true); toast.info("Você pulou esta rodada"); }
    catch (err: any) { toast.error(err.message || "Erro ao pular"); }
  };

  const progressPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;
  const groupedBosses = getGroupedBosses().slice(0, 3);

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

      {/* Winner Announcement Overlay */}
      {winnerAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in">
          <div className="glass-card glow-gold p-8 text-center max-w-xs mx-4 animate-scale-in">
            <Crown className="w-14 h-14 text-gold mx-auto mb-4 animate-float" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-body mb-2">🏆 Vencedor</p>
            <h2 className="font-display text-2xl font-extrabold text-gold text-shadow-gold mb-2">{winnerAnnouncement.nickname}</h2>
            <p className="text-sm text-muted-foreground font-body mb-3">
              Número <span className="text-gold font-extrabold text-lg">#{winnerAnnouncement.number}</span>
            </p>
            <div className="border-t border-border/40 pt-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-body mb-1">Prêmio</p>
              <p className="font-display text-lg font-extrabold text-primary text-shadow-glow">{winnerAnnouncement.itemName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Clock + BRT */}
      <div className="glass-card p-2.5 flex items-center justify-center gap-2">
        <Clock className="w-4 h-4 text-primary" />
        <span className="font-display text-lg font-extrabold tabular-nums">{getBrazilTimeStr()}</span>
        <span className="text-[10px] text-muted-foreground font-body bg-secondary px-1.5 py-0.5 rounded-md">BRT</span>
      </div>

      {/* Bosses - Grouped */}
      {groupedBosses.length > 0 && (
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
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Boss image - clickable opens modal with description */}
                  <button
                    onClick={() => boss.image_url && setImageModal({
                      url: boss.image_url,
                      title: boss.name,
                      description: boss.description || undefined,
                      mapLevel: boss.map_level || undefined,
                    })}
                    className="shrink-0"
                  >
                    {boss.image_url ? (
                      <img src={boss.image_url} alt={boss.name} className="w-12 h-12 rounded-xl object-cover border-2 border-border/40 hover:border-primary/50 transition-colors" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                        <Swords className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </button>

                  {/* Boss info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-display font-extrabold text-gold truncate">{boss.name}</span>
                      {nextSchedule && (
                        <span className={`text-[10px] font-display font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                          nextSchedule.minutesUntil <= 10 ? "bg-destructive/20 text-destructive" :
                          nextSchedule.minutesUntil <= 30 ? "bg-gold/20 text-gold" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {formatMinutesUntil(nextSchedule.minutesUntil)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-body mt-0.5">
                      {boss.map_level && <><MapPin className="w-3 h-3" /><span>{boss.map_level}</span><span>·</span></>}
                      <span>Próximo: {nextSchedule?.spawn_time.substring(0, 5)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {boss.map_image_url && (
                      <button
                        onClick={() => setImageModal({ url: boss.map_image_url!, title: `Mapa - ${boss.name}` })}
                        className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedBoss(expandedBoss === boss.id ? null : boss.id)}
                      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedBoss === boss.id ? "rotate-180" : ""}`} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => sendBossNotify(boss.id)}
                        disabled={sendingBoss === boss.id}
                        className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                      >
                        <Send className={`w-3.5 h-3.5 ${sendingBoss === boss.id ? "animate-pulse" : ""}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: Schedules only, single line each */}
                {expandedBoss === boss.id && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {schedules.map((sched) => {
                      const isNext = sched.id === nextSchedule?.id;
                      return (
                        <span
                          key={sched.id}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-display font-bold ${
                            isNext ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary/50 text-muted-foreground"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {sched.spawn_time.substring(0, 5)}
                          {isNext && <span className="text-[9px] opacity-70">← próximo</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Session / Game Area */}
      {!session ? (
        <div className="glass-card p-10 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
            <Swords className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-display text-sm font-extrabold uppercase tracking-wider">Nenhuma sessão ativa</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-body">Aguarde o admin iniciar uma sessão</p>
        </div>
      ) : !currentItem ? (
        <div className="glass-card p-10 text-center animate-fade-in">
          <Trophy className="w-12 h-12 text-gold mx-auto mb-4" />
          <p className="text-gold font-display text-sm font-extrabold uppercase tracking-wider">Sessão Encerrada!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Item badge */}
          <div className="flex items-center justify-between">
            <span className="badge-status bg-primary/15 text-primary">
              Item {currentItem.order_index + 1}{totalItems > 0 ? ` de ${totalItems}` : ""}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span className="font-body font-bold">{plays.length}</span>
            </div>
          </div>

          {/* Current item card */}
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <img src={currentItem.roulette_items.image_url} alt={currentItem.roulette_items.name}
                  className="w-16 h-16 rounded-2xl border-2 border-primary/30 object-contain bg-muted/50 shrink-0"
                  style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.15)' }}
                />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-extrabold text-foreground leading-tight">{currentItem.roulette_items.name}</h2>
                  {currentItem.roulette_items.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 font-body line-clamp-2">{currentItem.roulette_items.description}</p>
                  )}
                </div>
              </div>

              {/* Timer */}
              {currentItem.is_open && timeLeft > 0 ? (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Tempo</span>
                    <div className="flex items-center gap-1.5">
                      <Clock className={`w-4 h-4 ${isUrgent ? "text-destructive animate-timer-pulse" : "text-primary"}`} />
                      <span className={`font-display text-xl font-extrabold tabular-nums ${isUrgent ? "text-destructive animate-timer-pulse" : "text-primary"}`}>{timeLeft}s</span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ease-linear rounded-full ${isUrgent ? "bg-destructive" : "bg-primary"}`} style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-3 mb-3 bg-secondary/50 rounded-xl">
                  <p className="text-destructive font-display text-sm font-extrabold uppercase tracking-wider">⏱ Rodada Encerrada</p>
                  {currentItem.winner_number && <p className="text-gold font-display text-xs mt-0.5">Vencedor: #{currentItem.winner_number}</p>}
                </div>
              )}

              {/* Action buttons */}
              {currentItem.is_open && !hasPlayed && timeLeft > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleSpin} disabled={spinning} className="btn-primary font-display tracking-wider uppercase text-sm flex items-center justify-center gap-2">
                    {spinning ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <><Zap className="w-4 h-4" /> ACEITAR</>}
                  </button>
                  <button onClick={handleSkip} className="btn-secondary font-display tracking-wider uppercase text-sm flex items-center justify-center gap-2">
                    <SkipForward className="w-4 h-4" /> PULAR
                  </button>
                </div>
              ) : hasPlayed ? (
                <div className="text-center py-4 glass-card">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-0.5">Seu número</p>
                  <p className={`font-display text-3xl font-extrabold ${myNumber === 0 ? "text-muted-foreground" : "text-gold text-shadow-gold"}`}>
                    {myNumber === 0 ? "PULOU" : myNumber}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Players list */}
          {plays.length > 0 && (
            <div className="glass-card overflow-hidden animate-slide-up">
              <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                <Swords className="w-4 h-4 text-primary" />
                <span className="text-xs uppercase tracking-wider font-display font-extrabold">Jogadores</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-body font-bold">{plays.length}</span>
              </div>
              <div className="divide-y divide-border/20 max-h-48 overflow-y-auto">
                {plays.map((p, idx) => {
                  const isMe = profile && p.user_id === profile.id;
                  return (
                    <div key={p.id} className={`px-4 py-2.5 flex items-center gap-3 ${isMe ? "bg-primary/10" : "hover:bg-secondary/30"} transition-colors`}>
                      <span className={`w-5 text-center font-display text-xs font-extrabold ${idx === 0 && p.number > 0 ? "text-gold" : "text-muted-foreground"}`}>{idx + 1}</span>
                      <span className={`flex-1 font-body text-sm ${isMe ? "text-primary font-bold" : "text-foreground"}`}>
                        {p.users?.nickname || "???"}{isMe && <span className="ml-1 text-[10px] text-primary/70">(você)</span>}
                      </span>
                      <span className={`font-display text-sm font-extrabold ${p.number === 0 ? "text-muted-foreground" : idx === 0 ? "text-gold" : "text-foreground"}`}>
                        {p.number === 0 ? "PULOU" : p.number}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Winners in this session */}
          {winners.length > 0 && (
            <div className="glass-card overflow-hidden animate-slide-up">
              <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase tracking-wider font-display font-extrabold">Ganhadores</span>
              </div>
              <div className="divide-y divide-border/20 max-h-60 overflow-y-auto">
                {winners.map((w) => (
                  <div key={w.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors">
                    <img src={w.roulette_items.image_url} alt={w.roulette_items.name} className="w-10 h-10 rounded-xl border border-border/40 object-contain bg-muted/50 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-display font-bold text-foreground truncate">{w.roulette_items.name}</p>
                      <p className="text-xs text-gold font-body font-bold">{w.users.nickname} · #{w.number}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RouletteGamePage;
