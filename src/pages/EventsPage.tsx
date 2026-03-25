import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Calendar, Users, Plus, CheckCircle2, XCircle, Image as ImageIcon, Loader2, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerCharModal } from "@/components/PlayerCharModal";

export default function EventsPage() {
  const { isAdmin, profile } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Custom modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  
  // Create form
  const [title, setTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Attendees
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  // My Presence Modal State
  const [showMyPresenceModal, setShowMyPresenceModal] = useState(false);
  const [myPresence, setMyPresence] = useState<any | null>(null);
  const [myReason, setMyReason] = useState("");
  const [isChangingToNo, setIsChangingToNo] = useState(false);
  
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<{id: string, name: string} | null>(null);

  const handleUpdatePresence = async (status: 'confirmed' | 'declined') => {
    if (status === 'declined' && !myReason.trim()) {
      toast.error("Por favor, informe a justificativa.");
      return;
    }
    try {
      const payload = {
        event_id: selectedEvent.id,
        user_id: profile!.id,
        status,
        reason: status === 'declined' ? myReason.trim() : null,
        updated_at: new Date().toISOString()
      };
      let err;
      if (myPresence?.id) {
         const { error } = await supabase.from("event_presences").update(payload).eq("id", myPresence.id);
         err = error;
      } else {
         const { error } = await supabase.from("event_presences").insert([payload]);
         err = error;
      }
      if (err) throw err;
      
      toast.success("Presença atualizada com sucesso!");
      setShowMyPresenceModal(false);
      // Optional: Refresh local view
      if (showAttendeesModal) viewAttendees(selectedEvent);
    } catch(err: any){
      toast.error("Erro ao atualizar presença: " + err.message);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          event_presences(id, status, user_id)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      toast.error("Erro ao buscar eventos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Both admins and normal users can see the events list, but admins can manage
    fetchEvents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      const payload = {
        title,
        photo_url: photoUrl || null,
        event_date: eventDate,
        event_time: eventTime || null,
        is_active: isActive,
        created_by: profile.id
      };
      const { error } = await supabase.from("events").insert([payload]);
      if (error) throw error;
      
      toast.success("Evento criado com sucesso!");
      setShowCreateModal(false);
      
      // Reset
      setTitle("");
      setPhotoUrl("");
      setEventDate("");
      setEventTime("");
      setIsActive(true);

      fetchEvents();
    } catch (err: any) {
      toast.error("Erro ao criar evento: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from("events").update({ is_active: !currentStatus }).eq("id", id);
      if (error) throw error;
      toast.success(currentStatus ? "Evento inativado!" : "Evento ativado!");
      fetchEvents();
    } catch (err: any) {
      toast.error("Erro ao atualizar evento: " + err.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Certeza que deseja excluir este evento? Todas as presenças confirmadas serão apagadas permanentemente!")) return;
    try {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      toast.success("Evento excluído!");
      fetchEvents();
      if (selectedEvent?.id === id) {
          setShowAttendeesModal(false);
      }
    } catch (err: any) {
      toast.error("Erro ao excluir evento: " + err.message);
    }
  };

  const handleClearPresences = async (eventId: string) => {
    if (!window.confirm("Certeza que deseja remover TODAS as presenças deste evento? A lista ficará vazia.")) return;
    try {
      const { error } = await supabase.from("event_presences").delete().eq("event_id", eventId);
      if (error) throw error;
      toast.success("Lista de presenças limpa!");
      fetchEvents();
      setAttendees([]); // Update modal UI immediately
    } catch (err: any) {
      toast.error("Erro ao limpar presenças: " + err.message);
    }
  };

  const viewAttendees = async (event: any) => {
    setSelectedEvent(event);
    setShowAttendeesModal(true);
    setLoadingAttendees(true);
    try {
      // Fetch event presences and join with users to get nickname, class
      const { data, error } = await supabase
        .from("event_presences")
        .select(`
          status,
          reason,
          created_at,
          updated_at,
          users:user_id (id, nickname, class, avatar_url)
        `)
        .eq("event_id", event.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      
      const atts = data || [];
      
      // Fetch levels from alcatraz_members by matching nickname
      const nicknames = atts.map((d: any) => d.users?.nickname).filter(Boolean);
      if (nicknames.length > 0) {
        const { data: members } = await supabase
          .from("alcatraz_members" as any)
          .select("name, level")
          .in("name", nicknames);
          
        if (members) {
          const levelMap = new Map((members as any[]).map(m => [m.name, m.level]));
          atts.forEach((d: any) => {
             if (d.users) d.users.level = levelMap.get(d.users.nickname) || null;
          });
        }
      }
      
      setAttendees(atts);
    } catch (err: any) {
      toast.error("Erro ao buscar participantes: " + err.message);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const openMyPresence = async (ev: any) => {
     setSelectedEvent(ev);
     setShowMyPresenceModal(true);
     setShowAttendeesModal(false); // close attendees list if opened from there
     setLoadingAttendees(true);
     setIsChangingToNo(false);
     try {
       const { data } = await supabase
         .from("event_presences")
         .select("*")
         .eq("event_id", ev.id)
         .eq("user_id", profile?.id)
         .maybeSingle();
       setMyPresence(data || null);
       setMyReason(data?.reason || "");
     } catch {
       //
     } finally {
       setLoadingAttendees(false);
     }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-extrabold uppercase tracking-widest text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Eventos
          </h2>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            Acompanhe os próximos eventos do clã
          </p>
        </div>
        
        {isAdmin && (
            <button 
                onClick={() => setShowCreateModal(true)}
                className="btn-primary flex items-center gap-2 text-xs py-2 px-3"
            >
                <Plus className="w-3.5 h-3.5" />
                Novo Evento
            </button>
        )}
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 glass-card">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground font-body">Carregando eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-10 glass-card">
            <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-body">Nenhum evento registrado.</p>
          </div>
        ) : (
          events.map(ev => (
            <div key={ev.id} className="glass-card overflow-hidden hover:border-primary/30 transition-colors">
              {ev.photo_url && (
                <div className="w-full h-32 relative">
                  <img src={ev.photo_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent opacity-80" />
                  {!ev.is_active && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-xs px-2 py-1 rounded text-muted-foreground font-bold">
                        Encerrado
                    </div>
                  )}
                </div>
              )}
              
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-3">
                        <h3 className="font-display font-bold text-lg leading-tight truncate">{ev.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1.5">
                            <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(ev.event_date + "T00:00:00"), "dd/MM/yyyy")}
                            </span>
                            {ev.event_time && (
                                <span className="flex items-center gap-1">
                                    • <Clock className="w-3.5 h-3.5" />
                                    {ev.event_time.slice(0, 5)}
                                </span>
                            )}
                        </div>
                    </div>
                    {ev.event_presences && (
                      <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl px-3 py-1.5 border border-primary/20 shrink-0">
                         <div className="flex items-center gap-1.5 text-primary font-display font-extrabold text-sm">
                           <Users className="w-4 h-4" />
                           {ev.event_presences.filter((p: any) => p.status === 'confirmed').length}
                         </div>
                         <span className="text-[9px] text-primary/70 uppercase font-bold tracking-widest mt-0.5">Confirmados</span>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                    {isAdmin && (
                        <button 
                          onClick={() => handleToggleActive(ev.id, ev.is_active)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-colors ${ev.is_active ? 'border-primary/50 text-primary hover:bg-primary/10' : 'border-border text-muted-foreground hover:bg-white/5'}`}
                        >
                            {ev.is_active ? 'Ativo' : 'Ativar'}
                        </button>
                    )}
                    {ev.is_active && (() => {
                       const myPresenceObj = ev.event_presences?.find((p: any) => p.user_id === profile?.id);
                       
                       if (!myPresenceObj) {
                          return (
                             <div className="flex gap-1.5 shrink-0 ml-auto items-center">
                                <button 
                                   onClick={async () => {
                                     try {
                                       const { error } = await supabase.from("event_presences").insert({
                                         event_id: ev.id,
                                         user_id: profile!.id,
                                         status: 'confirmed'
                                       });
                                       if (error) throw error;
                                       toast.success("Presença Confirmada!");
                                       fetchEvents();
                                     } catch (err: any) {
                                       toast.error("Erro ao confirmar: " + err.message);
                                     }
                                   }}
                                   className="py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors bg-primary hover:bg-primary/90 text-primary-foreground border border-transparent"
                                >
                                   <CheckCircle2 className="w-3.5 h-3.5" /> VOU
                                </button>
                                <button 
                                   onClick={() => {
                                     setSelectedEvent(ev);
                                     setShowMyPresenceModal(true);
                                     setIsChangingToNo(true);
                                     setMyPresence(null);
                                     setMyReason("");
                                   }}
                                   className="py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors bg-transparent text-red-500 border border-red-500/20 hover:bg-red-500/10"
                                >
                                   <XCircle className="w-3.5 h-3.5" /> FALTAR
                                </button>
                             </div>
                          );
                       } else {
                          return (
                             <button 
                                 onClick={() => openMyPresence(ev)}
                                 className={`py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold ml-auto rounded-xl transition-all border ${myPresenceObj.status === 'confirmed' ? 'bg-primary hover:bg-primary/90 text-primary-foreground border-transparent' : 'bg-transparent text-red-500 border-red-500/20 hover:bg-red-500/10'}`}
                             >
                                 {myPresenceObj.status === 'confirmed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                 {myPresenceObj.status === 'confirmed' ? "Confirmado" : "Ausente"}
                             </button>
                          );
                       }
                    })()}
                    
                    <button 
                        onClick={() => viewAttendees(ev)}
                        className={`py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold rounded-xl transition-colors shrink-0 bg-secondary/30 hover:bg-secondary/50 border border-border/50 ${!ev.is_active || ev.event_presences?.find((p: any) => p.user_id === profile?.id) ? '' : 'ml-2'}`}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Ver Presenças
                    </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE EVENT MODAL */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Criar Novo Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Título do Evento</label>
                <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: GvG vs Clã Inimigo" className="input-modern" />
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data</label>
                    <input required type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="input-modern" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Hora</label>
                    <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="input-modern" />
                </div>
             </div>
             <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">URL da Foto (Opcional)</label>
                <div className="relative">
                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." className="input-modern pl-9" />
                </div>
             </div>
             <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-border/50 bg-background/50 accent-primary" />
                <label htmlFor="isActive" className="text-sm font-body cursor-pointer">Requerer confirmação de presença (Ativo)</label>
             </div>
             
             <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1 py-2 text-sm">Cancelar</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1 py-2 text-sm">
                    {creating ? "Criando..." : "Salvar Evento"}
                </button>
             </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MY PRESENCE MODAL */}
      <Dialog open={showMyPresenceModal} onOpenChange={setShowMyPresenceModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Minha Presença: {selectedEvent?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingAttendees ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
               <>
                 {myPresence && !isChangingToNo ? (
                   <div className="text-center space-y-3 p-4 glass-card">
                      {myPresence.status === 'confirmed' ? (
                        <>
                          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                          <p className="font-display font-bold text-lg">Você confirmou presença!</p>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                          <p className="font-display font-bold text-lg">Falta justificada.</p>
                          <p className="text-sm text-muted-foreground italic">"{myPresence.reason}"</p>
                        </>
                      )}
                      
                      <div className="mt-4 pt-4 border-t border-border/30 flex flex-col gap-2">
                          {myPresence.status === 'declined' && (
                             <button 
                               onClick={() => handleUpdatePresence('confirmed')}
                               className="btn-primary py-2 text-sm"
                             >
                               Mudar para "Vou Participar"
                             </button>
                          )}
                          {myPresence.status === 'confirmed' && (
                             <button 
                               onClick={() => setIsChangingToNo(true)}
                               className="btn-secondary py-2 text-sm hover:!bg-destructive/20 hover:!text-destructive border border-transparent hover:border-destructive/30"
                             >
                               Não poderei ir (Justificar)
                             </button>
                          )}
                      </div>
                   </div>
                 ) : (
                    <div className="space-y-3 p-2">
                       {(!myPresence || isChangingToNo) && (
                          <>
                             <p className="text-sm font-bold text-foreground">Por que você não poderá ir?</p>
                             <textarea 
                                value={myReason} 
                                onChange={e => setMyReason(e.target.value)} 
                                placeholder="Descreva sua justificativa..."
                                className="input-modern min-h-[100px] w-full resize-none"
                             />
                             <div className="flex gap-2 mt-4">
                               <button onClick={() => { setIsChangingToNo(false); if(!myPresence) setShowMyPresenceModal(false); }} className="btn-secondary flex-1 py-2 text-sm">Voltar</button>
                               <button 
                                 onClick={() => handleUpdatePresence('declined')}
                                 className="btn-primary !bg-destructive !text-destructive-foreground hover:!bg-destructive/90 flex-1 py-2 text-sm"
                               >
                                 Salvar Justificativa
                               </button>
                             </div>
                             
                             {!isChangingToNo && !myPresence && (
                               <div className="pt-4 border-t border-border/30 mt-4">
                                  <button onClick={() => handleUpdatePresence('confirmed')} className="btn-primary w-full py-2 text-sm">
                                     Mudei de ideia, Vou Participar!
                                  </button>
                               </div>
                             )}
                          </>
                       )}
                    </div>
                 )}
               </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ATTENDEES MODAL */}
      <Dialog open={showAttendeesModal} onOpenChange={setShowAttendeesModal}>
        <DialogContent className="max-w-md sm:max-w-xl h-[80vh] flex flex-col p-0">
          <div className="p-4 border-b border-border/30 shrink-0 flex items-start justify-between">
             <div>
                 <DialogTitle className="font-display text-lg">{selectedEvent?.title}</DialogTitle>
                 <p className="text-xs text-muted-foreground font-body mt-1">Lista de Presenças</p>
             </div>
             {isAdmin && selectedEvent && (
                 <div className="flex gap-2">
                     <button
                        onClick={() => handleDeleteEvent(selectedEvent.id)}
                        className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-lg transition-colors border border-destructive/20"
                        title="Excluir Evento"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                     <button
                        onClick={() => handleClearPresences(selectedEvent.id)}
                        className="p-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-lg transition-colors border border-orange-500/20"
                        title="Limpar Presenças"
                     >
                        <Trash2 className="w-4 h-4" />
                     </button>
                 </div>
             )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {loadingAttendees ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
             ) : attendees.length === 0 ? (
                <div className="text-center py-10">
                    <p className="text-sm text-muted-foreground font-body">Ninguém respondeu ainda.</p>
                </div>
             ) : (
                attendees.map((att, i) => (
                    <div key={i} className="glass-card p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                               {att.users?.avatar_url ? (
                                   <img src={att.users.avatar_url} className="w-8 h-8 rounded-lg object-cover" />
                               ) : (
                                   <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center font-bold text-xs uppercase">
                                     {att.users?.nickname?.substring(0,2) || "??"}
                                   </div>
                               )}
                               <div 
                                    className="cursor-pointer group flex flex-col justify-center"
                                    onClick={() => {
                                        if (att.users?.id && att.users?.nickname) {
                                            setSelectedPlayerForModal({ id: att.users.id, name: att.users.nickname });
                                        }
                                    }}
                               >
                                   <p className="font-bold font-display text-sm leading-none group-hover:text-primary transition-colors">{att.users?.nickname || "Usuário Desconhecido"}</p>
                                   <p className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary/70 transition-colors">
                                      {att.users?.class || "Sem Classe"}
                                      {att.users?.level ? ` • Lvl ${att.users.level}` : ""}
                                   </p>
                               </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-1">
                                {att.status === 'confirmed' ? (
                                    <span className="bg-green-500/20 text-green-500 text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" /> Vai
                                    </span>
                                ) : (
                                    <span className="bg-red-500/20 text-red-500 text-[10px] uppercase font-bold px-2 py-1 rounded flex items-center gap-1">
                                        <XCircle className="w-3 h-3" /> Faltará
                                    </span>
                                )}
                                <span className="text-[9px] text-muted-foreground/60 font-sans mt-0.5">
                                   {format(new Date(att.updated_at || att.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                </span>
                            </div>
                        </div>
                        
                        {att.status === 'declined' && att.reason && (
                            <div className="mt-1 bg-background/50 rounded-lg p-2 text-xs italic text-muted-foreground border border-border/20">
                                "{att.reason}"
                            </div>
                        )}
                        {(att.users?.id === profile?.id || isAdmin) && (
                            <div className="mt-1 pt-2 border-t border-border/20 flex justify-end">
                                <button
                                    onClick={() => openMyPresence(selectedEvent)}
                                    className="text-[10px] uppercase font-bold text-primary hover:text-primary/80 transition-colors py-1 px-2 hover:bg-primary/10 rounded"
                                >
                                    {att.users?.id === profile?.id ? "Mudar Minha Presença" : "Mudar Presença"}
                                </button>
                            </div>
                        )}
                    </div>
                ))
             )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedPlayerForModal && (
        <PlayerCharModal
          playerId={selectedPlayerForModal.id}
          playerName={selectedPlayerForModal.name}
          onClose={() => setSelectedPlayerForModal(null)}
        />
      )}
    </div>
  );
}
