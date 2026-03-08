const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HistoryEntry {
  date: string;
  nick: string;
  map: string;
  item: string;
  boss: string | null;
  source: string;
}

async function scrapePage(page: number): Promise<{ entries: HistoryEntry[]; totalPages: number }> {
  const url = `https://arkanumpt.com.br/historico?type=all&page=${page}`;
  const res = await fetch(url);
  const html = await res.text();

  const entries: HistoryEntry[] = [];

  // Extract total pages
  let totalPages = 1;
  const totalMatch = html.match(/Página\s+\d+\s*\/\s*(\d+)/);
  if (totalMatch) totalPages = parseInt(totalMatch[1]);

  // Parse table rows
  const rowRegex = /<tr[^>]*class="hover:bg-white\/5[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);

    if (cells.length >= 5) {
      const dateStr = cells[0].replace(/<[^>]*>/g, '').trim();
      const nick = cells[1].replace(/<[^>]*>/g, '').trim();
      const map = cells[2].replace(/<[^>]*>/g, '').trim();

      // Item cell may have boss info
      const itemCell = cells[3];
      const itemName = itemCell.match(/<div[^>]*class="text-white\/85[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || '';
      const bossName = itemCell.match(/Boss:\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1]?.trim() || null;

      const sourceCell = cells[4];
      const source = sourceCell.includes('Boss') ? 'Boss' : 'Normal';

      entries.push({ date: dateStr, nick, map, item: itemName, boss: bossName, source });
    }
  }

  return { entries, totalPages };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get today and yesterday in BRT (UTC-3)
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = `${String(brt.getDate()).padStart(2, '0')}/${String(brt.getMonth() + 1).padStart(2, '0')}/${brt.getFullYear()}`;
    const yesterday = new Date(brt);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${String(yesterday.getDate()).padStart(2, '0')}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${yesterday.getFullYear()}`;

    console.log(`Scraping history for today=${todayStr} and yesterday=${yesterdayStr}`);

    const allEntries: HistoryEntry[] = [];
    let page = 1;
    let maxPages = 1;
    let reachedOlder = false;

    // Scrape pages until we find records older than yesterday
    while (page <= maxPages && !reachedOlder && page <= 50) {
      const { entries, totalPages } = await scrapePage(page);
      maxPages = totalPages;

      for (const entry of entries) {
        const entryDate = entry.date.split(' ')[0]; // "DD/MM/YYYY"
        if (entryDate === todayStr || entryDate === yesterdayStr) {
          allEntries.push(entry);
        } else if (entryDate !== todayStr && entryDate !== yesterdayStr) {
          // Check if it's older (not today or yesterday)
          reachedOlder = true;
        }
      }

      page++;
    }

    // Group by date and item
    const todayItems: Record<string, number> = {};
    const yesterdayItems: Record<string, number> = {};
    let todayTotal = 0;
    let yesterdayTotal = 0;

    for (const entry of allEntries) {
      const entryDate = entry.date.split(' ')[0];
      const itemKey = entry.item || 'Desconhecido';

      if (entryDate === todayStr) {
        todayItems[itemKey] = (todayItems[itemKey] || 0) + 1;
        todayTotal++;
      } else {
        yesterdayItems[itemKey] = (yesterdayItems[itemKey] || 0) + 1;
        yesterdayTotal++;
      }
    }

    // Sort by count
    const sortItems = (items: Record<string, number>) =>
      Object.entries(items)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

    const result = {
      today: {
        date: todayStr,
        total: todayTotal,
        items: sortItems(todayItems),
      },
      yesterday: {
        date: yesterdayStr,
        total: yesterdayTotal,
        items: sortItems(yesterdayItems),
      },
      scrapedAt: new Date().toISOString(),
      pagesScraped: page - 1,
    };

    console.log(`Scraped ${page - 1} pages. Today: ${todayTotal}, Yesterday: ${yesterdayTotal}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
