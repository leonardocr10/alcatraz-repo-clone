import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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
  const [config, setConfig] = useState<WhatsConfig | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState('{"text":"{{text}}","number":"{{number}}"}');
  const [headersJson, setHeadersJson] = useState("[]");
  const [enabled, setEnabled] = useState(false);
  const [allowOptout, setAllowOptout] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    const { data, error } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (error) {
      toast.error("Erro ao carregar config");
      return;
    }

    const c = (data as WhatsConfig | null) ?? null;
    setConfig(c);
    setApiUrl(c?.api_url ?? "");
    setBodyTemplate(c?.body_template ?? '{"text":"{{text}}","number":"{{number}}"}');
    setHeadersJson(JSON.stringify(c?.headers ?? [], null, 2));
    setEnabled(Boolean(c?.is_enabled));
    setAllowOptout(Boolean(c?.allow_user_optout));
  };

  useEffect(() => {
    if (isAdmin) fetchConfig();
  }, [isAdmin]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let parsedHeaders: unknown = [];
    try {
      parsedHeaders = JSON.parse(headersJson || "[]");
    } catch {
      toast.error("Headers JSON inválido");
      setSaving(false);
      return;
    }

    const payload = {
      api_url: apiUrl,
      body_template: bodyTemplate,
      headers: parsedHeaders as any,
      is_enabled: enabled,
      allow_user_optout: allowOptout,
    };

    const query = config
      ? supabase.from("whatsapp_config").update(payload).eq("id", config.id)
      : supabase.from("whatsapp_config").insert(payload as any);

    const { error } = await query;
    if (error) {
      toast.error(error.message ?? "Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva");
      await fetchConfig();
    }

    setSaving(false);
  };

  if (!isAdmin) {
    return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Acesso restrito ao admin.</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Configuração WhatsApp</h2>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">API URL</span>
        <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Body template</span>
        <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Headers (JSON)</span>
        <textarea value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} rows={5} className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs" />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Ativar envio
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowOptout} onChange={(e) => setAllowOptout(e.target.checked)} />
          Permitir opt-out
        </label>
      </div>

      <button disabled={saving} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
        {saving ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}
