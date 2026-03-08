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

// Only track these items
const TRACKED_ITEMS = ['Celesto', 'Inferna', 'Mirage', 'Enigma'];

function isTrackedItem(itemName: string): boolean {
  const lower = itemName.toLowerCase();
  // Check exact matches
  for (const t of TRACKED_ITEMS) {
    if (lower === t.toLowerCase()) return true;
  }
  // Check if contains "inferno"
  if (lower.includes('inferno')) return true;
  return false;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

async function scrapePage(page: number): Promise<{ entries: HistoryEntry[]; totalPages: number }> {
  const url = `https://arkanumpt.com.br/historico?type=all&page=${page}`;
  const res = await fetch(url);
  const html = await res.text();

  const entries: HistoryEntry[] = [];

  let totalPages = 1;
  const totalMatch = html.match(/Página\s+\d+\s*\/\s*(\d+)/);
  if (totalMatch) totalPages = parseInt(totalMatch[1]);

  const rowRegex = /<tr\s+class="hover:bg-white\/5[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);

    if (cells.length >= 5) {
      const dateStr = stripHtml(cells[0]);
      const nick = stripHtml(cells[1]);
      const map = stripHtml(cells[2]);

      const itemCell = cells[3];
      const itemName = stripHtml(
        itemCell.match(/<div[^>]*class="[^"]*text-white\/85[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''
      );
      
      const bossName = stripHtml(
        itemCell.match(/Boss:\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1] || ''
      ) || null;

      const sourceCell = cells[4];
      const source = sourceCell.includes('Boss') ? 'Boss' : 'Normal';

      if (itemName) {
        entries.push({ date: dateStr, nick, map, item: itemName, boss: bossName, source });
      }
    }
  }

  return { entries, totalPages };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    let consecutiveOlderPages = 0;

    // Scrape all pages that contain today/yesterday data
    while (page <= maxPages && page <= 100) {
      const { entries, totalPages } = await scrapePage(page);
      maxPages = totalPages;

      let foundRelevant = false;
      for (const entry of entries) {
        const entryDate = entry.date.split(' ')[0];
        if (entryDate === todayStr || entryDate === yesterdayStr) {
          // Only keep tracked items
          if (isTrackedItem(entry.item)) {
            allEntries.push(entry);
          }
          foundRelevant = true;
        }
      }

      // Stop after 2 consecutive pages with no today/yesterday entries
      if (!foundRelevant) {
        consecutiveOlderPages++;
        if (consecutiveOlderPages >= 2) break;
      } else {
        consecutiveOlderPages = 0;
      }

      page++;
    }

    interface ItemDetail {
      nick: string;
      map: string;
      boss: string | null;
      source: string;
      time: string;
    }
    
    interface ItemGroup {
      count: number;
      details: ItemDetail[];
    }

    const todayItems: Record<string, ItemGroup> = {};
    const yesterdayItems: Record<string, ItemGroup> = {};
    let todayTotal = 0;
    let yesterdayTotal = 0;

    for (const entry of allEntries) {
      const entryDate = entry.date.split(' ')[0];
      const itemKey = entry.item;
      const time = entry.date.split(' ')[1] || '';
      const detail: ItemDetail = { nick: entry.nick, map: entry.map, boss: entry.boss, source: entry.source, time };

      if (entryDate === todayStr) {
        if (!todayItems[itemKey]) todayItems[itemKey] = { count: 0, details: [] };
        todayItems[itemKey].count++;
        todayItems[itemKey].details.push(detail);
        todayTotal++;
      } else {
        if (!yesterdayItems[itemKey]) yesterdayItems[itemKey] = { count: 0, details: [] };
        yesterdayItems[itemKey].count++;
        yesterdayItems[itemKey].details.push(detail);
        yesterdayTotal++;
      }
    }

    const sortItems = (items: Record<string, ItemGroup>) =>
      Object.entries(items)
        .map(([name, group]) => ({ name, count: group.count, details: group.details }))
        .sort((a, b) => b.count - a.count);

    const result = {
      today: { date: todayStr, total: todayTotal, items: sortItems(todayItems) },
      yesterday: { date: yesterdayStr, total: yesterdayTotal, items: sortItems(yesterdayItems) },
      scrapedAt: new Date().toISOString(),
      pagesScraped: page - 1,
      trackedItems: [...TRACKED_ITEMS, '*inferno*'],
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
