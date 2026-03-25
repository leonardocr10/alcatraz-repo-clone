import fs from 'node:fs';

async function fetchPage(page) {
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://arkanumpt.com.br/rankings?tab=rankLevel&page=${page}`)}`;
    const result = await fetch(url).then(r => r.json());
    return result.contents;
}

async function run() {
    console.log("Fetching search page...");
    const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://arkanumpt.com.br/rankings?q=RagnarLodBrok&tab=rankLevel&class=0`)}`;
    const result = await fetch(url).then(r => r.json());
    fs.writeFileSync('ranking_dump.html', result.contents);
    console.log("Dumped to ranking_dump.html");
}

run();
