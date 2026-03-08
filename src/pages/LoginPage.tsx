import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sword, Shield, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logoAz from "@/assets/logo-az.jpeg";
import bgBoss from "@/assets/bg-boss.jpg";
import type { Database } from "@/integrations/supabase/types";

type CharacterClass = Database["public"]["Enums"]["character_class"];

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<CharacterClass | "">("");
  const [classIcons, setClassIcons] = useState<{ name: CharacterClass; image_url: string | null }[]>([]);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("character_classes").select("name, image_url").then(({ data }) => {
      if (data) setClassIcons(data as any);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um telefone válido com DDD");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        if (!nickname.trim()) throw new Error("Informe um nickname");
        if (!selectedClass) throw new Error("Selecione uma classe");
        await signUp(nickname.trim(), password, phone, selectedClass);
        toast.success("Conta criada! Bem-vindo guerreiro!");
      } else {
        await signIn(phone, password);
        toast.success("Bem-vindo de volta!");
      }
      navigate("/inicio");
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <img src={bgBoss} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/60" />
      </div>

      <div className="w-full max-w-sm animate-fade-in">
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

        <div className="glass-card glow-primary p-6 bg-background/70 backdrop-blur-xl">
          <p className="text-center text-muted-foreground font-body text-sm mb-6 flex items-center justify-center gap-2">
            <Sword className="w-4 h-4 text-primary" />
            {isSignUp ? "Criar conta de guerreiro" : "Entrar na arena"}
            <Shield className="w-4 h-4 text-primary" />
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">Nickname</label>
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} required className="input-modern" placeholder="Seu nome de guerra" />
                </div>

                {/* Class selection */}
                <div>
                  <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">Classe</label>
                  <div className="grid grid-cols-4 gap-2">
                    {classIcons.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelectedClass(c.name)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                          selectedClass === c.name
                            ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                            : "border-border/40 hover:border-muted-foreground/30"
                        }`}
                      >
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {c.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-[9px] font-body font-semibold uppercase tracking-wider text-muted-foreground truncate w-full text-center">
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">Telefone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} required className="input-modern" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">Senha</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="input-modern pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary font-display tracking-wider uppercase text-sm">
              {loading ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mx-auto" /> : isSignUp ? "⚔️ CRIAR CONTA" : "⚔️ ENTRAR"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-border/60">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors font-body">
              {isSignUp ? "Já tenho conta → Entrar" : "Não tenho conta → Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
