import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const RAW_DIR = '/home/nxb/.gemini/antigravity/brain/adbe26f8-acc7-4866-b645-c324ec579d36/scratch/nxb-raw';
const OUT_DIR = path.resolve(process.cwd(), 'public/nxb-templates');

/**
 * 1. Official Logo (`/nxb-templates/logo-nxb-su-that.png`)
 * Uses the authentic `nxb_banner_header.png` from nxbctqg.org.vn framed in a crisp rounded gold-bordered badge.
 */
async function createOfficialLogo() {
  const bannerPath = path.join(RAW_DIR, 'nxb_banner_header.png');
  const width = 960;
  const height = 160;

  const resizedBanner = await sharp(bannerPath)
    .resize(width - 8, height - 8, { fit: 'fill' })
    .png()
    .toBuffer();

  const roundedMask = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="20" fill="#ffffff"/>
    </svg>
  `);

  const borderFrame = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldBorder" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="50%" stop-color="#F59E0B"/>
          <stop offset="100%" stop-color="#FEF08A"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="20" fill="none" stroke="url(#goldBorder)" stroke-width="4"/>
    </svg>
  `);

  await sharp({
    create: { width, height, channels: 4, background: { r: 215, g: 25, b: 32, alpha: 1 } },
  })
    .composite([
      { input: resizedBanner, left: 4, top: 4 },
      { input: roundedMask, blend: 'dest-in' },
      { input: borderFrame, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, 'logo-nxb-su-that.png'));
}

/**
 * Helper: gets a cropped header badge from `nxb_banner_header.png` (only the red section with ST + Nhà xuất bản Chính trị quốc gia Sự thật + medals)
 */
async function getHeaderStripBuffer(targetWidth, targetHeight) {
  const bannerPath = path.join(RAW_DIR, 'nxb_banner_header.png');
  // Top 122px of 961x153 is the red banner with gold/white official title & 5 medals
  const raw = await sharp(bannerPath)
    .extract({ left: 0, top: 0, width: 961, height: 122 })
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'left' })
    .png()
    .toBuffer();

  const mask = Buffer.from(`
    <svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${targetWidth}" height="${targetHeight}" rx="${Math.round(targetHeight / 4)}" fill="#ffffff"/>
    </svg>
  `);
  const border = Buffer.from(`
    <svg width="${targetWidth}" height="${targetHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${targetWidth - 2}" height="${targetHeight - 2}" rx="${Math.round(targetHeight / 4)}" fill="none" stroke="#FDE047" stroke-width="2"/>
    </svg>
  `);

  return sharp(raw)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: border, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * 3. Landscape Showcase Slide (`1280x720`, `.jpg`)
 * - Mode 'photo': High-resolution authentic NXB event/banner photo with subtle luxury frame
 * - Mode 'trio': Showcases 3 authentic NXB book covers side by side over a rich atmospheric background + official NXB header strip
 */
