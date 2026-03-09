import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type EquipmentSlot = 'arma_1m' | 'arma_2m' | 'escudo' | 'armadura' | 'bota' | 'luva' | 'bracelete' | 'anel_1' | 'colar' | 'anel_2';
type Rarity = 'normal' | 'raro' | 'epico' | 'lendario' | 'boss';

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
}

const RARITY_OPTIONS: { key: Rarity; label: string; borderColor: string; dotColor: string }[] = [
  { key: 'normal', label: 'Normal', borderColor: 'border-green-500', dotColor: 'bg-green-500' },
  { key: 'raro', label: 'Raro', borderColor: 'border-cyan-400', dotColor: 'bg-cyan-400' },
  { key: 'epico', label: 'Épico', borderColor: 'border-purple-400', dotColor: 'bg-purple-400' },
  { key: 'lendario', label: 'Lendário', borderColor: 'border-yellow-500', dotColor: 'bg-yellow-500' },
  { key: 'boss', label: 'Boss', borderColor: 'border-red-500', dotColor: 'bg-red-500' },
];

interface Props {
  slot: EquipmentSlot;
  slotLabel: string;
  onEquip: (slot: EquipmentSlot, itemId: string, rarity: Rarity, plusValue: number, mix?: string | null) => void;
  onClose: () => void;
}

export function EquipmentCatalogModal({ slot, slotLabel, onEquip, onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('normal');
  const [plusValue, setPlusValue] = useState(0);
  const [maxAging, setMaxAging] = useState(12);
  const [selectedMix, setSelectedMix] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const showMix = ['anel_1', 'anel_2', 'colar'].includes(slot);
  const MIX_OPTIONS = ['Raident', 'Celesto', 'Enigma'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      // Fetch categories, items, and max aging config in parallel
      const [catsRes, itemsRes, configRes] = await Promise.all([
        supabase.from("equipment_categories").select("id, name, slot").eq("slot", slot).order("sort_order"),
        supabase.from("equipment_items").select("id, name, image_url, category_id").eq("slot", slot),
        supabase.from("app_config").select("max_aging").eq("id", "main").maybeSingle(),
      ]);

      const catList = (catsRes.data as Category[]) || [];
      setCategories(catList);
      if (catList.length > 0) setSelectedCategory(catList[0].id);
      setItems((itemsRes.data as Item[]) || []);
      if (configRes.data?.max_aging != null) setMaxAging(configRes.data.max_aging);
      setLoading(false);
    };
    fetchData();
  }, [slot]);

  const filteredItems = selectedCategory
    ? items.filter(i => i.category_id === selectedCategory)
    : items;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase tracking-wide">
            {slotLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Left side - Catalog */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Category tabs */}
            {categories.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Navegar Categoria
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.id); setSelectedItem(null); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        selectedCategory === cat.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Items count */}
            <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest">
                Catálogo de Itens
              </p>
              <span className="text-[10px] text-muted-foreground">
                {filteredItems.length} itens encontrados
              </span>
            </div>

            {/* Items grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  Nenhum item cadastrado para este slot
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`rounded-xl border-2 p-2 flex flex-col items-center gap-1 transition-all hover:scale-105 ${
                        selectedItem?.id === item.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/40 bg-secondary/30 hover:border-border/60'
                      }`}
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-14 h-14 object-contain"
                      />
                      <span className="text-[9px] font-display font-bold text-center leading-tight truncate w-full uppercase">
                        {item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Preview & Rarity */}
          <div className="w-44 flex flex-col gap-3">
          {/* Item preview */}
            <div className={`rounded-xl border border-border/40 aspect-square flex items-center justify-center overflow-hidden transition-colors ${
              selectedItem
                ? selectedRarity === 'normal' ? 'bg-green-500/10'
                  : selectedRarity === 'raro' ? 'bg-cyan-400/10'
                  : selectedRarity === 'epico' ? 'bg-purple-400/10'
                  : selectedRarity === 'lendario' ? 'bg-yellow-500/10'
                  : 'bg-red-500/10'
                : 'bg-secondary/20'
            }`}>
              {selectedItem ? (
                <div className="flex flex-col items-center gap-2 p-3">
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.name}
                    className="w-24 h-24 object-contain"
                  />
                  <p className="font-display font-extrabold text-xs text-center uppercase">
                    {selectedItem.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      selectedRarity === 'normal' ? 'text-green-500 bg-green-500/20' :
                      selectedRarity === 'raro' ? 'text-cyan-400 bg-cyan-400/20' :
                      selectedRarity === 'epico' ? 'text-purple-400 bg-purple-400/20' :
                      selectedRarity === 'lendario' ? 'text-yellow-500 bg-yellow-500/20' :
                      'text-red-500 bg-red-500/20'
                    }`}>
                      {RARITY_OPTIONS.find(r => r.key === selectedRarity)?.label}
                    </span>
                    {plusValue > 0 && (
                      <span className={`text-[10px] font-display font-extrabold px-2 py-0.5 rounded-full bg-primary/20 text-primary`}>
                        +{plusValue}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/20" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-wider">
                    Aguardando Seleção
                  </span>
                </div>
              )}
            </div>

            {/* Rarity selector + Aging in one row */}
            <div>
              <p className="text-[10px] font-display font-bold text-muted-foreground mb-2">
                Selecione Raridade
              </p>
              <div className="flex gap-2 justify-center">
                {RARITY_OPTIONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setSelectedRarity(r.key)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedRarity === r.key ? r.borderColor : 'border-muted-foreground/30'
                    }`}>
                      {selectedRarity === r.key && (
                        <div className={`w-3 h-3 rounded-full ${r.dotColor}`} />
                      )}
                    </div>
                    <span className="text-[8px] font-bold">{r.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Aging Enhancement */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Aging Enhancement
                </p>
                <span className="text-sm font-display font-extrabold text-primary">
                  +{plusValue}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxAging}
                value={plusValue}
                onChange={e => setPlusValue(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary/50 accent-primary"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">+0</span>
                <span className="text-[8px] text-muted-foreground">+{maxAging}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm button */}
        <button
          disabled={!selectedItem}
          onClick={() => selectedItem && onEquip(slot, selectedItem.id, selectedRarity, plusValue)}
          className="w-full mt-3 py-3 rounded-xl bg-primary/80 hover:bg-primary text-primary-foreground font-display font-extrabold text-sm uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Confirmar Equipamento →
        </button>
      </DialogContent>
    </Dialog>
  );
}
