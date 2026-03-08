import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Play, Square, Trophy, Check, GripVertical, Users, Upload, Skull, Clock, MapPin, Image, Crown, Package, Layers, X, UserCheck, UserX } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [newBossMap, setNewBossMap] = useState("");
  const [newBossDesc, setNewBossDesc] = useState("");
  const [newBossFile, setNewBossFile] = useState<File | null>(null);
  const [newBossMapFile, setNewBossMapFile] = useState<File | null>(null);
  const [bossSchedules, setBossSchedules] = useState<Record<string, any[]>>({});
  const [newScheduleTime, setNewScheduleTime] = useState<Record<string, string>>({});
  const [newScheduleMinutes, setNewScheduleMinutes] = useState<Record<string, number>>({});

  // Tab
  const [tab, setTab] = useState<"boss" | "items" | "sessions" | "winners" | "approvals">("boss");
  const [showBossModal, setShowBossModal] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);


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
    const { data } = await supabase.from("roulette_winners").select("*, users(nickname), roulette_items(name, image_url)").order("created_at", { ascending: false });
    setWinners((data as any) || []);
  }, []);

  const fetchBosses = useCallback(async () => {
    const { data } = await supabase.from("bosses").select("*").order("name");
    setBosses(data || []);
    if (data) {
      const schedMap: Record<string, any[]> = {};
      for (const boss of data) {
        const { data: scheds } = await supabase.from("boss_schedules").select("*").eq("boss_id", boss.id).order("spawn_time");
        schedMap[boss.id] = scheds || [];
      }
      setBossSchedules(schedMap);
    }
  }, []);

  const fetchPendingUsers = useCallback(async () => {
    const { data } = await supabase.from("users").select("*").eq("approved", false).order("created_at", { ascending: false });
    setPendingUsers(data || []);
  }, []);

  useEffect(() => { fetchItems(); fetchSessions(); fetchWinners(); fetchBosses(); fetchPendingUsers(); }, [fetchItems, fetchSessions, fetchWinners, fetchBosses, fetchPendingUsers]);

  // Upload helper
  const uploadFile = async (file: File, bucket: string) => {
    const ext = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file, { contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  // Item functions
  const createItem = async () => {
    if (!newItemName.trim()) return;
    setUploading(true);
    try {
      let imageUrl = "/placeholder.svg";
      if (newItemFile) imageUrl = await uploadFile(newItemFile, "item-images");
      const { error } = await supabase.from("roulette_items").insert({ name: newItemName.trim(), description: newItemDesc.trim() || null, image_url: imageUrl });
      if (error) throw error;
      toast.success("Item criado!"); setNewItemName(""); setNewItemDesc(""); setNewItemFile(null); setNewItemPreview(null); fetchItems();
    } catch (err: any) { toast.error(err.message || "Erro ao criar item"); }
    finally { setUploading(false); }
  };

  const deleteItem = async (id: string) => { await supabase.from("roulette_items").delete().eq("id", id); fetchItems(); };

  // Session functions
  const createSession = async () => {
    if (!newSessionName.trim() || selectedItems.length === 0) { toast.error("Preencha nome e adicione pelo menos 1 item"); return; }
    const { data: sess, error } = await supabase.from("roulette_sessions").insert({ name: newSessionName.trim() }).select().single();
    if (error) { toast.error(error.message); return; }
    const sessionItems = selectedItems.map((si, idx) => ({ session_id: sess.id, item_id: si.item_id, order_index: idx, round_duration_seconds: si.duration }));
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
      if (error) throw error; if (data.error) throw new Error(data.error);
      toast.success(`Simulação completa! ${data.players} jogadores, ${data.items} itens`); fetchSessions(); fetchWinners();
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
  const updateDuration = (idx: number, dur: number) => { const copy = [...selectedItems]; copy[idx].duration = dur; setSelectedItems(copy); };

  // Boss functions
  const createBoss = async () => {
    if (!newBossName.trim()) return;
    setUploading(true);
    try {
      let imageUrl = null;
      let mapImageUrl = null;
      if (newBossFile) imageUrl = await uploadFile(newBossFile, "boss-images");
      if (newBossMapFile) mapImageUrl = await uploadFile(newBossMapFile, "boss-images");
      const { error } = await supabase.from("bosses").insert({
        name: newBossName.trim(),
        map_level: newBossMap.trim() || null,
        description: newBossDesc.trim() || null,
        image_url: imageUrl,
        map_image_url: mapImageUrl,
      });
      if (error) throw error;
      toast.success("Boss criado!"); setNewBossName(""); setNewBossMap(""); setNewBossDesc(""); setNewBossFile(null); setNewBossMapFile(null); fetchBosses();
    } catch (err: any) { toast.error(err.message || "Erro ao criar boss"); }
    finally { setUploading(false); }
  };

  const deleteBoss = async (id: string) => { await supabase.from("bosses").delete().eq("id", id); toast.success("Boss removido!"); fetchBosses(); };

  const addSchedule = async (bossId: string) => {
    const time = newScheduleTime[bossId]; const minutes = newScheduleMinutes[bossId] || 10;
    if (!time) { toast.error("Selecione um horário"); return; }
    const { error } = await supabase.from("boss_schedules").insert({ boss_id: bossId, spawn_time: time, notify_minutes_before: minutes });
    if (error) { toast.error(error.message); return; }
    toast.success("Horário adicionado!"); setNewScheduleTime({ ...newScheduleTime, [bossId]: "" }); fetchBosses();
  };

  const deleteSchedule = async (scheduleId: string) => { await supabase.from("boss_schedules").delete().eq("id", scheduleId); toast.success("Horário removido!"); fetchBosses(); };

  if (loading) return null;

  const tabs = [
    { key: "boss" as const, label: "Boss", icon: Skull },
    { key: "items" as const, label: "Itens", icon: Package },
    { key: "sessions" as const, label: "Sessões", icon: Layers },
    { key: "winners" as const, label: "Ganhadores", icon: Trophy },
  ];

  return (
    <div className="space-y-4">

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

      {/* ========== BOSS TAB ========== */}
      {tab === "boss" && (
        <div className="space-y-3">
          <button onClick={() => setShowBossModal(true)} className="w-full btn-primary text-sm flex items-center justify-center gap-2 py-3">
            <Plus className="w-4 h-4" /> Cadastrar Boss
          </button>

          <Dialog open={showBossModal} onOpenChange={setShowBossModal}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-sm font-extrabold uppercase tracking-wider flex items-center gap-2">
                  <Skull className="w-4 h-4 text-primary" /> Cadastrar Boss
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <input value={newBossName} onChange={(e) => setNewBossName(e.target.value)} placeholder="Nome do boss" className="input-modern" />
                <input value={newBossMap} onChange={(e) => setNewBossMap(e.target.value)} placeholder="Nome do mapa" className="input-modern" />
                <textarea value={newBossDesc} onChange={(e) => setNewBossDesc(e.target.value)} placeholder="Descrição..." rows={2} className="input-modern" />
                <label className="flex items-center gap-2 input-modern cursor-pointer hover:border-primary/50">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">{newBossFile ? newBossFile.name : "Imagem do boss"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setNewBossFile(e.target.files[0]); }} />
                </label>
                <label className="flex items-center gap-2 input-modern cursor-pointer hover:border-primary/50">
                  <Image className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground truncate">{newBossMapFile ? newBossMapFile.name : "Imagem do mapa"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setNewBossMapFile(e.target.files[0]); }} />
                </label>
                <button onClick={async () => { await createBoss(); setShowBossModal(false); }} disabled={uploading} className="w-full btn-primary text-sm flex items-center justify-center gap-2">
                  {uploading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
                  {uploading ? "Enviando..." : "Cadastrar Boss"}
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {bosses.map((boss) => (
            <div key={boss.id} className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {boss.image_url ? (
                    <img src={boss.image_url} alt={boss.name} className="w-10 h-10 rounded-xl object-cover border border-border/40 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0"><Skull className="w-5 h-5 text-muted-foreground" /></div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-extrabold truncate">{boss.name}</h3>
                    {boss.map_level && <p className="text-[11px] text-muted-foreground font-body">{boss.map_level}</p>}
                  </div>
                </div>
                <button onClick={() => deleteBoss(boss.id)} className="text-destructive/60 hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Horários de Spawn</p>
                {(bossSchedules[boss.id] || []).length === 0 && (
                  <p className="text-xs text-muted-foreground/50 font-body italic">Nenhum horário</p>
                )}
                {(bossSchedules[boss.id] || []).map((sched) => {
                  const spawnTime = sched.spawn_time.substring(0, 5);
                  const [h, m] = spawnTime.split(":").map(Number);
                  let totalMins = h * 60 + m - sched.notify_minutes_before;
                  if (totalMins < 0) totalMins += 24 * 60;
                  const notifH = Math.floor(totalMins / 60) % 24;
                  const notifM = totalMins % 60;
                  const notifTime = `${notifH.toString().padStart(2, "0")}:${notifM.toString().padStart(2, "0")}`;
                  return (
                    <div key={sched.id} className="flex items-center gap-2 bg-secondary/40 px-3 py-2.5 rounded-xl border border-border/30">
                      <Clock className="w-3.5 h-3.5 text-gold shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-display font-extrabold">{spawnTime}</span>
                        <span className="text-[10px] text-muted-foreground font-body ml-1.5">→ {notifTime} ({sched.notify_minutes_before}min)</span>
                      </div>
                      <button onClick={() => deleteSchedule(sched.id)} className="text-destructive/60 hover:text-destructive p-1 rounded-lg shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 pt-1">
                  <input type="time" value={newScheduleTime[boss.id] || ""} onChange={(e) => setNewScheduleTime({ ...newScheduleTime, [boss.id]: e.target.value })} className="input-modern w-28 text-center" />
                  <input type="number" value={newScheduleMinutes[boss.id] || 10} onChange={(e) => setNewScheduleMinutes({ ...newScheduleMinutes, [boss.id]: parseInt(e.target.value) || 10 })} className="input-modern w-14 text-center" min={1} max={60} />
                  <span className="text-[10px] text-muted-foreground shrink-0">min</span>
                  <button onClick={() => addSchedule(boss.id)} className="btn-primary py-2.5 px-3 shrink-0"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}

          {bosses.length === 0 && (
            <div className="text-center py-10">
              <Skull className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-body">Nenhum boss cadastrado</p>
            </div>
          )}
        </div>
      )}

      {/* ========== ITEMS TAB ========== */}
      {tab === "items" && (
        <div className="space-y-3">
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wider">Novo Item</h3>
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nome do item" className="input-modern" />
            <input value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="Descrição (opcional)" className="input-modern" />
            <label className="flex items-center gap-2 input-modern cursor-pointer hover:border-primary/50">
              <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground truncate">{newItemFile ? newItemFile.name : "Selecionar imagem"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setNewItemFile(file); const r = new FileReader(); r.onload = (ev) => setNewItemPreview(ev.target?.result as string); r.readAsDataURL(file); }
              }} />
            </label>
            {newItemPreview && <img src={newItemPreview} alt="Preview" className="w-16 h-16 rounded-xl border border-border/40 object-cover" />}
            <button onClick={createItem} disabled={uploading} className="w-full btn-primary text-sm flex items-center justify-center gap-2">
              {uploading ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
              {uploading ? "Enviando..." : "Adicionar Item"}
            </button>
          </div>
          {items.map((item) => (
            <div key={item.id} className="glass-card p-3 flex items-center gap-3">
              <img src={item.image_url} alt={item.name} className="w-11 h-11 rounded-xl border border-border/40 object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-bold truncate">{item.name}</p>
                {item.description && <p className="text-[11px] text-muted-foreground font-body truncate">{item.description}</p>}
              </div>
              <button onClick={() => deleteItem(item.id)} className="text-destructive/60 hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 shrink-0"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ========== SESSIONS TAB ========== */}
      {tab === "sessions" && (
        <div className="space-y-3">
          <div className="glass-card p-4 space-y-3">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-wider">Nova Sessão</h3>
            <input value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} placeholder="Nome da sessão" className="input-modern" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Selecionar itens:</p>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {items.map((item) => (
                <button key={item.id} onClick={() => addItemToSession(item.id)} className="w-full text-left px-3 py-2 text-sm font-body bg-secondary/50 border border-border/40 rounded-xl hover:border-primary/40 transition-all truncate">
                  + {item.name}
                </button>
              ))}
            </div>
            {selectedItems.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gold uppercase tracking-wider font-bold">Itens selecionados:</p>
                {selectedItems.map((si, idx) => {
                  const item = items.find((i) => i.id === si.item_id);
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-xl border border-border/30">
                      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs font-body flex-1 truncate">{idx + 1}. {item?.name}</span>
                      <input type="number" value={si.duration} onChange={(e) => updateDuration(idx, parseInt(e.target.value) || 20)} className="w-12 bg-input border border-border/40 rounded-lg px-1.5 py-1 text-xs text-center" />
                      <span className="text-[10px] text-muted-foreground">s</span>
                      <button onClick={() => removeFromSession(idx)} className="text-destructive/70 hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={createSession} className="w-full btn-primary text-sm">Criar Sessão</button>
          </div>
          {sessions.map((sess) => (
            <div key={sess.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-display font-bold truncate">{sess.name}</p>
                <span className={`badge-status ${sess.is_running ? "bg-primary/15 text-primary" : sess.ended_at ? "bg-secondary text-muted-foreground" : "bg-gold/15 text-gold"}`}>
                  {sess.is_running ? "ATIVA" : sess.ended_at ? "ENCERRADA" : "PRONTA"}
                </span>
              </div>
              <div className="flex gap-2">
                {!sess.is_running && !sess.ended_at && (
                  <>
                    <button onClick={() => startSession(sess.id)} className="flex-1 btn-primary py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"><Play className="w-3 h-3" /> Iniciar</button>
                    <button onClick={() => simulateSession(sess.id)} disabled={simulating === sess.id} className="flex-1 btn-secondary py-2.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {simulating === sess.id ? <div className="w-3 h-3 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" /> : <Users className="w-3 h-3" />} Simular
                    </button>
                  </>
                )}
                {sess.is_running && (
                  <button onClick={() => stopSession(sess.id)} className="flex-1 py-2.5 bg-destructive/10 text-destructive font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-destructive/20 flex items-center justify-center gap-1.5"><Square className="w-3 h-3" /> Encerrar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== WINNERS TAB ========== */}
      {tab === "winners" && (
        <div className="space-y-2">
          {winners.length === 0 && <p className="text-center text-muted-foreground text-sm py-10 font-body">Nenhum vencedor ainda</p>}
          {winners.map((w) => (
            <div key={w.id} className="glass-card p-3 flex items-center gap-3">
              <img src={w.roulette_items?.image_url} alt={w.roulette_items?.name} className="w-11 h-11 rounded-xl border border-border/40 object-contain bg-muted/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-bold truncate">{w.roulette_items?.name}</p>
                <p className="text-xs text-gold font-body font-bold">{w.users?.nickname} · #{w.number}</p>
                <p className="text-[10px] text-muted-foreground font-body">{new Date(w.created_at).toLocaleString("pt-BR")}</p>
              </div>
              {!w.claimed ? (
                <button onClick={() => claimWinner(w.id)} className="px-3 py-1.5 bg-gold/10 text-gold font-bold text-xs uppercase rounded-xl hover:bg-gold/20 flex items-center gap-1 shrink-0"><Check className="w-3 h-3" /> Entregar</button>
              ) : (
                <span className="badge-status bg-secondary text-muted-foreground shrink-0">✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
