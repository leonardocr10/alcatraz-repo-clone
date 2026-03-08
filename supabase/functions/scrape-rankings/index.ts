import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractLevelPlayer(html: string, targetName: string) {
  // Isolate the rankLevel panel
  let searchHtml = html;
  const panelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|id="rankBellatra"|$)/);
  if (panelMatch) searchHtml = panelMatch[1];

  const rowRegex = /<tr class="hover:bg-white\/5 transition">([\s\S]*?)<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(searchHtml)) !== null) {
    const rowHtml = match[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let m;
    while ((m = tdRegex.exec(rowHtml)) !== null) tds.push(m[1]);

    if (tds.length < 6) continue;

    const xpRaw = tds[5].replace(/<[^>]+>/g, "").trim();
    if (!xpRaw.includes("%")) continue;

    const rank = parseInt(tds[0].replace(/<[^>]+>/g, "").trim());
    if (isNaN(rank)) continue;

    const name = tds[1].replace(/<[^>]+>/g, "").trim();
    if (!name || name.toLowerCase() !== targetName.toLowerCase()) continue;

    const classMatch = tds[2].match(/<span[^>]*>([^<]+)<\/span>/);
    const gameClass = classMatch ? classMatch[1].trim() : "";

    const clanMatch = tds[3].match(/text-white\/80[^>]*>([^<]+)<\/span>/);
    const clan = clanMatch ? clanMatch[1].trim() : "";

    const level = parseInt(tds[4].replace(/<[^>]+>/g, "").trim());

    const xpMatch = xpRaw.match(/([\d.,]+%)/);
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

    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, nickname");
    if (usersErr) throw usersErr;

    let matched = 0;
    const unmatched: string[] = [];

    for (const user of users || []) {
      const url = `https://arkanumpt.com.br/rankings?q=${encodeURIComponent(user.nickname)}&class=0&tab=rankLevel`;

      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
      });

      if (!resp.ok) {
        console.error(`${user.nickname}: HTTP ${resp.status}`);
        unmatched.push(user.nickname);
        continue;
      }

      const html = await resp.text();
      const player = extractLevelPlayer(html, user.nickname);

      if (player) {
        const { error } = await supabase
          .from("player_rankings")
          .upsert({
            user_id: user.id,
            nickname: player.name,
            game_class: player.gameClass,
            clan: player.clan,
            level: player.level,
            xp: player.xp,
            rank_position: player.rank,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (!error) {
          matched++;
          console.log(`✓ ${player.name}: Lv.${player.level} ${player.xp} (#${player.rank})`);
        }
      } else {
        unmatched.push(user.nickname);
        console.log(`✗ ${user.nickname}: não encontrado no ranking`);
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`Done: ${matched} matched out of ${users?.length || 0}`);

    return new Response(
      JSON.stringify({ success: true, total: users?.length || 0, matched, unmatched: unmatched.length }),
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
