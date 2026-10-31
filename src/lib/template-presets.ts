import {
  allNodes, clone, createDocument, createNode, createSection, DEVICE_KEYS,
  flowNode, GATE_SCREENS, screenSurface, uid,
  type DesignNode, type DesignSurface, type TemplateDocumentV2,
} from './template-document';

export interface TemplatePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
}

/** 5 Mẫu trang chào WiFi chuyên biệt cho Nhà xuất bản Chính trị quốc gia Sự thật */
export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'van-hoa-doc',
    name: 'Mẫu 1',
    category: 'Văn hóa đọc',
    description: 'Không gian Sách & Văn hóa Đọc Sự Thật: Tông giấy kem trang nhã, tích hợp Thông báo (Announcement) ưu đãi và slider ảnh dọc/ngang chuẩn thiết bị.',
    thumbnail: '/nxb-templates/van-hoa-doc-thumb.webp',
  },
  {
    id: 'xuat-ban-so',
    name: 'Mẫu 2',
    category: 'Xuất bản số',
    description: 'Nền tảng Sách điện tử Stbook.vn: Tông navy công nghệ hiện đại, tích hợp Video Gate (9:16) giới thiệu kho sách số và trải nghiệm đọc đa nền tảng.',
    thumbnail: '/nxb-templates/stbook-thumb.webp',
  },
  {
    id: 'hoi-nghi',
    name: 'Mẫu 3',
    category: 'Hội nghị - Tọa đàm',
    description: 'Hội nghị & Tọa đàm khoa học: Tông đỏ bordeaux sang trọng, tích hợp Điểm danh đại biểu (Attendance Gate) và tải kỷ yếu số tốc độ cao.',
    thumbnail: '/nxb-templates/hoi-nghi-thumb.webp',
  },
  {
    id: 'trien-lam',
    name: 'Mẫu 4',
    category: 'Triển lãm - Sự kiện',
    description: 'Ngày Sách & Triển lãm Sự Thật: Tông trắng đỏ trang trọng, tích hợp Thông báo (Announcement) nhận E-Voucher 20% và slider ảnh ngày hội sách.',
    thumbnail: '/nxb-templates/trien-lam-thumb.webp',
  },
  {
    id: 'ly-luan-chinh-tri',
    name: 'Mẫu 5',
    category: 'Nghiên cứu lý luận',
    description: 'Trung tâm Học liệu & Nghiên cứu Lý luận: Tông xanh rêu học thuật uy nghiêm, kết nối nhanh trực tiếp tra cứu tư liệu Đảng và sách kinh điển.',
    thumbnail: '/nxb-templates/ly-luan-thumb.webp',
  },
];

interface PresetStyle {
  background: string; ink: string; muted: string; accent: string; buttonInk: string;
  brand: string; heading: string; description: string; button: string; label: string;
  perks: string;
  images: string[]; imageAlt: string[]; announcement: string; announcementMessage: string;
}

