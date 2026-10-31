import {
  allNodes, clone, createDocument, createNode, createSection, DEVICE_KEYS,
  flowNode, GATE_SCREENS, mediaRef, screenSurface, setNodeMedia, uid,
  type DesignNode, type DesignSurface, type TemplateDocumentV2,
} from './template-document';
import { presetBackground } from './preset-backgrounds';

export interface TemplatePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail: string;
}

/** 5 Mẫu trang chào WiFi chuyên biệt chuẩn thương hiệu Nhà xuất bản Chính trị quốc gia Sự thật */
export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    id: 'van-hoa-doc',
    name: 'Mẫu 1',
    category: 'Văn hóa đọc',
    description: 'Nền giấy ấm, tiêu đề biên tập và ấn phẩm lịch sử, văn hóa. Có thông báo giới thiệu không gian đọc.',
    thumbnail: '/nxb-templates/van-hoa-doc-redesign.webp',
  },
  {
    id: 'xuat-ban-so',
    name: 'Mẫu 2',
    category: 'Xuất bản số',
    description: 'Navy và xanh ngọc, giới thiệu sách điện tử. Tích hợp video dọc cho hệ sinh thái xuất bản số.',
    thumbnail: '/nxb-templates/xuat-ban-so-redesign.webp',
  },
  {
    id: 'hoi-nghi',
    name: 'Mẫu 3',
    category: 'Hội nghị - Tọa đàm',
    description: 'Đỏ trầm trang trọng, nội dung sáng rõ. Tích hợp màn hình xác nhận tham dự dành cho đại biểu.',
    thumbnail: '/nxb-templates/hoi-nghi-redesign.webp',
  },
  {
    id: 'trien-lam',
    name: 'Mẫu 4',
    category: 'Triển lãm - Sự kiện',
    description: 'Không gian triển lãm sáng, ảnh tác phẩm và thông điệp ngắn. Có màn hình giới thiệu hoạt động.',
    thumbnail: '/nxb-templates/trien-lam-redesign.webp',
  },
  {
    id: 'ly-luan-chinh-tri',
    name: 'Mẫu 5',
    category: 'Nghiên cứu lý luận',
    description: 'Xanh rừng và bề mặt giấy sáng, dành cho tư liệu lý luận chính trị. Kết nối trực tiếp, tập trung vào nội dung.',
    thumbnail: '/nxb-templates/ly-luan-chinh-tri-redesign.webp',
  },
];

interface SlideMeta {
  key: string;
  alt: string;
  badge: string;
  title: string;
  subtitle: string;
}

interface PresetStyle {
  background: string;
  bgImage: string;
  overlayColor: string;
  overlayOpacity: number;
  pattern: 'none' | 'dots' | 'grid';
  cardBg: string;
  cardOpacity: number;
  cardBorder: string;
  ink: string;
  muted: string;
  accent: string;
  pillBg: string;
  pillInk: string;
  buttonInk: string;
  buttonGradient: { from: string; to: string; angle: number };
  headingFont: string;
  brand: string;
  label: string;
  heading: string;
  description: string;
  perks: string;
  button: string;
  slides: SlideMeta[];
  announcement: string;
  announcementMessage: string;
}

