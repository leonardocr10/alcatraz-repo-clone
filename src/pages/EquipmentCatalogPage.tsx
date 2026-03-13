import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

const SLOT_LABELS: Record<string, string> = {
  arma_1m: 'Arma 1M',
  arma_2m: 'Arma 2M',
  escudo: 'Escudo',
  armadura: 'Armadura',
  bracelete: 'Bracelete',
  luva: 'Luva',
  bota: 'Bota',
  anel_1: 'Anel 1',
  colar: 'Colar',
  anel_2: 'Anel 2',
};

export default function EquipmentCatalogPage() {
  const { slot } = useParams<{ slot: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<Rarity>('normal');
  const [plusValue, setPlusValue] = useState(0);
  const [maxAging, setMaxAging] = useState(12);
  const [selectedMix, setSelectedMix] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const hasAging = ['arma_1m', 'arma_2m', 'escudo', 'armadura'].includes(slot || '');
  const MIX_OPTIONS = ['Raident', 'Celesto', 'Enigma'];
  const slotLabel = SLOT_LABELS[slot || ''] || 'Equipamento';
  const dbSlot = slot as EquipmentSlot;

  useEffect(() => {
    if (!slot) return;
    const fetchData = async () => {
      setLoading(true);
      const [catsRes, itemsRes, configRes] = await Promise.all([
        supabase.from("equipment_categories").select("id, name, slot").eq("slot", dbSlot).order("sort_order"),
        supabase.from("equipment_items").select("id, name, image_url, category_id").eq("slot", dbSlot),
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

  const handleEquip = async () => {
    if (!profile?.id || !selectedItem || !slot) return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("player_equipment")
        .select("id")
        .eq("user_id", profile.id)
        .eq("slot", dbSlot)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("player_equipment")
          .update({ item_id: selectedItem.id, rarity: selectedRarity, plus_value: plusValue, mix: selectedMix || null, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("player_equipment")
          .insert({ user_id: profile.id, slot: dbSlot, item_id: selectedItem.id, rarity: selectedRarity, plus_value: plusValue, mix: selectedMix || null });
        if (error) throw error;
      }
      toast.success("Equipamento atualizado!");
      navigate(-1);
    } catch (e) {
      toast.error("Erro ao equipar");
      setSaving(false);
    }
  };

  const filteredItems = selectedCategory
    ? items.filter(i => i.category_id === selectedCategory)
    : items;

  return (
    <div className="flex flex-col h-full animate-fade-in pb-20 sm:pb-0">
      <div className="shrink-0 pb-4 flex flex-row items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-secondary/50 transition-colors">
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <h1 className="font-display text-lg sm:text-2xl font-extrabold uppercase tracking-wide">
          {slotLabel}
        </h1>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row sm:gap-6 max-w-7xl mx-auto w-full">
        {/* Left side - Catalog */}
        <div className="flex-1 flex flex-col shrink-0 sm:shrink min-w-0">
          {/* Category tabs */}
          {categories.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-2 sm:mb-3">
                Navegar Categoria
              </p>
              <div className="flex flex-row overflow-x-auto gap-1.5 sm:gap-2 pb-2 scrollbar-none snap-x">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(cat.id); setSelectedItem(null); }}
                    className={`whitespace-nowrap shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all snap-start ${
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
          <div className="flex justify-between items-center mb-3">
            <p className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
              Catálogo de Itens
            </p>
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              {filteredItems.length} itens encontrados
            </span>
          </div>

          {/* Items grid */}
          <div className="flex-1 pb-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                Nenhum item cadastrado para este slot
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-4">
                {filteredItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`rounded-xl border-2 p-1.5 sm:p-3 flex flex-col items-center justify-between gap-1 sm:gap-3 transition-all hover:scale-105 h-[88px] sm:h-auto sm:aspect-square ${
                      selectedItem?.id === item.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border/40 bg-secondary/30 hover:border-border/60'
                    }`}
                  >
                    <div className="flex-1 w-full flex items-center justify-center min-h-0 sm:min-h-[60px]">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="text-[9px] sm:text-xs font-display font-bold text-center leading-tight truncate w-full uppercase">
                      {item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Preview & Options */}
        <div className="w-full sm:w-80 lg:w-96 flex flex-col gap-3 sm:gap-5 shrink-0 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border/40">
          {/* Item preview - larger */}
          <div className={`rounded-xl border border-border/40 flex items-center justify-center overflow-hidden transition-colors ${
            selectedItem
              ? selectedRarity === 'normal' ? 'bg-green-500/10'
                : selectedRarity === 'raro' ? 'bg-cyan-400/10'
                : selectedRarity === 'epico' ? 'bg-purple-400/10'
                : selectedRarity === 'lendario' ? 'bg-yellow-500/10'
                : 'bg-red-500/10'
              : 'bg-secondary/20'
          }`} style={{ minHeight: '140px' }}>
            {selectedItem ? (
              <div className="flex flex-col items-center gap-2 p-4">
                <img
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  className="w-20 h-20 sm:w-32 sm:h-32 object-contain max-w-full max-h-full"
                />
                <p className="font-display font-extrabold text-sm sm:text-base text-center uppercase">
                  {selectedItem.name}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  <span className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 sm:py-1 rounded-full ${
                    selectedRarity === 'normal' ? 'text-green-500 bg-green-500/20' :
                    selectedRarity === 'raro' ? 'text-cyan-400 bg-cyan-400/20' :
                    selectedRarity === 'epico' ? 'text-purple-400 bg-purple-400/20' :
                    selectedRarity === 'lendario' ? 'text-yellow-500 bg-yellow-500/20' :
                    'text-red-500 bg-red-500/20'
                  }`}>
                    {RARITY_OPTIONS.find(r => r.key === selectedRarity)?.label}
                  </span>
                  {plusValue > 0 && (
                    <span className="text-[10px] sm:text-xs font-display font-extrabold px-2 py-0.5 sm:py-1 rounded-full bg-primary/20 text-primary">
                      +{plusValue}
                    </span>
                  )}
                  {selectedMix && (
                    <span className={`text-[10px] sm:text-xs font-display font-extrabold px-2 py-0.5 sm:py-1 rounded-full uppercase ${
                      selectedMix === 'Raident' ? 'text-blue-400 bg-blue-400/20' :
                      selectedMix === 'Celesto' ? 'text-yellow-400 bg-yellow-400/20' :
                      'text-gray-400 bg-gray-400/20'
                    }`}>
                      Mix {selectedMix}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 sm:gap-3 text-muted-foreground/30 p-4 sm:p-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-dashed border-muted-foreground/20" />
                <span className="text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider">
                  Aguardando Seleção
                </span>
              </div>
            )}
          </div>

          {/* Rarity selector */}
          <div className="bg-secondary/10 p-3 sm:p-4 rounded-xl border border-border/40">
            <p className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground mb-3">
              Selecione Raridade
            </p>
            <div className="flex gap-2 sm:gap-3 justify-between">
              {RARITY_OPTIONS.map(r => (
                <button
                  key={r.key}
                  onClick={() => setSelectedRarity(r.key)}
                  className="flex flex-col items-center gap-1.5 flex-1"
                >
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedRarity === r.key ? r.borderColor : 'border-muted-foreground/30'
                  }`}>
                    {selectedRarity === r.key && (
                      <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full ${r.dotColor}`} />
                    )}
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Aging Enhancement - only for weapon/armor slots */}
          {hasAging && (
            <div className={`bg-secondary/10 p-3 sm:p-4 rounded-xl border border-border/40 ${selectedMix ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground uppercase tracking-widest">
                  Aging Enhancement
                </p>
                <span className="text-sm sm:text-base font-display font-extrabold text-primary">
                  +{plusValue}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxAging}
                value={plusValue}
                onChange={e => { setPlusValue(Number(e.target.value)); if (Number(e.target.value) > 0) setSelectedMix(null); }}
                className={`w-full h-1.5 sm:h-2 rounded-full appearance-none cursor-pointer bg-secondary/50 accent-primary ${selectedMix ? 'opacity-30 pointer-events-none' : ''}`}
              />
              <div className="flex justify-between mt-2">
                <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">+0</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">+{maxAging}</span>
              </div>
            </div>
          )}

          {/* Mix selector - always shown */}
          <div className={`bg-secondary/10 p-3 sm:p-4 rounded-xl border border-border/40 mb-2 sm:mb-0 ${hasAging && plusValue > 0 ? 'opacity-40' : ''}`}>
            <p className="text-[10px] sm:text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-3">
              Specialization (Mix)
            </p>
            <div className="flex gap-2">
              {MIX_OPTIONS.map(mix => {
                const mixColorActive = mix === 'Raident' ? 'bg-blue-500 text-white' : mix === 'Celesto' ? 'bg-yellow-500 text-black' : 'bg-gray-500 text-white';
                return (
                  <button
                    key={mix}
                    onClick={() => {
                      if (selectedMix === mix) {
                        setSelectedMix(null);
                      } else {
                        setSelectedMix(mix);
                        if (hasAging) setPlusValue(0);
                      }
                    }}
                    className={`flex-1 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider transition-all ${
                      selectedMix === mix
                        ? mixColorActive
                        : 'bg-secondary/50 text-muted-foreground hover:bg-secondary/80 border border-transparent'
                    }`}
                  >
                    {mix}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm button */}
          <button
            disabled={!selectedItem || saving}
            onClick={handleEquip}
            className="w-full mt-auto py-3.5 sm:py-4 rounded-xl bg-primary/90 hover:bg-primary text-primary-foreground font-display font-extrabold text-sm sm:text-base uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Equipamento →'}
          </button>
        </div>
      </div>
    </div>
  );
}
