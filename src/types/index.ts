// ============================================
// Template Config - Simplified page builder model
// ============================================

export interface TemplateConfig {
  background: BackgroundConfig;
  elements: TemplateElement[];
}

export interface BackgroundConfig {
  imageMobile?: string;
  imageDesktop?: string;
  videoMobile?: string;
  videoDesktop?: string;
  type: 'cover' | 'contain' | 'fill' | 'repeat';
  overlayColor: string;
  overlayOpacity: number;
  padding: string;
  // Extended Portal Background capabilities
  bgMode?: 'solid' | 'gradient' | 'image';
  gradient?: string;
  gradientFrom?: string;
  gradientVia?: string;
  gradientTo?: string;
  gradientAngle?: number;
  overlayMode?: 'solid' | 'gradient';
  overlayGradientDirection?: 'to-b' | 'to-t' | 'radial';
  overlayGradientTo?: string;
  imageBlur?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  pattern?: 'none' | 'dots' | 'grid' | 'waves' | 'diagonal';
  patternColor?: string;
  patternOpacity?: number;
}

export type ShadowSize = 'none' | 'sm' | 'soft' | 'md' | 'medium' | 'lg' | 'strong' | 'xl' | 'glow';

export interface TypographyStyleProps {
  fontFamily?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textTransform?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textShadow?: string;
  textStroke?: string;
  textStrokeWidth?: number;
  textStrokeColor?: string;
  textGradient?: string;
  // Text Box / Pill / Badge container styling
  bgColor?: string;
  bgOpacity?: number;
  paddingX?: number;
  paddingY?: number;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: number | string;
  backdropBlur?: number;
}

export type TemplateElement =
  | LogoElement
  | TitleElement
  | DescriptionElement
  | ImageElement
  | ImageSliderElement
  | VideoElement
  | ConnectButtonElement
  | VideoGateElement
  | AnnouncementElement
  | AttendanceGateElement
  | SpacerElement;

export interface BaseElement {
  id: string;
  type: string;
  enabled: boolean;
}

export interface LogoElement extends BaseElement {
  type: 'logo';
  src: string;
  width: string;
  height?: string;
  position: 'left' | 'center' | 'right';
  bgColor?: string;
  bgOpacity?: number;
  padding?: number | string;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: number | string;
  shadow?: ShadowSize;
  opacity?: number;
  canvasPosition?: { x: number; y: number } | null;
}

export interface TitleElement extends BaseElement, TypographyStyleProps {
  type: 'title';
  content: string;
  color: string;
  fontSize: string;
  align: 'left' | 'center' | 'right' | 'justify';
  canvasPosition?: { x: number; y: number } | null;
}

export interface DescriptionElement extends BaseElement, TypographyStyleProps {
  type: 'description';
  content: string;
  color: string;
  fontSize: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  canvasPosition?: { x: number; y: number } | null;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  srcDesktop?: string;
  alt: string;
  width: string;
  height: string;
  borderRadius: string;
  objectFit: 'cover' | 'contain' | 'fill';
  zoom: number;       // 1 = 100%, 1.5 = 150%
  posX: number;       // percentage offset X (0 = center)
  posY: number;       // percentage offset Y (0 = center)
  shadow?: ShadowSize;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'double' | 'glass';
  borderColor?: string;
  borderWidth?: string | number;
  aspectRatio?: 'auto' | '16/9' | '4/3' | '1/1' | '3/4' | '9/16';
  maskShape?: 'rect' | 'rounded' | 'circle' | 'arch' | 'pill';
  opacity?: number;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  grayscale?: number;
  blur?: number;
  caption?: string;
  captionPosition?: 'below' | 'overlay-bottom';
  captionColor?: string;
  captionBgColor?: string;
  canvasPosition?: { x: number; y: number } | null;
}

export interface ImageSliderElement extends BaseElement {
  type: 'image_slider';
  images: { src: string; alt: string; title?: string; subtitle?: string; badge?: string }[];
  imagesDesktop?: { src: string; alt: string; title?: string; subtitle?: string; badge?: string }[];
  height: string;
  heightDesktop?: string;
  borderRadius: string;
  objectFit: 'cover' | 'contain' | 'fill';
  autoplay: boolean;
  interval: number;   // seconds
  shadow?: ShadowSize;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'double' | 'glass';
  borderColor?: string;
  borderWidth?: string | number;
  transitionType?: 'slide' | 'fade';
  showArrows?: boolean;
  showDots?: boolean;
  showCaptions?: boolean;
  aspectRatio?: 'auto' | '16/9' | '4/3' | '1/1';
  canvasPosition?: { x: number; y: number } | null;
}

