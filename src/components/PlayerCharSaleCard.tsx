import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { PlayerCharModal } from "@/components/PlayerCharModal";
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

type Props = {
  playerId: string;
  playerName: string;
  clan: string | null;
  price: string | null;
  description: string | null;
  phone: string | null;
  onContact: () => void;
};

export function PlayerCharSaleCard({
  playerId,
  playerName,
  clan,
  price,
  description,
  phone,
  onContact,
}: Props) {
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [xp, setXp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCharModal, setShowCharModal] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const formatCurrencyInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatSalePrice = (value: string | null) => {
    if (!value) return "A combinar";
    if (/^R\$\s?[\d.]+,\d{2}$/.test(value.trim())) return value;
    return formatCurrencyInput(value) || value;
  };

  const fetchWithTimeout = (url: string, timeoutMs: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      supabase.functions
        .invoke("image-proxy", { body: { url } })
        .then(({ data, error }) => {
          clearTimeout(timer);
          if (error) throw error;
          if (data?.base64) resolve(data.base64);
          else throw new Error("No base64");
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  const convertImageToBase64 = async (url: string): Promise<string> => {
    if (url.startsWith("data:") || url.startsWith("blob:")) return url;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetchWithTimeout(url, 10000);
      } catch {
        // continue
      }
    }
    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) throw new Error("fetch failed");
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

  const generateImage = async (): Promise<string> => {
    if (!captureRef.current) throw new Error("No ref");
    const images = captureRef.current.querySelectorAll("img");
    const originalSrcs: { img: HTMLImageElement; src: string }[] = [];

    for (const img of Array.from(images)) {
      if (img.src.startsWith("data:") || img.src.startsWith("blob:")) continue;
      const isLocal = img.src.includes(window.location.origin) || img.src.startsWith("/");
      if (isLocal) continue;
      originalSrcs.push({ img, src: img.src });
      try {
        const base64 = await convertImageToBase64(img.src);
        img.src = base64;
      } catch {
        // keep original if conversion fails
      }
    }

    await new Promise((r) => setTimeout(r, 100));

    const dataUrl = await toPng(captureRef.current, {
      backgroundColor: "#0b1220",
      pixelRatio: 2,
      cacheBust: true,
    });

    originalSrcs.forEach(({ img, src }) => {
      img.src = src;
    });

    return dataUrl;
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `anuncio-${playerName}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Anúncio de ${playerName}`,
          text: `${playerName} está vendendo char por ${formatSalePrice(price)}.`,
          files: [file],
        });
      } else {
        toast.error("Compartilhamento indisponível neste dispositivo. Use o botão Baixar.");
        return;
      }
      toast.success("Anúncio pronto para compartilhar!");
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Erro ao compartilhar anúncio");
      }
    }
    setSharing(false);
  };

  const handleDownload = async () => {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      const blob = await (await fetch(dataUrl)).blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `anuncio-${playerName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Imagem do anúncio baixada!");
    } catch {
      toast.error("Erro ao baixar anúncio");
    }
    setSharing(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [userRes, equipRes, rankRes] = await Promise.all([
        supabase.from("users").select("avatar_url, class").eq("id", playerId).single(),
        supabase.from("player_equipment").select("slot, rarity, plus_value, mix, item_id").eq("user_id", playerId),
        supabase.from("player_rankings").select("level, xp").eq("user_id", playerId).maybeSingle(),
      ]);

      if (userRes.data?.avatar_url) {
        setAvatarUrl(userRes.data.avatar_url);
      } else if (userRes.data?.class) {
        const { data: classData } = await supabase
          .from("character_classes")
          .select("image_url")
          .eq("name", userRes.data.class)
          .maybeSingle();
        if (classData?.image_url) setAvatarUrl(classData.image_url);
      }

      if (rankRes.data) {
        setLevel(rankRes.data.level);
        setXp(rankRes.data.xp);
      }

      const data = equipRes.data;
      if (data && data.length > 0) {
        const itemIds = data.map((d) => d.item_id);
        const { data: items } = await supabase
          .from("equipment_items")
          .select("id, name, image_url")
          .in("id", itemIds);
        const itemMap = new Map(items?.map((i) => [i.id, i]) || []);
        setEquipment(data.map((d) => ({
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

  const getEquip = (slot: EquipmentSlot) => equipment.find((e) => e.slot === slot);

  if (loading) {
    return (
      <div className="glass-card p-5 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div ref={shareRef} className="glass-card p-4 space-y-3">
      <div className="grid grid-cols-[auto,1fr,auto] items-start gap-3">
        {avatarUrl ? (
          <button onClick={() => setShowCharModal(true)} className="block">
            <img src={avatarUrl} alt={playerName} className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/30" />
          </button>
        ) : (
          <button
            onClick={() => setShowCharModal(true)}
            className="w-20 h-20 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-center text-xl font-bold"
          >
            {playerName.charAt(0).toUpperCase()}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display font-extrabold text-base truncate">{playerName}</p>
          <p className="text-xs text-muted-foreground">{clan || "Sem clã"}</p>
          <p className="text-sm font-display font-bold text-gold mt-1">{formatSalePrice(price)}</p>
          {level != null && (
            <p className="text-[11px] text-primary font-bold mt-0.5">
              Lv.{level}{xp ? ` • ${xp}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-9 h-9 rounded-xl bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-border/30 transition-colors text-xs font-bold flex items-center justify-center"
            title={expanded ? "Recolher" : "Expandir"}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-9 h-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            title="Compartilhar"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onContact}
            disabled={!phone}
            className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            disabled={sharing}
            className="w-9 h-9 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 border border-gold/20 transition-colors text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
            title="Baixar"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {description && (
            <div className="rounded-xl border border-border/30 bg-secondary/15 px-3 py-2">
              <p className="text-[11px] text-foreground/85 whitespace-pre-wrap">{description}</p>
            </div>
          )}

          <div className="flex gap-2.5">
            {SLOT_CONFIG.filter((s) => s.size === "large").map((slotCfg) => {
              const equip = getEquip(slotCfg.slot);
              return (
                <div key={slotCfg.slot} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`relative w-full aspect-[3/4] rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : "border-border/40 bg-secondary/20"
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
                  <span className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">{slotCfg.label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {SLOT_CONFIG.filter((s) => s.size === "small").map((slotCfg) => {
              const equip = getEquip(slotCfg.slot);
              return (
                <div key={slotCfg.slot} className="flex flex-col items-center gap-1">
                  <div className={`relative w-full aspect-square rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : "border-border/40 bg-secondary/20"
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
                  <span className="text-[8px] font-display font-bold text-muted-foreground uppercase tracking-wider">{slotCfg.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showCharModal && (
        <PlayerCharModal
          playerId={playerId}
          playerName={playerName}
          onClose={() => setShowCharModal(false)}
        />
      )}

      <div className="fixed -left-[10000px] top-0 pointer-events-none z-[-1]">
        <div ref={captureRef} className="glass-card p-4 space-y-3 w-[760px]">
          <div className="grid grid-cols-[auto,1fr] items-start gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt={playerName} className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/30" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-secondary/30 border border-border/40 flex items-center justify-center text-2xl font-bold">
                {playerName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-display font-extrabold text-2xl truncate">{playerName}</p>
              <p className="text-base text-muted-foreground">{clan || "Sem clã"}</p>
              <p className="text-2xl font-display font-bold text-gold mt-1">{formatSalePrice(price)}</p>
              {level != null && (
                <p className="text-lg text-primary font-bold mt-0.5">
                  Lv.{level}{xp ? ` • ${xp}` : ""}
                </p>
              )}
            </div>
          </div>

          {description && (
            <div className="rounded-xl border border-border/30 bg-secondary/15 px-3 py-2">
              <p className="text-sm text-foreground/85 whitespace-pre-wrap">{description}</p>
            </div>
          )}

          <div className="flex gap-2.5">
            {SLOT_CONFIG.filter((s) => s.size === "large").map((slotCfg) => {
              const equip = getEquip(slotCfg.slot);
              return (
                <div key={`capture-${slotCfg.slot}`} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`relative w-full aspect-[3/4] rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : "border-border/40 bg-secondary/20"
                  }`}>
                    {equip?.item ? (
                      <>
                        <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                        {equip.plus_value != null && equip.plus_value > 0 && (
                          <span className="absolute bottom-1 right-1 text-[11px] font-display font-bold text-foreground bg-background/80 px-1 rounded">
                            +{equip.plus_value}
                          </span>
                        )}
                      </>
                    ) : (
                      <img src={slotCfg.placeholder} alt={slotCfg.label} className="w-3/5 h-3/5 object-contain opacity-20" />
                    )}
                  </div>
                  <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider">{slotCfg.label}</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {SLOT_CONFIG.filter((s) => s.size === "small").map((slotCfg) => {
              const equip = getEquip(slotCfg.slot);
              return (
                <div key={`capture-small-${slotCfg.slot}`} className="flex flex-col items-center gap-1">
                  <div className={`relative w-full aspect-square rounded-xl border-2 flex items-center justify-center overflow-hidden ${
                    equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : "border-border/40 bg-secondary/20"
                  }`}>
                    {equip?.item ? (
                      <>
                        <img src={equip.item.image_url} alt={equip.item.name} className="w-4/5 h-4/5 object-contain" />
                        {equip.plus_value != null && equip.plus_value > 0 && (
                          <span className="absolute bottom-0.5 right-0.5 text-[9px] font-display font-bold text-foreground bg-background/80 px-1 rounded">
                            +{equip.plus_value}
                          </span>
                        )}
                      </>
                    ) : (
                      <img src={slotCfg.placeholder} alt={slotCfg.label} className="w-3/5 h-3/5 object-contain opacity-20" />
                    )}
                  </div>
                  <span className="text-[9px] font-display font-bold text-muted-foreground uppercase tracking-wider">{slotCfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