const STYLES: Record<string, PresetStyle> = {
  'van-hoa-doc': {
    background: '#e8dfcc',
    bgImage: '/nxb-templates/van-hoa-doc-bg.jpg',
    overlayColor: '#655c48',
    overlayOpacity: 0.12,
    pattern: 'dots',
    cardBg: '#fffcf7',
    cardOpacity: 0.95,
    cardBorder: '#f59e0b',
    ink: '#1c1917',
    muted: '#44403c',
    accent: '#991b1b',
    pillBg: '#fef3c7',
    pillInk: '#991b1b',
    buttonInk: '#ffffff',
    buttonGradient: { from: '#b91c1c', to: '#7f1d1d', angle: 135 },
    headingFont: 'Playfair Display',
    brand: 'NXB CHÍNH TRỊ QUỐC GIA SỰ THẬT',
    label: 'NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT · KHÔNG GIAN VĂN HÓA ĐỌC',
    heading: 'Lan tỏa tri thức cách mạng, bồi đắp văn hóa đọc Việt Nam.',
    description: 'Chào mừng Quý độc giả đến Không gian Sách & Văn hóa Đọc của Nhà xuất bản Chính trị quốc gia Sự thật. Kết nối WiFi tốc độ cao để tra cứu danh mục ấn phẩm mới và đọc sách trực tuyến.',
    perks: '✦ Tác phẩm Lịch sử nước ta  •  Tủ sách Xã - Phường - Thị trấn  •  WiFi tốc độ cao miễn phí',
    button: 'Kết nối WiFi & Khám phá Tủ sách Sự Thật',
    slides: [
      {
        key: 'van-hoa-doc-hero',
        alt: 'Tác phẩm Hồ Chí Minh - Lịch sử nước ta của Nhà xuất bản Chính trị quốc gia Sự thật',
        badge: 'ẤN PHẨM DI SẢN',
        title: 'Hồ Chí Minh — Lịch sử nước ta',
        subtitle: 'Tác phẩm khơi dậy tinh thần yêu nước và niềm tự hào lịch sử dân tộc Việt Nam',
      },
      {
        key: 'van-hoa-doc-slide-2',
        alt: 'Không gian Thư viện cơ sở và Tủ sách Xã, Phường, Thị trấn NXB Sự Thật',
        badge: 'THƯ VIỆN CƠ SỞ',
        title: 'Tủ sách Xã · Phường · Thị trấn',
        subtitle: 'Đưa sách lý luận, pháp luật và tri thức thiết thực đến tận cơ sở và cộng đồng',
      },
      {
        key: 'van-hoa-doc-slide-3',
        alt: 'Ấn phẩm Việt sử giai thoại và Huyền thoại đường Hồ Chí Minh trên biển',
        badge: 'LỊCH SỬ & VĂN HÓA',
        title: 'Việt Sử Giai Thoại & Truyền thống Cách mạng',
        subtitle: 'Những trang sử hào hùng của dân tộc qua ấn phẩm chính thống NXB Sự Thật',
      },
    ],
    announcement: 'Chào mừng Quý bạn đọc đến Không gian Sách Sự Thật',
    announcementMessage: 'Ưu đãi giảm 15% và tặng Bookmark kỷ niệm khi mua các ấn phẩm Lịch sử - Văn hóa tại Trung tâm Phát hành sách 24 Quang Trung và Phố Sách 19/12 Hà Nội.',
  },
  'xuat-ban-so': {
    background: '#09152b',
    bgImage: '/nxb-templates/xuat-ban-so-bg.jpg',
    overlayColor: '#09152b',
    overlayOpacity: 0.18,
    pattern: 'none',
    cardBg: '#0f172a',
    cardOpacity: 0.88,
    cardBorder: '#38bdf8',
    ink: '#f8fafc',
    muted: '#cbd5e1',
    accent: '#38bdf8',
    pillBg: '#991b1b',
    pillInk: '#fde047',
    buttonInk: '#09152b',
    buttonGradient: { from: '#fde047', to: '#f59e0b', angle: 135 },
    headingFont: 'Montserrat',
    brand: 'STBOOK.VN · HỆ SINH THÁI XUẤT BẢN SỐ',
    label: 'TRUNG TÂM XUẤT BẢN & PHÁT HÀNH SÁCH ĐIỆN TỬ · STBOOK.VN',
    heading: 'Chuyển đổi số xuất bản. Kho sách chính thống trên mọi thiết bị.',
    description: 'Trải nghiệm hệ sinh thái sách điện tử Stbook.vn với hàng nghìn ấn phẩm chuyên khảo về kinh tế số, chuyển đổi xanh, pháp luật và quản trị quốc gia hiện đại.',
    perks: '✦ Sách chuyên khảo Kinh tế số & Sandbox  •  Tủ sách Chi bộ điện tử  •  Đọc đa nền tảng 24/7',
    button: 'Kết nối WiFi & Truy cập Stbook.vn',
    slides: [
      {
        key: 'stbook-hero',
        alt: 'Sách chuyên khảo Xây dựng khung thể chế thử nghiệm có kiểm soát Sandbox ở Việt Nam',
        badge: 'SÁCH CHUYÊN KHẢO MỚI',
        title: 'Khung thể chế thử nghiệm (Sandbox) ở Việt Nam',
        subtitle: 'Ấn phẩm chuyên khảo phục vụ đổi mới sáng tạo và chuyển đổi số quốc gia',
      },
      {
        key: 'stbook-slide-2',
        alt: 'Sách chuyên khảo Thị trường Các-bon tại Việt Nam trên Stbook.vn',
        badge: 'CHUYỂN ĐỔI XANH',
        title: 'Thị trường Các-bon tại Việt Nam',
        subtitle: 'Phát hành đồng bộ bản in và bản điện tử trên nền tảng số Stbook.vn',
      },
      {
        key: 'stbook-slide-3',
        alt: 'Hội nghị chuyển đổi số và ứng dụng AI trong công tác xuất bản tại NXB Sự Thật',
        badge: 'CHUYỂN ĐỔI SỐ NXB',
        title: 'Tiên phong Xuất bản số & Ứng dụng Công nghệ số',
        subtitle: 'Hiện đại hóa quy trình biên tập, xuất bản và lan tỏa sách lý luận trên không gian mạng',
      },
    ],
    announcement: 'Trải nghiệm Hệ sinh thái Sách điện tử Stbook.vn',
    announcementMessage: 'Truy cập https://stbook.vn để đọc trực tuyến các Tủ sách Điện tử chuyên đề và nhận 30 ngày trải nghiệm miễn phí Tủ sách Chi bộ điện tử.',
  },
  'hoi-nghi': {
    background: '#3b0707',
    bgImage: '/nxb-templates/hoi-nghi-bg.jpg',
    overlayColor: '#2a0505',
    overlayOpacity: 0.64,
    pattern: 'dots',
    cardBg: '#450a0a',
    cardOpacity: 0.90,
    cardBorder: '#fbbf24',
    ink: '#ffffff',
    muted: '#fde68a',
    accent: '#fde047',
    pillBg: '#7f1d1d',
    pillInk: '#fde047',
    buttonInk: '#450a0a',
    buttonGradient: { from: '#fde047', to: '#f59e0b', angle: 135 },
    headingFont: 'Playfair Display',
    brand: 'HỘI THẢO KHOA HỌC QUỐC GIA · NXB SỰ THẬT',
    label: 'HỘI TRƯỜNG TRUNG TÂM · NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT',
    heading: 'Diễn đàn học thuật uy tín. Kết nối lý luận với thực tiễn phát triển.',
    description: 'Chào mừng Quý đại biểu, các nhà khoa học và chuyên gia tham dự Hội thảo Khoa học Quốc gia & Lễ giới thiệu sách mới. Vui lòng kết nối WiFi để điểm danh đại biểu và nhận tài liệu hội thảo số.',
    perks: '✦ Điểm danh đại biểu trực tuyến  •  Tải kỷ yếu hội thảo PDF  •  Giới thiệu ấn phẩm lý luận mới',
    button: 'Điểm danh Đại biểu & Kết nối WiFi',
    slides: [
      {
        key: 'hoi-nghi-hero',
        alt: 'Hội thảo khoa học quốc gia Pháp luật kinh tế Việt Nam trong kỷ nguyên số và chuyển đổi xanh',
        badge: 'HỘI THẢO QUỐC GIA',
        title: 'Hội thảo Khoa học Quốc gia tại NXB Sự Thật',
        subtitle: 'Quy tụ các chuyên gia, nhà khoa học đầu ngành bàn về thể chế kỷ nguyên số và chuyển đổi xanh',
      },
      {
        key: 'hoi-nghi-slide-2',
        alt: 'Lễ giới thiệu cuốn sách Kiên định chủ nghĩa Mác - Lênin, tư tưởng Hồ Chí Minh',
        badge: 'LỄ GIỚI THIỆU SÁCH',
        title: 'Ra mắt các Ấn phẩm Lý luận Chính trị Trọng điểm',
        subtitle: 'Công bố và lan tỏa các công trình nghiên cứu lý luận, tổng kết thực tiễn có giá trị cao',
      },
      {
        key: 'hoi-nghi-slide-3',
        alt: 'Ấn phẩm Phát huy truyền thống 60 năm ngành Nội chính Đảng (1966 - 2026)',
        badge: 'ẤN PHẨM KỶ NIỆM',
        title: 'Phát huy truyền thống 60 năm ngành Nội chính Đảng',
        subtitle: 'Tài liệu nghiên cứu chính thống phục vụ đại biểu và các cơ quan, ban ngành Trung ương - Địa phương',
      },
    ],
    announcement: 'Chào mừng Quý Đại biểu tham dự Hội nghị & Lễ ra mắt sách',
    announcementMessage: 'Quý đại biểu vui lòng xác nhận thông tin điểm danh để tải trọn bộ Kỷ yếu Hội thảo Khoa học Quốc gia và danh mục sách mới phát hành.',
  },
  'trien-lam': {
    background: '#e9decc',
    bgImage: '/nxb-templates/trien-lam-bg.jpg',
    overlayColor: '#807059',
    overlayOpacity: 0.12,
    pattern: 'dots',
    cardBg: '#fffdf9',
    cardOpacity: 0.96,
    cardBorder: '#dc2626',
    ink: '#1e293b',
    muted: '#475569',
    accent: '#b91c1c',
    pillBg: '#fee2e2',
    pillInk: '#991b1b',
    buttonInk: '#ffffff',
    buttonGradient: { from: '#dc2626', to: '#991b1b', angle: 135 },
    headingFont: 'Playfair Display',
    brand: 'TRIỂN LÃM SÁCH & KỶ NIỆM TRUYỀN THỐNG NXB SỰ THẬT',
    label: 'TRƯNG BÀY ẤN PHẨM TIÊU BIỂU · NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT',
    heading: 'Tự hào truyền thống trang sách Sự Thật qua các thời kỳ lịch sử.',
    description: 'Không gian trưng bày và giới thiệu các bộ sách kinh điển, sách giải thưởng Sách Quốc gia và ấn phẩm kỷ niệm trọng đại của đất nước. Kết nối WiFi để nhận E-Voucher ưu đãi bạn đọc.',
    perks: '✦ Tác phẩm Điện Biên Phủ & Tổng hành dinh  •  Tinh hoa Vân Đài Loại Ngữ  •  E-Voucher ưu đãi 20%',
    button: 'Kết nối WiFi & Nhận Ưu đãi Triển lãm',
    slides: [
      {
        key: 'trien-lam-hero',
        alt: 'Tác phẩm Đại tướng Võ Nguyên Giáp - Điện Biên Phủ của NXB Chính trị quốc gia Sự thật',
        badge: 'TÁC PHẨM KINH ĐIỂN',
        title: 'Đại tướng Võ Nguyên Giáp — Điện Biên Phủ',
        subtitle: 'Ấn phẩm lịch sử quân sự tiêu biểu luôn nằm trong tâm điểm các kỳ Triển lãm Sách Quốc gia',
      },
      {
        key: 'trien-lam-slide-2',
        alt: 'Bộ sách Lê Quý Đôn - Vân Đài Loại Ngữ xuất bản bởi NXB Chính trị quốc gia Sự thật',
        badge: 'TINH HOA CỔ HỌC',
        title: 'Lê Quý Đôn — Vân Đài Loại Ngữ',
        subtitle: 'Bách khoa thư đồ sộ tôn vinh di sản tri thức và văn hiến ngàn năm của dân tộc Việt Nam',
      },
      {
        key: 'trien-lam-slide-3',
        alt: 'Không gian trưng bày và trao tặng sách của Đảng tại các sự kiện trọng đại',
        badge: 'TRUYỀN THỐNG NGÀNH',
        title: 'Tự hào Truyền thống Ngành Xuất bản Cách mạng',
        subtitle: 'Hơn 7 thập kỷ phụng sự Đảng, Nhà nước và nhân dân bằng những công trình xuất bản giá trị',
      },
    ],
    announcement: 'Đặc quyền Bạn đọc tại Không gian Triển lãm Sách Sự Thật',
    announcementMessage: 'Quý độc giả kết nối WiFi nhận ngay E-Voucher ưu đãi 20% áp dụng cho toàn bộ đầu sách trưng bày tại gian hàng Nhà xuất bản Chính trị quốc gia Sự thật và trên Stbook.vn.',
  },
  'ly-luan-chinh-tri': {
    background: '#c4d2c3',
    bgImage: '/nxb-templates/ly-luan-bg.jpg',
    overlayColor: '#314a40',
    overlayOpacity: 0.16,
    pattern: 'dots',
    cardBg: '#3b0707',
    cardOpacity: 0.90,
    cardBorder: '#fde047',
    ink: '#fffbeb',
    muted: '#fde68a',
    accent: '#fde047',
    pillBg: '#991b1b',
    pillInk: '#fde047',
    buttonInk: '#450a0a',
    buttonGradient: { from: '#fde047', to: '#f59e0b', angle: 135 },
    headingFont: 'Merriweather',
    brand: 'TỦ SÁCH LÝ LUẬN CHÍNH TRỊ & XÂY DỰNG ĐẢNG',
    label: 'CƠ QUAN TRUNG ƯƠNG CỦA ĐẢNG · NHÀ XUẤT BẢN CHÍNH TRỊ QUỐC GIA SỰ THẬT',
    heading: 'Chuẩn mực tư liệu lý luận. Vững vàng nền tảng tư tưởng của Đảng.',
    description: 'Cổng kết nối và tra cứu Tủ sách Tư tưởng Hồ Chí Minh, Tủ sách Xây dựng Đảng, Nhà nước pháp quyền và Sổ tay Đảng viên dành cho cán bộ, đảng viên, giảng viên và học viên.',
    perks: '✦ Tủ sách Tư tưởng Hồ Chí Minh  •  Tủ sách Xây dựng Đảng  •  Kết nối nhanh phục vụ nghiên cứu',
    button: 'Kết nối WiFi & Tra cứu Tủ sách Lý luận',
    slides: [
      {
        key: 'ly-luan-hero',
        alt: 'Tác phẩm Hồ Chí Minh - Quá khứ, hiện tại và tương lai của Thủ tướng Phạm Văn Đồng',
        badge: 'TƯ TƯỞNG HỒ CHÍ MINH',
        title: 'Hồ Chí Minh — Quá khứ, Hiện tại và Tương lai',
        subtitle: 'Công trình sâu sắc của Thủ tướng Phạm Văn Đồng về cuộc đời, tư tưởng và sự nghiệp của Bác',
      },
      {
        key: 'ly-luan-slide-2',
        alt: 'Tác phẩm Xây dựng Chính phủ liêm chính, vững mạnh, hoạt động hiệu lực, hiệu quả của Tổng Bí thư Nguyễn Phú Trọng',
        badge: 'XÂY DỰNG ĐẢNG & NHÀ NƯỚC',
        title: 'Xây dựng Chính phủ liêm chính, vững mạnh, hiệu lực, hiệu quả',
        subtitle: 'Tác phẩm định hướng chiến lược của Tổng Bí thư Nguyễn Phú Trọng về xây dựng nền hành chính nhà nước',
      },
      {
        key: 'ly-luan-slide-3',
        alt: 'Lãnh đạo Đảng, Nhà nước trao tặng các bộ sách lý luận chính trị trọng điểm',
        badge: 'SINH HOẠT CHI BỘ',
        title: 'Tủ sách Chi bộ & Học liệu Lý luận Chính trị chuẩn mực',
        subtitle: 'Cung cấp nguồn tài liệu chính thống phục vụ học tập, quán triệt Nghị quyết của Đảng',
      },
    ],
    announcement: 'Cổng Học liệu số Lý luận Chính trị & Xây dựng Đảng',
    announcementMessage: 'Cán bộ, đảng viên và bạn đọc kết nối WiFi để truy cập miễn phí danh mục Tủ sách Bảo vệ nền tảng tư tưởng của Đảng và Tủ sách Học tập theo gương Bác.',
  },
};

