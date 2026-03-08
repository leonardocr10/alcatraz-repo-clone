import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Scrape ranking pages until we've matched all users or run out of pages
    const allPlayers: Array<{
      rank: number;
      name: string;
      gameClass: string;
      clan: string;
      level: number;
      xp: string;
    }> = [];

    const maxPages = 10; // Scrape up to 10 pages (100 players)
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://arkanumpt.com.br/rankings?q=&class=0&tab=rankLevel&page_level=${page}`;
      console.log(`Fetching page ${page}: ${url}`);

      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`Failed to fetch page ${page}: ${resp.status}`);
        break;
      }

      const html = await resp.text();

      // Parse the Level ranking table (first table in rankLevel panel)
      // Each row: <tr> with 6 <td>: #, name, class, clan, level, xp
      const rowRegex = /<tr class="hover:bg-white\/5 transition">([\s\S]*?)<\/tr>/g;
      let match;
      let foundOnPage = 0;

      while ((match = rowRegex.exec(html)) !== null) {
        const rowHtml = match[1];

        // Only process rows from the Level table (before the PvP section)
        // The level table rows have 6 tds with level and xp%
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        const tds: string[] = [];
        let tdMatch;
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
          tds.push(tdMatch[1]);
        }

        if (tds.length < 6) continue;

        // Extract rank
        const rankMatch = tds[0].match(/(\d+)/);
        if (!rankMatch) continue;
        const rank = parseInt(rankMatch[1]);

        // Extract name (orange text)
        const nameMatch = tds[1].match(/text-orange-400[^>]*>([^<]+)/);
        if (!nameMatch) continue;
        const name = nameMatch[1].trim();

        // Extract class
        const classMatch = tds[2].match(/<span[^>]*>([^<]+)<\/span>/);
        const gameClass = classMatch ? classMatch[1].trim() : "";

        // Extract clan
        const clanMatch = tds[3].match(/<span[^>]*text-white\/80[^>]*>([^<]+)<\/span>/);
        const clan = clanMatch ? clanMatch[1].trim() : "";

        // Extract level
        const levelMatch = tds[4].match(/(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1]) : 0;

        // Extract XP
        const xpMatch = tds[5].match(/([\d.]+%)/);
        const xp = xpMatch ? xpMatch[1] : "0%";

        // Check if this is a level row (xp contains %) vs pvp row
        if (!tds[5].includes("%")) continue;

        allPlayers.push({ rank, name, gameClass, clan, level, xp });
        foundOnPage++;
      }

      console.log(`Page ${page}: found ${foundOnPage} level players`);

      // If less than 10 results, we're on the last page
      if (foundOnPage < 10) break;
    }

    console.log(`Total scraped: ${allPlayers.length} players`);

    // Match with our users and upsert
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
        console.error(`Error upserting ${player.name}:`, error.message);
      } else {
        matched++;
      }
    }

    console.log(`Matched and upserted: ${matched} players`);

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
