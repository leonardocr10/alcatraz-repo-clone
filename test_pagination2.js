import fs from 'node:fs';

async function fetchPage(page) {
    const url = 'https://arkanumpt.com.br/rankings?tab=rankLevel&page_level=' + page;
    const result = await fetch(url, { headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    } }).then(r => r.text());
    return result;
}

async function run() {
    console.log("Fetching pages 1 and 2...");
    const p1 = await fetchPage(1);
    const p2 = await fetchPage(2);
    
    const name1 = p1.match(/text-orange-400\x22>([^<]+)/)?.[1];
    const name2 = p2.match(/text-orange-400\x22>([^<]+)/)?.[1] || p2.match(/class=\x22hover:bg-white\/5 transition\x22>\s*<td[^>]*>[^<]*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i)?.[1];
    
    console.log("Page 1 top name:", name1);
    console.log("Page 2 top name:", name2);
    
    const count1 = (p1.match(/<tr[^>]*>/g) || []).length;
    const count2 = (p2.match(/<tr[^>]*>/g) || []).length;
    console.log("Page 1 rows:", count1);
    console.log("Page 2 rows:", count2);
}

run();
