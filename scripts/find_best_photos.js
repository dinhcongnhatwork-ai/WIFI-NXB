const https = require('https');
const fs = require('fs');

async function search(q) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1600&format=json';
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'WiFiPortalDev/1.0 (contact@solutionai.vn)' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          const list = Object.values(pages).map(p => ({
            title: p.title,
            thumb: p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url,
            url: p.imageinfo?.[0]?.url,
            w: p.imageinfo?.[0]?.width || 0,
            h: p.imageinfo?.[0]?.height || 0
          })).filter(x => x.thumb && (x.title.endsWith('.jpg') || x.title.endsWith('.JPG') || x.title.endsWith('.jpeg')) && !x.title.includes('IA ') && !x.title.includes('Borough of Reading') && !x.title.includes('Reading,'));
          resolve(list);
        } catch (e) { resolve([]); }
      });
    }).on('error', () => resolve([]));
  });
}

const CATEGORIES = {
  'van-hoa-doc': ['modern public library interior', 'reading book cafe', 'bookshelf cozy reading', 'reading book table'],
  'xuat-ban-so': ['person reading ebook', 'reading on ipad', 'tablet reading book', 'digital tablet workspace'],
  'hoi-nghi': ['conference auditorium hall', 'panel discussion symposium', 'conference delegates lecture', 'modern auditorium lecture'],
  'trien-lam': ['book fair stand', 'book festival crowd', 'bookstore display books', 'exhibition booth book'],
  'ly-luan-chinh-tri': ['old library interior archive', 'leather bound books shelf', 'historic archive reading room', 'ancient books library']
};

(async () => {
  const results = {};
  for (const [cat, queries] of Object.entries(CATEGORIES)) {
    console.log(`Searching for ${cat}...`);
    results[cat] = [];
    for (const q of queries) {
      const items = await search(q);
      for (const item of items) {
        if (!results[cat].some(r => r.title === item.title)) {
          results[cat].push({ query: q, ...item });
        }
      }
    }
  }
  fs.writeFileSync('/tmp/curated_candidates.json', JSON.stringify(results, null, 2));
  console.log('Results written to /tmp/curated_candidates.json');
})();