async function createLandscapeSlide({
  outName,
  mode = 'photo',
  bgFile,
  books = [],
  position = 'center',
  theme = { bg1: '#5A0E0E', bg2: '#1F0606', accent: '#FDE047' },
}) {
  const width = 1280;
  const height = 720;

  if (mode === 'photo') {
    const photoBuf = await sharp(path.join(RAW_DIR, bgFile))
      .resize(width, height, { fit: 'cover', position })
      .modulate({ brightness: 1.02, saturation: 1.06 })
      .toBuffer();

    const frameSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#090D16" stop-opacity="0.18"/>
            <stop offset="55%" stop-color="#090D16" stop-opacity="0.04"/>
            <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0.72"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#scrim)"/>
        <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="20" fill="none" stroke="${theme.accent}" stroke-opacity="0.45" stroke-width="2"/>
      </svg>
    `);

    await sharp(photoBuf)
      .composite([{ input: frameSvg, left: 0, top: 0 }])
      .jpeg({ quality: 91, progressive: true })
      .toFile(path.join(OUT_DIR, outName));
    return;
  }

  // Mode 'trio': 3 authentic NXB books showcased on a royal stage with the official NXB header strip at top
  const bgBuf = await sharp(path.join(RAW_DIR, bgFile))
    .resize(width, height, { fit: 'cover', position: 'center' })
    .blur(14)
    .modulate({ brightness: 0.55, saturation: 1.15 })
    .toBuffer();

  const headerStrip = await getHeaderStripBuffer(620, 74);

  const bLeft = await sharp(path.join(RAW_DIR, books[0])).resize(270, 400, { fit: 'cover' }).toBuffer();
  const bCenter = await sharp(path.join(RAW_DIR, books[1])).resize(320, 470, { fit: 'cover' }).toBuffer();
  const bRight = await sharp(path.join(RAW_DIR, books[2])).resize(270, 400, { fit: 'cover' }).toBuffer();

  const stageSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgOverlay" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.bg1}" stop-opacity="0.88"/>
          <stop offset="50%" stop-color="${theme.bg2}" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0.88"/>
        </linearGradient>
        <radialGradient id="bookGlow" cx="50%" cy="54%" r="46%">
          <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.38"/>
          <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
        </radialGradient>
        <filter id="dropShadow" x="-15%" y="-15%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#000000" flood-opacity="0.68"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bgOverlay)"/>
      <rect width="${width}" height="${height}" fill="url(#bookGlow)"/>
      <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="24" fill="none" stroke="${theme.accent}" stroke-opacity="0.45" stroke-width="2"/>
      <rect x="32" y="32" width="${width - 64}" height="${height - 64}" rx="18" fill="none" stroke="${theme.accent}" stroke-opacity="0.18" stroke-width="1"/>

      <!-- Pedestal frames for 3 books -->
      <rect x="134" y="184" width="282" height="412" rx="10" fill="#FFFFFF" filter="url(#dropShadow)"/>
      <rect x="864" y="184" width="282" height="412" rx="10" fill="#FFFFFF" filter="url(#dropShadow)"/>
      <rect x="472" y="144" width="336" height="486" rx="12" fill="#FFFFFF" stroke="${theme.accent}" stroke-width="3" filter="url(#dropShadow)"/>
    </svg>
  `);

  await sharp(bgBuf)
    .composite([
      { input: stageSvg, left: 0, top: 0 },
      { input: headerStrip, left: Math.round((width - 620) / 2), top: 44 },
      { input: bLeft, left: 140, top: 190 },
      { input: bRight, left: 870, top: 190 },
      { input: bCenter, left: 480, top: 152 },
    ])
    .jpeg({ quality: 92, progressive: true })
    .toFile(path.join(OUT_DIR, outName));
}

/**
 * 4. Portrait Slide (`720x960`, `-portrait.jpg`)
 * - Mode 'book': Displays the authentic NXB book cover large & crisp in the center below the official NXB header strip
 * - Mode 'photo': Displays the authentic NXB event/library photo in a vertical frame with a companion featured NXB book cover
 */
