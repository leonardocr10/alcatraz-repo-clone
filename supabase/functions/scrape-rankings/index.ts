import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractLevelPlayer(html: string): { rank: number; name: string; gameClass: string; clan: string; level: number; xp: string } | null {
  // Find the rankLevel panel
  const panelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|$)/);
  if (!panelMatch) return null;
  const panelHtml = panelMatch[1];

  // Find all rows (skip headers)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(panelHtml)) !== null) {
    const rowHtml = rowMatch[1];
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

    return { rank, name, gameClass, clan, level: isNaN(level) ? 0 : level, xp };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch all users
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, nickname");
    if (usersErr) throw usersErr;

    console.log(`Searching rankings for ${users?.length || 0} users...`);

    let matched = 0;
    let errors = 0;

    for (const user of users || []) {
      try {
        const url = `https://arkanumpt.com.br/rankings?q=${encodeURIComponent(user.nickname)}&class=0&tab=rankLevel`;
        const resp = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml",
          },
        });

        if (!resp.ok) {
          console.error(`Failed for ${user.nickname}: ${resp.status}`);
          errors++;
          continue;
        }

        const html = await resp.text();
        const player = extractLevelPlayer(html);

        if (!player) {
          console.log(`No ranking found for ${user.nickname}`);
          continue;
        }

        // Verify the name matches (search might return partial matches)
        if (player.name.toLowerCase() !== user.nickname.toLowerCase()) {
          console.log(`Name mismatch: searched ${user.nickname}, got ${player.name}`);
          continue;
        }

        const { error } = await supabase
          .from("player_rankings")
          .upsert(
            {
              user_id: user.id,
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
          console.error(`Upsert error for ${user.nickname}: ${error.message}`);
          errors++;
        } else {
          matched++;
          console.log(`✓ ${user.nickname}: Lv.${player.level} ${player.xp} (#${player.rank})`);
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        console.error(`Error for ${user.nickname}:`, e);
        errors++;
      }
    }

    console.log(`Done: ${matched} matched, ${errors} errors`);

    return new Response(
      JSON.stringify({ success: true, total: users?.length || 0, matched, errors }),
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
