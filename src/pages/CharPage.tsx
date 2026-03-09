import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Swords, Shield, ShirtIcon, Footprints, Hand, CircleDot, Gem, X } from "lucide-react";
import { EquipmentCatalogModal } from "@/components/EquipmentCatalogModal";

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

const SLOT_CONFIG: { slot: EquipmentSlot; label: string; icon: React.ElementType; size: 'large' | 'small' }[] = [
  { slot: 'arma_1m', label: 'Arma 1M', icon: Swords, size: 'large' },
  { slot: 'arma_2m', label: 'Arma 2M', icon: Swords, size: 'large' },
  { slot: 'escudo', label: 'Escudo', icon: Shield, size: 'large' },
  { slot: 'armadura', label: 'Armadura', icon: ShirtIcon, size: 'large' },
  { slot: 'bracelete', label: 'Bracelete', icon: CircleDot, size: 'small' },
  { slot: 'luva', label: 'Luva', icon: Hand, size: 'small' },
  { slot: 'bota', label: 'Bota', icon: Footprints, size: 'small' },
  { slot: 'anel_1', label: 'Anel 1', icon: Gem, size: 'small' },
  { slot: 'colar', label: 'Colar', icon: Gem, size: 'small' },
  { slot: 'anel_2', label: 'Anel 2', icon: Gem, size: 'small' },
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

  const fetchEquipment = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("player_equipment")
      .select("id, slot, item_id, rarity, plus_value")
      .eq("user_id", profile.id);

    if (data && data.length > 0) {
      // Fetch item details
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

  useEffect(() => {
    fetchEquipment();
  }, [profile?.id]);

  const getEquipForSlot = (slot: EquipmentSlot) => equipment.find(e => e.slot === slot);

  const handleEquip = async (slot: EquipmentSlot, itemId: string, rarity: Rarity) => {
    if (!profile?.id) return;
    const existing = getEquipForSlot(slot);

    if (existing) {
      const { error } = await supabase
        .from("player_equipment")
        .update({ item_id: itemId, rarity, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao equipar"); return; }
    } else {
      const { error } = await supabase
        .from("player_equipment")
        .insert({ user_id: profile.id, slot, item_id: itemId, rarity });
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

      {/* Equipment Grid */}
      <div className="glass-card p-4 rounded-2xl border border-border/40">
        {/* Large slots - weapons/armor */}
        <div className="flex gap-3 mb-4">
          {SLOT_CONFIG.filter(s => s.size === 'large').map(slotCfg => {
            const equip = getEquipForSlot(slotCfg.slot);
            return (
              <div key={slotCfg.slot} className="flex flex-col items-center gap-1 flex-1">
                <button
                  onClick={() => setCatalogSlot(slotCfg.slot)}
                  className={`relative w-full aspect-[3/4] rounded-xl border-2 transition-all hover:scale-105 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
                  }`}
                >
                  {equip?.item ? (
                    <>
                      <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                      {equip.plus_value && (
                        <span className="absolute bottom-1 right-1 text-[10px] font-display font-bold text-foreground bg-background/80 px-1 rounded">
                          +{equip.plus_value}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnequip(slotCfg.slot); }}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                    </>
                  ) : (
                    <slotCfg.icon className="w-8 h-8 text-muted-foreground/30" />
                  )}
                </button>
                <span className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                  {slotCfg.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Small slots - accessories */}
        <div className="grid grid-cols-6 gap-2">
          {SLOT_CONFIG.filter(s => s.size === 'small').map(slotCfg => {
            const equip = getEquipForSlot(slotCfg.slot);
            return (
              <div key={slotCfg.slot} className="flex flex-col items-center gap-1">
                <button
                  onClick={() => setCatalogSlot(slotCfg.slot)}
                  className={`relative w-full aspect-square rounded-xl border-2 transition-all hover:scale-105 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
                  }`}
                >
                  {equip?.item ? (
                    <>
                      <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnequip(slotCfg.slot); }}
                        className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2 h-2 text-white" />
                      </button>
                    </>
                  ) : (
                    <slotCfg.icon className="w-5 h-5 text-muted-foreground/30" />
                  )}
                </button>
                <span className="text-[8px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                  {slotCfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Catalog Modal */}
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
