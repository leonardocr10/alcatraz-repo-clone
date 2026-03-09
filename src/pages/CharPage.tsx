import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield, X, Eye, EyeOff, Trash2, Share2 } from "lucide-react";
import { EquipmentCatalogModal } from "@/components/EquipmentCatalogModal";
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
  id: string;
  slot: EquipmentSlot;
  item_id: string;
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

const RARITY_LEGEND: { key: Rarity; label: string; color: string }[] = [
  { key: 'normal', label: 'Normal', color: 'bg-green-500' },
  { key: 'raro', label: 'Raro', color: 'bg-cyan-400' },
  { key: 'epico', label: 'Épico', color: 'bg-purple-400' },
  { key: 'lendario', label: 'Lendário', color: 'bg-yellow-500' },
  { key: 'boss', label: 'Boss', color: 'bg-red-500' },
];

const MIX_COLORS: Record<string, { text: string; bg: string }> = {
  Raident: { text: 'text-blue-400', bg: 'bg-blue-400/20' },
  Celesto: { text: 'text-yellow-400', bg: 'bg-yellow-400/20' },
  Enigma: { text: 'text-gray-400', bg: 'bg-gray-400/20' },
};

export default function CharPage() {
  const { profile } = useAuth();
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogSlot, setCatalogSlot] = useState<EquipmentSlot | null>(null);
  const [charVisible, setCharVisible] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [playerRanking, setPlayerRanking] = useState<{ level: number | null; xp: string | null } | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const fetchEquipment = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("player_equipment")
      .select("id, slot, item_id, rarity, plus_value, mix")
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
        mix: d.mix || null,
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

  const handleEquip = async (slot: EquipmentSlot, itemId: string, rarity: Rarity, plusValue: number, mix?: string | null) => {
    if (!profile?.id) return;
    const existing = getEquipForSlot(slot);
    if (existing) {
      const { error } = await supabase
        .from("player_equipment")
        .update({ item_id: itemId, rarity, plus_value: plusValue, mix: mix || null, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error("Erro ao equipar"); return; }
    } else {
      const { error } = await supabase
        .from("player_equipment")
        .insert({ user_id: profile.id, slot, item_id: itemId, rarity, plus_value: plusValue, mix: mix || null });
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

  const handleClearAll = async () => {
    if (!profile?.id || equipment.length === 0) return;
    if (!confirm("Remover todos os equipamentos?")) return;
    const ids = equipment.map(e => e.id);
    await supabase.from("player_equipment").delete().in("id", ids);
    toast.success("Todos os equipamentos removidos");
    fetchEquipment();
  };

  const convertImageToBase64 = async (url: string): Promise<string> => {
    // Skip already-converted images
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    
    try {
      // Use server-side proxy to avoid CORS issues
      const { data, error } = await supabase.functions.invoke('image-proxy', {
        body: { url },
      });
      if (error) throw error;
      if (data?.base64) return data.base64;
      throw new Error('No base64 returned');
    } catch (e) {
      console.error('Image proxy error for:', url, e);
      // Last resort fallback
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
    }
  };

  const handleShare = async () => {
    if (!shareRef.current) return;
    setSharing(true);
    try {
      // Pre-convert all images to base64
      const images = shareRef.current.querySelectorAll('img');
      const originalSrcs: { img: HTMLImageElement; src: string }[] = [];
      
      await Promise.all(
        Array.from(images).map(async (img) => {
          if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return;
          // Skip local assets (placeholders) - they don't need conversion
          if (!img.src.includes('supabase.co')) return;
          originalSrcs.push({ img, src: img.src });
          const base64 = await convertImageToBase64(img.src);
          img.src = base64;
        })
      );

      const dataUrl = await toPng(shareRef.current, {
        backgroundColor: '#1a1a2e',
        pixelRatio: 2,
        cacheBust: true,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });

      // Restore original srcs to avoid broken images in UI
      originalSrcs.forEach(({ img, src }) => { img.src = src; });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `char-${profile?.nickname || 'player'}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Char de ${profile?.nickname}`,
          text: `Confira o char de ${profile?.nickname}!`,
          files: [file],
        });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `char-${profile?.nickname || 'player'}.png`;
        link.click();
        toast.success("Imagem salva! Envie pelo WhatsApp.");
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error("Erro ao compartilhar");
        console.error("Share error:", err);
      }
    }
    setSharing(false);
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

    const mixColors = equip?.mix ? MIX_COLORS[equip.mix] : null;

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
              {equip.mix && mixColors && (
                <span className={`absolute top-0.5 left-0.5 text-[7px] font-display font-extrabold px-1 rounded ${mixColors.text} ${mixColors.bg}`}>
                  Mix {equip.mix}
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
            Inventário
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            {sharing ? 'Gerando...' : 'Compartilhar'}
          </button>
          {equipment.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Shareable card area */}
      <div ref={shareRef} className="space-y-4 p-1">
        {/* Avatar display */}
        {profile?.avatar_url && (
          <>
            <button onClick={() => setAvatarExpanded(true)} className="flex flex-col items-center w-full gap-2">
              <img
                src={profile.avatar_url}
                alt={profile.nickname}
                className="w-40 h-40 rounded-2xl object-cover border-2 border-primary/30 shadow-lg hover:scale-105 transition-transform cursor-pointer"
              />
              <div className="text-center">
                <p className="font-display font-extrabold text-base uppercase tracking-wider">
                  {profile.nickname}
                </p>
                {playerRanking && (
                  <p className="font-display font-bold text-primary text-sm">
                    Lv.{playerRanking.level} • {playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}
                  </p>
                )}
              </div>
            </button>

            {/* Expanded avatar modal */}
            {avatarExpanded && (
              <div
                className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
                onClick={() => setAvatarExpanded(false)}
              >
                <div className="flex flex-col items-center gap-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                  <img
                    src={profile.avatar_url}
                    alt={profile.nickname}
                    className="max-w-[80vw] max-h-[60vh] rounded-2xl object-contain border-2 border-primary/40 shadow-2xl"
                  />
                  <div className="text-center">
                    <p className="font-display font-extrabold text-xl text-white uppercase tracking-wider">
                      {profile.nickname}
                    </p>
                    {playerRanking && (
                      <p className="font-display font-bold text-primary text-sm mt-1">
                        Lv.{playerRanking.level} • {playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setAvatarExpanded(false)}
                    className="mt-2 text-xs text-muted-foreground hover:text-white transition-colors font-display uppercase tracking-wider"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Rarity legend */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-bold">
          {RARITY_LEGEND.map(r => (
            <span key={r.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${r.color}`} />
              {r.label}
            </span>
          ))}
        </div>

        {/* Equipment Grid */}
        <div className="glass-card p-4 rounded-2xl border border-border/40">
          <div className="flex gap-3 mb-4">
            {SLOT_CONFIG.filter(s => s.size === 'large').map(s => renderSlot(s, true))}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {SLOT_CONFIG.filter(s => s.size === 'small').map(s => renderSlot(s, false))}
          </div>
        </div>
      </div>

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
