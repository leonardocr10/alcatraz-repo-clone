import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractLevelPlayers(html: string) {
  const players: Array<{
    rank: number; name: string; gameClass: string; clan: string; level: number; xp: string;
  }> = [];

  const panelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|$)/);
  if (!panelMatch) return players;
  const panelHtml = panelMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(panelHtml)) !== null) {
    const rowHtml = match[1];
    if (rowHtml.includes("<th") || rowHtml.includes("Nenhum resultado")) continue;

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let m;
    while ((m = tdRegex.exec(rowHtml)) !== null) tds.push(m[1]);

    if (tds.length < 6 || !tds[5].includes("%")) continue;

    const rankText = tds[0].replace(/<[^>]+>/g, "").trim();
    const rank = parseInt(rankText);
    if (isNaN(rank)) continue;

    const nameMatch = tds[1].match(/text-orange-400[^>]*>([^<]+)/);
    const name = nameMatch ? nameMatch[1].trim() : "";
    if (!name) continue;

    const classMatch = tds[2].match(/<span[^>]*>([^<]+)<\/span>/);
    const gameClass = classMatch ? classMatch[1].trim() : "";

    const clanMatch = tds[3].match(/text-white\/80[^>]*>([^<]+)<\/span>/);
    const clan = clanMatch ? clanMatch[1].trim() : "";

    const levelText = tds[4].replace(/<[^>]+>/g, "").trim();
    const level = parseInt(levelText);

    const xpMatch = tds[5].match(/([\d.,]+%)/);
    const xp = xpMatch ? xpMatch[1] : "0%";

    players.push({ rank, name, gameClass, clan, level: isNaN(level) ? 0 : level, xp });
  }

  return players;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, nickname");
    if (usersErr) throw usersErr;

    // Build nickname lookup (case insensitive)
    const nicknameMap = new Map<string, string>();
    for (const u of users || []) {
      nicknameMap.set(u.nickname.toLowerCase(), u.id);
    }

    const unmatchedUsers = new Set(nicknameMap.keys());
    let matched = 0;
    const maxPages = 65; // ~627 players / 10 per page

    for (let page = 1; page <= maxPages; page++) {
      // Stop if all users matched
      if (unmatchedUsers.size === 0) {
        console.log(`All users matched at page ${page - 1}`);
        break;
      }

      const url = `https://arkanumpt.com.br/rankings?q=&class=0&tab=rankLevel&page_level=${page}`;
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
      });

      if (!resp.ok) {
        console.error(`Page ${page} failed: ${resp.status}`);
        break;
      }

      const html = await resp.text();
      console.log(`Page ${page}: HTML length=${html.length}`);
      const pagePlayers = extractLevelPlayers(html);
      console.log(`Page ${page}: ${pagePlayers.length} players found`);

      if (pagePlayers.length === 0) {
        console.log(`No more players at page ${page}`);
        break;
      }

      for (const player of pagePlayers) {
        const key = player.name.toLowerCase();
        const userId = nicknameMap.get(key);
        if (!userId) continue;

        const { error } = await supabase
          .from("player_rankings")
          .upsert(
            {
              user_id: userId,
              nickname: player.name,
              game_class: player.gameClass,
              clan: player.clan,
              level: player.level,
              xp: player.xp,
              rank_position: player.rank,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

        if (!error) {
          matched++;
          unmatchedUsers.delete(key);
          console.log(`✓ ${player.name}: Lv.${player.level} ${player.xp} (#${player.rank})`);
        }
      }

      if (page % 10 === 0) console.log(`Scanned ${page} pages, ${matched} matched, ${unmatchedUsers.size} remaining`);
    }

    if (unmatchedUsers.size > 0) {
      console.log(`Unmatched users: ${[...unmatchedUsers].join(", ")}`);
    }

    return new Response(
      JSON.stringify({ success: true, total: users?.length || 0, matched, unmatched: unmatchedUsers.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
