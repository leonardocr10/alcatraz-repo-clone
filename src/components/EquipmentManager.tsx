import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Pencil, Save, X, Upload, Search, ImageIcon } from "lucide-react";

type EquipmentSlot = 'arma_1m' | 'arma_2m' | 'escudo' | 'armadura' | 'bota' | 'luva' | 'bracelete' | 'anel_1' | 'colar' | 'anel_2';

interface Category {
  id: string;
  name: string;
  slot: EquipmentSlot;
}

interface Item {
  id: string;
  name: string;
  image_url: string;
  category_id: string;
  slot: EquipmentSlot;
}

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  arma_1m: "Arma 1 Mão",
  arma_2m: "Arma 2 Mãos",
  escudo: "Escudo",
  armadura: "Armadura",
  bota: "Bota",
  luva: "Luva",
  bracelete: "Bracelete",
  anel_1: "Anel 1",
  colar: "Colar",
  anel_2: "Anel 2",
};

export default function EquipmentManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from("equipment_categories").select("id, name, slot").order("sort_order"),
      supabase.from("equipment_items").select("id, name, image_url, category_id, slot").order("name"),
    ]);
    setCategories((catsRes.data as Category[]) || []);
    setItems((itemsRes.data as Item[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCategories = selectedSlot === "all"
    ? categories
    : categories.filter(c => c.slot === selectedSlot);

  const filteredItems = items.filter(item => {
    if (selectedSlot !== "all" && item.slot !== selectedSlot) return false;
    if (selectedCategory !== "all" && item.category_id !== selectedCategory) return false;
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const startEdit = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditImageUrl(item.image_url);
    setEditFile(null);
    setEditPreview(null);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditName("");
    setEditImageUrl("");
    setEditFile(null);
    setEditPreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditFile(file);
    setEditPreview(URL.createObjectURL(file));
  };

  const saveItem = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      let finalUrl = editImageUrl;

      // If there's no URL but there's a file, upload it
      if (editFile && !editImageUrl.trim()) {
        const ext = editFile.name.split(".").pop() || "png";
        const path = `items/${editingItem.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("equipment-images")
          .upload(path, editFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("equipment-images").getPublicUrl(path);
        finalUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("equipment_items")
        .update({ name: editName, image_url: finalUrl })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Item atualizado!");
      setItems(prev => prev.map(i =>
        i.id === editingItem.id ? { ...i, name: editName, image_url: finalUrl } : i
      ));
      cancelEdit();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Filtros</p>

        {/* Slot filter */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setSelectedSlot("all"); setSelectedCategory("all"); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              selectedSlot === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            Todos
          </button>
          {(Object.keys(SLOT_LABELS) as EquipmentSlot[]).map(slot => (
            <button
              key={slot}
              onClick={() => { setSelectedSlot(slot); setSelectedCategory("all"); }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedSlot === slot
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {filteredCategories.length > 0 && selectedSlot !== "all" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                selectedCategory === "all"
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              Todas categorias
            </button>
            {filteredCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar item por nome..."
            className="input-modern pl-9 text-sm"
          />
        </div>

        <p className="text-[10px] text-muted-foreground">{filteredItems.length} itens encontrados</p>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {filteredItems.map(item => (
          <div key={item.id} className="glass-card p-3 flex items-center gap-3">
            <img
              src={item.image_url}
              alt={item.name}
              className="w-12 h-12 object-contain rounded-lg bg-secondary/30 p-1 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-sm truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {getCategoryName(item.category_id)} · {SLOT_LABELS[item.slot]}
              </p>
            </div>
            <button
              onClick={() => startEdit(item)}
              className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-primary/10 transition-colors shrink-0"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum item encontrado</p>
        )}
      </div>

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={cancelEdit}>
          <div
            className="bg-background border border-border rounded-2xl p-5 w-full max-w-md space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-sm uppercase tracking-wider">Editar Item</h3>
              <button onClick={cancelEdit} className="p-1.5 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-center overflow-hidden">
                {editPreview ? (
                  <img src={editPreview} alt="preview" className="w-20 h-20 object-contain" />
                ) : editImageUrl ? (
                  <img src={editImageUrl} alt={editName} className="w-20 h-20 object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                )}
              </div>
            </div>

            {/* Name */}
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Nome</span>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="input-modern text-sm"
              />
            </label>

            {/* Image URL */}
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">URL da Imagem (prioritário)</span>
              <input
                value={editImageUrl}
                onChange={e => setEditImageUrl(e.target.value)}
                className="input-modern text-sm"
                placeholder="https://..."
              />
            </label>

            {/* File upload */}
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Ou enviar imagem</span>
              <p className="text-[10px] text-muted-foreground">Usado apenas se o campo URL acima estiver vazio</p>
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/60 bg-secondary/20 cursor-pointer hover:border-primary/40 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {editFile ? editFile.name : "Escolher arquivo..."}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="flex-1 btn-secondary text-sm py-2.5"
              >
                Cancelar
              </button>
              <button
                onClick={saveItem}
                disabled={saving || !editName.trim()}
                className="flex-1 btn-primary text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