const STYLES: Record<string, PresetStyle> = {
  'van-hoa-doc': {
    background: '#fdfbf7', ink: '#1c1917', muted: '#44403c', accent: '#b91c1c', buttonInk: '#ffffff',
    brand: 'NXB CHÍNH TRỊ QUỐC GIA SỰ THẬT', label: 'NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT · KHÔNG GIAN VĂN HÓA ĐỌC',
    heading: 'Lan tỏa tri thức cách mạng. Phụng sự bạn đọc muôn nơi.',
    description: 'Chào mừng bạn đến Không gian Văn hóa Đọc và Nhà sách Sự Thật. Hệ thống WiFi tốc độ cao sẵn sàng đồng hành cùng bạn trên hành trình khám phá tri thức lý luận và văn hóa.',
    perks: '✦ 10.000+ Tựa sách bản quyền  •  Không gian văn hóa đọc trang trọng  •  WiFi miễn phí không giới hạn',
    button: 'Kết nối WiFi & Khám phá Sách',
    images: ['van-hoa-doc-hero', 'van-hoa-doc-space', 'van-hoa-doc-books', 'van-hoa-doc-reading'],
    imageAlt: [
      'Khoảnh khắc cùng sách tại Nhà xuất bản Chính trị quốc gia Sự thật',
      'Không gian thư viện và trưng bày sách lý luận chính trị',
      'Bộ ấn phẩm sách kinh điển Chủ nghĩa Mác - Lênin và Tư tưởng Hồ Chí Minh',
      'Tác phẩm Lịch sử nước ta và văn hóa đọc',
    ],
    announcement: 'Chào mừng Quý bạn đọc đến Nhà sách Sự Thật',
    announcementMessage: 'Tặng Bookmark kỷ niệm và giảm 15% khi mua sách trực tiếp tại Nhà sách 24 Quang Trung và Phố Sách 19/12 Hà Nội hôm nay.',
  },
  'xuat-ban-so': {
    background: '#0b132b', ink: '#ffffff', muted: '#cbd5e1', accent: '#d97706', buttonInk: '#0b132b',
    brand: 'STBOOK.VN / NỀN TẢNG SỐ', label: 'HỆ THỐNG XUẤT BẢN & PHÁT HÀNH SÁCH ĐIỆN TỬ · STBOOK.VN',
    heading: 'Chuyển đổi số xuất bản. Đọc sách mọi lúc, mọi nơi.',
    description: 'Trải nghiệm nền tảng sách điện tử chính trị, pháp luật và tư tưởng lớn nhất Việt Nam. Kết nối WiFi để tải ứng dụng Stbook và truy cập kho sách số bản quyền.',
    perks: '✦ Kho sách điện tử đa nền tảng  •  Tủ sách Chi bộ điện tử  •  Đọc thử miễn phí hàng trăm ấn phẩm',
    button: 'Kết nối WiFi & Trải nghiệm Stbook',
    images: ['stbook-hero', 'stbook-app', 'stbook-digital', 'stbook-reader'],
    imageAlt: [
      'Nền tảng xuất bản và phát hành sách điện tử trực tuyến Stbook.vn',
      'Ứng dụng đọc sách Stbook trên điện thoại thông minh và máy tính bảng',
      'Tủ sách điện tử bảo vệ nền tảng tư tưởng của Đảng',
      'Trải nghiệm đọc sách lý luận chính trị trên thiết bị di động',
    ],
    announcement: 'Trải nghiệm Tủ sách điện tử Stbook.vn',
    announcementMessage: 'Quét mã QR để tải ứng dụng Stbook và nhận ngay 30 ngày đọc miễn phí bộ Tủ sách Chi bộ điện tử.',
  },
  'hoi-nghi': {
    background: '#450a0a', ink: '#ffffff', muted: '#fecaca', accent: '#fde047', buttonInk: '#450a0a',
    brand: 'HỘI NGHỊ KHOA HỌC / SỰ THẬT', label: 'HỘI TRƯỜNG TRUNG TÂM · NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT',
    heading: 'Đột phá lý luận. Kiến tạo giá trị thực tiễn.',
    description: 'Chào mừng Quý đại biểu tham dự Hội nghị Tọa đàm Khoa học. Quý đại biểu vui lòng kết nối WiFi để xác nhận điểm danh và tải kỷ yếu hội thảo bản điện tử.',
    perks: '✦ Điểm danh đại biểu thông minh  •  Tải kỷ yếu số tốc độ cao  •  Hạ tầng mạng hội trường bảo mật',
    button: 'Điểm danh Đại biểu & Kết nối',
    images: ['hoi-nghi-hero', 'hoi-nghi-discussion', 'hoi-nghi-delegates'],
    imageAlt: [
      'Đại hội trường hội nghị khoa học và lễ công bố ấn phẩm mới',
      'Phiên tọa đàm chuyên đề các nhà khoa học, chuyên gia lý luận',
      'Kỷ yếu và tài liệu hội thảo khoa học chính trị',
    ],
    announcement: 'Chào mừng Quý Đại biểu tham dự Hội nghị',
    announcementMessage: 'Phiên thảo luận trọng thể bắt đầu lúc 08:30 tại Hội trường tầng 3. Quý đại biểu kết nối WiFi để xem sơ đồ chỗ ngồi và nhận kỷ yếu điện tử.',
  },
  'trien-lam': {
    background: '#ffffff', ink: '#0f172a', muted: '#334155', accent: '#dc2626', buttonInk: '#ffffff',
    brand: 'TRIỂN LÃM SÁCH / NGÀY HỘI ĐỌC', label: 'HƯỞNG ỨNG NGÀY SÁCH & VĂN HÓA ĐỌC VIỆT NAM · NXB SỰ THẬT',
    heading: 'Tự hào trang sách Sự Thật. Tôn vinh văn hóa đọc.',
    description: 'Chào mừng Quý độc giả ghé thăm Không gian Triển lãm sách chuyên đề. Kết nối WiFi để nhận ngay Voucher ưu đãi 20% khi mua sách tại các gian hàng.',
    perks: '✦ Tặng E-Voucher giảm 20%  •  Giao lưu cùng tác giả & học giả  •  Tặng ấn phẩm đặc biệt',
    button: 'Kết nối WiFi & Nhận Ưu đãi',
    images: ['trien-lam-hero', 'trien-lam-event', 'trien-lam-books'],
    imageAlt: [
      'Không gian trưng bày triển lãm sách Nhà xuất bản Chính trị quốc gia Sự thật',
      'Ngày hội sách và văn hóa đọc thu hút đông đảo bạn đọc trẻ',
      'Gian hàng giới thiệu các bộ sách quý và tài liệu lịch sử đặc sắc',
    ],
    announcement: 'Đặc quyền bạn đọc tại Triển lãm',
    announcementMessage: 'Nhận ngay Voucher giảm giá 20% áp dụng cho toàn bộ đầu sách tại gian hàng Nhà xuất bản Chính trị quốc gia Sự thật hôm nay.',
  },
  'ly-luan-chinh-tri': {
    background: '#0f241a', ink: '#f8fafc', muted: '#bbf7d0', accent: '#f59e0b', buttonInk: '#0f241a',
    brand: 'TRUNG TÂM HỌC LIỆU / LÝ LUẬN CHÍNH TRỊ', label: 'TRUNG TÂM TƯ LIỆU & HỌC LIỆU LÝ LUẬN CHÍNH TRỊ · NXB SỰ THẬT',
    heading: 'Chuẩn mực tư liệu. Vững vàng nền tảng tư tưởng.',
    description: 'Hệ thống cơ sở dữ liệu tra cứu các bộ sách kinh điển, Văn kiện Đảng và Tư tưởng Hồ Chí Minh dành cho cán bộ nghiên cứu, giảng viên và học viên.',
    perks: '✦ Bộ sách Hồ Chí Minh toàn tập  •  Bộ sách Văn kiện Đảng toàn tập  •  Tủ sách Bảo vệ nền tảng tư tưởng',
    button: 'Kết nối & Tra cứu Học liệu',
    images: ['ly-luan-hero', 'ly-luan-dangvien', 'ly-luan-database'],
    imageAlt: [
      'Các công trình nghiên cứu Tư tưởng Hồ Chí Minh kinh điển',
      'Sổ tay Đảng viên và tủ sách Chi bộ cơ sở chuẩn mực',
      'Cơ sở dữ liệu học liệu lý luận chính trị và pháp luật',
    ],
    announcement: 'Tra cứu Dữ liệu Lý luận Chính trị',
    announcementMessage: 'Cán bộ, giảng viên và học viên kết nối WiFi để truy cập miễn phí cơ sở dữ liệu số Văn kiện Đảng và toàn văn tư liệu nghiên cứu.',
  },
};