async function createPortraitSlide({
  outName,
  mode = 'book',
  bgFile,
  bookFile,
  theme = { bg1: '#6E1010', bg2: '#240505', accent: '#FDE047' },
}) {
  const width = 720;
  const height = 960;
  const headerStrip = await getHeaderStripBuffer(620, 76);

  if (mode === 'photo') {
    const bgBlurred = await sharp(path.join(RAW_DIR, bgFile))
      .resize(width, height, { fit: 'cover', position: 'center' })
      .blur(18)
      .modulate({ brightness: 0.50, saturation: 1.18 })
      .toBuffer();

    const mainPhoto = await sharp(path.join(RAW_DIR, bgFile))
      .resize(632, 420, { fit: 'cover', position: 'center' })
      .toBuffer();

    const subBook = await sharp(path.join(RAW_DIR, bookFile || 'book_hcm.jpg'))
      .resize(210, 310, { fit: 'cover' })
      .toBuffer();

    const frameSvg = Buffer.from(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${theme.bg1}" stop-opacity="0.88"/>
            <stop offset="50%" stop-color="${theme.bg2}" stop-opacity="0.65"/>
            <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0.95"/>
          </linearGradient>
          <filter id="pShadow" x="-15%" y="-15%" width="140%" height="140%">
            <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.68"/>
          </filter>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#pGrad)"/>
        <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="24" fill="none" stroke="${theme.accent}" stroke-opacity="0.48" stroke-width="2"/>
        <rect x="38" y="134" width="644" height="432" rx="16" fill="#FFFFFF" stroke="${theme.accent}" stroke-width="2" filter="url(#pShadow)"/>
        <rect x="249" y="514" width="222" height="322" rx="10" fill="#FFFFFF" stroke="${theme.accent}" stroke-width="2.5" filter="url(#pShadow)"/>
      </svg>
    `);

    await sharp(bgBlurred)
      .composite([
        { input: frameSvg, left: 0, top: 0 },
        { input: headerStrip, left: 50, top: 40 },
        { input: mainPhoto, left: 44, top: 140 },
        { input: subBook, left: 255, top: 520 },
      ])
      .jpeg({ quality: 92, progressive: true })
      .toFile(path.join(OUT_DIR, outName));
    return;
  }

  // Mode 'book': Crisp authentic NXB Book Cover centerpiece
  const bgBuf = await sharp(path.join(RAW_DIR, bgFile))
    .resize(width, height, { fit: 'cover', position: 'center' })
    .blur(18)
    .modulate({ brightness: 0.48, saturation: 1.15 })
    .toBuffer();

  const bookCover = await sharp(path.join(RAW_DIR, bookFile))
    .resize(450, 660, { fit: 'inside' })
    .toBuffer();
  const meta = await sharp(bookCover).metadata();
  const bw = meta.width || 430;
  const bh = meta.height || 640;
  const bookX = Math.round((width - bw) / 2);
  const bookY = 136 + Math.round((660 - bh) / 2);

  const posterSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${theme.bg1}" stop-opacity="0.88"/>
          <stop offset="55%" stop-color="${theme.bg2}" stop-opacity="0.78"/>
          <stop offset="100%" stop-color="${theme.bg2}" stop-opacity="0.96"/>
        </linearGradient>
        <radialGradient id="centerGlow" cx="50%" cy="48%" r="46%">
          <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.40"/>
          <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
        </radialGradient>
        <filter id="bookShadow" x="-15%" y="-15%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000000" flood-opacity="0.72"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#pBg)"/>
      <rect width="${width}" height="${height}" fill="url(#centerGlow)"/>
      <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="24" fill="none" stroke="${theme.accent}" stroke-opacity="0.48" stroke-width="2"/>
      <rect x="28" y="28" width="${width - 56}" height="${height - 56}" rx="18" fill="none" stroke="${theme.accent}" stroke-opacity="0.20" stroke-width="1"/>

      <!-- White border & gold rim around authentic book cover -->
      <rect x="${bookX - 8}" y="${bookY - 8}" width="${bw + 16}" height="${bh + 16}" rx="10" fill="#FFFFFF" stroke="${theme.accent}" stroke-width="2" filter="url(#bookShadow)"/>
    </svg>
  `);

  await sharp(bgBuf)
    .composite([
      { input: posterSvg, left: 0, top: 0 },
      { input: headerStrip, left: 50, top: 40 },
      { input: bookCover, left: bookX, top: bookY },
    ])
    .jpeg({ quality: 92, progressive: true })
    .toFile(path.join(OUT_DIR, outName));
}

/**
 * 5. Template Thumbnails (`960x600`, `.webp`)
 * Showcases the official NXB header banner + 3 authentic NXB book covers / event scene with zero SVG text
 */
async function createThumbnail({
  outName,
  bgFile,
  books,
  theme = { bg1: '#7F1D1D', bg2: '#1E0505', accent: '#FDE047' },
}) {
  const width = 960;
  const height = 600;

  const bgBuf = await sharp(path.join(RAW_DIR, bgFile))
    .resize(width, height, { fit: 'cover', position: 'center' })
    .blur(6)
    .modulate({ brightness: 0.62, saturation: 1.15 })
    .toBuffer();

  const headerStrip = await getHeaderStripBuffer(640, 78);
  const b1 = await sharp(path.join(RAW_DIR, books[0])).resize(210, 310, { fit: 'cover' }).toBuffer();
  const b2 = await sharp(path.join(RAW_DIR, books[1])).resize(250, 370, { fit: 'cover' }).toBuffer();
  const b3 = await sharp(path.join(RAW_DIR, books[2])).resize(210, 310, { fit: 'cover' }).toBuffer();

  const svg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${theme.bg1}" stop-opacity="0.84"/>
          <stop offset="55%" stop-color="${theme.bg2}" stop-opacity="0.76"/>
          <stop offset="100%" stop-color="${theme.bg1}" stop-opacity="0.88"/>
        </linearGradient>
        <radialGradient id="tGlow" cx="50%" cy="56%" r="45%">
          <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.36"/>
          <stop offset="100%" stop-color="${theme.accent}" stop-opacity="0"/>
        </radialGradient>
        <filter id="tShadow" x="-15%" y="-15%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000000" flood-opacity="0.68"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#tGrad)"/>
      <rect width="${width}" height="${height}" fill="url(#tGlow)"/>
      <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="22" fill="none" stroke="${theme.accent}" stroke-opacity="0.48" stroke-width="2"/>

      <!-- 3 Book Pedestals -->
      <rect x="94" y="194" width="222" height="322" rx="10" fill="#FFFFFF" filter="url(#tShadow)"/>
      <rect x="644" y="194" width="222" height="322" rx="10" fill="#FFFFFF" filter="url(#tShadow)"/>
      <rect x="348" y="158" width="264" height="384" rx="12" fill="#FFFFFF" stroke="${theme.accent}" stroke-width="3" filter="url(#tShadow)"/>
    </svg>
  `);

  await sharp(bgBuf)
    .composite([
      { input: svg, left: 0, top: 0 },
      { input: headerStrip, left: Math.round((width - 640) / 2), top: 42 },
      { input: b1, left: 100, top: 200 },
      { input: b3, left: 650, top: 200 },
      { input: b2, left: 355, top: 165 },
    ])
    .webp({ quality: 91 })
    .toFile(path.join(OUT_DIR, outName));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.rm(path.join(OUT_DIR, 'logo-solutionai.png'), { force: true });

  console.log('1. Creating official NXB Chính trị quốc gia Sự thật logo...');
  await createOfficialLogo();

  // Backgrounds are curated generated assets in public/nxb-templates/backgrounds.
  // Keep them separate from event photos and book/slider artwork.

  console.log('3. Creating Mẫu 1 (Văn hóa đọc & Không gian Sách NXB Sự Thật)...');
  const theme1 = { bg1: '#6B1212', bg2: '#270909', accent: '#FDE047' };
  await createLandscapeSlide({
    outName: 'van-hoa-doc-hero.jpg',
    mode: 'photo',
    bgFile: 'book_lich_su_nuoc_ta.jpg',
    position: 'bottom',
    theme: theme1,
  });
  await createLandscapeSlide({
    outName: 'van-hoa-doc-slide-2.jpg',
    mode: 'photo',
    bgFile: 'nxb_thuviencoso.jpg',
    theme: theme1,
  });
  await createLandscapeSlide({
    outName: 'van-hoa-doc-slide-3.jpg',
    mode: 'trio',
    bgFile: 'nxb_thuviencoso.jpg',
    books: ['book_viet_su.jpg', 'book_lich_su_nuoc_ta.jpg', 'book_huyen_thoai.jpg'],
    theme: theme1,
  });

  await createPortraitSlide({
    outName: 'van-hoa-doc-hero-portrait.jpg',
    mode: 'book',
    bgFile: 'book_lich_su_nuoc_ta.jpg',
    bookFile: 'book_lich_su_nuoc_ta.jpg',
    theme: theme1,
  });
  await createPortraitSlide({
    outName: 'van-hoa-doc-slide-2-portrait.jpg',
    mode: 'book',
    bgFile: 'nxb_thuviencoso.jpg',
    bookFile: 'book_viet_su.jpg',
    theme: theme1,
  });
  await createPortraitSlide({
    outName: 'van-hoa-doc-slide-3-portrait.jpg',
    mode: 'book',
    bgFile: 'book_lich_su_nuoc_ta.jpg',
    bookFile: 'book_huyen_thoai.jpg',
    theme: theme1,
  });

  console.log('4. Creating Mẫu 2 (Hệ sinh thái Xuất bản số Stbook.vn & Chuyển đổi số)...');
  const theme2 = { bg1: '#0F172A', bg2: '#1E3A8A', accent: '#38BDF8' };
  await createLandscapeSlide({
    outName: 'stbook-hero.jpg',
    mode: 'trio',
    bgFile: 'news_4.jpg',
    books: ['news_1.jpg', 'news_3.jpg', 'event_4.jpg'],
    theme: theme2,
  });
  await createLandscapeSlide({
    outName: 'stbook-slide-2.jpg',
    mode: 'photo',
    bgFile: 'news_4.jpg',
    theme: theme2,
  });
  await createLandscapeSlide({
    outName: 'stbook-slide-3.jpg',
    mode: 'photo',
    bgFile: 'event_hoithao.jpg',
    theme: theme2,
  });

  await createPortraitSlide({
    outName: 'stbook-hero-portrait.jpg',
    mode: 'book',
    bgFile: 'news_4.jpg',
    bookFile: 'news_3.jpg',
    theme: theme2,
  });
  await createPortraitSlide({
    outName: 'stbook-slide-2-portrait.jpg',
    mode: 'book',
    bgFile: 'news_4.jpg',
    bookFile: 'event_4.jpg',
    theme: theme2,
  });
  await createPortraitSlide({
    outName: 'stbook-slide-3-portrait.jpg',
    mode: 'book',
    bgFile: 'news_4.jpg',
    bookFile: 'news_1.jpg',
    theme: theme2,
  });

  console.log('5. Creating Mẫu 3 (Hội nghị, Hội thảo Khoa học Quốc gia & Ra mắt sách)...');
  const theme3 = { bg1: '#580D0D', bg2: '#17153B', accent: '#FBBF24' };
  await createLandscapeSlide({
    outName: 'hoi-nghi-hero.jpg',
    mode: 'photo',
    bgFile: 'event_hoithao.jpg',
    theme: theme3,
  });
  await createLandscapeSlide({
    outName: 'hoi-nghi-slide-2.jpg',
    mode: 'photo',
    bgFile: 'event_ramatsach.jpg',
    theme: theme3,
  });
  await createLandscapeSlide({
    outName: 'hoi-nghi-slide-3.jpg',
    mode: 'trio',
    bgFile: 'event_hoithao.jpg',
    books: ['book_chinh_phu.jpg', 'book_noi_chinh.jpg', 'news_1.jpg'],
    theme: theme3,
  });

  await createPortraitSlide({
    outName: 'hoi-nghi-hero-portrait.jpg',
    mode: 'photo',
    bgFile: 'event_hoithao.jpg',
    bookFile: 'news_3.jpg',
    theme: theme3,
  });
  await createPortraitSlide({
    outName: 'hoi-nghi-slide-2-portrait.jpg',
    mode: 'photo',
    bgFile: 'event_ramatsach.jpg',
    bookFile: 'book_chinh_phu.jpg',
    theme: theme3,
  });
  await createPortraitSlide({
    outName: 'hoi-nghi-slide-3-portrait.jpg',
    mode: 'book',
    bgFile: 'event_hoithao.jpg',
    bookFile: 'book_noi_chinh.jpg',
    theme: theme3,
  });

  console.log('6. Creating Mẫu 4 (Triển lãm Sách Kỷ niệm & Ngày Sách Việt Nam)...');
  const theme4 = { bg1: '#7C1919', bg2: '#3B1806', accent: '#FDE047' };
  await createLandscapeSlide({
    outName: 'trien-lam-hero.jpg',
    mode: 'photo',
    bgFile: 'banner_about.jpg',
    theme: theme4,
  });
  await createLandscapeSlide({
    outName: 'trien-lam-slide-2.jpg',
    mode: 'trio',
    bgFile: 'banner_about.jpg',
    books: ['book_thd.jpg', 'book_dbp.jpg', 'event_3.jpg'],
    theme: theme4,
  });
  await createLandscapeSlide({
    outName: 'trien-lam-slide-3.jpg',
    mode: 'photo',
    bgFile: 'nxb_tbt1.jpg',
    theme: theme4,
  });

  await createPortraitSlide({
    outName: 'trien-lam-hero-portrait.jpg',
    mode: 'book',
    bgFile: 'banner_about.jpg',
    bookFile: 'book_dbp.jpg',
    theme: theme4,
  });
  await createPortraitSlide({
    outName: 'trien-lam-slide-2-portrait.jpg',
    mode: 'book',
    bgFile: 'banner_about.jpg',
    bookFile: 'event_3.jpg',
    theme: theme4,
  });
  await createPortraitSlide({
    outName: 'trien-lam-slide-3-portrait.jpg',
    mode: 'book',
    bgFile: 'banner_about.jpg',
    bookFile: 'book_thd.jpg',
    theme: theme4,
  });

  console.log('7. Creating Mẫu 5 (Tủ sách Lý luận Chính trị, Tư tưởng Hồ Chí Minh & Xây dựng Đảng)...');
  const theme5 = { bg1: '#6D0B0B', bg2: '#230404', accent: '#FDE047' };
  await createLandscapeSlide({
    outName: 'ly-luan-hero.jpg',
    mode: 'trio',
    bgFile: 'nxb_tbt3.jpg',
    books: ['book_noi_chinh.jpg', 'book_hcm.jpg', 'book_chinh_phu.jpg'],
    theme: theme5,
  });
  await createLandscapeSlide({
    outName: 'ly-luan-slide-2.jpg',
    mode: 'photo',
    bgFile: 'nxb_tbt3.jpg',
    theme: theme5,
  });
  await createLandscapeSlide({
    outName: 'ly-luan-slide-3.jpg',
    mode: 'photo',
    bgFile: 'event_ramatsach.jpg',
    theme: theme5,
  });

  await createPortraitSlide({
    outName: 'ly-luan-hero-portrait.jpg',
    mode: 'book',
    bgFile: 'nxb_tbt3.jpg',
    bookFile: 'book_hcm.jpg',
    theme: theme5,
  });
  await createPortraitSlide({
    outName: 'ly-luan-slide-2-portrait.jpg',
    mode: 'book',
    bgFile: 'nxb_tbt3.jpg',
    bookFile: 'book_chinh_phu.jpg',
    theme: theme5,
  });
  await createPortraitSlide({
    outName: 'ly-luan-slide-3-portrait.jpg',
    mode: 'book',
    bgFile: 'nxb_tbt3.jpg',
    bookFile: 'book_noi_chinh.jpg',
    theme: theme5,
  });

  console.log('8. Creating 5 WebP Template Thumbnails...');
  await createThumbnail({
    outName: 'van-hoa-doc-thumb.webp',
    bgFile: 'nxb_thuviencoso.jpg',
    books: ['book_viet_su.jpg', 'book_lich_su_nuoc_ta.jpg', 'book_huyen_thoai.jpg'],
    theme: theme1,
  });
  await createThumbnail({
    outName: 'stbook-thumb.webp',
    bgFile: 'news_4.jpg',
    books: ['news_1.jpg', 'news_3.jpg', 'event_4.jpg'],
    theme: theme2,
  });
  await createThumbnail({
    outName: 'hoi-nghi-thumb.webp',
    bgFile: 'event_hoithao.jpg',
    books: ['book_chinh_phu.jpg', 'book_noi_chinh.jpg', 'news_1.jpg'],
    theme: theme3,
  });
  await createThumbnail({
    outName: 'trien-lam-thumb.webp',
    bgFile: 'banner_about.jpg',
    books: ['book_thd.jpg', 'book_dbp.jpg', 'event_3.jpg'],
    theme: theme4,
  });
  await createThumbnail({
    outName: 'ly-luan-thumb.webp',
    bgFile: 'nxb_tbt3.jpg',
    books: ['book_noi_chinh.jpg', 'book_hcm.jpg', 'book_chinh_phu.jpg'],
    theme: theme5,
  });

  console.log('✅ All 41 NXB Chính trị quốc gia Sự thật assets generated cleanly in public/nxb-templates!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
