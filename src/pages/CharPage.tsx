import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield, X, Eye, EyeOff } from "lucide-react";
import { EquipmentCatalogModal } from "@/components/EquipmentCatalogModal";
import slotSword from "@/assets/slot-sword.png";
import slotShield from "@/assets/slot-shield.png";
import slotArmor from "@/assets/slot-armor.png";
import slotBoot from "@/assets/slot-boot.png";
import slotGlove from "@/assets/slot-glove.png";
import slotBracelet from "@/assets/slot-bracelet.png";
import slotRing from "@/assets/slot-ring.png";
import slotNecklace from "@/assets/slot-necklace.png";

type EquipmentSlot = 'arma_1m' | 'arma_2m' | 'escudo' | 'armadura' | 'bota' | 'luva' | 'bracelete' | 'anel_1' | 'colar' | 'anel_2';
type Rarity = 'normal' | 'raro' | 'epico' | 'lendario' | 'boss';

interface PlayerEquip {
  id: string;
  slot: EquipmentSlot;
  item_id: string;
  rarity: Rarity;
  plus_value: number | null;
  item?: { name: string; image_url: string };
}

const SLOT_CONFIG: { slot: EquipmentSlot; label: string; placeholder: string; size: 'large' | 'small' }[] = [
  { slot: 'arma_1m', label: 'Arma 1M', placeholder: slotSword, size: 'large' },
  { slot: 'arma_2m', label: 'Arma 2M', placeholder: slotSword, size: 'large' },
  { slot: 'escudo', label: 'Escudo', placeholder: slotShield, size: 'large' },
  { slot: 'armadura', label: 'Armadura', placeholder: slotArmor, size: 'large' },
  { slot: 'bracelete', label: 'Bracelete', placeholder: slotBracelet, size: 'small' },
  { slot: 'luva', label: 'Luva', placeholder: slotGlove, size: 'small' },
  { slot: 'bota', label: 'Bota', placeholder: slotBoot, size: 'small' },
  { slot: 'anel_1', label: 'Anel 1', placeholder: slotRing, size: 'small' },
  { slot: 'colar', label: 'Colar', placeholder: slotNecklace, size: 'small' },
  { slot: 'anel_2', label: 'Anel 2', placeholder: slotRing, size: 'small' },
];

const RARITY_COLORS: Record<Rarity, string> = {
  normal: 'border-green-500/60',
  raro: 'border-cyan-400/60',
  epico: 'border-purple-400/60',
  lendario: 'border-yellow-500/60',
  boss: 'border-red-500/60',
};

const RARITY_BG: Record<Rarity, string> = {
  normal: 'bg-green-500/10',
  raro: 'bg-cyan-400/10',
  epico: 'bg-purple-400/10',
  lendario: 'bg-yellow-500/10',
  boss: 'bg-red-500/10',
};

const RARITY_LEGEND: { key: Rarity; label: string; color: string }[] = [
  { key: 'normal', label: 'Normal', color: 'bg-green-500' },
  { key: 'raro', label: 'Raro', color: 'bg-cyan-400' },
  { key: 'epico', label: 'Épico', color: 'bg-purple-400' },
  { key: 'lendario', label: 'Lendário', color: 'bg-yellow-500' },
  { key: 'boss', label: 'Boss', color: 'bg-red-500' },
];

