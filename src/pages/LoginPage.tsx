import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sword, Shield, Eye, EyeOff } from "lucide-react";
import logoAz from "@/assets/logo-az.jpeg";

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(nickname, password);
        toast.success("Conta criada! Bem-vindo guerreiro!");
      } else {
        await signIn(nickname, password);
        toast.success("Bem-vindo de volta!");
      }
      navigate("/roleta");
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <img
              src={logoAz}
              alt="AZ Logo"
              className="w-20 h-20 rounded-2xl border-2 border-primary/40 shadow-lg"
              style={{ boxShadow: '0 0 30px hsl(var(--primary) / 0.3)' }}
            />
            <div className="absolute -inset-1 rounded-2xl bg-primary/10 blur-xl -z-10" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
            PAINEL <span className="text-primary text-shadow-glow">AZ</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-body">Sistema de Gestão</p>
        </div>

        {/* Card */}
        <div className="glass-card glow-primary p-6">
          <p className="text-center text-muted-foreground font-body text-sm mb-6 flex items-center justify-center gap-2">
            <Sword className="w-4 h-4 text-primary" />
            {isSignUp ? "Criar conta de guerreiro" : "Entrar na arena"}
            <Shield className="w-4 h-4 text-primary" />
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">
                Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="input-modern"
                placeholder="Seu nome de guerra"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-modern pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary font-display tracking-wider uppercase text-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mx-auto" />
              ) : isSignUp ? (
                "⚔️ CRIAR CONTA"
              ) : (
                "⚔️ ENTRAR"
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-border/60">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors font-body"
            >
              {isSignUp ? "Já tenho conta → Entrar" : "Não tenho conta → Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
