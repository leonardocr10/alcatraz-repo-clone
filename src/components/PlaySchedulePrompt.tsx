import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { PlayScheduleSelector } from "./PlayScheduleSelector";

export function PlaySchedulePrompt() {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Only show if user is logged in, profile exists, and play_schedule is empty
  const playSchedule = (profile as any)?.play_schedule as string[] | undefined;
  if (!profile || dismissed || (playSchedule && playSchedule.length > 0)) return null;

  const handleSave = async () => {
    if (selected.length === 0) {
      toast.error("Selecione pelo menos um horário");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("users")
      .update({ play_schedule: selected } as any)
      .eq("id", profile.id);
    if (error) {
      toast.error("Erro ao salvar horários");
    } else {
      toast.success("Horários salvos!");
      setDismissed(true);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fade-in">
      <div className="glass-card glow-primary p-6 bg-background/90 backdrop-blur-xl w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 justify-center">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg font-bold tracking-wider uppercase">
            Horários de Jogo
          </h2>
        </div>
        <p className="text-sm text-muted-foreground font-body text-center">
          Selecione os horários que você costuma jogar:
        </p>
        <PlayScheduleSelector selected={selected} onChange={setSelected} />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || selected.length === 0}
          className="w-full btn-primary text-sm font-display tracking-wider uppercase"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        {selected.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center font-body">
            Selecione pelo menos um horário para continuar
          </p>
        )}
      </div>
    </div>
  );
}
