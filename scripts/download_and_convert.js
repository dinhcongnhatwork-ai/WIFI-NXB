const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SELECTED = [
  // 1. Van hoa doc
  {
    category: 'van-hoa-doc',
    key: 'van-hoa-doc-hero',
    thumbKey: 'van-hoa-doc-thumb',
    title: 'File:Westmount Public Library by Rodrigo Tetsuo Argenton (03).jpg'
  },
  {
    category: 'van-hoa-doc',
    key: 'van-hoa-doc-reading',
    title: 'File:Reading at a cafe (Unsplash).jpg'
  },
  {
    category: 'van-hoa-doc',
    key: 'van-hoa-doc-books',
    title: 'File:Man reads a book while sitting at a table near a window in a cafe.jpg'
  },
  {
    category: 'van-hoa-doc',
    key: 'van-hoa-doc-space',
    title: 'File:Bella Judie, book café in Taipei.jpg'
  },

  // 2. Xuat ban so
  {
    category: 'xuat-ban-so',
    key: 'stbook-hero',
    thumbKey: 'stbook-thumb',
    title: 'File:Woman with blue nails reading ipad (Unsplash).jpg'
  },
  {
    category: 'xuat-ban-so',
    key: 'stbook-app',
    title: 'File:IPad reading - TNW Conference 2011 - Day 1 (5663389351).jpg'
  },
  {
    category: 'xuat-ban-so',
    key: 'stbook-digital',
    title: 'File:Person reading an ebook.jpg'
  },
  {
    category: 'xuat-ban-so',
    key: 'stbook-reader',
    title: 'File:Reading on an e-book reader (Unsplash).jpg'
  },

  // 3. Hoi nghi
  {
    category: 'hoi-nghi',
    key: 'hoi-nghi-hero',
    thumbKey: 'hoi-nghi-thumb',
    title: 'File:Craig Newmark Auditorium at WCNA 2025.jpg'
  },
  {
    category: 'hoi-nghi',
    key: 'hoi-nghi-discussion',
    title: 'File:29.01.2016 11-30pm Panel Discussion (24658228451).jpg'
  },
  {
    category: 'hoi-nghi',
    key: 'hoi-nghi-delegates',
    title: 'File:The Conference Hall (941130290).jpg'
  },

  // 4. Trien lam
  {
    category: 'trien-lam',
    key: 'trien-lam-hero',
    thumbKey: 'trien-lam-thumb',
    title: 'File:Hebrew Book Week 2023 fair in Jerusalem4155.jpg'
  },
  {
    category: 'trien-lam',
    key: 'trien-lam-event',
    title: 'File:Wikimedia Sverige at Göteborg Book Fair 2024 03.jpg'
  },
  {
    category: 'trien-lam',
    key: 'trien-lam-books',
    title: 'File:Bookman Books booth, TIBE 20230131.jpg'
  },

  // 5. Ly luan chinh tri
  {
    category: 'ly-luan-chinh-tri',
    key: 'ly-luan-hero',
    thumbKey: 'ly-luan-thumb',
    title: 'File:NLC Ancient Books Library (20211107143535).jpg'
  },
  {
    category: 'ly-luan-chinh-tri',
    key: 'ly-luan-dangvien',
    title: 'File:NLC Ancient Books Library 7.jpg'
  },
  {
    category: 'ly-luan-chinh-tri',
    key: 'ly-luan-database',
    title: 'File:NLC Ancient Books Library 10.jpg'
  }
];

// Candidates cache from previous search
const candidates = JSON.parse(fs.readFileSync('/tmp/curated_candidates.json'));

function getUrlForTitle(title, category) {
  const list = candidates[category] || [];
  const found = list.find(x => x.title === title);
  if (found) return found.thumb;
  return null;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'WiFiPortalDev/1.0 (contact@solutionai.vn)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function processAll() {
  const outDir = path.join(__dirname, '../public/nxb-templates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const item of SELECTED) {
    let url = getUrlForTitle(item.title, item.category);
    if (!url) {
      console.warn(`No URL in cache for ${item.title}, using first candidate in ${item.category}`);
      url = candidates[item.category]?.[0]?.thumb;
    }
    console.log(`Processing [${item.key}] from ${url}...`);
    try {
      const buffer = await fetchBuffer(url);
      console.log(`  Downloaded ${buffer.length} bytes for ${item.key}`);

      // 1. Landscape 16:9 (1200x675) for Desktop & Tablet
      const landscapePath = path.join(outDir, `${item.key}.jpg`);
      await sharp(buffer)
        .resize(1200, 675, { fit: 'cover', position: 'entropy' })
        .jpeg({ quality: 90, progressive: true })
        .toFile(landscapePath);
      console.log(`  -> Saved Landscape: ${landscapePath}`);

      // 2. Portrait 3:4 (720x960) for Mobile (slice ảnh nếu của điện thoại có thể để tỉ lệ dọc)
      const portraitPath = path.join(outDir, `${item.key}-portrait.jpg`);
      await sharp(buffer)
        .resize(720, 960, { fit: 'cover', position: 'entropy' })
        .jpeg({ quality: 90, progressive: true })
        .toFile(portraitPath);
      console.log(`  -> Saved Portrait: ${portraitPath}`);

      // 3. WebP Thumbnail (800x600) if thumbKey specified
      if (item.thumbKey) {
        const thumbPath = path.join(outDir, `${item.thumbKey}.webp`);
        await sharp(buffer)
          .resize(800, 600, { fit: 'cover', position: 'entropy' })
          .webp({ quality: 88 })
          .toFile(thumbPath);
        console.log(`  -> Saved Thumbnail: ${thumbPath}`);
      }
    } catch (err) {
      console.error(`  ERROR processing ${item.key}:`, err.message);
    }
  }
  console.log('All images processed successfully!');
}

processAll().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
