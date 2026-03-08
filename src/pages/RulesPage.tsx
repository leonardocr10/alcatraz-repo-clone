import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText } from "lucide-react";

export default function RulesPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("clan_rules")
      .select("content")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContent(data.content);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-primary" />
        </div>
        <h2 className="font-display text-xl font-extrabold uppercase tracking-wider">Regras</h2>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="glass-card p-5">
          <div className="whitespace-pre-wrap text-sm font-body leading-relaxed text-foreground/90">
            {content || "Nenhuma regra cadastrada."}
          </div>
        </div>
      )}
    </div>
  );
}
