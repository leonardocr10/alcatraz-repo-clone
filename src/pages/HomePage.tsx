import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClans } from "@/hooks/useClans";
import { toast } from "sonner";
import { AlertCircle, Clock, RefreshCw, Tag, UserCheck, UserX } from "lucide-react";
import { SocialFeed } from "@/components/SocialFeed";
import { PlayerCharSaleCard } from "@/components/PlayerCharSaleCard";
import { DiscordFloatingButton } from "@/components/DiscordFloatingButton";

interface CharSaleItem {
  id: string;
  nickname: string;
  clan: string | null;
  phone: string | null;
  char_sale_price: string | null;
  char_sale_description: string | null;
}

export default function HomePage() {
  const { isAdmin, isLeader, profile } = useAuth();
  const { clans } = useClans();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingClanMap, setPendingClanMap] = useState<Record<string, string>>({});
  const [charsForSale, setCharsForSale] = useState<CharSaleItem[]>([]);
  const canManageApprovals = isAdmin || isLeader;
  const leaderClan = profile?.clan || null;

  const fetchPendingUsers = useCallback(async () => {
    if (!canManageApprovals) return;
    if (!isAdmin && !leaderClan) {
      setPendingUsers([]);
      setPendingClanMap({});
      return;
    }

    let query = supabase.from("users").select("*").eq("approved", false).order("created_at", { ascending: false });
    if (!isAdmin && leaderClan) {
      query = query.eq("clan", leaderClan);
    }

    const { data } = await query;
    setPendingUsers(data || []);

    const map: Record<string, string> = {};
    (data || []).forEach((u: any) => {
      map[u.id] = u.clan || clans[0]?.name || "";
    });
    setPendingClanMap(map);
  }, [canManageApprovals, isAdmin, leaderClan, clans]);

  const fetchCharsForSale = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, nickname, clan, phone, char_sale_price, char_sale_description")
      .eq("approved", true)
      .eq("char_visible", true)
      .eq("char_for_sale", true)
      .order("created_at", { ascending: false });

    if (!error) setCharsForSale((data || []) as CharSaleItem[]);
  }, []);

  useEffect(() => {
    fetchPendingUsers();
    fetchCharsForSale();
  }, [fetchPendingUsers, fetchCharsForSale]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const approveUser = async (userId: string) => {
    if (!canManageApprovals) return;
    const clan = isAdmin ? (pendingClanMap[userId] || clans[0]?.name || null) : (leaderClan || null);
    if (!clan) {
      toast.error("Defina um clã válido para aprovar.");
      return;
    }
    const { error } = await supabase.from("users").update({ approved: true, clan }).eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Usuário aprovado no ${clan}!`);
    fetchPendingUsers();
  };

  const rejectUser = async (userId: string) => {
    if (!canManageApprovals) return;
    if (!confirm("Rejeitar este usuário?")) return;
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Usuário rejeitado!");
    fetchPendingUsers();
  };

  const getBrazilTimeStr = () => {
    const now = currentTime;
    const brazilOffset = -3 * 60;
    const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
    return brazilTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const formatSalePrice = (value: string | null) => {
    if (!value) return "A combinar";
    if (/^R\$\s?[\d.]+,\d{2}$/.test(value.trim())) return value;
    const digits = value.replace(/\D/g, "");
    if (!digits) return value;
    const amount = Number(digits) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const openSaleWhatsApp = (item: CharSaleItem) => {
    if (!item.phone) {
      toast.error("Este jogador não tem telefone cadastrado.");
      return;
    }
    const digits = item.phone.replace(/\D/g, "");
    const number = digits.startsWith("55") ? digits : `55${digits}`;
    const message = [
      `Olá ${item.nickname}!`,
      "Vi seu char à venda no Clan Panel.",
      `Valor anunciado: ${formatSalePrice(item.char_sale_price)}.`,
      item.char_sale_description ? `Descrição: ${item.char_sale_description}` : null,
      "Ainda está disponível?",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-2.5 flex items-center justify-between">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-display text-lg font-extrabold tabular-nums">{getBrazilTimeStr()}</span>
          <span className="text-[10px] text-muted-foreground font-body bg-secondary px-1.5 py-0.5 rounded-md">BRT</span>
          <span className="text-[9px] text-muted-foreground/40 font-body select-none">v{__APP_VERSION__}</span>
        </div>
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => {
              fetchPendingUsers();
              fetchCharsForSale();
              toast.success("Atualizado!");
            }}
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-primary"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {canManageApprovals && pendingUsers.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gold" />
            <span className="font-display text-sm font-extrabold uppercase tracking-wider">Aprovações Pendentes</span>
            <span className="ml-auto text-xs font-display font-bold text-gold bg-gold/15 px-2 py-0.5 rounded-lg">{pendingUsers.length}</span>
          </div>
          <div className="divide-y divide-border/20">
            {pendingUsers.map((user) => (
              <div key={user.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-bold truncate">{user.nickname}</p>
                    <p className="text-[11px] text-muted-foreground font-body">
                      {user.class || "Sem classe"} · {user.phone}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => approveUser(user.id)} className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <UserCheck className="w-4 h-4" />
                    </button>
                    <button onClick={() => rejectUser(user.id)} className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase">Clã:</span>
                  {isAdmin ? (
                    clans.map((clan) => (
                      <button
                        key={clan.name}
                        onClick={() => setPendingClanMap((prev) => ({ ...prev, [user.id]: clan.name }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition-all border ${
                          (pendingClanMap[user.id] || clans[0]?.name || "AZ") === clan.name
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/40 text-muted-foreground hover:border-muted-foreground/30"
                        }`}
                      >
                        {clan.name}
                      </button>
                    ))
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-display font-bold border border-primary bg-primary/15 text-primary">
                      {leaderClan || "Sem clã"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SocialFeed />

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="font-display text-sm font-extrabold uppercase tracking-wider">Chars à Venda (Todos os Clãs)</span>
          <span className="ml-auto text-xs font-display font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-lg">{charsForSale.length}</span>
        </div>
        {charsForSale.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground font-body">Nenhum char à venda no momento.</p>
          </div>
        ) : (
          <div className="space-y-3 p-3">
            {charsForSale.map((item) => (
              <PlayerCharSaleCard
                key={item.id}
                playerId={item.id}
                playerName={item.nickname}
                clan={item.clan}
                price={item.char_sale_price}
                description={item.char_sale_description}
                phone={item.phone}
                onContact={() => openSaleWhatsApp(item)}
              />
            ))}
          </div>
        )}
      </div>

      <DiscordFloatingButton />
    </div>
  );
}
