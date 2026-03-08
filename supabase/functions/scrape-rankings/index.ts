import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractLevelPlayers(html: string) {
  const players: Array<{
    rank: number; name: string; gameClass: string; clan: string; level: number; xp: string;
  }> = [];

  // Try to find the rankLevel panel first, otherwise use the whole page
  let searchHtml = html;
  const panelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|$)/);
  if (panelMatch) searchHtml = panelMatch[1];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(searchHtml)) !== null) {
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

async function fetchWithCookies(url: string, cookies: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Referer": "https://arkanumpt.com.br/rankings",
  };
  if (cookies) headers["Cookie"] = cookies;

  const resp = await fetch(url, { headers });

  // Extract cookies from response
  let newCookies = cookies;
  const setCookieHeaders = resp.headers.getSetCookie?.() || [];
  for (const sc of setCookieHeaders) {
    const cookiePart = sc.split(";")[0];
    if (cookiePart) {
      if (newCookies) newCookies += "; " + cookiePart;
      else newCookies = cookiePart;
    }
  }

  return { resp, cookies: newCookies };
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

    const nicknameMap = new Map<string, string>();
    for (const u of users || []) {
      nicknameMap.set(u.nickname.toLowerCase(), u.id);
    }

    const unmatchedUsers = new Set(nicknameMap.keys());
    let matched = 0;
    let cookies = "";
    const maxPages = 65;

    for (let page = 1; page <= maxPages; page++) {
      if (unmatchedUsers.size === 0) break;

      const url = `https://arkanumpt.com.br/rankings?q=&class=0&tab=rankLevel&page_level=${page}`;

      const { resp, cookies: newCookies } = await fetchWithCookies(url, cookies);
      cookies = newCookies;

      if (!resp.ok) {
        console.error(`Page ${page}: HTTP ${resp.status}`);
        break;
      }

      const html = await resp.text();
      const pagePlayers = extractLevelPlayers(html);

      if (page <= 3 || page % 10 === 0) {
        console.log(`Page ${page}: ${html.length} bytes, ${pagePlayers.length} players`);
      }

      if (pagePlayers.length === 0) break;

      for (const player of pagePlayers) {
        const key = player.name.toLowerCase();
        const userId = nicknameMap.get(key);
        if (!userId) continue;

        const { error } = await supabase
          .from("player_rankings")
          .upsert({
            user_id: userId,
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
          unmatchedUsers.delete(key);
          console.log(`✓ ${player.name}: Lv.${player.level} ${player.xp} (#${player.rank})`);
        }
      }

      // Delay between pages
      await new Promise(r => setTimeout(r, 500));
    }

    if (unmatchedUsers.size > 0) {
      console.log(`Unmatched: ${[...unmatchedUsers].join(", ")}`);
    }

    console.log(`Done: ${matched} matched out of ${users?.length || 0}`);

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
