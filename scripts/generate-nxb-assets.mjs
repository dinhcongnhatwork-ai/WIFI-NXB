import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE_DIR = '/tmp/nxb_assets';
const TARGET_DIR = '/tmp/nxb_output';
fs.mkdirSync(TARGET_DIR, { recursive: true });

async function resizeCrop(srcPath, destName, width, height) {
  const destPath = path.join(TARGET_DIR, destName);
  await sharp(srcPath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 88, progressive: true })
    .toFile(destPath);
  console.log(`Generated: ${destName} (${width}x${height})`);
}

async function generateThumbnail({ destName, bgImage, title, subtitle, category, badgeColor, badgeBg, accentColor, darkTheme }) {
  const destPath = path.join(TARGET_DIR, destName);
  const W = 800;
  const H = 600;

  // Create base resized image
  const baseBuffer = await sharp(bgImage)
    .resize(W, H, { fit: 'cover', position: 'center' })
    .toBuffer();

  const textColor = darkTheme ? '#ffffff' : '#0f172a';
  const descColor = darkTheme ? '#cbd5e1' : '#334155';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const overlaySvg = Buffer.from(`
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="overlayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${darkTheme ? '#0b132b' : '#000000'}" stop-opacity="0.25"/>
          <stop offset="45%" stop-color="${darkTheme ? '#0b132b' : '#000000'}" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="${darkTheme ? '#050814' : '#0f172a'}" stop-opacity="0.92"/>
        </linearGradient>
        <filter id="cardGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>

      <!-- Gradient scrim -->
      <rect width="${W}" height="${H}" fill="url(#overlayGrad)"/>

      <!-- Top decorative bar -->
      <rect x="0" y="0" width="${W}" height="6" fill="${accentColor}"/>

      <!-- Category Pill Badge -->
      <g transform="translate(36, 36)">
        <rect width="180" height="34" rx="17" fill="${badgeBg}"/>
        <text x="90" y="22" font-family="sans-serif" font-size="12" font-weight="700" fill="${badgeColor}" text-anchor="middle" letter-spacing="0.5">${esc(category.toUpperCase())}</text>
      </g>

      <!-- Brand Seal -->
      <g transform="translate(${W - 220}, 36)">
        <rect width="184" height="34" rx="8" fill="rgba(255,255,255,0.2)"/>
        <text x="92" y="22" font-family="sans-serif" font-size="11" font-weight="600" fill="#ffffff" text-anchor="middle">NXB SỰ THẬT</text>
      </g>

      <!-- Bottom Card Info -->
      <g transform="translate(36, ${H - 160})" filter="url(#cardGlow)">
        <text x="0" y="40" font-family="sans-serif" font-size="30" font-weight="800" fill="#ffffff">${esc(title)}</text>
        <text x="0" y="74" font-family="sans-serif" font-size="15" font-weight="500" fill="#f1f5f9">${esc(subtitle)}</text>
        <rect x="0" y="96" width="130" height="3" fill="${accentColor}" rx="1.5"/>
        <text x="146" y="100" font-family="sans-serif" font-size="12" font-weight="600" fill="${accentColor}">✦ TRANG CHÀO WIFI SẴN SÀNG KẾT NỐI</text>
      </g>
    </svg>
  `);

  await sharp(baseBuffer)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .webp({ quality: 90 })
    .toFile(destPath);

  console.log(`Generated thumbnail: ${destName}`);
}