const REFINEMENTS: Record<string, Partial<PresetStyle>> = {
  'van-hoa-doc': {
    cardBg: '#fffdf8', cardOpacity: 1, cardBorder: '#e3dacc', ink: '#302923', muted: '#625c53',
    accent: '#8a302b', pillBg: 'transparent', pillInk: '#8a302b', buttonInk: '#ffffff', pattern: 'none',
    headingFont: 'Georgia, serif', label: 'Không gian văn hóa đọc',
    heading: 'Trang sách mở. Tri thức lan tỏa.',
    description: 'Khám phá các ấn phẩm lịch sử, văn hóa và tủ sách di sản của Nhà xuất bản Chính trị quốc gia Sự thật.',
    perks: 'Ấn phẩm chọn lọc · Tủ sách di sản · Không gian đọc', button: 'Kết nối WiFi',
    announcement: 'Chào mừng đến với không gian sách Sự thật',
    announcementMessage: 'Mời bạn đọc tìm hiểu các ấn phẩm trưng bày và danh mục sách của Nhà xuất bản. Tiếp tục để truy cập WiFi tại không gian đọc.',
  },
  'xuat-ban-so': {
    cardBg: '#102638', cardOpacity: 1, cardBorder: '#294759', ink: '#f3f7fa', muted: '#c2d1dc',
    accent: '#9bd7d0', pillBg: 'transparent', pillInk: '#9bd7d0', buttonInk: '#102638', pattern: 'none',
    overlayOpacity: 0.24, headingFont: "'Be Vietnam Pro', sans-serif", label: 'Xuất bản và học liệu số',
    heading: 'Kết nối hôm nay. Đọc trên mọi thiết bị.',
    description: 'Tìm hiểu sách điện tử và các chuyên đề nghiên cứu trên hệ sinh thái xuất bản số Stbook.vn.',
    perks: 'Sách điện tử · Chuyên đề nghiên cứu · Học liệu số', button: 'Kết nối WiFi',
    announcement: 'Khám phá thư viện xuất bản số',
    announcementMessage: 'Danh mục sách điện tử và học liệu được giới thiệu trên Stbook.vn. Tiếp tục để truy cập WiFi và tìm hiểu nội dung phù hợp.',
  },
  'hoi-nghi': {
    cardBg: '#fffdfb', cardOpacity: 1, cardBorder: '#eaded6', ink: '#352725', muted: '#6b5c58',
    accent: '#8c302e', pillBg: 'transparent', pillInk: '#8c302e', buttonInk: '#ffffff', pattern: 'none',
    overlayOpacity: 0.24, headingFont: "'Be Vietnam Pro', sans-serif", label: 'Hội nghị · Tọa đàm khoa học',
    heading: 'Kết nối tri thức. Đồng hành cùng đại biểu.',
    description: 'Chào mừng quý đại biểu đến với hội nghị. Xác nhận thông tin tham dự và kết nối WiFi để theo dõi chương trình.',
    perks: 'Đăng ký tham dự · Điểm danh · Thông tin hội nghị', button: 'Kết nối WiFi hội nghị',
    announcement: 'Thông tin dành cho đại biểu',
    announcementMessage: 'Quý đại biểu vui lòng theo dõi thông tin chương trình và hướng dẫn của ban tổ chức. Tiếp tục để truy cập WiFi hội nghị.',
  },
  'trien-lam': {
    cardBg: '#fffdfa', cardOpacity: 1, cardBorder: '#e6dccc', ink: '#302c28', muted: '#655f58',
    accent: '#9b352d', pillBg: 'transparent', pillInk: '#9b352d', buttonInk: '#ffffff', pattern: 'none',
    headingFont: 'Georgia, serif', label: 'Triển lãm · Ấn phẩm tiêu biểu',
    heading: 'Dấu ấn trên từng trang sách.',
    description: 'Khám phá các tác phẩm và ấn phẩm tiêu biểu tại không gian trưng bày của Nhà xuất bản Chính trị quốc gia Sự thật.',
    perks: 'Tác phẩm kinh điển · Ấn phẩm mới · Hoạt động triển lãm', button: 'Kết nối WiFi triển lãm',
    announcement: 'Chào mừng đến với không gian triển lãm',
    announcementMessage: 'Mời bạn đọc tham quan các ấn phẩm trưng bày và theo dõi hoạt động tại triển lãm. Tiếp tục để truy cập WiFi.',
  },
  'ly-luan-chinh-tri': {
    cardBg: '#fafcf9', cardOpacity: 1, cardBorder: '#d8e2d9', ink: '#243d34', muted: '#53675c',
    accent: '#315f4d', pillBg: 'transparent', pillInk: '#315f4d', buttonInk: '#ffffff', pattern: 'none',
    headingFont: 'Georgia, serif', label: 'Lý luận chính trị · Nghiên cứu',
    heading: 'Nguồn tư liệu cho nghiên cứu và học tập.',
    description: 'Tìm hiểu các tác phẩm lý luận chính trị, tư tưởng Hồ Chí Minh và tài liệu về xây dựng Đảng, Nhà nước.',
    perks: 'Tư liệu chính thống · Nghiên cứu · Học tập', button: 'Kết nối WiFi',
    announcement: 'Không gian tư liệu nghiên cứu',
    announcementMessage: 'Mời bạn đọc tìm hiểu danh mục tác phẩm lý luận chính trị và tài liệu nghiên cứu được Nhà xuất bản giới thiệu.',
  },
};

