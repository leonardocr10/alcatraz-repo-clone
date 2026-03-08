import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Swords, SkipForward, Trophy, Clock, LogOut, Settings, Crown, Users, Zap } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

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

const RouletteGamePage = () => {
  const { profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
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

  const fetchActiveSession = useCallback(async () => {
    const { data } = await supabase
      .from("roulette_sessions")
      .select("*")
      .eq("is_running", true)
      .limit(1)
      .maybeSingle();
    setSession(data);
    return data;
  }, []);

  const fetchCurrentItem = useCallback(async (sess: any) => {
    if (!sess) return;
    const { data } = await supabase
      .from("roulette_session_items")
      .select("*, roulette_items(name, image_url, description)")
      .eq("session_id", sess.id)
      .eq("order_index", sess.current_item_index)
      .maybeSingle();
    
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
    const { data } = await supabase
      .from("roulette_plays")
      .select("number")
      .eq("session_id", sess.id)
      .eq("item_id", item.item_id)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (data) {
      setHasPlayed(true);
      setMyNumber(data.number);
    } else {
      setHasPlayed(false);
      setMyNumber(null);
    }
  }, [profile]);

  const fetchWinners = useCallback(async (sessId: string) => {
    const { data } = await supabase
      .from("roulette_winners")
      .select("*, users(nickname), roulette_items(name, image_url)")
      .eq("session_id", sessId)
      .order("created_at", { ascending: false });
    setWinners((data as any) || []);
  }, []);

  const fetchTotalItems = useCallback(async (sessId: string) => {
    const { count } = await supabase
      .from("roulette_session_items")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessId);
    setTotalItems(count || 0);
  }, []);

  const fetchPlays = useCallback(async (sessId: string, itemId: string) => {
    const { data } = await supabase
      .from("roulette_plays")
      .select("id, user_id, number, users(nickname)")
      .eq("session_id", sessId)
      .eq("item_id", itemId)
      .order("number", { ascending: false });
    setPlays((data as any) || []);
  }, []);

  // Initial load
  useEffect(() => {
    const load = async () => {
      const sess = await fetchActiveSession();
      if (sess) {
        await fetchCurrentItem(sess);
        await fetchWinners(sess.id);
        await fetchTotalItems(sess.id);
      }
    };
    load();
  }, [fetchActiveSession, fetchCurrentItem, fetchWinners]);

  // Fetch plays when current item changes
  useEffect(() => {
    if (session && currentItem) {
      fetchPlays(session.id, currentItem.item_id);
    }
  }, [session, currentItem, fetchPlays]);

  // Check played status when item changes
  useEffect(() => {
    if (session && currentItem) {
      checkIfPlayed(session, currentItem);
    }
  }, [session, currentItem, checkIfPlayed]);

  // Poll for new sessions when none is active
  useEffect(() => {
    if (session) return; // Already have a session, no need to poll

    const poll = async () => {
      const sess = await fetchActiveSession();
      if (sess) {
        await fetchCurrentItem(sess);
        await fetchWinners(sess.id);
      }
    };

    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [session, fetchActiveSession, fetchCurrentItem, fetchWinners]);

  // Global realtime: listen for ANY session starting (even when no session is active)
  useEffect(() => {
    const globalChannel = supabase
      .channel("global-session-watch")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "roulette_sessions" }, async (payload: any) => {
        if (payload.new?.is_running) {
          const sess = await fetchActiveSession();
          if (sess) {
            await fetchCurrentItem(sess);
            await fetchWinners(sess.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(globalChannel); };
  }, [fetchActiveSession, fetchCurrentItem, fetchWinners]);

  // Timer countdown
  useEffect(() => {
    if (!currentItem?.round_ends_at || !currentItem.is_open) {
      setTimeLeft(0);
      return;
    }
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
        
        // Call the cron to close round and advance
        const closeAndAdvance = async () => {
          // Retry cron call up to 3 times
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await supabase.functions.invoke("roulette-cron");
              break;
            } catch (e) {
              console.error("Cron invoke error, attempt", attempt + 1, e);
              await new Promise(r => setTimeout(r, 500));
            }
          }
          
          // Poll for winner with retries
          let winnerData = null;
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 800));
            const { data } = await supabase
              .from("roulette_winners")
              .select("*, users(nickname), roulette_items(name)")
              .eq("session_id", savedSessionId)
              .eq("item_id", savedItemId)
              .maybeSingle();
            if (data) {
              winnerData = data;
              break;
            }
          }

          if (winnerData) {
            setWinnerAnnouncement({
              nickname: (winnerData as any).users?.nickname || "???",
              itemName: (winnerData as any).roulette_items?.name || savedItemName,
              number: winnerData.number,
            });
          }

          // Show winner for 4 seconds then advance
          setTimeout(async () => {
            setWinnerAnnouncement(null);
            setHasPlayed(false);
            setMyNumber(null);
            setPlays([]);
            setProcessingRound(false);

            const sess = await fetchActiveSession();
            if (sess) {
              await fetchCurrentItem(sess);
              await fetchWinners(sess.id);
            } else {
              setSession(null);
              setCurrentItem(null);
            }
          }, 4000);
        };
        closeAndAdvance();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentItem, session, processingRound, fetchActiveSession, fetchCurrentItem, fetchWinners]);

  // Realtime subscriptions for active session
  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel("game-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_sessions", filter: `id=eq.${session.id}` }, async (payload: any) => {
        // Session was updated
        if (payload.new && !payload.new.is_running && payload.new.ended_at) {
          // Session ended
          setSession(null);
          setCurrentItem(null);
          return;
        }
        const sess = await fetchActiveSession();
        if (sess) {
          await fetchCurrentItem(sess);
          await fetchWinners(sess.id);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "roulette_session_items", filter: `session_id=eq.${session.id}` }, async () => {
        const sess = await fetchActiveSession();
        if (sess) {
          await fetchCurrentItem(sess);
          await fetchWinners(sess.id);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roulette_winners", filter: `session_id=eq.${session.id}` }, async () => {
        await fetchWinners(session.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "roulette_plays", filter: `session_id=eq.${session.id}` }, async () => {
        if (currentItem) {
          await fetchPlays(session.id, currentItem.item_id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session, currentItem, fetchActiveSession, fetchCurrentItem, fetchWinners, fetchPlays]);

  const invokePlay = async (action: string, sessionId: string, itemId: string) => {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) throw new Error("Não autenticado");

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const resp = await fetch(`https://${projectId}.supabase.co/functions/v1/roulette-play`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, session_id: sessionId, item_id: itemId }),
    });

    const body = await resp.json();
    if (!resp.ok) {
      throw new Error(body.error || "Erro na operação");
    }
    return body;
  };

  const handleSpin = async () => {
    if (!session || !currentItem || !profile || hasPlayed || spinning) return;
    setSpinning(true);
    setHasPlayed(true);
    try {
      const data = await invokePlay("spin", session.id, currentItem.item_id);
      setMyNumber(data.number);
      toast.success(`Seu número: ${data.number}`);
    } catch (err: any) {
      setHasPlayed(false);
      toast.error(err.message || "Erro ao aceitar");
    } finally {
      setSpinning(false);
    }
  };

  const handleSkip = async () => {
    if (!session || !currentItem || !profile || hasPlayed) return;
    try {
      await invokePlay("skip", session.id, currentItem.item_id);
      setMyNumber(0);
      setHasPlayed(true);
      toast.info("Você pulou esta rodada");
    } catch (err: any) {
      toast.error(err.message || "Erro ao pular");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const progressPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-display text-lg font-bold tracking-wider text-foreground flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            PAINEL <span className="text-primary">AZ</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-body bg-secondary px-3 py-1.5 rounded-full">
              {profile?.nickname}
            </span>
            {isAdmin && (
              <Link to="/admin" className="text-muted-foreground hover:text-primary transition-colors bg-secondary p-2 rounded-full">
                <Settings className="w-4 h-4" />
              </Link>
            )}
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors bg-secondary p-2 rounded-full">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Winner Announcement Overlay */}
      {winnerAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md animate-fade-in">
          <div className="glass-card glow-gold p-10 text-center max-w-sm mx-4 animate-scale-in">
            <Crown className="w-16 h-16 text-gold mx-auto mb-5 animate-float" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-body mb-3">🏆 Vencedor</p>
            <h2 className="font-display text-3xl font-bold text-gold text-shadow-gold mb-3">
              {winnerAnnouncement.nickname}
            </h2>
            <p className="text-sm text-muted-foreground font-body mb-4">
              Ganhou com o número <span className="text-gold font-bold text-lg">#{winnerAnnouncement.number}</span>
            </p>
            <div className="border-t border-border/40 pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-1">Prêmio</p>
              <p className="font-display text-xl font-bold text-primary text-shadow-glow">
                {winnerAnnouncement.itemName}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left: Game area */}
          <div className="flex-1 space-y-5">
            {!session ? (
              <div className="glass-card p-12 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  <Swords className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-display text-base uppercase tracking-wider">
                  Nenhuma sessão ativa
                </p>
                <p className="text-sm text-muted-foreground/60 mt-2 font-body">
                  Aguarde o admin iniciar uma sessão
                </p>
              </div>
            ) : !currentItem ? (
              <div className="glass-card p-12 text-center animate-fade-in">
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5">
                  <Trophy className="w-8 h-8 text-gold" />
                </div>
                <p className="text-gold font-display text-base uppercase tracking-wider">
                  Sessão Encerrada!
                </p>
              </div>
            ) : (
              <>
                {/* Session info bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="badge-status bg-primary/15 text-primary">
                      Item {currentItem.order_index + 1}{totalItems > 0 ? ` de ${totalItems}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground font-body">{session.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-body">{plays.length} jogadores</span>
                  </div>
                </div>

                {/* Current Item Card */}
                <div className="glass-card overflow-hidden animate-slide-up">
                  <div className="p-5">
                    <div className="flex items-center gap-5 mb-5">
                      <div className="relative">
                        <img
                          src={currentItem.roulette_items.image_url}
                          alt={currentItem.roulette_items.name}
                          className="w-24 h-24 rounded-xl border border-border/40 object-contain bg-muted/50"
                        />
                        <div className="absolute -inset-0.5 rounded-xl bg-primary/10 blur-md -z-10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-display text-xl font-bold text-foreground truncate">
                          {currentItem.roulette_items.name}
                        </h2>
                        {currentItem.roulette_items.description && (
                          <p className="text-sm text-muted-foreground font-body mt-1 line-clamp-2">
                            {currentItem.roulette_items.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timer */}
                    {currentItem.is_open ? (
                      <div className="space-y-3 mb-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-body">Tempo restante</span>
                          <div className="flex items-center gap-2">
                            <Clock className={`w-4 h-4 ${isUrgent ? "text-destructive animate-timer-pulse" : "text-primary"}`} />
                            <span className={`font-display text-2xl font-bold tabular-nums ${isUrgent ? "text-destructive animate-timer-pulse" : "text-primary"}`}>
                              {timeLeft}s
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                              isUrgent ? "bg-destructive" : "bg-primary"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 mb-4 bg-secondary/50 rounded-xl">
                        <p className="text-destructive font-display text-sm uppercase tracking-wider">
                          ⏱ Rodada Encerrada
                        </p>
                        {currentItem.winner_number && (
                          <p className="text-gold font-display text-xs mt-1">
                            Vencedor: #{currentItem.winner_number}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {currentItem.is_open && !hasPlayed && timeLeft > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={handleSpin}
                          disabled={spinning}
                          className="btn-primary font-display tracking-wider uppercase text-sm flex items-center justify-center gap-2"
                        >
                          {spinning ? (
                            <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          ) : (
                            <>
                              <Zap className="w-4 h-4" />
                              ACEITAR
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleSkip}
                          className="btn-secondary font-display tracking-wider uppercase text-sm flex items-center justify-center gap-2"
                        >
                          <SkipForward className="w-4 h-4" />
                          PULAR
                        </button>
                      </div>
                    ) : hasPlayed ? (
                      <div className="text-center py-5 glass-card">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-body mb-1">Seu número</p>
                        <p className={`font-display text-4xl font-bold ${myNumber === 0 ? "text-muted-foreground" : "text-gold text-shadow-gold"}`}>
                          {myNumber === 0 ? "PULOU" : myNumber}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* TOP KILLERS */}
                {plays.length > 0 && (
                  <div className="glass-card overflow-hidden animate-slide-up">
                    <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
                      <Swords className="w-4 h-4 text-primary" />
                      <span className="text-xs uppercase tracking-wider text-foreground font-display font-semibold">
                        Top Killers
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto font-body">{plays.length} jogadores</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {plays.map((p, idx) => {
                        const isMe = profile && p.user_id === profile.id;
                        return (
                          <div
                            key={p.id}
                            className={`px-5 py-3 flex items-center gap-3 transition-colors ${
                              isMe ? "bg-primary/10" : "hover:bg-secondary/50"
                            }`}
                          >
                            <span className={`w-6 text-center font-display text-xs font-bold ${
                              idx === 0 && p.number > 0 ? "text-gold" : "text-muted-foreground"
                            }`}>
                              {idx + 1}
                            </span>
                            <span className={`flex-1 font-body text-sm ${isMe ? "text-primary font-semibold" : "text-foreground"}`}>
                              {p.users?.nickname || "???"}
                              {isMe && <span className="ml-1 text-[10px] text-primary/70">(você)</span>}
                            </span>
                            <span className={`font-display text-sm font-bold ${
                              p.number === 0 ? "text-muted-foreground" :
                              idx === 0 ? "text-gold" : "text-foreground"
                            }`}>
                              {p.number === 0 ? "PULOU" : p.number}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Winners Section */}
          {session && winners.length > 0 && (
            <div className="lg:w-80 shrink-0">
              <div className="glass-card overflow-hidden lg:sticky lg:top-20 animate-slide-up">
                <div className="px-5 py-3 border-b border-border/40 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-gold" />
                  <span className="text-xs uppercase tracking-wider text-foreground font-display font-semibold">
                    Ganhadores
                  </span>
                </div>
                <div className="divide-y divide-border/30 max-h-[70vh] overflow-y-auto">
                  {winners.map((w) => (
                    <div key={w.id} className="px-5 py-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors">
                      <img
                        src={w.roulette_items.image_url}
                        alt={w.roulette_items.name}
                        className="w-12 h-12 rounded-xl border border-border/40 object-contain bg-muted/50 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-display text-foreground truncate">{w.roulette_items.name}</p>
                        <p className="text-xs text-gold font-body font-semibold">{w.users.nickname}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-display font-bold text-primary">#{w.number}</span>
                          <span className="text-[10px] text-muted-foreground font-body">
                            {new Date(w.created_at).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default RouletteGamePage;
