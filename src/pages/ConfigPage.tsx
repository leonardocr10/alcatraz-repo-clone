import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Settings, MessageCircle, Palette, Trash2, Plus, X, Save, RotateCcw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

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

  const [tab, setTab] = useState<"whatsapp" | "theme" | "clear">("whatsapp");

  // WhatsApp state
  const [config, setConfig] = useState<WhatsConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState('{"text":"{{text}}","number":"{{number}}"}');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [allowOptout, setAllowOptout] = useState(false);
  const [saving, setSaving] = useState(false);

  // Clear state
  const [clearing, setClearing] = useState(false);

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
    if (isAdmin) fetchConfig();
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

  const tabs = [
    { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
    { key: "theme" as const, label: "Tema", icon: Palette },
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

      {/* WhatsApp Tab */}
      {tab === "whatsapp" && (
        <div className="glass-card p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">API URL</span>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="input-modern" placeholder="https://api.exemplo.com/send" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Body Template</span>
            <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={4} className="input-modern font-mono text-xs" />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Headers</span>
              <button onClick={() => setHeaders([...headers, { key: "", value: "" }])} className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary/80">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>
            {headers.map((h, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={h.key} onChange={(e) => { const c = [...headers]; c[i].key = e.target.value; setHeaders(c); }} placeholder="Key" className="input-modern flex-1" />
                <input value={h.value} onChange={(e) => { const c = [...headers]; c[i].value = e.target.value; setHeaders(c); }} placeholder="Value" className="input-modern flex-1" />
                <button onClick={() => setHeaders(headers.filter((_, j) => j !== i))} className="p-2 text-destructive/60 hover:text-destructive rounded-lg hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => setEnabled(!enabled)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all text-sm font-body ${
                enabled ? "border-primary bg-primary/15 text-primary font-bold" : "border-border/40 text-muted-foreground"
              }`}
            >
              <div className={`w-8 h-4.5 rounded-full transition-all relative ${enabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${enabled ? "left-[calc(100%-1rem)]" : "left-0.5"}`} />
              </div>
              Ativar envio
            </button>
            <button
              onClick={() => setAllowOptout(!allowOptout)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all text-sm font-body ${
                allowOptout ? "border-primary bg-primary/15 text-primary font-bold" : "border-border/40 text-muted-foreground"
              }`}
            >
              <div className={`w-8 h-4.5 rounded-full transition-all relative ${allowOptout ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${allowOptout ? "left-[calc(100%-1rem)]" : "left-0.5"}`} />
              </div>
              Permitir opt-out
            </button>
          </div>

          <button onClick={onSaveWhatsApp} disabled={saving} className="w-full btn-primary text-sm flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      )}

      {/* Theme Tab */}
      {tab === "theme" && (
        <div className="glass-card p-5 space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Temas Predefinidos</p>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((preset) => {
              const [h, s, l] = preset.colors.primary.split(" ");
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