export interface VideoElement extends BaseElement {
  type: 'video';
  src: string;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  poster: string;
  aspectRatio: '16:9' | '9:16' | '4:3' | 'auto';
  frameWidth: string;
  frameWidthDesktop?: string;
  shadow?: ShadowSize;
  borderRadius?: string;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'double' | 'glass';
  borderColor?: string;
  borderWidth?: string | number;
  canvasPosition?: { x: number; y: number } | null;
}

export interface SpacerElement extends BaseElement {
  type: 'spacer';
  height: string;
  heightDesktop?: string;
  canvasPosition?: { x: number; y: number } | null;
}

export interface ConnectButtonElement extends BaseElement {
  type: 'connect_button';
  text: string;
  color: string;
  bgColor: string;
  radius: string;
  buttonWidth: string;
  buttonWidthDesktop?: string;
  showPhone: boolean;
  phonePlaceholder: string;
  termsText: string;
  requireConfirm?: boolean;
  confirmMessage?: string;
  imageSrc?: string;
  imageWidth?: string;
  imageWidthDesktop?: string;
  buttonStyle?: 'solid' | 'gradient' | 'glass' | 'outline';
  gradient?: string | { from?: string; via?: string; to?: string; angle?: number; css?: string };
  buttonEffect?: 'none' | 'glow' | 'pulse' | 'shimmer' | 'lift';
  buttonIcon?: 'none' | 'wifi' | 'arrow' | 'lightning' | 'shield';
  shadow?: ShadowSize;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase' | 'capitalize';
  letterSpacing?: number | string;
  paddingY?: number | string;
  borderColor?: string;
  borderWidth?: number | string;
  canvasPosition?: { x: number; y: number } | null;
}

export interface VideoGateElement extends BaseElement {
  type: 'video_gate';
  videoUrl: string;
  skipAfter: number;
  poster: string;
  aspectRatio: '16:9' | '9:16' | '4:3' | 'auto';
  frameWidth: string;
  frameWidthDesktop?: string;
  dialogTitle: string;
  dialogMessage: string;
  dialogMaxWidth?: string;
  dialogMaxWidthDesktop?: string;
  dialogSize?: 'normal' | 'large' | 'xlarge' | 'cinematic' | 'fullscreen';
  dialogTheme?: 'luxury_gold' | 'cinematic_dark' | 'glass_neon' | 'clean_light';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow';
  borderRadius?: string;
  overlayBlur?: string;
  muted?: boolean;
  showVolumeControl?: boolean;
  buttonBgColor?: string;
  buttonTextColor?: string;
}

export interface AnnouncementElement extends BaseElement {
  type: 'announcement';
  title: string;
  message: string;
  // Video support
  videoUrl?: string;
  autoPlayVideo?: boolean;
  // Rich text
  titleBold?: boolean;
  titleItalic?: boolean;
  titleFontSize?: string;
  titleColor?: string;
  messageBold?: boolean;
  messageItalic?: boolean;
  messageFontSize?: string;
  messageColor?: string;
  // Media & styling
  imageUrl?: string;
  bgColor: string;
  buttonText: string;
  buttonBgColor: string;
  buttonTextColor: string;
  skipAfter: number;
  dialogMaxWidth?: string;
  dialogMaxWidthDesktop?: string;
  dialogSize?: 'normal' | 'large' | 'xlarge' | 'cinematic' | 'fullscreen';
  dialogTheme?: 'luxury_gold' | 'cinematic_dark' | 'glass_neon' | 'clean_light';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow';
  borderRadius?: string;
  overlayBlur?: string;
}

