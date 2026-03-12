import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, X, Share2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { toPng } from "html-to-image";
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
  mix: string | null;
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

const MIX_COLORS: Record<string, { text: string; bg: string }> = {
  Raident: { text: 'text-blue-400', bg: 'bg-blue-400/20' },
  Celesto: { text: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  Enigma: { text: 'text-gray-400', bg: 'bg-gray-400/20' },
};

interface Props {
  playerId: string;
  playerName: string;
  onClose: () => void;
}

const fetchWithTimeout = (url: string, timeoutMs: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    supabase.functions.invoke('image-proxy', { body: { url } })
      .then(({ data, error }) => {
        clearTimeout(timer);
        if (error) throw error;
        if (data?.base64) resolve(data.base64);
        else throw new Error('No base64');
      })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
};

const convertImageToBase64 = async (url: string): Promise<string> => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchWithTimeout(url, 10000);
    } catch (e) {
      console.warn(`Proxy attempt ${attempt + 1} failed for:`, url, e);
    }
  }
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('fetch failed');
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};

export function PlayerCharModal({ playerId, playerName, onClose }: Props) {
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [xp, setXp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [userRes, equipRes, rankRes] = await Promise.all([
        supabase.from("users").select("avatar_url").eq("id", playerId).single(),
        supabase.from("player_equipment").select("slot, rarity, plus_value, mix, item_id").eq("user_id", playerId),
        supabase.from("player_rankings").select("level, xp").eq("user_id", playerId).maybeSingle(),
      ]);
      if (userRes.data?.avatar_url) setAvatarUrl(userRes.data.avatar_url);
      if (rankRes.data) {
        setLevel(rankRes.data.level);
        setXp(rankRes.data.xp);
      }
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
          mix: d.mix || null,
          item: itemMap.get(d.item_id) as any,
        })));
      }
      setLoading(false);
    };
    fetchData();
  }, [playerId]);

  const getEquip = (slot: EquipmentSlot) => equipment.find(e => e.slot === slot);

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      const images = shareRef.current.querySelectorAll('img');
      const originalSrcs: { img: HTMLImageElement; src: string }[] = [];

      // Convert external images sequentially via proxy
      for (const img of Array.from(images)) {
        if (img.src.startsWith('data:') || img.src.startsWith('blob:')) continue;
        // Skip local bundled assets (Vite imports) - they render fine in html-to-image
        const isLocal = img.src.includes(window.location.origin) || img.src.startsWith('/');
        if (isLocal) continue;
        originalSrcs.push({ img, src: img.src });
        try {
          const base64 = await convertImageToBase64(img.src);
          img.src = base64;
        } catch {
          // Keep original src if conversion fails
        }
      }

      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await toPng(shareRef.current, {
        backgroundColor: '#1a1a2e',
        pixelRatio: 2,
        cacheBust: true,
      });

      originalSrcs.forEach(({ img, src }) => { img.src = src; });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `char-${playerName}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Char de ${playerName}`,
          text: `Confira o char de ${playerName}!`,
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `char-${playerName}.png`;
        link.click();
        toast.success("Imagem salva!");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error("Erro ao compartilhar");
        console.error("Share error:", err);
      }
    }
    setSharing(false);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-lg font-extrabold uppercase tracking-wide">
              Char de {playerName}
            </DialogTitle>
            <button
              onClick={handleShare}
              disabled={sharing || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              <Share2 className="w-3.5 h-3.5" />
              {sharing ? 'Gerando...' : 'Compartilhar'}
            </button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div ref={shareRef} className="space-y-3 p-1">
            {avatarUrl && (
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => setAvatarExpanded(true)} className="focus:outline-none">
                  <img src={avatarUrl} alt={playerName} className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/30 shadow-lg hover:scale-105 transition-transform cursor-pointer" />
                </button>
                <p className="font-display font-extrabold text-sm uppercase tracking-wider">{playerName}</p>
                <div className="flex items-center gap-2">
                  {level != null && (
                    <span className="text-[10px] font-display font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Lv. {level}
                    </span>
                  )}
                  {xp && (
                    <span className="text-[10px] font-display font-bold text-muted-foreground">
                      {xp} XP
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              {SLOT_CONFIG.filter(s => s.size === 'large').map(slotCfg => {
                const equip = getEquip(slotCfg.slot);
                const mixColors = equip?.mix ? MIX_COLORS[equip.mix] : null;
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
                          {equip.mix && mixColors && (
                            <span className={`absolute top-0.5 left-0.5 text-[7px] font-display font-extrabold px-1 rounded ${mixColors.text} ${mixColors.bg}`}>
                              Mix {equip.mix}
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
                const mixColors = equip?.mix ? MIX_COLORS[equip.mix] : null;
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
                          {equip.mix && mixColors && (
                            <span className={`absolute top-0.5 left-0.5 text-[6px] font-display font-extrabold px-0.5 rounded ${mixColors.text} ${mixColors.bg}`}>
                              Mix {equip.mix}
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

        {/* Avatar expanded overlay */}
        {avatarExpanded && avatarUrl && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
            onClick={() => setAvatarExpanded(false)}
          >
            <div className="relative" onClick={e => e.stopPropagation()}>
              <img src={avatarUrl} alt={playerName} className="max-w-[80vw] max-h-[70vh] rounded-2xl object-contain shadow-2xl border-2 border-primary/30" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-2xl p-4">
                <p className="font-display font-extrabold text-lg text-white text-center uppercase">{playerName}</p>
                <div className="flex items-center justify-center gap-3 mt-1">
                  {level != null && (
                    <span className="text-sm font-display font-extrabold text-primary">Lv. {level}</span>
                  )}
                  {xp && (
                    <span className="text-sm font-display font-bold text-muted-foreground">{xp} XP</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setAvatarExpanded(false)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
