import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Play, Square, Trophy, ArrowLeft, Check, GripVertical, Users, Palette, AlertTriangle, Upload, Skull, MessageCircle, Clock, Send } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

const AdminPage = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  // Items state
  const [items, setItems] = useState<any[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemFile, setNewItemFile] = useState<File | null>(null);
  const [newItemPreview, setNewItemPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedItems, setSelectedItems] = useState<{ item_id: string; duration: number }[]>([]);

  // Winners state
  const [winners, setWinners] = useState<any[]>([]);
  const [simulating, setSimulating] = useState<string | null>(null);

  // Boss state
  const [bosses, setBosses] = useState<any[]>([]);
  const [newBossName, setNewBossName] = useState("");
  const [bossSchedules, setBossSchedules] = useState<Record<string, any[]>>({});
  const [newScheduleTime, setNewScheduleTime] = useState<Record<string, string>>({});
  const [newScheduleMinutes, setNewScheduleMinutes] = useState<Record<string, number>>({});

  // WhatsApp config state
  const [waConfig, setWaConfig] = useState<any>(null);
  const [waApiUrl, setWaApiUrl] = useState("");
  const [waHeaders, setWaHeaders] = useState<{ key: string; value: string }[]>([]);
  const [waBodyTemplate, setWaBodyTemplate] = useState('{\n  "text": "{{text}}",\n  "number": "{{number}}"\n}');
  const [waEnabled, setWaEnabled] = useState(false);
  const [waAllowOptout, setWaAllowOptout] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);

  // Tab
  const [tab, setTab] = useState<"items" | "sessions" | "winners" | "boss" | "whatsapp" | "theme" | "cleanup">("items");
  const [clearing, setClearing] = useState(false);
  const { currentTheme, setTheme, resetTheme, presets } = useTheme();

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/roleta");
  }, [loading, isAdmin, navigate]);

  // Fetch functions
  const fetchItems = useCallback(async () => {
    const { data } = await supabase.from("roulette_items").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }, []);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase.from("roulette_sessions").select("*").order("started_at", { ascending: false });
    setSessions(data || []);
  }, []);

  const fetchWinners = useCallback(async () => {
    const { data } = await supabase
      .from("roulette_winners")
      .select("*, users(nickname), roulette_items(name, image_url)")
      .order("created_at", { ascending: false });
    setWinners((data as any) || []);
  }, []);

  const fetchBosses = useCallback(async () => {
    const { data } = await supabase.from("bosses").select("*").order("name");
    setBosses(data || []);
    // Fetch schedules for each boss
    if (data) {
      const schedMap: Record<string, any[]> = {};
      for (const boss of data) {
        const { data: scheds } = await supabase
          .from("boss_schedules")
          .select("*")
          .eq("boss_id", boss.id)
          .order("spawn_time");
        schedMap[boss.id] = scheds || [];
      }
      setBossSchedules(schedMap);
    }
  }, []);

  const fetchWaConfig = useCallback(async () => {
    const { data } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
    if (data) {
      setWaConfig(data);
      setWaApiUrl(data.api_url || "");
      setWaHeaders(Array.isArray(data.headers) ? (data.headers as any[]).map((h: any) => ({ key: h.key || "", value: h.value || "" })) : []);
      setWaBodyTemplate(data.body_template || '{\n  "text": "{{text}}",\n  "number": "{{number}}"\n}');
      setWaEnabled(data.is_enabled || false);
      setWaAllowOptout(data.allow_user_optout || false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchSessions();
    fetchWinners();
    fetchBosses();
    fetchWaConfig();
  }, [fetchItems, fetchSessions, fetchWinners, fetchBosses, fetchWaConfig]);

  // Item functions
  const createItem = async () => {
    if (!newItemName.trim()) return;
    setUploading(true);
    try {
      let imageUrl = "/placeholder.svg";
      if (newItemFile) {
        const ext = newItemFile.name.split('.').pop() || 'bmp';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(fileName, newItemFile, { contentType: newItemFile.type || 'image/bmp' });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("roulette_items").insert({
        name: newItemName.trim(),
        description: newItemDesc.trim() || null,
        image_url: imageUrl,
      });
      if (error) throw error;
      toast.success("Item criado!");
      setNewItemName(""); setNewItemDesc(""); setNewItemFile(null); setNewItemPreview(null);
      fetchItems();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar item");
    } finally { setUploading(false); }
  };

  const deleteItem = async (id: string) => {
    await supabase.from("roulette_items").delete().eq("id", id);
    fetchItems();
  };

  // Session functions
  const createSession = async () => {
    if (!newSessionName.trim() || selectedItems.length === 0) {
      toast.error("Preencha nome e adicione pelo menos 1 item"); return;
    }
    const { data: sess, error } = await supabase
      .from("roulette_sessions").insert({ name: newSessionName.trim() }).select().single();
    if (error) { toast.error(error.message); return; }
    const sessionItems = selectedItems.map((si, idx) => ({
      session_id: sess.id, item_id: si.item_id, order_index: idx, round_duration_seconds: si.duration,
    }));
    await supabase.from("roulette_session_items").insert(sessionItems);
    toast.success("Sessão criada!"); setNewSessionName(""); setSelectedItems([]); fetchSessions();
  };

  const startSession = async (sessionId: string) => {
    const { error } = await supabase.functions.invoke("roulette-admin", { body: { action: "start", session_id: sessionId } });
    if (error) { toast.error("Erro ao iniciar"); return; }
    toast.success("Sessão iniciada!"); fetchSessions();
  };

  const stopSession = async (sessionId: string) => {
    await supabase.from("roulette_sessions").update({ is_running: false, ended_at: new Date().toISOString() }).eq("id", sessionId);
    toast.success("Sessão encerrada!"); fetchSessions();
  };

  const simulateSession = async (sessionId: string) => {
    setSimulating(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("roulette-simulate", { body: { session_id: sessionId, num_players: 8 } });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`Simulação completa! ${data.players} jogadores, ${data.items} itens`);
      fetchSessions(); fetchWinners();
    } catch (err: any) { toast.error(err.message || "Erro na simulação"); }
    finally { setSimulating(null); }
  };

  const claimWinner = async (winnerId: string) => {
    await supabase.from("roulette_winners").update({ claimed: true, claimed_at: new Date().toISOString() }).eq("id", winnerId);
    toast.success("Marcado como entregue!"); fetchWinners();
  };

  const addItemToSession = (itemId: string) => {
    if (selectedItems.find((si) => si.item_id === itemId)) return;
    setSelectedItems([...selectedItems, { item_id: itemId, duration: 20 }]);
  };
  const removeFromSession = (idx: number) => setSelectedItems(selectedItems.filter((_, i) => i !== idx));
  const updateDuration = (idx: number, dur: number) => {
    const copy = [...selectedItems]; copy[idx].duration = dur; setSelectedItems(copy);
  };

  // Boss functions
  const createBoss = async () => {
    if (!newBossName.trim()) return;
    const { error } = await supabase.from("bosses").insert({ name: newBossName.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Boss criado!"); setNewBossName(""); fetchBosses();
  };

  const deleteBoss = async (id: string) => {
    await supabase.from("bosses").delete().eq("id", id);
    toast.success("Boss removido!"); fetchBosses();
  };

  const addSchedule = async (bossId: string) => {
    const time = newScheduleTime[bossId];
    const minutes = newScheduleMinutes[bossId] || 10;
    if (!time) { toast.error("Selecione um horário"); return; }
    const { error } = await supabase.from("boss_schedules").insert({
      boss_id: bossId, spawn_time: time, notify_minutes_before: minutes,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Horário adicionado!");
    setNewScheduleTime({ ...newScheduleTime, [bossId]: "" });
    fetchBosses();
  };

  const deleteSchedule = async (scheduleId: string) => {
    await supabase.from("boss_schedules").delete().eq("id", scheduleId);
    toast.success("Horário removido!"); fetchBosses();
  };

  // WhatsApp functions
  const saveWaConfig = async () => {
    setWaSaving(true);
    try {
      const payload = {
        api_url: waApiUrl,
        headers: waHeaders,
        body_template: waBodyTemplate,
        is_enabled: waEnabled,
        allow_user_optout: waAllowOptout,
        updated_at: new Date().toISOString(),
      };
      if (waConfig?.id) {
        const { error } = await supabase.from("whatsapp_config").update(payload).eq("id", waConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("whatsapp_config").insert(payload);
        if (error) throw error;
      }
      toast.success("Configuração salva!"); fetchWaConfig();
    } catch (err: any) { toast.error(err.message); }
    finally { setWaSaving(false); }
  };

  const testWaNotification = async () => {
    setWaTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("boss-notify");
      if (error) throw error;
      toast.success(data?.message || "Teste executado!");
    } catch (err: any) { toast.error(err.message || "Erro no teste"); }
    finally { setWaTesting(false); }
  };

  if (loading) return null;

  const tabs = [
    { key: "boss" as const, label: "Boss", icon: Skull },
    { key: "whatsapp" as const, label: "WhatsApp", icon: MessageCircle },
    { key: "items" as const, label: "Itens", icon: null },
    { key: "sessions" as const, label: "Sessões", icon: null },
    { key: "winners" as const, label: "Vencedores", icon: null },
    { key: "theme" as const, label: "Tema", icon: null },
    { key: "cleanup" as const, label: "Limpar", icon: null },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/roleta" className="text-muted-foreground hover:text-primary transition-colors bg-secondary p-2 rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="font-display text-lg font-bold tracking-wider text-foreground">
            ⚙ PAINEL <span className="text-primary">AZ</span> — Admin
          </h1>
        </div>
      </header>

      {/* Tabs - scrollable */}
      <div className="sticky top-[53px] z-30 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="max-w-2xl mx-auto overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-xs font-display uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.key
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon && <t.icon className="w-3.5 h-3.5" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">

        {/* ========== BOSS TAB ========== */}
        {tab === "boss" && (
          <>
            {/* Create boss */}
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-display text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                <Skull className="w-4 h-4 text-primary" />
                Cadastrar Boss
              </h2>
              <div className="flex gap-2">
                <input
                  value={newBossName}
                  onChange={(e) => setNewBossName(e.target.value)}
                  placeholder="Nome do boss (ex: Babel)"
                  className="input-modern text-sm flex-1"
                />
                <button onClick={createBoss} className="btn-primary font-display text-sm px-5 shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Boss list with schedules */}
            {bosses.map((boss) => (
              <div key={boss.id} className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skull className="w-5 h-5 text-primary" />
                    <h3 className="font-display text-base font-bold text-foreground">{boss.name}</h3>
                  </div>
                  <button onClick={() => deleteBoss(boss.id)} className="text-destructive/60 hover:text-destructive transition-colors p-2 rounded-full hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Schedules */}
                <div className="p-5 space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-body">Horários de Spawn</p>
                  
                  {(bossSchedules[boss.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground/50 font-body italic">Nenhum horário cadastrado</p>
                  )}

                  {(bossSchedules[boss.id] || []).map((sched) => {
                    const spawnTime = sched.spawn_time.substring(0, 5);
                    // Calculate notification time
                    const [h, m] = spawnTime.split(":").map(Number);
                    let totalMins = h * 60 + m - sched.notify_minutes_before;
                    if (totalMins < 0) totalMins += 24 * 60;
                    const notifH = Math.floor(totalMins / 60) % 24;
                    const notifM = totalMins % 60;
                    const notifTime = `${notifH.toString().padStart(2, "0")}:${notifM.toString().padStart(2, "0")}`;

                    return (
                      <div key={sched.id} className="flex items-center gap-3 bg-secondary/40 px-4 py-3 rounded-xl border border-border/30">
                        <Clock className="w-4 h-4 text-gold shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-display font-bold text-foreground">{spawnTime}</span>
                            <span className="text-[11px] text-muted-foreground font-body">
                              → Aviso às <span className="text-gold font-semibold">{notifTime}</span> ({sched.notify_minutes_before}min antes)
                            </span>
                          </div>
                        </div>
                        <button onClick={() => deleteSchedule(sched.id)} className="text-destructive/60 hover:text-destructive transition-colors p-1.5 rounded-full hover:bg-destructive/10 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add schedule */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="time"
                      value={newScheduleTime[boss.id] || ""}
                      onChange={(e) => setNewScheduleTime({ ...newScheduleTime, [boss.id]: e.target.value })}
                      className="input-modern text-sm w-32"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={newScheduleMinutes[boss.id] || 10}
                        onChange={(e) => setNewScheduleMinutes({ ...newScheduleMinutes, [boss.id]: parseInt(e.target.value) || 10 })}
                        className="input-modern text-sm w-16 text-center"
                        min={1}
                        max={60}
                      />
                      <span className="text-[11px] text-muted-foreground font-body whitespace-nowrap">min antes</span>
                    </div>
                    <button
                      onClick={() => addSchedule(boss.id)}
                      className="btn-primary py-2.5 px-3 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {bosses.length === 0 && (
              <div className="text-center py-12">
                <Skull className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-body">Nenhum boss cadastrado</p>
              </div>
            )}
          </>
        )}

        {/* ========== WHATSAPP TAB ========== */}
        {tab === "whatsapp" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-5">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h2 className="font-display text-sm uppercase tracking-wider text-foreground">Integração WhatsApp</h2>
              </div>
              <p className="text-xs text-muted-foreground font-body">
                Configure a API do WhatsApp para enviar notificações automáticas quando um boss estiver prestes a spawnar.
              </p>

              {/* Toggles */}
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-body text-foreground font-medium">Ativar integração</span>
                  <button
                    onClick={() => setWaEnabled(!waEnabled)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${waEnabled ? "bg-primary" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${waEnabled ? "left-[26px]" : "left-0.5"}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="text-sm font-body text-foreground font-medium block">Permitir usuário desativar</span>
                    <span className="text-[11px] text-muted-foreground font-body">Exibe opção no perfil do usuário</span>
                  </div>
                  <button
                    onClick={() => setWaAllowOptout(!waAllowOptout)}
                    className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${waAllowOptout ? "bg-primary" : "bg-secondary"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${waAllowOptout ? "left-[26px]" : "left-0.5"}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* API URL */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-display text-xs uppercase tracking-wider text-foreground">URL da API</h3>
              <p className="text-[11px] text-muted-foreground font-body">
                O endpoint completo para envio de mensagens (ex: https://sua-api.com/sendText)
              </p>
              <input
                value={waApiUrl}
                onChange={(e) => setWaApiUrl(e.target.value)}
                placeholder="https://apiwhatsapp.smartvc.com.br/sendText"
                className="input-modern text-sm"
              />
            </div>

            {/* Headers */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Headers</h3>
                <button
                  onClick={() => setWaHeaders([...waHeaders, { key: "", value: "" }])}
                  className="text-xs text-primary font-body flex items-center gap-1 hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground font-body">
                Content-Type: application/json já é incluído automaticamente.
              </p>
              {waHeaders.map((h, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={h.key}
                    onChange={(e) => {
                      const copy = [...waHeaders]; copy[idx].key = e.target.value; setWaHeaders(copy);
                    }}
                    placeholder="chave"
                    className="input-modern text-sm flex-1"
                  />
                  <input
                    value={h.value}
                    onChange={(e) => {
                      const copy = [...waHeaders]; copy[idx].value = e.target.value; setWaHeaders(copy);
                    }}
                    placeholder="valor"
                    className="input-modern text-sm flex-1"
                  />
                  <button
                    onClick={() => setWaHeaders(waHeaders.filter((_, i) => i !== idx))}
                    className="text-destructive/60 hover:text-destructive transition-colors p-2 rounded-full hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Body Template */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Body (JSON)</h3>
              <p className="text-[11px] text-muted-foreground font-body">
                Use as variáveis <code className="bg-secondary px-1.5 py-0.5 rounded text-primary text-[10px]">{"{{number}}"}</code> para o telefone e <code className="bg-secondary px-1.5 py-0.5 rounded text-primary text-[10px]">{"{{text}}"}</code> para a mensagem. Elas serão substituídas automaticamente.
              </p>
              <textarea
                value={waBodyTemplate}
                onChange={(e) => setWaBodyTemplate(e.target.value)}
                rows={8}
                className="input-modern text-sm font-mono"
                placeholder='{"text": "{{text}}", "number": "{{number}}"}'
              />
              <div className="text-[11px] text-muted-foreground font-body space-y-1 pt-1">
                <p className="font-semibold text-foreground/70">Variáveis disponíveis:</p>
                <p>• <code className="text-primary">{"{{number}}"}</code> — Telefone do usuário com DDI (ex: 5534991612116)</p>
                <p>• <code className="text-primary">{"{{text}}"}</code> — Mensagem com detalhes do boss</p>
              </div>
            </div>

            {/* Preview */}
            <div className="glass-card p-5 space-y-3">
              <h3 className="font-display text-xs uppercase tracking-wider text-foreground">Prévia da Mensagem (variável text)</h3>
              <div className="bg-secondary/60 rounded-xl p-4 space-y-1 text-sm font-body">
                <p>⚔️ <strong>*Boss Alert - Painel AZ!*</strong></p>
                <p></p>
                <p>🐉 Boss: <strong>*Babel*</strong></p>
                <p>⏰ Spawna em 10 minutos (00:10)</p>
                <p></p>
                <p>⚔️ Prepare-se guerreiro!</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={testWaNotification}
                disabled={waTesting}
                className="flex-1 btn-secondary font-display text-sm tracking-wider uppercase flex items-center justify-center gap-2"
              >
                {waTesting ? (
                  <div className="w-4 h-4 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Testar Envio
              </button>
              <button
                onClick={saveWaConfig}
                disabled={waSaving}
                className="flex-1 btn-primary font-display text-sm tracking-wider uppercase flex items-center justify-center gap-2"
              >
                {waSaving ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <MessageCircle className="w-4 h-4" />
                )}
                Salvar WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* ========== ITEMS TAB ========== */}
        {tab === "items" && (
          <>
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-display text-sm uppercase tracking-wider text-foreground">Novo Item</h2>
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nome do item" className="input-modern text-sm" />
              <input value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="Descrição (opcional)" className="input-modern text-sm" />
              <div>
                <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2 font-body">Imagem</label>
                <label className="flex items-center gap-2 input-modern cursor-pointer hover:border-primary/50">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground truncate text-sm">{newItemFile ? newItemFile.name : "Selecionar imagem"}</span>
                  <input type="file" accept="image/bmp,image/png,image/jpeg,image/gif,image/webp" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setNewItemFile(file); const r = new FileReader(); r.onload = (ev) => setNewItemPreview(ev.target?.result as string); r.readAsDataURL(file); }
                    }}
                  />
                </label>
                {newItemPreview && <img src={newItemPreview} alt="Preview" className="mt-3 w-20 h-20 rounded-xl border border-border/40 object-cover" />}
              </div>
              <button onClick={createItem} disabled={uploading} className="w-full btn-primary font-display text-sm tracking-wider uppercase flex items-center justify-center gap-2">
                {uploading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                {uploading ? "Enviando..." : "Adicionar"}
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={item.image_url} alt={item.name} className="w-11 h-11 rounded-xl border border-border/40 object-cover" />
                    <div><p className="text-sm font-display text-foreground">{item.name}</p>{item.description && <p className="text-[11px] text-muted-foreground font-body">{item.description}</p>}</div>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="text-destructive/70 hover:text-destructive transition-colors p-2 rounded-full hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========== SESSIONS TAB ========== */}
        {tab === "sessions" && (
          <>
            <div className="glass-card p-5 space-y-4">
              <h2 className="font-display text-sm uppercase tracking-wider text-foreground">Nova Sessão</h2>
              <input value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} placeholder="Nome da sessão" className="input-modern text-sm" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Selecionar itens:</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {items.map((item) => (
                  <button key={item.id} onClick={() => addItemToSession(item.id)} className="w-full text-left px-4 py-2.5 text-sm font-body text-foreground bg-secondary/50 border border-border/40 rounded-xl hover:border-primary/40 transition-all">
                    + {item.name}
                  </button>
                ))}
              </div>
              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gold uppercase tracking-wider font-semibold">Itens na sessão:</p>
                  {selectedItems.map((si, idx) => {
                    const item = items.find((i) => i.id === si.item_id);
                    return (
                      <div key={idx} className="flex items-center gap-2 bg-secondary/50 px-4 py-2.5 rounded-xl border border-border/30">
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-body text-foreground flex-1">{idx + 1}. {item?.name}</span>
                        <input type="number" value={si.duration} onChange={(e) => updateDuration(idx, parseInt(e.target.value) || 20)} className="w-14 bg-input border border-border/40 rounded-lg px-2 py-1 text-xs text-foreground text-center" />
                        <span className="text-[10px] text-muted-foreground">seg</span>
                        <button onClick={() => removeFromSession(idx)} className="text-destructive/70 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={createSession} className="w-full btn-primary font-display text-sm tracking-wider uppercase">Criar Sessão</button>
            </div>
            <div className="space-y-2">
              {sessions.map((sess) => (
                <div key={sess.id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-display text-foreground">{sess.name}</p>
                    <span className={`badge-status ${sess.is_running ? "bg-primary/15 text-primary" : sess.ended_at ? "bg-secondary text-muted-foreground" : "bg-gold/15 text-gold"}`}>
                      {sess.is_running ? "ATIVA" : sess.ended_at ? "ENCERRADA" : "PRONTA"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {!sess.is_running && !sess.ended_at && (
                      <>
                        <button onClick={() => startSession(sess.id)} className="flex-1 btn-primary py-2.5 font-display text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"><Play className="w-3 h-3" /> Iniciar</button>
                        <button onClick={() => simulateSession(sess.id)} disabled={simulating === sess.id} className="flex-1 btn-secondary py-2.5 font-display text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 text-gold border-gold/20">
                          {simulating === sess.id ? <div className="w-3 h-3 border-2 border-gold/30 border-t-gold rounded-full animate-spin" /> : <Users className="w-3 h-3" />} Simular
                        </button>
                      </>
                    )}
                    {sess.is_running && (
                      <button onClick={() => stopSession(sess.id)} className="flex-1 py-2.5 bg-destructive/10 text-destructive font-display text-xs uppercase tracking-wider rounded-xl hover:bg-destructive/20 transition-colors flex items-center justify-center gap-1.5"><Square className="w-3 h-3" /> Encerrar</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========== WINNERS TAB ========== */}
        {tab === "winners" && (
          <div className="space-y-2">
            {winners.length === 0 && <p className="text-center text-muted-foreground text-sm py-12 font-body">Nenhum vencedor ainda</p>}
            {winners.map((w) => (
              <div key={w.id} className="glass-card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display text-foreground truncate">{w.roulette_items?.name}</p>
                  <p className="text-xs text-gold font-body font-semibold">{w.users?.nickname} — #{w.number}</p>
                  <p className="text-[10px] text-muted-foreground font-body">{new Date(w.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <img src={w.roulette_items?.image_url} alt={w.roulette_items?.name} className="w-12 h-12 rounded-xl border border-border/40 object-contain bg-muted/50 shrink-0" />
                {!w.claimed ? (
                  <button onClick={() => claimWinner(w.id)} className="px-3 py-1.5 bg-gold/10 text-gold font-display text-xs uppercase rounded-xl hover:bg-gold/20 transition-colors flex items-center gap-1 shrink-0"><Check className="w-3 h-3" /> Entregar</button>
                ) : (
                  <span className="badge-status bg-secondary text-muted-foreground shrink-0">✓ ENTREGUE</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ========== THEME TAB ========== */}
        {tab === "theme" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /><h2 className="font-display text-sm uppercase tracking-wider text-foreground">Cores do Sistema</h2></div>
              <p className="text-xs text-muted-foreground font-body">Escolha um tema para alterar as cores em todo o sistema.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {presets.map((preset) => {
                const isActive = currentTheme.primary === preset.colors.primary;
                return (
                  <button key={preset.name} onClick={() => setTheme(preset.colors)} className={`glass-card p-4 text-left transition-all ${isActive ? "ring-2 ring-primary glow-primary" : "hover:border-primary/30"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full border border-border/40" style={{ backgroundColor: `hsl(${preset.colors.primary})` }} />
                      <div className="w-4 h-4 rounded-full border border-border/40" style={{ backgroundColor: `hsl(${preset.colors.gold})` }} />
                    </div>
                    <p className="text-xs font-display text-foreground">{preset.name}</p>
                    {isActive && <p className="text-[10px] text-primary font-body mt-1">✓ Ativo</p>}
                  </button>
                );
              })}
            </div>
            <button onClick={resetTheme} className="w-full btn-secondary font-display text-xs uppercase tracking-wider">Restaurar Padrão</button>
          </div>
        )}

        {/* ========== CLEANUP TAB ========== */}
        {tab === "cleanup" && (
          <div className="space-y-4">
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /><h2 className="font-display text-sm uppercase tracking-wider text-foreground">Limpar Históricos</h2></div>
              <p className="text-xs text-muted-foreground font-body">Esta ação irá apagar <strong className="text-foreground">todos</strong> os dados: vencedores, jogadas, sessões e números usados.</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm("Tem certeza? Todos os históricos serão apagados permanentemente.")) return;
                setClearing(true);
                try {
                  const { error } = await supabase.functions.invoke("roulette-admin", { body: { action: "clear-history" } });
                  if (error) throw error;
                  toast.success("Históricos limpos com sucesso!"); fetchSessions(); fetchWinners();
                } catch (err: any) { toast.error(err.message || "Erro ao limpar"); }
                finally { setClearing(false); }
              }}
              disabled={clearing}
              className="w-full py-3 bg-destructive/10 text-destructive font-display font-bold text-sm tracking-wider uppercase rounded-xl hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 border border-destructive/20"
            >
              {clearing ? <div className="w-4 h-4 border-2 border-destructive/30 border-t-destructive rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {clearing ? "Limpando..." : "Apagar Todos os Históricos"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPage;