const asset = (name: string, isMobile = false) => `/nxb-templates/${name}${isMobile ? '-portrait' : ''}.jpg`;
export const LOGO_URL = '/nxb-templates/logo-nxb-su-that.png';

function kickerNode(content: string, style: PresetStyle, width: number, isMobile: boolean): DesignNode {
  const node = createNode('description');
  Object.assign(node.element, {
    content,
    color: style.pillInk,
    fontFamily: 'Be Vietnam Pro',
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    textTransform: 'none',
    align: 'left',
    textShadow: 'none',
    bgColor: style.pillBg,
    borderRadius: '999px',
    paddingX: '0px',
    paddingY: '0px',
  });
  node.layout.width = width;
  node.layout.height = 30;
  node.name = 'Nhãn chuyên đề NXB';
  return node;
}

function headingNode(content: string, style: PresetStyle, size: number, width: number, explicitHeight: number): DesignNode {
  const node = createNode('title');
  Object.assign(node.element, {
    content,
    color: style.ink,
    fontFamily: style.headingFont,
    fontSize: `${size}px`,
    fontWeight: '700',
    lineHeight: '1.25',
    align: 'left',
    textShadow: 'none',
  });
  node.layout.width = width;
  node.layout.height = explicitHeight;
  node.name = 'Tiêu đề thông điệp';
  return node;
}

