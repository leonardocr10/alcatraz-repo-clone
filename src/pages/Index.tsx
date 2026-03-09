import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dices, Users, Shield, Swords, History, ScrollText, ChevronRight, Trophy, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoAz from "@/assets/logo-az.jpeg";
import bgClasses from "@/assets/bg-classes.jpg";

interface LandingStats {
  totalMembers: number;
  totalClasses: number;
  totalItems: number;
  totalSessions: number;
  topPlayers: { nickname: string; level: number | null; xp: string | null; game_class: string | null; clan: string | null }[];
  classes: { name: string; image_url: string | null }[];
  recentWinners: { nickname: string; item_name: string }[];
}

const features = [
  {
    icon: Dices,
    title: "Roleta de Prêmios",
    description: "Sistema de sorteio interativo com itens exclusivos para membros do clan.",
  },
  {
    icon: Users,
    title: "Gestão de Jogadores",
    description: "Acompanhe rankings, níveis e progresso de todos os membros.",
  },
  {
    icon: Swords,
    title: "Classes de Personagens",
    description: "Diversas classes com habilidades únicas para cada estilo de jogo.",
  },
  {
    icon: History,
    title: "Histórico de Eventos",
    description: "Registro completo de guerras de clan e conquistas do grupo.",
  },
  {
    icon: Shield,
    title: "Sistema de Clans",
    description: "Organização hierárquica com cargos e permissões personalizadas.",
  },
  {
    icon: ScrollText,
    title: "Regras do Clan",
    description: "Documentação clara das regras e diretrizes para todos os membros.",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LandingStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      const [usersRes, classesRes, itemsRes, sessionsRes, rankingsRes, winnersRes] = await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }).eq("approved", true),
        supabase.from("character_classes").select("name, image_url"),
        supabase.from("roulette_items").select("id", { count: "exact", head: true }),
        supabase.from("roulette_sessions").select("id", { count: "exact", head: true }),
        supabase.from("player_rankings").select("nickname, level, xp, game_class, clan").order("level", { ascending: false }).order("xp", { ascending: false }).limit(5),
        supabase
          .from("roulette_winners")
          .select("number, users!roulette_winners_user_id_fkey(nickname), roulette_items!roulette_winners_item_id_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const recentWinners = (winnersRes.data || []).map((w: any) => ({
        nickname: w.users?.nickname || "?",
        item_name: w.roulette_items?.name || "?",
      }));

      setStats({
        totalMembers: usersRes.count || 0,
        totalClasses: classesRes.data?.length || 0,
        totalItems: itemsRes.count || 0,
        totalSessions: sessionsRes.count || 0,
        topPlayers: rankingsRes.data || [],
        classes: classesRes.data || [],
        recentWinners,
      });
    }
    loadStats();
  }, []);

  return (
    <div className="min-h-screen text-foreground relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <img src={bgClasses} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
      </div>

      {/* Hero Section */}
      <header className="relative">
        <div className="mx-auto max-w-4xl px-6 pt-16 pb-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img
                src={logoAz}
                alt="Alcatraz Clan"
                className="w-28 h-28 rounded-3xl border-2 border-primary/40 shadow-2xl"
              />
              <div className="absolute -inset-2 rounded-3xl bg-primary/20 blur-xl -z-10" />
            </div>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight mb-4">
            <span className="text-primary">ALCATRAZ</span> CLAN
          </h1>

          <p className="text-lg text-muted-foreground font-body max-w-xl mx-auto mb-8">
            Sistema completo de gestão para o Clan Alcatraz. Roletas, rankings, histórico de eventos e muito mais.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/login")}
              className="btn-primary px-8 py-3 text-base font-bold flex items-center justify-center gap-2"
            >
              Entrar no Sistema
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <section className="py-10">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: stats?.totalMembers ?? "—", label: "Membros" },
              { value: stats?.totalClasses ?? "—", label: "Classes" },
              { value: stats?.totalItems ?? "—", label: "Itens na Roleta" },
              { value: stats?.totalSessions ?? "—", label: "Sessões Realizadas" },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-4 text-center border border-border/30"
              >
                <p className="font-display text-2xl sm:text-3xl font-black text-primary">
                  {stat.value}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground font-body uppercase tracking-wider">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Classes Section */}
      {stats && stats.classes.length > 0 && (
        <section className="py-10">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-6">
              <span className="text-primary">Classes</span> Disponíveis
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {stats.classes.map((cls, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1.5">
                  {cls.image_url ? (
                    <img src={cls.image_url} alt={cls.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-border/40" />
                  ) : (
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/15 flex items-center justify-center">
                      <Swords className="w-6 h-6 text-primary" />
                    </div>
                  )}
                  <span className="text-[10px] sm:text-xs font-display font-bold text-center leading-tight">{cls.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Top Players */}
      {stats && stats.topPlayers.length > 0 && (
        <section className="py-10">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-6">
              <span className="text-primary">Top</span> Jogadores
            </h2>
            <div className="space-y-2">
              {stats.topPlayers.map((player, idx) => {
                const classData = stats.classes.find(
                  (c) => c.name.toLowerCase() === player.game_class?.toLowerCase()
                );
                const xpDisplay = player.xp
                  ? player.xp.endsWith("%") ? player.xp : `${player.xp}%`
                  : null;

                return (
                  <div
                    key={idx}
                    className="glass-card rounded-xl border border-border/30 p-3 flex items-center gap-3"
                  >
                    {/* Rank number */}
                    <span className="font-display font-black text-lg w-6 text-center text-muted-foreground">
                      {idx + 1}
                    </span>

                    {/* Class image */}
                    {classData?.image_url ? (
                      <img
                        src={classData.image_url}
                        alt={player.game_class || ""}
                        className="w-12 h-12 rounded-xl object-cover border border-border/40 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Swords className="w-5 h-5 text-primary" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-bold text-sm">{player.nickname}</span>
                        {player.clan && (
                          <span className="text-[10px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded font-display">
                            {player.clan}
                          </span>
                        )}
                      </div>
                      {player.game_class && (
                        <span className="text-[10px] font-bold bg-secondary text-primary px-1.5 py-0.5 rounded font-display inline-block mt-1">
                          🎮 {player.game_class.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Level & XP */}
                    <div className="text-right flex-shrink-0">
                      {player.level && (
                        <p className="font-display font-black text-primary text-base leading-none">
                          Lv.{player.level}
                        </p>
                      )}
                      {xpDisplay && (
                        <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                          {xpDisplay}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Recent Winners */}
      {stats && stats.recentWinners.length > 0 && (
        <section className="py-10">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-6">
              Últimos <span className="text-primary">Ganhadores</span>
            </h2>
            <div className="space-y-2">
              {stats.recentWinners.map((w, idx) => (
                <div key={idx} className="glass-card rounded-xl p-3 border border-border/30 flex items-center justify-between">
                  <span className="font-display font-bold text-sm">{w.nickname}</span>
                  <span className="text-xs text-primary font-body">{w.item_name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-12">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-center mb-8">
            Funcionalidades do <span className="text-primary">Sistema</span>
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="glass-card rounded-2xl p-5 border border-border/30 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3 group-hover:bg-primary/25 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-base mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground font-body leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="glass-card rounded-3xl p-8 sm:p-12 text-center border border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
            <div className="relative">
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4">
                Pronto para começar?
              </h2>
              <p className="text-muted-foreground font-body mb-6 max-w-md mx-auto">
                Entre agora no sistema e tenha acesso a todas as funcionalidades exclusivas do Clan Alcatraz.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="btn-primary px-10 py-3 text-base font-bold"
              >
                Acessar o Sistema
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="text-sm text-muted-foreground font-body">
            © 2024 Clan Alcatraz. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground/60 font-body mt-1">
            v{__APP_VERSION__}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