async function main() {
  console.log('Processing NXB Sự Thật assets...');

  // Template 1: Văn hóa đọc
  await resizeCrop(path.join(SOURCE_DIR, 'khoanh_khac_cung_sach.jpg'), 'van-hoa-doc-hero.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'thuviencoso.jpg'), 'van-hoa-doc-space.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'banner_chinh.png'), 'van-hoa-doc-books.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'lich_su_nuoc_ta.jpg'), 'van-hoa-doc-reading.jpg', 960, 540);
  await generateThumbnail({
    destName: 'van-hoa-doc-thumb.webp',
    bgImage: path.join(SOURCE_DIR, 'khoanh_khac_cung_sach.jpg'),
    title: 'Mẫu 1 · Không Gian Văn Hóa Đọc',
    subtitle: 'Nhà sách Sự Thật · Lan tỏa tri thức cách mạng · WiFi Gigabit',
    category: 'Văn hóa đọc',
    badgeBg: '#b91c1c',
    badgeColor: '#ffffff',
    accentColor: '#f59e0b',
    darkTheme: false,
  });

  // Template 2: Xuất bản số Stbook
  await resizeCrop(path.join(SOURCE_DIR, 'stbook_banner1.jpg'), 'stbook-hero.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'stbook_banner2.jpg'), 'stbook-app.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'stbook_banner3.jpg'), 'stbook-digital.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'stbook_banner4.jpg'), 'stbook-reader.jpg', 960, 540);
  await generateThumbnail({
    destName: 'stbook-thumb.webp',
    bgImage: path.join(SOURCE_DIR, 'stbook_banner1.jpg'),
    title: 'Mẫu 2 · Sách Điện Tử STBOOK.VN',
    subtitle: 'Nền tảng xuất bản số · Tủ sách Chi bộ điện tử · Kho sách bản quyền',
    category: 'Xuất bản số',
    badgeBg: '#1e3a8a',
    badgeColor: '#93c5fd',
    accentColor: '#38bdf8',
    darkTheme: true,
  });

  // Template 3: Hội nghị - Tọa đàm
  await resizeCrop(path.join(SOURCE_DIR, 'hoi_nghi_4.jpg'), 'hoi-nghi-hero.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'hoi_nghi_15.jpg'), 'hoi-nghi-discussion.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'dien_bien_phu.jpg'), 'hoi-nghi-delegates.jpg', 960, 540);
  await generateThumbnail({
    destName: 'hoi-nghi-thumb.webp',
    bgImage: path.join(SOURCE_DIR, 'hoi_nghi_4.jpg'),
    title: 'Mẫu 3 · Hội Nghị & Tọa Đàm Khoa Học',
    subtitle: 'Điểm danh đại biểu thông minh · Kỷ yếu số · Hội trường trung tâm',
    category: 'Hội nghị - Tọa đàm',
    badgeBg: '#991b1b',
    badgeColor: '#fef08a',
    accentColor: '#fde047',
    darkTheme: true,
  });

  // Template 4: Triển lãm & Ngày sách
  await resizeCrop(path.join(SOURCE_DIR, 'trien_lam_1.jpg'), 'trien-lam-hero.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'khoanh_khac_cung_sach.jpg'), 'trien-lam-event.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'stbook_banner5.jpg'), 'trien-lam-books.jpg', 960, 540);
  await generateThumbnail({
    destName: 'trien-lam-thumb.webp',
    bgImage: path.join(SOURCE_DIR, 'trien_lam_1.jpg'),
    title: 'Mẫu 4 · Triển Lãm & Ngày Sách Việt Nam',
    subtitle: 'Tự hào trang sách Sự Thật · Tặng Voucher 20% · Không gian phố sách',
    category: 'Triển lãm - Sự kiện',
    badgeBg: '#dc2626',
    badgeColor: '#ffffff',
    accentColor: '#dc2626',
    darkTheme: false,
  });

  // Template 5: Nghiên cứu lý luận
  await resizeCrop(path.join(SOURCE_DIR, 'ho_chi_minh.jpg'), 'ly-luan-hero.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'so_tay_dang_vien.jpg'), 'ly-luan-dangvien.jpg', 960, 540);
  await resizeCrop(path.join(SOURCE_DIR, 'banner_chinh.png'), 'ly-luan-database.jpg', 960, 540);
  await generateThumbnail({
    destName: 'ly-luan-thumb.webp',
    bgImage: path.join(SOURCE_DIR, 'ho_chi_minh.jpg'),
    title: 'Mẫu 5 · Nghiên Cứu Lý Luận & Tư Tưởng',
    subtitle: 'Tủ sách bảo vệ nền tảng tư tưởng · Hồ Chí Minh toàn tập · Văn kiện Đảng',
    category: 'Nghiên cứu lý luận',
    badgeBg: '#14532d',
    badgeColor: '#86efac',
    accentColor: '#f59e0b',
    darkTheme: true,
  });

  // Copy videos
  fs.copyFileSync(path.join(SOURCE_DIR, 'video_12.mp4'), path.join(TARGET_DIR, 'video-nxb-landscape.mp4'));
  fs.copyFileSync(path.join(SOURCE_DIR, 'video_26.mp4'), path.join(TARGET_DIR, 'video-nxb-portrait.mp4'));
  console.log('Copied videos: video-nxb-landscape.mp4, video-nxb-portrait.mp4');

  console.log('All assets processed successfully in /tmp/nxb_output');
}

main().catch(err => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
