import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Shield, X, Eye, EyeOff, Trash2, Share2, Download, Clock } from "lucide-react";
import { PlayScheduleSelector } from "@/components/PlayScheduleSelector";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<PlayerEquip[]>([]);
  const [loading, setLoading] = useState(true);
  const [charVisible, setCharVisible] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const [playerRanking, setPlayerRanking] = useState<{ level: number | null; xp: string | null } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [playSchedule, setPlaySchedule] = useState<string[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [classImageUrl, setClassImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const fetchClassImage = async () => {
    if (!profile?.class) return;
    const { data } = await supabase
      .from("character_classes")
      .select("image_url")
      .eq("name", profile.class)
      .maybeSingle();
    if (data) setClassImageUrl(data.image_url);
  };

  useEffect(() => {
    fetchEquipment();
    fetchVisibility();
    fetchRanking();
    fetchClassImage();
    // Load play_schedule from profile
    if (profile) {
      const ps = (profile as any)?.play_schedule as string[] | undefined;
      setPlaySchedule(ps || []);
    }
  }, [profile?.id, profile?.class]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0 || !profile?.id) {
        return;
      }
      setIsUploading(true);
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      toast.success("Foto atualizada com sucesso!");
      // Força um recarregamento da página para atualizar o contexto de Auth, mas preferencialmente só o update local seria melhor. 
      // Como não temos acesso imediato a mutar o contexto do useAuth aqui (profile.avatar_url), orientamos refresh ou mudamos um state local:
      setTimeout(() => window.location.reload(), 1500);

    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar a imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const savePlaySchedule = async (newSchedule: string[]) => {
    if (!profile?.id) return;
    setPlaySchedule(newSchedule);
    setSavingSchedule(true);
    const { error } = await supabase
      .from("users")
      .update({ play_schedule: newSchedule } as any)
      .eq("id", profile.id);
    if (error) {
      toast.error("Erro ao salvar horários");
    } else {
      toast.success("Horários atualizados!");
    }
    setSavingSchedule(false);
  };

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
    
    // Try up to 2 times with 10s timeout each
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fetchWithTimeout(url, 10000);
      } catch (e) {
        console.warn(`Proxy attempt ${attempt + 1} failed for:`, url, e);
      }
    }
    // Fallback: direct fetch
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

  const generateImage = async (): Promise<string> => {
    if (!shareRef.current) throw new Error('No ref');
    const images = shareRef.current.querySelectorAll('img');
    const originalSrcs: { img: HTMLImageElement; src: string }[] = [];

    for (const img of Array.from(images)) {
      if (img.src.startsWith('data:') || img.src.startsWith('blob:')) continue;
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
    return dataUrl;
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `char-${profile?.nickname || 'player'}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Char de ${profile?.nickname}`,
          text: `Confira o char de ${profile?.nickname}!`,
          files: [file],
        });
      } else {
        handleDownloadFromDataUrl(dataUrl);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error("Erro ao compartilhar");
        console.error("Share error:", err);
      }
    }
    setSharing(false);
  };

  const handleDownloadFromDataUrl = (dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `char-${profile?.nickname || 'player'}.png`;
    link.click();
    toast.success("Imagem salva!");
  };

  const handleDownload = async () => {
    setSharing(true);
    try {
      const dataUrl = await generateImage();
      handleDownloadFromDataUrl(dataUrl);
    } catch (err: any) {
      toast.error("Erro ao baixar imagem");
      console.error("Download error:", err);
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
          onClick={() => navigate(`/equipment/${slotCfg.slot}`)}
          className={`relative w-full ${sizeClass} rounded-xl border-2 transition-all hover:scale-105 flex items-center justify-center overflow-hidden ${
            equip ? `${RARITY_COLORS[equip.rarity]} ${RARITY_BG[equip.rarity]}` : 'border-border/40 bg-secondary/30'
          }`}
        >
          {equip?.item ? (
            <>
              <img src={equip.item.image_url} alt={equip.item.name} className={`${imgSize} object-contain max-w-full max-h-full`} />
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
            <img src={slotCfg.placeholder} alt={slotCfg.label} className={`${placeholderSize} object-contain opacity-20 max-w-full max-h-full`} />
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            {sharing ? 'Gerando...' : 'Compartilhar'}
          </button>
          <button
            onClick={handleDownload}
            disabled={sharing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar
          </button>
        </div>
      </div>

      {/* Shareable card area */}
      <div ref={shareRef} className="space-y-4 p-1">
        {/* Avatar and Profile display */}
        <div className="flex flex-col items-center w-full gap-2 relative">
          
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
          />

          {profile?.avatar_url || classImageUrl ? (
            <div className="flex flex-col md:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => setAvatarExpanded(true)}
                className="block"
                title="Ver maior"
              >
                <img
                  src={profile?.avatar_url || classImageUrl || ""}
                  alt={profile?.nickname || 'Avatar'}
                  className={`w-40 h-40 rounded-2xl object-cover border-2 border-primary/30 shadow-lg cursor-pointer transition-transform hover:scale-105 ${isUploading ? 'opacity-50' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-display font-bold text-xs uppercase tracking-wider hover:bg-primary/30 transition-colors disabled:opacity-50"
              >
                {isUploading ? 'Enviando...' : 'Mudar Foto'}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isUploading}
              className={`w-40 h-40 rounded-2xl bg-secondary/30 border-2 border-border/40 flex items-center justify-center shadow-inner hover:border-primary/50 transition-colors cursor-pointer ${isUploading ? 'opacity-50' : ''}`}
            >
              <div className="text-center space-y-2">
                {isUploading ? (
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                  <>
                    <Shield className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-extrabold px-4">Adicionar Foto</p>
                  </>
                )}
              </div>
            </button>
          )}
          <div className="text-center mt-1">
            <p className="font-display font-extrabold text-base uppercase tracking-wider text-white">
              {profile?.nickname || 'Jogador'}
            </p>
            {playerRanking && (
              <p className="font-display font-bold mt-0.5">
                <span className="text-gold text-[15px]">Lv.{playerRanking.level}</span> <span className="text-white mx-0.5">•</span> <span className="text-cyan-400 text-sm">{playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}</span>
              </p>
            )}
          </div>
        </div>

        {/* Expanded avatar modal */}
        {(profile?.avatar_url || classImageUrl) && avatarExpanded && (
              <div
                className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
                onClick={() => setAvatarExpanded(false)}
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                  <img
                    src={profile?.avatar_url || classImageUrl || ""}
                    alt={profile?.nickname || "Avatar"}
                    className="max-w-[92vw] md:max-w-[70vw] max-h-[80vh] rounded-2xl object-contain border-2 border-primary/40 shadow-2xl bg-background/40"
                  />
                  <div className="w-full md:w-52 space-y-3">
                    <div className="text-center md:text-left">
                      <p className="font-display font-extrabold text-xl text-white uppercase tracking-wider">
                        {profile.nickname}
                      </p>
                      {playerRanking && (
                        <p className="font-display font-bold mt-1">
                          <span className="text-gold text-base">Lv.{playerRanking.level}</span> <span className="text-white mx-0.5">•</span> <span className="text-cyan-400 text-sm">{playerRanking.xp?.endsWith('%') ? playerRanking.xp : `${playerRanking.xp}%`}</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full px-3 py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-display font-bold text-xs uppercase tracking-wider hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? 'Enviando...' : 'Mudar Foto'}
                    </button>
                  </div>
                  <button
                    onClick={() => setAvatarExpanded(false)}
                    className="mt-1 md:mt-0 text-xs text-muted-foreground hover:text-white transition-colors font-display uppercase tracking-wider"
                  >
                    Fechar
                  </button>
                </div>
              </div>
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

      {/* Visibility + Clear actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleVisibility}
          disabled={togglingVisibility}
          className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
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

        <button
          onClick={handleClearAll}
          disabled={equipment.length === 0}
          className="h-full min-h-[46px] px-3 rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 text-xs font-display font-bold whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpar
        </button>
      </div>

      {/* Play Schedule */}
      <div className="glass-card p-4 rounded-2xl border border-border/40 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-xs uppercase tracking-wider text-foreground">
            Horários que jogo
          </span>
          {savingSchedule && (
            <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin ml-auto" />
          )}
        </div>
        <PlayScheduleSelector selected={playSchedule} onChange={savePlaySchedule} size="sm" />
      </div>

    </div>
  );
}
