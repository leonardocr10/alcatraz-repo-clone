import { useNavigate } from "react-router-dom";
import { Dices, Users, Shield, Swords, History, ScrollText, ChevronRight } from "lucide-react";
import logoAz from "@/assets/logo-az.jpeg";
import bgClasses from "@/assets/bg-classes.jpg";

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
    title: "8 Classes de Personagens",
    description: "Fighter, Mechanician, Archer, Pikeman, Knight, Atalanta, Priestess e Magician.",
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
              { value: "8", label: "Classes" },
              { value: "100+", label: "Membros" },
              { value: "24/7", label: "Online" },
              { value: "∞", label: "Prêmios" },
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