function textNode(type: 'title' | 'description', content: string, color: string, size: number, width: number, explicitHeight?: number, weight: '400' | '500' | '600' | '700' = '500'): DesignNode {
  const node = createNode(type);
  Object.assign(node.element, {
    content,
    color,
    fontFamily: 'Be Vietnam Pro',
    fontSize: `${size}px`,
    fontWeight: weight,
    lineHeight: '1.5',
    align: 'left',
    textShadow: 'none',
  });
  node.layout.width = width;
  node.layout.height = explicitHeight !== undefined ? explicitHeight : type === 'title' ? Math.round(size * 2.4) : Math.round(size * 3.8);
  return node;
}

function brandNode(width: number, isMobile = false): DesignNode {
  const node = createNode('logo');
  Object.assign(node.element, {
    src: LOGO_URL,
    width: isMobile ? '244px' : '280px',
    position: 'left',
    borderRadius: '4px',
    shadow: 'none',
  });
  node.layout.width = width;
  node.layout.height = 58;
  setNodeMedia(node, 'src', LOGO_URL);
  node.name = 'Logo NXB Chính trị quốc gia Sự thật';
  return node;
}

function imageNode(style: PresetStyle, width: number, height: number, isMobile = false): DesignNode {
  const node = createNode(style.slides.length > 1 ? 'image_slider' : 'image');
  if (node.element.type === 'image_slider') {
    Object.assign(node.element, {
      images: style.slides.map(s => ({
        src: asset(s.key, isMobile),
        alt: s.alt,
        badge: s.badge,
        title: s.title,
        subtitle: s.subtitle,
      })),
      imagesDesktop: style.slides.map(s => ({
        src: asset(s.key, false),
        alt: s.alt,
        badge: s.badge,
        title: s.title,
        subtitle: s.subtitle,
      })),
      autoplay: false,
      interval: 4,
      transitionType: 'fade',
      showDots: true,
      showArrows: true,
      showCaptions: false,
      captionPosition: 'bottom',
      objectFit: 'contain',
      borderRadius: '10px',
      shadow: 'none',
      height: `${height}px`,
      heightDesktop: '320px',
    });
  } else {
    const first = style.slides[0];
    Object.assign(node.element, {
      src: asset(first.key, isMobile),
      srcDesktop: asset(first.key, false),
      alt: first.alt,
      caption: first.title,
      objectFit: 'contain',
      borderRadius: '10px',
      shadow: 'none',
    });
  }
  node.layout.width = width;
  node.layout.height = height;
  node.name = 'Slider Ấn phẩm & Sự kiện NXB';
  return node;
}