const asset = (name: string, isMobile = false) => `/nxb-templates/${name}${isMobile ? '-portrait' : ''}.jpg`;
const LOGO_URL = 'https://solutionai.com.vn/_next/image?url=%2Flogo.png&w=48&q=75';

function textNode(type: 'title' | 'description', content: string, color: string, size: number, width: number, explicitHeight?: number): DesignNode {
  const node = createNode(type);
  Object.assign(node.element, { content, color, fontSize: `${size}px`, align: 'center', textShadow: 'none' });
  node.layout.width = width;
  node.layout.height = explicitHeight !== undefined ? explicitHeight : type === 'title' ? Math.round(size * 2.4) : Math.round(size * 3.8);
  return node;
}

function brandNode(width: number): DesignNode {
  const node = createNode('logo');
  Object.assign(node.element, {
    src: LOGO_URL,
    width: '64px',
    position: 'center',
  });
  node.layout.width = width;
  node.layout.height = 54;
  node.name = 'Logo SolutionAI';
  return node;
}

function imageNode(style: PresetStyle, width: number, height: number, isMobile = false): DesignNode {
  const node = createNode(style.images.length > 1 ? 'image_slider' : 'image');
  if (node.element.type === 'image_slider') {
    Object.assign(node.element, {
      images: style.images.map((name, i) => ({ src: asset(name, isMobile), alt: style.imageAlt[i] })),
      imagesDesktop: style.images.map((name, i) => ({ src: asset(name, false), alt: style.imageAlt[i] })),
      autoplay: true,
      interval: 4,
      objectFit: 'cover',
      borderRadius: '12px',
      shadow: 'md',
      height: `${height}px`,
      heightDesktop: '320px',
    });
  } else {
    Object.assign(node.element, {
      src: asset(style.images[0], isMobile),
      srcDesktop: asset(style.images[0], false),
      alt: style.imageAlt[0],
      objectFit: 'cover',
      borderRadius: '12px',
      shadow: 'md',
    });
  }
  node.layout.width = width;
  node.layout.height = height;
  return node;
}

