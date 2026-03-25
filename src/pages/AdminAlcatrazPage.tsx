import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface RankingPlayer {
  id?: string;
  rank_position: number;
  name: string;
  game_class: string;
  level: number;
  xp: string;
}

const AdminAlcatrazPage = () => {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState<RankingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

  const loadPlayersFromDB = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("alcatraz_members")
        .select("*")
        .order("rank_position", { ascending: true });
        
      if (error) throw error;
      setPlayers(data || []);
    } catch (err: any) {
      console.warn("Table alcatraz_members might not exist yet:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadPlayersFromDB();
    }
  }, [isAdmin])  
  const extractAlcatrazMembers = (html: string) => {
    const members: RankingPlayer[] = [];
    let shouldStop = false;
    
    // Match each table row regardless of strict styling
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    if (!rows) return { members, shouldStop };

    for (const row of rows) {
      if (!row.includes("<td")) continue;
      
      const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi);
      if (!tds || tds.length < 4) continue;

      // Extract raw text from all TDs
      const rowText = tds.map(td => td.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
      
      const pos = parseInt(rowText[0], 10);
      if (isNaN(pos)) continue;

      const name = rowText[1];
      if (!name) continue;

      // Search entire row for "Alcatraz"
      const clanText = rowText.find(t => t.toLowerCase().includes("alcatraz") || t.toLowerCase().includes("icatraz"));
      if (!clanText) continue;

      // Class is usually before clan, or just take index 2 string if it's not a number
      let gameClass = "Desconhecida";
      const classCandidate = rowText[2];
      if (classCandidate && isNaN(parseInt(classCandidate.charAt(0)))) {
         gameClass = classCandidate;
      }

      // Gather the remaining text after column 3 to search for XP and Level
      const remainingText = rowText.slice(3).join(" ");
      
      // XP is usually formatted with dots or is just a huge number
      const xpMatch = remainingText.match(/\d{1,3}(?:\.\d{3})+/);
      let xpStr = "0";
      if (xpMatch) {
          xpStr = xpMatch[0];
      } else {
          // fallback to any large number
          const largeNums = remainingText.match(/\d{5,}/);
          if (largeNums) xpStr = largeNums[0];
      }

      // Level is a standalone number between ~50 and 250
      const numberMatches = remainingText.replace(/\d{1,3}(?:\.\d{3})+/g, "").match(/\b\d+\b/g) || [];
      const validLevel = numberMatches.map(n => parseInt(n, 10)).find(n => n > 20 && n <= 250);
      const level = validLevel || 1;

      if (!isNaN(level) && level <= 100 && level > 0) {
        shouldStop = true;
      }

      members.push({
        rank_position: pos,
        name,
        game_class: gameClass,
        level: level,
        xp: xpStr
      });
    }

    return { members, shouldStop };
  };

  const syncWithArkanum = async () => {
    if (!isAdmin) return;
    setSyncing(true);
    
    let page = 1;
    let keepGoing = true;

    try {
      while (keepGoing && page <= 40) {
        setSyncProgress(`Buscando página ${page}...`);
        const url = encodeURIComponent(`https://arkanumpt.com.br/rankings?tab=rankLevel&page_level=${page}`);
        let html = "";
        let ok = false;
        
        const proxies = [
          `https://api.allorigins.win/get?url=${url}`,
          `https://api.codetabs.com/v1/proxy/?quest=${url}`,
          `https://corsproxy.io/?url=${url}`
        ];

        for (let retry = 0; retry < 3; retry++) {
          for (let proxyUrl of proxies) {
            try {
              const res = await fetch(proxyUrl);
              if (res.ok) {
                if (proxyUrl.includes("allorigins")) {
                  const data = await res.json();
                  html = data.contents;
                } else {
                  html = await res.text();
                }
                
                if (html && html.includes("<td")) {
                  ok = true;
                  break;
                }
              }
            } catch (e) {
              console.warn(`Proxy ${proxyUrl} failed:`, e);
            }
          }
          if (ok) break;
          setSyncProgress(`Tentando novamente página ${page}...`);
          await new Promise(r => setTimeout(r, 2000));
        }

        if (!ok || !html) {
           console.warn(`Failed to fetch page ${page}, stopping sync.`);
           break; 
        }

        const hasRows = html.includes("<td");
        if (!hasRows) {
            keepGoing = false;
        } else {
            const { members: pageMembers, shouldStop } = extractAlcatrazMembers(html);
            
            if (pageMembers.length > 0) {
                setSyncProgress(`Salvando ${pageMembers.length} membros da página ${page}...`);
                const { error: insErr } = await (supabase as any)
                   .from("alcatraz_members")
                   .upsert(pageMembers, { onConflict: 'name' });
                   
                if (!insErr) {
                   setPlayers(prev => {
                      const newPlayers = [...prev];
                      pageMembers.forEach(m => {
                         const idx = newPlayers.findIndex(p => p.name === m.name);
                         if (idx >= 0) newPlayers[idx] = m;
                         else newPlayers.push(m);
                      });
                      return newPlayers.sort((a,b) => a.rank_position - b.rank_position);
                   });
                }
            }
            
            if (shouldStop) keepGoing = false;
            
            page++;
            await new Promise(r => setTimeout(r, 1000)); 
        }
      }

      toast.success(`Sincronização concluída!`);
      setSyncProgress("");
    } catch (err: any) {
      console.error("Error syncing AlcatraZ members:", err);
      toast.error("Erro ao sincronizar membros. Detalhes: " + err.message);
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  };

  const handleClearMembers = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Limpará todos os membros salvos do banco. Continuar?")) return;
    try {
      setLoading(true);
      const { error } = await (supabase as any).from("alcatraz_members").delete().neq('level', -1);
      if (error) throw error;
      setPlayers([]);
      toast.success("Todos os membros foram apagados!");
    } catch (err: any) {
      toast.error("Erro ao limpar banco: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-extrabold flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Membros do Clã AlcatraZ
          </h1>
          <p className="text-muted-foreground mt-2 font-body max-w-2xl">
            Sincronize a lista de membros do clã diretamente do ranking oficial do Arkanum PT.
          </p>
          <p className="text-xs font-bold text-primary mt-1">
            Ranking do banco de dados ({players.length} membros)
          </p>
        </div>
        <div className="flex gap-2">
            <button
                onClick={handleClearMembers}
                disabled={syncing || loading}
                title="Limpar Banco"
                className="btn-secondary flex items-center justify-center p-2.5 border-destructive/30 hover:bg-destructive/10 text-destructive font-bold transition-all rounded-xl"
            >
                <Trash2 className="w-5 h-5" />
            </button>
            <button
                onClick={syncWithArkanum}
                disabled={syncing}
                title="Sincronizar AlcatraZ"
                className="btn-primary flex items-center justify-center p-2.5 disabled:opacity-50 rounded-xl"
            >
                {syncing ? <Loader2 className={`w-5 h-5 animate-spin`} /> : <RefreshCw className={`w-5 h-5`} />}
            </button>
        </div>
      </div>

      {syncing && syncProgress && (
        <div className="glass-card p-3 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground font-display font-bold">{syncProgress}</p>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground font-body">Carregando do banco de dados...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-10">
            <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-body">Nenhum membro no banco de dados.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Clique em "Sincronizar" para buscar do site Arkanum.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground font-bold border-b border-border/40">
                <tr>
                  <th className="px-4 py-3 text-center">#</th>
                  <th className="px-4 py-3">Jogador</th>
                  <th className="px-4 py-3 text-center">Classe</th>
                  <th className="px-4 py-3 text-center">Level / XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {players.map((player) => (
                  <tr key={player.name} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-center font-display font-bold text-muted-foreground">
                      {player.rank_position}
                    </td>
                    <td className="px-4 py-3 font-display font-bold text-gold">
                      {player.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="badge-status bg-secondary text-foreground">
                        {player.game_class}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-display font-bold text-sm">Lv.{player.level}</span>
                        <span className="text-[10px] text-muted-foreground">{player.xp}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAlcatrazPage;