function surfaceStyle(surface: DesignSurface, style: PresetStyle, device: 'mobile' | 'tablet' | 'desktop') {
  Object.assign(surface.background, {
    bgMode: 'image',
    type: 'cover',
    color: style.background,
    overlayColor: style.overlayColor,
    overlayOpacity: style.overlayOpacity,
    overlayMode: 'gradient',
    overlayGradientDirection: 'to-b',
    pattern: style.pattern,
    patternOpacity: 0.08,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    pagePadding: device === 'mobile' ? '16px 12px' : device === 'tablet' ? '40px 24px' : '64px 40px',
  });
  surface.backgroundMedia = {
    image: mediaRef(presetBackground(style.bgImage, device) || style.bgImage)!,
  };
}

function applySectionCardStyle(section: ReturnType<typeof createSection>, style: PresetStyle, isMobile: boolean) {
  section.padding = isMobile ? 20 : 36;
  section.gap = isMobile ? 18 : 24;
  section.background = style.cardBg;
  section.bgOpacity = style.cardOpacity;
  section.backdropBlur = 0;
  section.borderRadius = '16px';
  section.borderStyle = 'solid';
  section.borderWidth = 1;
  section.borderColor = style.cardBorder;
  section.shadow = 'sm';
}

function buildPreset(id: string): TemplateDocumentV2 {
  const style = STYLES[id] ? { ...STYLES[id], ...REFINEMENTS[id] } : undefined;
  if (!style) throw new Error(`Mẫu khởi đầu không tồn tại: ${id}`);
  const document = createDocument();
  document.brandColors = [style.accent, style.ink, style.background, style.muted, style.buttonInk];

  for (const device of DEVICE_KEYS) {
    const isMobile = device === 'mobile';
    const variant = document.variants[device];
    const width = device === 'desktop' ? 468 : device === 'tablet' ? 520 : 342;
    const mediaHeight = device === 'desktop' ? 330 : device === 'tablet' ? 293 : 224;
    surfaceStyle(variant, style, device);

    const section = createSection(variant.viewport);
    section.name = style.brand;
    applySectionCardStyle(section, style, isMobile);

    const button = createNode('connect_button');
    Object.assign(button.element, {
      text: style.button,
      color: style.buttonInk,
      bgColor: style.accent,
      fontFamily: 'Be Vietnam Pro',
      fontSize: '16px',
      fontWeight: '700',
      radius: '14px',
      buttonStyle: 'solid',
      gradient: undefined,
      buttonEffect: 'none',
      buttonIcon: 'wifi',
      shadow: 'none',
      termsText: '',
      requireConfirm: false,
    });
    button.layout.width = width;
    button.layout.height = 54;
    button.name = 'Nút Kết nối WiFi NXB Sự Thật';

    const brand = brandNode(width, isMobile);
    const kicker = kickerNode(style.label, style, width, isMobile);
    const heading = headingNode(style.heading, style, isMobile ? 28 : device === 'tablet' ? 34 : 38, width, 112);
    const image = imageNode(style, width, mediaHeight, false);
    const description = textNode('description', style.description, style.muted, isMobile ? 15 : 16, width, 90, '400');
    description.name = 'Giới thiệu chuyên đề';
    const perks = textNode('description', style.perks, style.muted, 12, width, 40, '500');
    perks.name = 'Nội dung nổi bật';
    const footer = textNode('description', 'Nhà xuất bản Chính trị quốc gia Sự thật · stbook.vn', style.muted, 12, width, 36, '400');
    footer.name = 'Thông tin đơn vị';
    section.nodes = [brand, kicker, heading, image, description, perks, button, footer];
    section.maxWidth = device === 'desktop' ? 1080 : device === 'tablet' ? 608 : 390;
    if (device === 'desktop') {
      section.columns = 2;
      const place = (node: DesignNode, column: number, row: number, columnSpan = 1, rowSpan = 1) => { node.grid = {column,row,columnSpan,rowSpan}; };
      brand.layout.width = 980;
      place(brand, 1, 1, 2);
      place(kicker, 2, 2); place(heading, 2, 3);
      place(image, 1, 2, 1, 5);
      place(description, 2, 4); place(perks, 2, 5); place(button, 2, 6);
      footer.layout.width = 980; place(footer, 1, 7, 2);
    }
    variant.sections = [section];

    for (const screen of GATE_SCREENS) {
      const controller = flowNode(variant, screen)!;

      let isGateEnabled = false;
      if (id === 'van-hoa-doc' && screen === 'announcement') isGateEnabled = true;
      else if (id === 'xuat-ban-so' && screen === 'video_gate') isGateEnabled = true;
      else if (id === 'hoi-nghi' && screen === 'attendance_gate') isGateEnabled = true;
      else if (id === 'trien-lam' && screen === 'announcement') isGateEnabled = true;

      controller.element.enabled = isGateEnabled;
      controller.hidden = false;

      const isPortraitVideo = id === 'xuat-ban-so';
      const isDark = id === 'xuat-ban-so';
      const firstSlideKey = style.slides[0].key;

      if (controller.element.type === 'video_gate') {
        Object.assign(controller.element, {
          videoUrl: isPortraitVideo ? '/nxb-templates/video-nxb-portrait.mp4' : '/nxb-templates/video-nxb-landscape.mp4',
          poster: asset(firstSlideKey, isMobile),
          aspectRatio: isPortraitVideo ? '9:16' : '16:9',
          skipAfter: 5,
          dialogTitle: id === 'xuat-ban-so' ? 'Khám phá xuất bản số' : 'Giới thiệu Nhà xuất bản',
          dialogMessage: 'Mời bạn đọc theo dõi video giới thiệu Nhà xuất bản và các ấn phẩm trước khi tiếp tục truy cập WiFi.',
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '10px',
          shadow: 'none',
          muted: true,
          buttonBgColor: style.accent,
          buttonTextColor: style.buttonInk,
          frameWidth: '100%',
        });
      } else if (controller.element.type === 'attendance_gate') {
        Object.assign(controller.element, {
          dialogTitle: id === 'hoi-nghi' ? 'Xác nhận tham dự hội nghị' : 'Thông tin đại biểu',
          dialogMessage: 'Quý đại biểu vui lòng nhập họ tên và đơn vị công tác để ban tổ chức ghi nhận thông tin tham dự.',
          nameLabel: 'Họ và tên đại biểu',
          namePlaceholder: 'Nhập họ và tên đầy đủ của Quý đại biểu',
          departmentLabel: 'Cơ quan / Đơn vị công tác',
          departmentPlaceholder: 'Nhập tên cơ quan, học viện hoặc đơn vị',
          buttonText: 'Xác nhận tham dự',
          buttonBgColor: style.accent,
          buttonTextColor: style.buttonInk,
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '10px',
          shadow: 'none',
        });
      } else if (controller.element.type === 'announcement') {
        Object.assign(controller.element, {
          title: style.announcement,
          message: style.announcementMessage,
          imageUrl: asset(firstSlideKey, isMobile),
          bgColor: style.cardBg,
          titleColor: style.ink,
          messageColor: style.muted,
          buttonBgColor: style.accent,
          buttonTextColor: style.buttonInk,
          buttonText: 'Tiếp tục kết nối WiFi',
          dialogTheme: isDark ? 'cinematic_dark' : 'clean_light',
          borderRadius: '10px',
          shadow: 'none',
        });
      }

      const surface = screenSurface(variant, screen);
      surfaceStyle(surface, style, device);
      const gateSection = surface.sections[0];
      gateSection.maxWidth = device === 'mobile' ? 390 : 640;
      applySectionCardStyle(gateSection, style, isMobile);

      const core = gateSection.nodes.find(n => n.element.type === 'flow_content')!;
      core.layout.width = width;
      core.layout.height = screen === 'video_gate' ? (isPortraitVideo ? 620 : 420) : screen === 'attendance_gate' ? 420 : 480;

      gateSection.nodes = [
        brandNode(width, isMobile),
        kickerNode(style.label, style, width, isMobile),
        core,
        textNode('description', 'Nhà xuất bản Chính trị quốc gia Sự thật', style.muted, 12, width, 24, '500'),
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
