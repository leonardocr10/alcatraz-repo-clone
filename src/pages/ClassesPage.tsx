import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Swords, Pencil, X } from "lucide-react";

type CharacterClass = {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
};

const CLASS_OPTIONS = [
  "Fighter", "Mechanician", "Archer", "Pikeman",
  "Knight", "Atalanta", "Priestess", "Magician",
] as const;

export default function ClassesPage() {
  const { isAdmin } = useAuth();
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("character_classes")
      .select("id, name, image_url, description")
      .order("name", { ascending: true });
    if (error) { toast.error("Erro ao carregar classes"); return; }
    setClasses((data ?? []) as CharacterClass[]);
  };

  useEffect(() => { fetchClasses(); }, []);

  const startEdit = (cls: CharacterClass) => {
    setEditing(cls.id);
    setEditUrl(cls.image_url ?? "");
    setEditDesc(cls.description ?? "");
  };

  const saveEdit = async (cls: CharacterClass) => {
    setSaving(true);
    const { error } = await supabase
      .from("character_classes")
      .update({ image_url: editUrl || null, description: editDesc || null })
      .eq("id", cls.id);
    if (error) { toast.error(error.message); }
    else { toast.success("Classe atualizada!"); setEditing(null); await fetchClasses(); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Swords className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wider">Classes</h2>
          <p className="text-xs text-muted-foreground font-body">{classes.length} classes cadastradas</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {classes.map((cls) => (
          <div key={cls.id} className="glass-card overflow-hidden">
            {cls.image_url ? (
              <div className="aspect-[3/4] bg-secondary/30 overflow-hidden">
                <img
                  src={cls.image_url}
                  alt={cls.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center">
                <Swords className="w-12 h-12 text-muted-foreground/30" />
              </div>
            )}

            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-base font-bold uppercase tracking-wider">{cls.name}</h3>
                {isAdmin && editing !== cls.id && (
                  <button
                    onClick={() => startEdit(cls)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editing === cls.id ? (
                <div className="space-y-2 mt-2">
                  <input
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="URL da imagem"
                    className="input-modern text-sm"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Descrição..."
                    rows={3}
                    className="input-modern text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(cls)}
                      disabled={saving}
                      className="flex-1 btn-primary text-xs py-2"
                    >
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="btn-secondary text-xs py-2 px-3"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground font-body line-clamp-3">
                  {cls.description || "Sem descrição"}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Show unregistered classes for admin */}
        {isAdmin && CLASS_OPTIONS.filter(name => !classes.find(c => c.name === name)).map((name) => (
          <div key={name} className="glass-card overflow-hidden opacity-50 hover:opacity-80 transition-opacity">
            <div className="aspect-[3/4] bg-secondary/30 flex items-center justify-center">
              <Swords className="w-12 h-12 text-muted-foreground/20" />
            </div>
            <div className="p-4">
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-muted-foreground">{name}</h3>
              <p className="text-xs text-muted-foreground/50 font-body mt-1">Não cadastrada</p>
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from("character_classes")
                    .insert({ name: name as any });
                  if (error) toast.error(error.message);
                  else { toast.success(`${name} cadastrada!`); fetchClasses(); }
                }}
                className="mt-2 btn-primary text-xs py-2 w-full"
              >
                Cadastrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