export default function CharPage() {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogSlot, setCatalogSlot] = useState<EquipmentSlot | null>(null);
  const [charVisible, setCharVisible] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [playerRanking, setPlayerRanking] = useState<{ level: number | null; xp: string | null } | null>(null);

  const fetchEquipment = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("player_equipment")
      .select("id, slot, item_id, rarity, plus_value")
      .eq("user_id", profile.id);

    if (data && data.length > 0) {
      const itemIds = data.map(d => d.item_id);
      const { data: items } = await supabase
        .from("equipment_items")
        .select("id, name, image_url")
        .in("id", itemIds);

      const itemMap = new Map(items?.map(i => [i.id, i]) || []);
      setEquipment(data.map(d => ({
        ...d,
        slot: d.slot as EquipmentSlot,
        rarity: d.rarity as Rarity,
        item: itemMap.get(d.item_id) as any,
      })));
    } else {
      setEquipment([]);
    }
    setLoading(false);
  };

  const fetchVisibility = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("users")
      .select("char_visible")
      .eq("id", profile.id)
      .single();
    if (data) setCharVisible(!!data.char_visible);
  };

  const fetchRanking = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("player_rankings")
      .select("level, xp")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (data) setPlayerRanking(data);
  };

  useEffect(() => {
    fetchEquipment();
    fetchVisibility();
    fetchRanking();
  }, [profile?.id]);

  const toggleVisibility = async () => {
    if (!profile?.id) return;
    setTogglingVisibility(true);
    const newVal = !charVisible;
    const { error } = await supabase
      .from("users")
      .update({ char_visible: newVal })
      .eq("id", profile.id);
    if (error) {
      toast.error("Erro ao alterar visibilidade");
    } else {
      setCharVisible(newVal);
      toast.success(newVal ? "Char visível para todos!" : "Char oculto");
    }
    setTogglingVisibility(false);
  };

  const getEquipForSlot = (slot: EquipmentSlot) => equipment.find(e => e.slot === slot);

  const handleEquip = async (slot: EquipmentSlot, itemId: string, rarity: Rarity, plusValue: number) => {
    if (!profile?.id) return;
    const existing = getEquipForSlot(slot);
    if (existing) {
      const { error } = await supabase
        .from("player_equipment")
        .update({ item_id: itemId, rarity, plus_value: plusValue, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao equipar"); return; }
    } else {
      const { error } = await supabase
        .from("player_equipment")
        .insert({ user_id: profile.id, slot, item_id: itemId, rarity, plus_value: plusValue });
      if (error) { toast.error("Erro ao equipar"); return; }
    }
    toast.success("Equipamento atualizado!");
    setCatalogSlot(null);
    fetchEquipment();
  };

  const handleUnequip = async (slot: EquipmentSlot) => {
    const existing = getEquipForSlot(slot);
    if (!existing) return;
    await supabase.from("player_equipment").delete().eq("id", existing.id);
    toast.success("Equipamento removido");
    fetchEquipment();
  };

  const renderSlot = (slotCfg: typeof SLOT_CONFIG[number], isLarge: boolean) => {
    const equip = getEquipForSlot(slotCfg.slot);
    const sizeClass = isLarge ? 'aspect-[3/4]' : 'aspect-square';
    const imgSize = isLarge ? 'w-4/5 h-4/5' : 'w-4/5 h-4/5';
    const placeholderSize = isLarge ? 'w-3/5 h-3/5' : 'w-3/5 h-3/5';
    const plusSize = isLarge ? 'text-[10px] bottom-1 right-1 px-1' : 'text-[8px] bottom-0.5 right-0.5 px-1';
    const removeSize = isLarge ? 'w-4 h-4 top-1 right-1' : 'w-3.5 h-3.5 top-0.5 right-0.5';
    const removeIcon = isLarge ? 'w-2.5 h-2.5' : 'w-2 h-2';
    const labelSize = isLarge ? 'text-[9px]' : 'text-[8px]';

    return (
      <div key={slotCfg.slot} className={`flex flex-col items-center gap-1 ${isLarge ? 'flex-1' : ''}`}>
        <button
          onClick={() => setCatalogSlot(slotCfg.slot)}
          className={`relative w-full ${sizeClass} rounded-xl border-2 transition-all hover:scale-105 flex items-center justify-center overflow-hidden ${
            equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
          }`}
        >
          {equip?.item ? (
            <>
              <img src={equip.item.image_url} alt={equip.item.name} className={`${imgSize} object-contain`} />
              {equip.plus_value != null && equip.plus_value > 0 && (
                <span className={`absolute ${plusSize} font-display font-bold text-foreground bg-background/80 rounded`}>
                  +{equip.plus_value}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleUnequip(slotCfg.slot); }}
                className={`absolute ${removeSize} rounded-full bg-destructive/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity`}
              >
                <X className={`${removeIcon} text-white`} />
              </button>
            </>
          ) : (
            <img src={slotCfg.placeholder} alt={slotCfg.label} className={`${placeholderSize} object-contain opacity-20`} />
          )}
        </button>
        <span className={`${labelSize} font-display font-bold text-muted-foreground uppercase tracking-wider`}>
          {slotCfg.label}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/15">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-lg font-extrabold tracking-wide uppercase">
            Inventário de Equipamentos
          </h2>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold">
          {RARITY_LEGEND.map(r => (
            <span key={r.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${r.color}`} />
              {r.label}
            </span>
          ))}
        </div>
      </div>

      {/* Avatar display */}
      {profile?.avatar_url && (
        <div className="flex justify-center">
          <img
            src={profile.avatar_url}
            alt={profile.nickname}
            className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/30 shadow-lg"
          />
        </div>
      )}

      {/* Visibility toggle */}
      <button
        onClick={toggleVisibility}
        disabled={togglingVisibility}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
          charVisible
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/40 bg-secondary/30 text-muted-foreground'
        }`}
      >
        <div className="flex items-center gap-2">
          {charVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          <span className="font-display font-bold text-xs uppercase tracking-wider">
            {charVisible ? 'Char visível para todos' : 'Char oculto'}
          </span>
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors relative ${charVisible ? 'bg-primary' : 'bg-secondary'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${charVisible ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </button>

      {/* Equipment Grid */}
      <div className="glass-card p-4 rounded-2xl border border-border/40">
        <div className="flex gap-3 mb-4">
          {SLOT_CONFIG.filter(s => s.size === 'large').map(s => renderSlot(s, true))}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {SLOT_CONFIG.filter(s => s.size === 'small').map(s => renderSlot(s, false))}
        </div>
      </div>

      {catalogSlot && (
        <EquipmentCatalogModal
          slot={catalogSlot}
          slotLabel={SLOT_CONFIG.find(s => s.slot === catalogSlot)?.label || ''}
          onEquip={handleEquip}
          onClose={() => setCatalogSlot(null)}
        />
      )}
    </div>
  );
}
