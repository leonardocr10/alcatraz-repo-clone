import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractLevelPlayers(html: string) {
  const players: Array<{
    rank: number;
    name: string;
    gameClass: string;
    clan: string;
    level: number;
    xp: string;
  }> = [];

  // Find the rankLevel panel content
  const levelPanelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|$)/);
  if (!levelPanelMatch) {
    console.log("Could not find rankLevel panel");
    // Try the whole page
    return extractFromTable(html);
  }

  return extractFromTable(levelPanelMatch[1]);
}

function extractFromTable(html: string) {
  const players: Array<{
    rank: number;
    name: string;
    gameClass: string;
    clan: string;
    level: number;
    xp: string;
  }> = [];

  // Match each table row
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];

    // Skip header rows
    if (rowHtml.includes("<th")) continue;

    // Extract all td contents
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      tds.push(tdMatch[1]);
    }

    // Level table has 6 columns: #, name, class, clan, level, xp(%)
    if (tds.length !== 6) continue;

    // Check if last column has % (level table vs pvp table)
    if (!tds[5].includes("%")) continue;

    // Extract rank
    const rankText = tds[0].replace(/<[^>]+>/g, "").trim();
    const rank = parseInt(rankText);
    if (isNaN(rank)) continue;

    // Extract name
    const nameMatch = tds[1].match(/text-orange-400[^>]*>([^<]+)/);
    const name = nameMatch ? nameMatch[1].trim() : tds[1].replace(/<[^>]+>/g, "").trim();
    if (!name) continue;

    // Extract class
    const classMatch = tds[2].match(/<span[^>]*>([^<]+)<\/span>/);
    const gameClass = classMatch ? classMatch[1].trim() : "";

    // Extract clan
    const clanMatch = tds[3].match(/text-white\/80[^>]*>([^<]+)<\/span>/);
    const clan = clanMatch ? clanMatch[1].trim() : "";

    // Extract level
    const levelText = tds[4].replace(/<[^>]+>/g, "").trim();
    const level = parseInt(levelText);

    // Extract XP
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

    // Fetch all users nicknames
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, nickname");
    if (usersErr) throw usersErr;

    const nicknameMap = new Map<string, string>();
    for (const u of users || []) {
      nicknameMap.set(u.nickname.toLowerCase(), u.id);
    }

    console.log(`Users in DB: ${nicknameMap.size}`);

    const allPlayers: Array<{
      rank: number;
      name: string;
      gameClass: string;
      clan: string;
      level: number;
      xp: string;
    }> = [];

    const maxPages = 10;
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://arkanumpt.com.br/rankings?q=&class=0&tab=rankLevel&page_level=${page}`;
      console.log(`Fetching page ${page}...`);

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        },
      });

      if (!resp.ok) {
        console.error(`Page ${page} failed: ${resp.status}`);
        break;
      }

      const html = await resp.text();
      console.log(`Page ${page} HTML length: ${html.length}`);

      if (page === 1) {
        // Log a snippet to debug
        const snippet = html.substring(0, 500);
        console.log(`HTML start: ${snippet}`);
      }

      const pagePlayers = extractLevelPlayers(html);
      console.log(`Page ${page}: ${pagePlayers.length} players found`);

      if (pagePlayers.length > 0) {
        console.log(`First player: ${JSON.stringify(pagePlayers[0])}`);
      }

      allPlayers.push(...pagePlayers);

      if (pagePlayers.length < 10) break;
    }

    console.log(`Total scraped: ${allPlayers.length}`);

    // Match and upsert
    let matched = 0;
    for (const player of allPlayers) {
      const userId = nicknameMap.get(player.name.toLowerCase());
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

      if (error) {
        console.error(`Upsert error for ${player.name}: ${error.message}`);
      } else {
        matched++;
        console.log(`Matched: ${player.name} -> level ${player.level}, xp ${player.xp}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, scraped: allPlayers.length, matched }),
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