export interface AttendanceGateElement extends BaseElement {
  type: 'attendance_gate';
  dialogTitle: string;
  dialogMessage: string;
  nameLabel?: string;
  namePlaceholder?: string;
  departmentLabel?: string;
  departmentPlaceholder?: string;
  buttonText: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  dialogTheme?: 'luxury_gold' | 'cinematic_dark' | 'glass_neon' | 'clean_light';
  dialogSize?: 'normal' | 'large' | 'xlarge' | 'cinematic' | 'fullscreen';
  dialogMaxWidth?: string;
  dialogMaxWidthDesktop?: string;
  borderRadius?: string;
  overlayBlur?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'glow';
  successMessage?: string;
}

export function createDefaultTemplateConfig(): TemplateConfig {
  return {
    background: {
      imageMobile: '',
      imageDesktop: '',
      type: 'cover',
      overlayColor: '#000000',
      overlayOpacity: 0.3,
      padding: '20px',
    },
    elements: [
      { id: 'logo-1', type: 'logo', enabled: true, src: '', width: '120px', position: 'center' },
      { id: 'title-1', type: 'title', enabled: true, content: 'Chào mừng đến với WiFi', color: '#ffffff', fontSize: '24px', align: 'center' },
      { id: 'desc-1', type: 'description', enabled: true, content: 'Kết nối WiFi miễn phí ngay bây giờ', color: '#ffffff', fontSize: '14px' },
      {
        id: 'connect-1',
        type: 'connect_button',
        enabled: true,
        text: 'Kết nối ngay',
        color: '#ffffff',
        bgColor: '#3b82f6',
        radius: '50px',
        buttonWidth: '100%',
        showPhone: false,
        phonePlaceholder: 'Nhập số điện thoại',
        termsText: '',
        requireConfirm: false,
        confirmMessage: '',
      },
    ],
  };
}

export function isLegacyLocalUploadUrl(url?: string | null): boolean {
  return !!url && url.startsWith('/api/uploads/');
}

function cleanMediaUrl(url?: string): string {
  if (!url || isLegacyLocalUploadUrl(url)) return '';
  return url;
}

function cleanMediaItems(items?: { src: string; alt: string }[]): { src: string; alt: string }[] {
  return (items || [])
    .map((item) => ({ ...item, src: cleanMediaUrl(item.src) }))
    .filter((item) => !!item.src);
}

export function normalizeTemplateConfigMedia(config: TemplateConfig): TemplateConfig {
  return {
    ...config,
    background: {
      ...config.background,
      imageMobile: cleanMediaUrl(config.background.imageMobile),
      imageDesktop: cleanMediaUrl(config.background.imageDesktop),
      videoMobile: cleanMediaUrl(config.background.videoMobile),
      videoDesktop: cleanMediaUrl(config.background.videoDesktop),
    },
    elements: config.elements.map((element) => {
      switch (element.type) {
        case 'logo':
          return { ...element, src: cleanMediaUrl(element.src) };
        case 'image':
          return {
            ...element,
            src: cleanMediaUrl(element.src),
            srcDesktop: cleanMediaUrl(element.srcDesktop),
          };
        case 'image_slider':
          return {
            ...element,
            images: cleanMediaItems(element.images),
            imagesDesktop: cleanMediaItems(element.imagesDesktop),
          };
        case 'video':
          return {
            ...element,
            src: cleanMediaUrl(element.src),
            poster: cleanMediaUrl(element.poster),
          };
        case 'connect_button':
          return {
            ...element,
            imageSrc: cleanMediaUrl(element.imageSrc),
            requireConfirm: element.requireConfirm === true,
            confirmMessage: element.confirmMessage || '',
          };
        case 'video_gate':
          return {
            ...element,
            videoUrl: cleanMediaUrl(element.videoUrl),
            poster: cleanMediaUrl(element.poster),
          };
        case 'announcement':
          return {
            ...element,
            imageUrl: cleanMediaUrl(element.imageUrl),
            videoUrl: cleanMediaUrl(element.videoUrl),
          };
        default:
          return element;
      }
    }),
  };
}

// ============================================
// Portal Params
// ============================================

export interface PortalParams {
  apMac?: string;
  unifiSite?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  mac?: string;
  ip?: string;
  ssid?: string;
  'link-login'?: string;
  'link-login-only'?: string;
  'link-orig'?: string;
  linkLoginOnly?: string;
  trial?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Check if a layoutJson is the new TemplateConfig format
export function isTemplateConfig(obj: unknown): obj is TemplateConfig {
  return !!obj && typeof obj === 'object' && 'background' in obj && 'elements' in obj;
}
