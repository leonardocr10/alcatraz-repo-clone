import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, Clock, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface EventData {
  id: string;
  title: string;
  photo_url: string | null;
  event_date: string;
  event_time: string | null;
}

export function EventPresencePrompt() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null);
  const [isDeclining, setIsDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    const checkEvent = async () => {
      // Find the most recent active event
      const { data: events, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (eventError || !events || events.length === 0) return;

      const event = events[0];

      // Check if user has already responded
      const { data: presence, error: presenceError } = await supabase
        .from("event_presences")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", profile.id)
        .maybeSingle();

      // If no presence explicitly recorded, prompt them
      if (!presence) {
        setActiveEvent(event);
        setOpen(true);
      }
    };

    checkEvent();
  }, [profile?.id]);

  const handleConfirm = async () => {
    if (!activeEvent || !profile) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("event_presences").insert({
        event_id: activeEvent.id,
        user_id: profile.id,
        status: "confirmed"
      });
      if (error) throw error;
      toast.success("Presença confirmada!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar presença");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!activeEvent || !profile) return;
    if (!reason.trim()) {
      toast.error("Por favor, informe o motivo.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("event_presences").insert({
        event_id: activeEvent.id,
        user_id: profile.id,
        status: "declined",
        reason: reason.trim()
      });
      if (error) throw error;
      toast.success("Falta justificada!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao justificar falta");
    } finally {
      setLoading(false);
    }
  };

  if (!activeEvent) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => {
        // Prevent closing by clicking outside if they haven't responded
        if (!val) {
            toast.error("Você precisa confirmar ou justificar sua ausência.");
        }
    }}>
      <DialogContent className="max-w-md sm:rounded-2xl overflow-hidden p-0 border-border/40">
        {activeEvent.photo_url ? (
          <div className="w-full h-48 relative">
            <img src={activeEvent.photo_url} alt={activeEvent.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        ) : (
          <div className="w-full h-24 bg-primary/20 flex items-center justify-center">
             <Calendar className="w-10 h-10 text-primary" />
          </div>
        )}
        
        <div className="px-6 py-4 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">{activeEvent.title}</DialogTitle>
            <DialogDescription className="font-body text-muted-foreground flex flex-wrap items-center gap-2 mt-2 text-sm">
                <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> 
                    {format(new Date(activeEvent.event_date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                </span>
                {activeEvent.event_time && (
                    <span className="flex items-center gap-1 ml-2">
                        <Clock className="w-4 h-4" />
                        {activeEvent.event_time.slice(0, 5)}
                    </span>
                )}
            </DialogDescription>
          </DialogHeader>

          {!isDeclining ? (
            <div className="flex flex-col gap-3 mt-4">
               <p className="text-sm font-body mb-2 text-center">Você irá participar deste evento?</p>
               <button 
                  onClick={handleConfirm}
                  disabled={loading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-bold"
               >
                 <CheckCircle2 className="w-5 h-5" /> Confirmar Presença
               </button>
               <button 
                  onClick={() => setIsDeclining(true)}
                  disabled={loading}
                 className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-xl transition-colors"
               >
                 <XCircle className="w-5 h-5" /> Não poderei ir
               </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-4 animate-in fade-in slide-in-from-right-4">
                <p className="text-sm font-bold text-destructive">Por que você não poderá ir?</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Digite sua justificativa..."
                    className="input-modern min-h-[80px] w-full resize-none p-3"
                    required
                />
                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={() => setIsDeclining(false)}
                        disabled={loading}
                        className="btn-secondary flex-1 py-2 text-sm"
                    >
                        Voltar
                    </button>
                    <button 
                        onClick={handleDecline}
                        disabled={loading || !reason.trim()}
                        className="btn-primary flex-1 py-2 text-sm !bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
                    >
                        {loading ? "Enviando..." : "Justificar"}
                    </button>
                </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
