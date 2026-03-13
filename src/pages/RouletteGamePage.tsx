import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Swords, SkipForward, Trophy, Clock, Crown, Users, Zap } from "lucide-react";

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
  created_at?: string;
  users: { nickname: string };
}

const RouletteGamePage = () => {
  const { profile, isAdmin } = useAuth();
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
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
  const TOP_PLAYERS_LIMIT = 20;

  // === ROULETTE LOGIC ===
  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase.from("roulette_sessions").select("*").eq("is_running", true).limit(1).maybeSingle();
    setSession(data);
    setSessionLoading(false);
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
    const { data } = await supabase
      .from("roulette_plays")
      .select("id, user_id, number, created_at, users(nickname)")
      .eq("session_id", sessId)
      .eq("item_id", itemId)
      .order("number", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(TOP_PLAYERS_LIMIT);
    setPlays((data as any) || []);
  }, [TOP_PLAYERS_LIMIT]);

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
    try {
      const data = await invokePlay("spin", session.id, currentItem.item_id);
      setMyNumber(data.number);
      await fetchPlays(session.id, currentItem.item_id);
      toast.success(`Seu número: ${data.number}`);
    }
    catch (err: any) { setHasPlayed(false); toast.error(err.message || "Erro ao aceitar"); }
    finally { setSpinning(false); }
  };

  const handleSkip = async () => {
    if (!session || !currentItem || !profile || hasPlayed) return;
    try {
      await invokePlay("skip", session.id, currentItem.item_id);
      setMyNumber(0);
      setHasPlayed(true);
      await fetchPlays(session.id, currentItem.item_id);
      toast.info("Você pulou esta rodada");
    }
    catch (err: any) { toast.error(err.message || "Erro ao pular"); }
  };

  const progressPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;
  const rankedPlays = plays.slice(0, TOP_PLAYERS_LIMIT);
  const leftColumn = Array.from({ length: 10 }, (_, idx) => ({
    rank: idx + 1,
    play: rankedPlays[idx] ?? null,
  }));
  const rightColumn = Array.from({ length: 10 }, (_, idx) => ({
    rank: idx + 11,
    play: rankedPlays[idx + 10] ?? null,
  }));

  return (
    <div className="space-y-4">
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

      {/* Active Session / Game Area */}
      {sessionLoading ? (
        <div className="glass-card p-10 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !session ? (
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

          {/* Players ranking */}
          <div className="glass-card overflow-hidden animate-slide-up">
            <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase tracking-wider font-display font-extrabold">Pontos</span>
              <span className="text-[10px] text-muted-foreground ml-auto font-body font-bold">{rankedPlays.length}/{TOP_PLAYERS_LIMIT} · Max 1000</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <div className="grid grid-cols-2 gap-px bg-border/30">
                {leftColumn.map((left, idx) => {
                  const right = rightColumn[idx];
                  const leftIsMe = !!(left.play && profile && left.play.user_id === profile.id);
                  const rightIsMe = !!(right.play && profile && right.play.user_id === profile.id);
                  return (
                    <div key={`row-${idx}`} className="contents">
                      <div className={`bg-card px-3 py-2 flex items-center gap-2 ${leftIsMe ? "bg-primary/10" : ""}`}>
                        <span className={`w-5 text-center font-display text-xs font-extrabold ${left.rank === 1 && left.play && left.play.number > 0 ? "text-gold" : "text-muted-foreground"}`}>{left.rank}</span>
                        <span className={`flex-1 font-body text-xs truncate ${leftIsMe ? "text-primary font-bold" : "text-foreground"}`}>
                          {left.play?.users?.nickname || "---"}{leftIsMe && <span className="ml-1 text-[10px] text-primary/70">(você)</span>}
                        </span>
                        <span className={`font-display text-xs font-extrabold ${!left.play || left.play.number === 0 ? "text-muted-foreground" : left.rank === 1 ? "text-gold" : "text-foreground"}`}>
                          {!left.play ? 0 : left.play.number}
                        </span>
                      </div>
                      <div className={`bg-card px-3 py-2 flex items-center gap-2 border-l border-border/30 ${rightIsMe ? "bg-primary/10" : ""}`}>
                        <span className="w-5 text-center font-display text-xs font-extrabold text-muted-foreground">{right.rank}</span>
                        <span className={`flex-1 font-body text-xs truncate ${rightIsMe ? "text-primary font-bold" : "text-foreground"}`}>
                          {right.play?.users?.nickname || "---"}{rightIsMe && <span className="ml-1 text-[10px] text-primary/70">(você)</span>}
                        </span>
                        <span className={`font-display text-xs font-extrabold ${!right.play || right.play.number === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                          {!right.play ? 0 : right.play.number}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

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
