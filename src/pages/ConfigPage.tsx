import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Settings, MessageCircle, Palette, Trash2, Plus, X, Save, RotateCcw, Send, CheckCircle, AlertCircle, Zap, ScrollText, Crown, Link } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import AdminPage from "@/pages/AdminPage";

type WhatsConfig = {
  id: string;
  is_enabled: boolean;
  allow_user_optout: boolean;
  api_url: string;
  body_template: string;
  headers: unknown;
};

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const { currentTheme, setTheme, resetTheme, presets } = useTheme();

  const [tab, setTab] = useState<"manage" | "whatsapp" | "theme" | "rules" | "discord" | "clear">("manage");

  // WhatsApp state
  const [config, setConfig] = useState<WhatsConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState('{"text":"{{text}}","number":"{{number}}"}');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [allowOptout, setAllowOptout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Clear state
  const [clearing, setClearing] = useState(false);

  // Rules state
  const [rulesContent, setRulesContent] = useState("");
  const [rulesId, setRulesId] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);

  // Discord state
  const [discordLink, setDiscordLink] = useState("");
  const [savingDiscord, setSavingDiscord] = useState(false);

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (data) {
      const c = data as WhatsConfig;
      setConfig(c);
      setApiUrl(c.api_url ?? "");
      setBodyTemplate(c.body_template ?? '{"text":"{{text}}","number":"{{number}}"}');
      setHeaders(
        Array.isArray(c.headers)
          ? (c.headers as any[]).map((h: any) => ({ key: h.key || "", value: h.value || "" }))
          : []
      );
      setEnabled(Boolean(c.is_enabled));
      setAllowOptout(Boolean(c.allow_user_optout));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchConfig();
      supabase.from("clan_rules").select("id, content").limit(1).maybeSingle().then(({ data }) => {
        if (data) { setRulesContent(data.content); setRulesId(data.id); }
      });
      supabase.from("app_config").select("discord_link").eq("id", "main").maybeSingle().then(({ data }) => {
        if (data?.discord_link) setDiscordLink(data.discord_link);
      });
    }
  }, [isAdmin, fetchConfig]);

  const onSaveWhatsApp = async () => {
    setSaving(true);
    const headersJson = headers.filter((h) => h.key.trim());
    const payload = {
      api_url: apiUrl,
      body_template: bodyTemplate,
      headers: headersJson as any,
      is_enabled: enabled,
      allow_user_optout: allowOptout,
    };

    const query = config
      ? supabase.from("whatsapp_config").update(payload).eq("id", config.id)
      : supabase.from("whatsapp_config").insert(payload as any);

    const { error } = await query;
    if (error) toast.error(error.message ?? "Erro ao salvar");
    else { toast.success("Configuração salva!"); await fetchConfig(); }
    setSaving(false);
  };

  const onTestWhatsApp = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // First save current config
      await onSaveWhatsApp();
      
      // Then invoke boss-notify in force mode
      const { data, error } = await supabase.functions.invoke("boss-notify", {
        body: { force: true, all: true },
      });
      if (error) throw error;
      
      const msg = data?.message || "Teste concluído";
      const hasErrors = data?.errors && data.errors.length > 0;
      
      setTestResult({
        ok: !hasErrors,
        message: hasErrors ? `${msg}\n\nErros:\n${data.errors.join("\n")}` : msg,
      });
      
      if (hasErrors) {
        toast.error("Teste com erros - verifique os detalhes");
      } else {
        toast.success("Teste enviado com sucesso!");
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || "Erro ao testar" });
      toast.error(err.message || "Erro ao testar");
    }
    setTesting(false);
  };

  const clearAllData = async () => {
    if (!confirm("⚠️ Tem certeza? Isso vai apagar TODOS os dados de roleta (sessões, jogadas, vencedores). Essa ação não pode ser desfeita.")) return;
    setClearing(true);
    try {
      await supabase.from("roulette_winners").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_plays").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_numbers_used").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_session_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("roulette_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast.success("Todos os dados de roleta foram limpos!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao limpar dados");
    }
    setClearing(false);
  };

  if (!isAdmin) {
    return <p className="glass-card p-4 text-sm text-muted-foreground">Acesso restrito ao admin.</p>;
  }

  const saveRules = async () => {
    setSavingRules(true);
    if (rulesId) {
      const { error } = await supabase.from("clan_rules").update({ content: rulesContent, updated_at: new Date().toISOString() }).eq("id", rulesId);
      if (error) toast.error("Erro ao salvar regras");
      else toast.success("Regras atualizadas!");
    } else {
      const { data, error } = await supabase.from("clan_rules").insert({ content: rulesContent }).select("id").single();
      if (error) toast.error("Erro ao salvar regras");
      else { toast.success("Regras salvas!"); if (data) setRulesId(data.id); }
    }
    setSavingRules(false);
  };

  const saveDiscordLink = async () => {
    setSavingDiscord(true);
    const { error } = await supabase.from("app_config").upsert({
      id: "main",
      discord_link: discordLink,
      updated_at: new Date().toISOString()
    });
    if (error) toast.error("Erro ao salvar link do Discord");
    else toast.success("Link do Discord atualizado!");
    setSavingDiscord(false);
  };

  const tabs = [
    { key: "manage" as const, label: "Gerenciar", icon: Crown },
    { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
    { key: "theme" as const, label: "Tema", icon: Palette },
    { key: "rules" as const, label: "Regras", icon: ScrollText },
    { key: "clear" as const, label: "Limpar", icon: Trash2 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-display text-xl font-extrabold uppercase tracking-wider">Configurações</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-pill flex items-center gap-1.5 whitespace-nowrap ${
              tab === t.key ? "tab-pill-active" : "tab-pill-inactive"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Manage Tab */}
      {tab === "manage" && <AdminPage />}

      {/* WhatsApp Tab */}
      {tab === "whatsapp" && (
        <div className="space-y-3">
          {/* Toggles on top */}
          <div className="glass-card p-4 flex items-center gap-3">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-display font-bold uppercase tracking-wider ${
                enabled
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              <div className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${enabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-[calc(100%-1.125rem)]" : "left-0.5"}`} />
              </div>
              Ativar envio
            </button>
            <button
              onClick={() => setAllowOptout(!allowOptout)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-display font-bold uppercase tracking-wider ${
                allowOptout
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              <div className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${allowOptout ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${allowOptout ? "left-[calc(100%-1.125rem)]" : "left-0.5"}`} />
              </div>
              Opt-out
            </button>
          </div>

          {/* API URL */}
          <div className="glass-card p-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">API URL</span>
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="input-modern text-sm"
                placeholder="https://api.exemplo.com/sendText"
              />
            </label>

            {/* Headers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Headers</span>
                <button
                  onClick={() => setHeaders([...headers, { key: "", value: "" }])}
                  className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={h.key}
                    onChange={(e) => { const c = [...headers]; c[i].key = e.target.value; setHeaders(c); }}
                    placeholder="Key"
                    className="input-modern flex-1 text-sm"
                  />
                  <input
                    value={h.value}
                    onChange={(e) => { const c = [...headers]; c[i].value = e.target.value; setHeaders(c); }}
                    placeholder="Value"
                    className="input-modern flex-1 text-sm"
                  />
                  <button
                    onClick={() => setHeaders(headers.filter((_, j) => j !== i))}
                    className="p-2 text-destructive/60 hover:text-destructive rounded-xl hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {headers.length === 0 && (
                <p className="text-xs text-muted-foreground/50 font-body italic py-1">Nenhum header configurado</p>
              )}
            </div>

            {/* Body Template - bigger, after headers */}
            <label className="block space-y-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Body Template</span>
              <p className="text-[10px] text-muted-foreground/60 font-body">
                Use <code className="text-primary/80">{"{{text}}"}</code> para a mensagem e <code className="text-primary/80">{"{{number}}"}</code> para o telefone
              </p>
              <textarea
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={8}
                className="input-modern font-mono text-xs leading-relaxed resize-y min-h-[120px]"
                placeholder='{"text":"{{text}}","number":"{{number}}"}'
              />
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onSaveWhatsApp}
              disabled={saving}
              className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 py-3"
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button
              onClick={onTestWhatsApp}
              disabled={testing || !apiUrl}
              className="flex-1 btn-secondary text-sm flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {testing ? (
                <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {testing ? "Testando..." : "Testar Envio"}
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`glass-card p-4 rounded-xl border-2 ${
              testResult.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
            }`}>
              <div className="flex items-start gap-2">
                {testResult.ok ? (
                  <CheckCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-display font-bold ${testResult.ok ? "text-primary" : "text-destructive"}`}>
                    {testResult.ok ? "Teste OK" : "Erro no Teste"}
                  </p>
                  <pre className="text-xs text-muted-foreground font-mono mt-1 whitespace-pre-wrap break-all">
                    {testResult.message}
                  </pre>
                </div>
                <button onClick={() => setTestResult(null)} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Theme Tab */}
      {tab === "theme" && (
        <div className="glass-card p-5 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Temas Predefinidos</p>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const isActive = currentTheme.primary === preset.colors.primary;
              return (
                <button
                  key={preset.name}
                  onClick={() => setTheme(preset.colors)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/30 bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-5 h-5 rounded-full border border-border/60"
                      style={{ background: `hsl(${preset.colors.primary})` }}
                    />
                    <span className="text-xs font-bold font-display">{preset.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={resetTheme} className="w-full btn-secondary text-sm flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Resetar para Padrão
          </button>
        </div>
      )}

      {/* Rules Tab */}
      {tab === "rules" && (
        <div className="glass-card p-5 space-y-4">
          <label className="block space-y-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Texto das Regras</span>
            <p className="text-[10px] text-muted-foreground/60 font-body">
              Use emojis e quebras de linha para formatar. O texto será exibido como está na página de Regras.
            </p>
            <textarea
              value={rulesContent}
              onChange={(e) => setRulesContent(e.target.value)}
              rows={16}
              className="input-modern text-sm font-body leading-relaxed resize-y min-h-[200px]"
              placeholder="Digite as regras do clã..."
            />
          </label>
          <button
            onClick={saveRules}
            disabled={savingRules}
            className="w-full btn-primary text-sm flex items-center justify-center gap-2 py-3"
          >
            <Save className="w-4 h-4" />
            {savingRules ? "Salvando..." : "Salvar Regras"}
          </button>
        </div>
      )}

      {/* Clear Tab */}
      {tab === "clear" && (
        <div className="glass-card p-5 space-y-4">
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-bold font-display mb-1">⚠️ Zona de Perigo</p>
            <p className="text-xs text-muted-foreground font-body">
              Ao limpar os dados, todas as sessões, jogadas e vencedores serão removidos permanentemente.
              Os itens e bosses serão mantidos.
            </p>
          </div>
          <button
            onClick={clearAllData}
            disabled={clearing}
            className="w-full py-3 bg-destructive/10 text-destructive font-bold font-display text-sm uppercase tracking-wider rounded-xl hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {clearing ? "Limpando..." : "Limpar Todos os Dados"}
          </button>
        </div>
      )}
    </div>
  );
}
