import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractAlcatrazMembers(html: string) {
  // Isolate the rankLevel panel
  let searchHtml = html;
  const panelMatch = html.match(/id="rankLevel"([\s\S]*?)(?:id="rankPvp"|id="rankBellatra"|$)/);
  if (panelMatch) searchHtml = panelMatch[1];

  const rowRegex = /<tr class="hover:bg-white\/5 transition">([\s\S]*?)<\/tr>/g;
  const members = [];
  let match;
  
  while ((match = rowRegex.exec(searchHtml)) !== null) {
    const rowHtml = match[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let m;
    while ((m = tdRegex.exec(rowHtml)) !== null) tds.push(m[1]);

    if (tds.length < 6) continue;

    const clanMatch = tds[3].match(/text-white\/80[^>]*>([^<]+)<\/span>/);
    const clan = clanMatch ? clanMatch[1].trim() : "";
    
    // Only interested in AlcatraZ members
    if (!clan || clan.toLowerCase() !== "alcatraz") continue;

    const rank = parseInt(tds[0].replace(/<[^>]+>/g, "").trim());
    if (isNaN(rank)) continue;

    const name = tds[1].replace(/<[^>]+>/g, "").trim();

    const classMatch = tds[2].match(/<span[^>]*>([^<]+)<\/span>/);
    const gameClass = classMatch ? classMatch[1].trim() : "";

    const level = parseInt(tds[4].replace(/<[^>]+>/g, "").trim());

    const xpRaw = tds[5].replace(/<[^>]+>/g, "").trim();
    const xpMatch = xpRaw.match(/([\d.,]+%)/);
    const xp = xpMatch ? xpMatch[1] : "0%";

    members.push({ rank, name, gameClass, clan, level: isNaN(level) ? 0 : level, xp });
  }

  return members;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = `https://arkanumpt.com.br/rankings?tab=rankLevel`;
    
    // Attempt up to 3 times to fetch
    let html = "";
    let ok = false;
    for (let i = 0; i < 3; i++) {
        const resp = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html",
        },
        });
        
        if (resp.ok) {
            html = await resp.text();
            ok = true;
            break;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!ok) {
        throw new Error("Failed to fetch ranking from Arkanum");
    }

    const members = extractAlcatrazMembers(html);

    return new Response(
      JSON.stringify(members),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
