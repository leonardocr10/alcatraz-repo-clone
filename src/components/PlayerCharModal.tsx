import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  slot: EquipmentSlot;
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

interface Props {
  playerId: string;
  playerName: string;
  onClose: () => void;
}

export function PlayerCharModal({ playerId, playerName, onClose }: Props) {
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch avatar and equipment in parallel
      const [userRes, equipRes] = await Promise.all([
        supabase.from("users").select("avatar_url").eq("id", playerId).single(),
        supabase.from("player_equipment").select("slot, rarity, plus_value, item_id").eq("user_id", playerId),
      ]);
      if (userRes.data?.avatar_url) setAvatarUrl(userRes.data.avatar_url);
      const data = equipRes.data;

      if (data && data.length > 0) {
        const itemIds = data.map(d => d.item_id);
        const { data: items } = await supabase
          .from("equipment_items")
          .select("id, name, image_url")
          .in("id", itemIds);
        const itemMap = new Map(items?.map(i => [i.id, i]) || []);
        setEquipment(data.map(d => ({
          slot: d.slot as EquipmentSlot,
          rarity: d.rarity as Rarity,
          plus_value: d.plus_value,
          item: itemMap.get(d.item_id) as any,
        })));
      }
      setLoading(false);
    };
    fetchData();
  }, [playerId]);

  const getEquip = (slot: EquipmentSlot) => equipment.find(e => e.slot === slot);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-wide">
            Char de {playerName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3">
              {SLOT_CONFIG.filter(s => s.size === 'large').map(slotCfg => {
                const equip = getEquip(slotCfg.slot);
                return (
                  <div key={slotCfg.slot} className="flex flex-col items-center gap-1 flex-1">
                    <div className={`relative w-full aspect-[3/4] rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                      equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
                    }`}>
                      {equip?.item ? (
                        <>
                          <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                          {equip.plus_value != null && equip.plus_value > 0 && (
                            <span className="absolute bottom-1 right-1 text-[10px] font-display font-bold text-foreground bg-background/80 px-1 rounded">
                              +{equip.plus_value}
                            </span>
                          )}
                        </>
                      ) : (
                        <img src={slotCfg.placeholder} alt={slotCfg.label} className="w-3/5 h-3/5 object-contain opacity-20" />
                      )}
                    </div>
                    <span className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                      {slotCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {SLOT_CONFIG.filter(s => s.size === 'small').map(slotCfg => {
                const equip = getEquip(slotCfg.slot);
                return (
                  <div key={slotCfg.slot} className="flex flex-col items-center gap-1">
                    <div className={`relative w-full aspect-square rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                      equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
                    }`}>
                      {equip?.item ? (
                        <>
                          <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                          {equip.plus_value != null && equip.plus_value > 0 && (
                            <span className="absolute bottom-0.5 right-0.5 text-[8px] font-display font-bold text-foreground bg-background/80 px-1 rounded">
                              +{equip.plus_value}
                            </span>
                          )}
                        </>
                      ) : (
                        <img src={slotCfg.placeholder} alt={slotCfg.label} className="w-3/5 h-3/5 object-contain opacity-20" />
                      )}
                    </div>
                    <span className="text-[8px] font-display font-bold text-muted-foreground uppercase tracking-wider">
                      {slotCfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