function surfaceStyle(surface: DesignSurface, style: PresetStyle) {
  Object.assign(surface.background, { color: style.background, overlayOpacity: 0, overlayColor: '#000000', padding: '0px' });
  surface.backgroundMedia = {};
}

function buildPreset(id: string): TemplateDocumentV2 {
  const style = STYLES[id];
  if (!style) throw new Error(`Mẫu khởi đầu không tồn tại: ${id}`);
  const document = createDocument();
  document.brandColors = [style.accent, style.ink, style.background, style.muted, style.buttonInk];

  for (const device of DEVICE_KEYS) {
    const isMobile = device === 'mobile';
    const variant = document.variants[device];
    const width = device === 'desktop' ? 560 : device === 'tablet' ? 480 : 342;
    // Mobile gets a vertical portrait proportion (380px height for 342px width) to display vertical photos without harsh crop
    const mediaHeight = device === 'desktop' ? 320 : device === 'tablet' ? 270 : 380;
    surfaceStyle(variant, style);

    const section = createSection(variant.viewport);
    section.name = style.brand;
    section.padding = isMobile ? 20 : 32;
    section.gap = 16;

    const button = createNode('connect_button');
    Object.assign(button.element, {
      text: style.button,
      color: style.buttonInk,
      bgColor: style.accent,
      radius: '12px',
      buttonStyle: 'solid',
      buttonEffect: 'none',
      buttonIcon: 'arrow',
      shadow: 'md',
      termsText: '',
      requireConfirm: false,
    });
    button.layout.width = width;
    button.layout.height = 54;

    section.nodes = [
      brandNode(width),
      textNode('description', style.label, style.muted, isMobile ? 11 : 12, width, 26),
      imageNode(style, width, mediaHeight, isMobile),
      textNode('title', style.heading, style.ink, isMobile ? 24 : device === 'tablet' ? 30 : 34, width, isMobile ? 64 : 80),
      textNode('description', style.description, style.muted, isMobile ? 13 : 14, width, isMobile ? 64 : 60),
      textNode('description', style.perks, style.accent, isMobile ? 12 : 13, width, isMobile ? 42 : 38),
      button,
      textNode('description', '✓ WiFi tốc độ cao  ·  Bảo mật riêng tư  ·  Tự động duy trì phiên kết nối', style.muted, 11, width, 24),
    ];
    variant.sections = [section];

    for (const screen of GATE_SCREENS) {
      const controller = flowNode(variant, screen)!;

      // Rich diversity of gate defaults:
      // - van-hoa-doc: announcement gate enabled by default (thông báo không gian văn hóa đọc & voucher)
      // - xuat-ban-so: video_gate enabled by default (video giới thiệu nền tảng số Stbook)
      // - hoi-nghi: attendance_gate enabled by default (điểm danh đại biểu tham dự)
      // - trien-lam: announcement gate enabled by default (thông báo nhận ưu đãi triển lãm sách)
      // - ly-luan-chinh-tri: fast direct connect (tất cả các cổng phụ để người dùng tùy chọn bật)
      let isGateEnabled = false;
      if (id === 'van-hoa-doc' && screen === 'announcement') isGateEnabled = true;
      else if (id === 'xuat-ban-so' && screen === 'video_gate') isGateEnabled = true;
      else if (id === 'hoi-nghi' && screen === 'attendance_gate') isGateEnabled = true;
      else if (id === 'trien-lam' && screen === 'announcement') isGateEnabled = true;

      controller.element.enabled = isGateEnabled;
      controller.hidden = false;

      const isPortraitVideo = id === 'xuat-ban-so';
      const isDark = style.background === '#0b132b' || style.background === '#450a0a' || style.background === '#0f241a';

      if (controller.element.type === 'video_gate') {
        Object.assign(controller.element, {
          videoUrl: isPortraitVideo ? '/nxb-templates/video-nxb-portrait.mp4' : '/nxb-templates/video-nxb-landscape.mp4',
          poster: asset(style.images[0], isMobile),
          aspectRatio: isPortraitVideo ? '9:16' : '16:9',
          skipAfter: 5,
          dialogTitle: id === 'xuat-ban-so' ? 'Khám phá Hệ thống Sách điện tử Stbook.vn' : `Chào mừng Quý khách đến ${style.brand.split('/')[0].trim()}`,
          dialogMessage: 'Theo dõi video giới thiệu ngắn để nhận quyền truy cập Internet tốc độ cao.',
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '12px',
          shadow: 'md',
          muted: true,
          frameWidth: '100%',
        });
      } else if (controller.element.type === 'attendance_gate') {
        Object.assign(controller.element, {
          dialogTitle: id === 'hoi-nghi' ? 'Điểm danh đại biểu Hội nghị' : 'Điểm danh cuộc họp & Check-in WiFi',
          dialogMessage: 'Vui lòng xác nhận thông tin cá nhân và cơ quan công tác để cấp quyền truy cập Internet.',
          nameLabel: 'Họ và tên đại biểu',
          namePlaceholder: 'Nhập họ và tên đầy đủ của bạn',
          departmentLabel: 'Cơ quan / Đơn vị công tác',
          departmentPlaceholder: 'Nhập tên cơ quan hoặc ban ngành',
          buttonText: 'Xác nhận tham dự & Kết nối',
          buttonBgColor: style.accent,
          buttonTextColor: style.buttonInk,
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '12px',
          shadow: 'md',
        });
      } else if (controller.element.type === 'announcement') {
        Object.assign(controller.element, {
          title: style.announcement,
          message: style.announcementMessage,
          imageUrl: asset(style.images[0], isMobile),
          bgColor: style.background,
          titleColor: style.ink,
          messageColor: style.muted,
          buttonBgColor: style.accent,
          buttonTextColor: style.buttonInk,
          buttonText: 'Tôi đã hiểu · Tiếp tục',
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '12px',
          shadow: 'md',
        });
      }

      const surface = screenSurface(variant, screen);
      surfaceStyle(surface, style);
      const gateSection = surface.sections[0];
      gateSection.padding = isMobile ? 20 : 32;
      gateSection.gap = 16;

      const core = gateSection.nodes.find(n => n.element.type === 'flow_content')!;
      core.layout.width = width;
      core.layout.height = screen === 'video_gate' ? (isPortraitVideo ? 620 : 420) : screen === 'attendance_gate' ? 420 : 480;

      gateSection.nodes = [
        brandNode(width),
        textNode('description', style.label, style.muted, 11, width, 26),
        core,
        textNode('description', '🔒 WiFi tốc độ cao miễn phí · Kết nối an tâm', style.muted, 11, width, 24),
      ];
    }
  }

  return document;
}


const masterDocuments = new Map<string, TemplateDocumentV2>();
/** Clone every selection and regenerate section/node IDs, including flow controllers. */
export function createPresetDocument(id: string): TemplateDocumentV2 {
  if (!TEMPLATE_PRESETS.some(p => p.id === id)) throw new Error(`Mẫu khởi đầu không tồn tại: ${id}`);
  if (!masterDocuments.has(id)) masterDocuments.set(id, buildPreset(id));
  const document = clone(masterDocuments.get(id)!);
  for (const device of DEVICE_KEYS) {
    const variant = document.variants[device];
    for (const node of allNodes(variant)) { node.id = uid(); node.element.id = node.id; }
    for (const surface of [variant, ...GATE_SCREENS.map(screen => screenSurface(variant, screen))]) {
      for (const section of surface.sections) section.id = uid();
    }
  }
  return document;
}
