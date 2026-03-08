import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type CharacterClass = {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
};

const CLASS_OPTIONS = [
  "Fighter",
  "Mechanician",
  "Archer",
  "Pikeman",
  "Knight",
  "Atalanta",
  "Priestess",
  "Magician",
] as const;

export default function ClassesPage() {
  const { isAdmin } = useAuth();
  const [classes, setClasses] = useState<CharacterClass[]>([]);
  const [selectedName, setSelectedName] = useState<string>(CLASS_OPTIONS[0]);
  const [iconUrl, setIconUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const classByName = useMemo(() => new Map(classes.map((c) => [c.name, c])), [classes]);

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("character_classes")
      .select("id, name, image_url, description")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar classes");
      return;
    }
    setClasses((data ?? []) as CharacterClass[]);
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  useEffect(() => {
    const current = classByName.get(selectedName);
    setIconUrl(current?.image_url ?? "");
    setDescription(current?.description ?? "");
  }, [selectedName, classByName]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);

    const existing = classByName.get(selectedName);
    let error = null as any;

    if (existing) {
      ({ error } = await supabase
        .from("character_classes")
        .update({ image_url: iconUrl || null, description: description || null })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("character_classes")
        .insert({ name: selectedName as any, image_url: iconUrl || null, description: description || null }));
    }

    if (error) {
      toast.error(error.message ?? "Erro ao salvar classe");
    } else {
      toast.success("Classe salva com sucesso");
      await fetchClasses();
    }

    setSaving(false);
  };

  if (!isAdmin) {
    return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Acesso restrito ao admin.</p>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSave} className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Classes e ícones</h2>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Classe</span>
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {CLASS_OPTIONS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">URL do ícone</span>
          <input
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Descrição</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <button
          disabled={saving}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar classe"}
        </button>
      </form>

      <section className="grid gap-3 sm:grid-cols-2">
        {classes.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-3">
              {item.image_url ? (
                <img src={item.image_url} alt={`Ícone da classe ${item.name}`} className="h-8 w-8 rounded object-cover" loading="lazy" />
              ) : (
                <div className="h-8 w-8 rounded bg-secondary" />
              )}
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.description || "Sem descrição"}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
