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

const TRACKED_EXACT = new Set(['celesto', 'inferna', 'mirage', 'enigma']);
const TRACKED_PARTIAL = ['inferno'];

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

function isTrackedItem(itemName: string): boolean {
  const normalized = itemName.toLowerCase().trim();
  if (TRACKED_EXACT.has(normalized)) return true;
  return TRACKED_PARTIAL.some((term) => normalized.includes(term));
}

function parseBrDate(dateText: string): Date | null {
  const [day, month, year] = dateText.split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

async function scrapePage(page: number): Promise<{ entries: HistoryEntry[]; totalPages: number }> {
  const url = `https://arkanumpt.com.br/historico?type=all&page=${page}`;
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();

  const entries: HistoryEntry[] = [];

  let totalPages = 1;
  const totalMatch = html.match(/Página[\s\S]*?\/\s*(\d+)\s*</i);
  if (totalMatch) {
    totalPages = parseInt(totalMatch[1], 10);
  }

  // Fallback: parse max page number from links
  if (!totalMatch) {
    const pageMatches = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => parseInt(m[1], 10));
    if (pageMatches.length > 0) {
      totalPages = Math.max(...pageMatches);
    }
  }

  const rowRegex = /<tr\s+class="hover:bg-white\/5[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);

    if (cells.length >= 5) {
      const date = stripHtml(cells[0]);
      const nick = stripHtml(cells[1]);
      const map = stripHtml(cells[2]);

      const itemCell = cells[3];
      const item = stripHtml(
        itemCell.match(/<div[^>]*class="[^"]*text-white\/85[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || ''
      );
      const boss =
        stripHtml(itemCell.match(/Boss:\s*<span[^>]*>([\s\S]*?)<\/span>/)?.[1] || '') || null;

      const sourceCell = cells[4];
      const source = sourceCell.includes('Boss') ? 'Boss' : 'Normal';

      if (item) {
        entries.push({ date, nick, map, item, boss, source });
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

    const yesterdayDate = new Date(brt);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = `${String(yesterdayDate.getDate()).padStart(2, '0')}/${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}/${yesterdayDate.getFullYear()}`;

    const yesterdayDateOnly = parseBrDate(yesterdayStr);

    console.log(`Scraping history for today=${todayStr} and yesterday=${yesterdayStr}`);

    const allEntries: HistoryEntry[] = [];
    let page = 1;
    let maxPages = 1;

    while (page <= maxPages && page <= 500) {
      const { entries, totalPages } = await scrapePage(page);
      maxPages = Math.max(maxPages, totalPages);

      let hasTodayOrYesterdayOnPage = false;
      let hasOlderThanYesterdayOnPage = false;

      for (const entry of entries) {
        const entryDateStr = entry.date.split(' ')[0];

        if (entryDateStr === todayStr || entryDateStr === yesterdayStr) {
          hasTodayOrYesterdayOnPage = true;
          if (isTrackedItem(entry.item)) {
            allEntries.push(entry);
          }
          continue;
        }

        if (yesterdayDateOnly) {
          const entryDate = parseBrDate(entryDateStr);
          if (entryDate && entryDate.getTime() < yesterdayDateOnly.getTime()) {
            hasOlderThanYesterdayOnPage = true;
          }
        }
      }

      // As rows are ordered by newest first, once a page has only older dates we can stop.
      if (!hasTodayOrYesterdayOnPage && hasOlderThanYesterdayOnPage) {
        break;
      }

      page++;
    }

    type ItemDetail = {
      nick: string;
      map: string;
      boss: string | null;
      source: string;
      time: string;
    };

    type ItemGroup = {
      count: number;
      details: ItemDetail[];
    };

    const todayItems: Record<string, ItemGroup> = {};
    const yesterdayItems: Record<string, ItemGroup> = {};
    let todayTotal = 0;
    let yesterdayTotal = 0;

    for (const entry of allEntries) {
      const entryDate = entry.date.split(' ')[0];
      const itemKey = entry.item;
      const time = entry.date.split(' ')[1] || '';
      const detail: ItemDetail = {
        nick: entry.nick,
        map: entry.map,
        boss: entry.boss,
        source: entry.source,
        time,
      };

      if (entryDate === todayStr) {
        if (!todayItems[itemKey]) todayItems[itemKey] = { count: 0, details: [] };
        todayItems[itemKey].count += 1;
        todayItems[itemKey].details.push(detail);
        todayTotal += 1;
      } else {
        if (!yesterdayItems[itemKey]) yesterdayItems[itemKey] = { count: 0, details: [] };
        yesterdayItems[itemKey].count += 1;
        yesterdayItems[itemKey].details.push(detail);
        yesterdayTotal += 1;
      }
    }

    const sortItems = (items: Record<string, ItemGroup>) =>
      Object.entries(items)
        .map(([name, group]) => ({ name, count: group.count, details: group.details }))
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
      trackedItems: ['Celesto', 'Inferna', 'Mirage', 'Enigma', '*inferno*'],
      scrapedAt: new Date().toISOString(),
      pagesScraped: page - 1,
    };

    console.log(`Scraped ${page - 1} pages (max detected: ${maxPages}). Today: ${todayTotal}, Yesterday: ${yesterdayTotal}`);

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
