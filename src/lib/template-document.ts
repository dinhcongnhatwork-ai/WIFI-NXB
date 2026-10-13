import { isSafeMediaKey } from './media';
import { createDefaultTemplateConfig, isTemplateConfig, type TemplateConfig, type TemplateElement, type BackgroundConfig } from '@/types';

export type DeviceVariant = 'mobile' | 'tablet' | 'desktop';
export type RenderMode = 'edit' | 'simulate' | 'live';
export interface Viewport { width: number; height: number }
export const DEVICES: Record<DeviceVariant, { label: string; presets: Viewport[] }> = {
  mobile: {
    label: 'Mobile',
    presets: [
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 375, height: 667 },
    ],
  },
  tablet: {
    label: 'Tablet',
    presets: [
      { width: 768, height: 1024 },
      { width: 820, height: 1180 },
      { width: 1024, height: 768 },
    ],
  },
  desktop: {
    label: 'PC',
    presets: [
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
    ],
  },
};
export const DEVICE_KEYS = Object.keys(DEVICES) as DeviceVariant[];
export type MediaRef = { kind: 'object'; key: string } | { kind: 'external'; url: string };
export interface DecorationElement { id: string; type: 'container' | 'divider' | 'shape'; enabled: boolean; color: string; borderRadius: string }
export type NodeElement = TemplateElement | DecorationElement;
export interface NodeLayout { x: number; y: number; width: number; height: number; rotation: number }
export interface DesignNode {
  id: string; name: string; element: NodeElement; layout: NodeLayout; locked: boolean; hidden: boolean;
  media: Record<string, MediaRef>; children?: DesignNode[];
}
export interface DesignSection {
  id: string; name: string; mode: 'flow' | 'freeform'; width: number; height: number;
  gap: number; padding: number; columns: number; align: 'start' | 'center' | 'end'; background: string;
  locked: boolean; hidden: boolean; nodes: DesignNode[];
}
export interface DesignVariant {
  viewport: Viewport; background: BackgroundConfig & { focalX: number; focalY: number; color: string };
  backgroundMedia: Record<string, MediaRef>; sections: DesignSection[];
  flow: { videoGate?: DesignNode; announcement?: DesignNode; attendanceGate?: DesignNode };
}
export interface TemplateDocumentV2 {
  schemaVersion: 2; variants: Record<DeviceVariant, DesignVariant>; brandColors: string[];
}
export interface DocumentIssue { severity: 'error' | 'warning'; message: string; nodeId?: string; variant?: DeviceVariant }
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
export function uid(): string { return globalThis.crypto?.randomUUID?.() || `node-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
export function variantForWidth(width: number): DeviceVariant { return width < 768 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop'; }
export function mediaRef(url: string): MediaRef | undefined {
  if (!url) return undefined;
  if (url.startsWith('/api/media/')) {
    try { const key = url.slice(11).split('/').map(decodeURIComponent).join('/'); return isSafeMediaKey(key) ? { kind: 'object', key } : undefined; } catch { return undefined; }
  }
  return { kind: 'external', url };
}
export function mediaUrl(ref?: MediaRef): string {
  return !ref || !validMediaRef(ref) ? '' : ref.kind === 'object' ? `/api/media/${ref.key.split('/').map(encodeURIComponent).join('/')}` : ref.url;
}
export const MEDIA_FIELDS = ['src', 'srcDesktop', 'poster', 'videoUrl', 'imageUrl', 'imageSrc'];
export function materializeElement(node: DesignNode): NodeElement {
  const element = clone(node.element) as unknown as Record<string, unknown>;
  for (const [field, ref] of Object.entries(node.media)) element[field] = mediaUrl(ref);
  return element as unknown as NodeElement;
}
export function setNodeMedia(node: DesignNode, field: string, url: string) {
  const ref = mediaRef(url);
  if (ref) node.media[field] = ref; else delete node.media[field];
  (node.element as unknown as Record<string, unknown>)[field] = url;
}
export const COMPONENT_LABELS: Record<NodeElement['type'], string> = {
  logo: 'Logo', title: 'Tiêu đề', description: 'Mô tả', image: 'Hình ảnh', image_slider: 'Slider ảnh', video: 'Video',
  connect_button: 'Nút kết nối', attendance_gate: 'Điểm danh họp', video_gate: 'Video Gate', announcement: 'Thông báo', spacer: 'Khoảng trắng', container: 'Container', divider: 'Đường phân cách', shape: 'Hình khối',
};
export function createNode(type: NodeElement['type'], viewportWidth?: number): DesignNode {
  const id = uid(); const base = { id, type, enabled: true };
  const targetW = viewportWidth
    ? viewportWidth >= 1200 ? 520 : viewportWidth >= 768 ? 480 : Math.min(340, viewportWidth - 32)
    : 340;
  let element: NodeElement;
  let layoutHeight = 160;

  switch (type) {
    case 'logo':
      element = { ...base, type, src: '', width: '120px', position: 'center' };
      layoutHeight = 70;
      break;
    case 'title':
      element = { ...base, type, content: 'Chào mừng bạn đến với Wi-Fi', color: '#ffffff', fontSize: '26px', align: 'center' };
      layoutHeight = 48;
      break;
    case 'description':
      element = { ...base, type, content: 'Kết nối WiFi tốc độ cao hoàn toàn miễn phí.', color: '#ffffff', fontSize: '15px' };
      layoutHeight = 36;
      break;
    case 'image':
      element = { ...base, type, src: '', alt: '', width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover', zoom: 1, posX: 0, posY: 0, shadow: 'md' };
      layoutHeight = Math.round(targetW * 9 / 16);
      break;
    case 'image_slider':
      element = { ...base, type, images: [], height: `${Math.round(targetW * 9 / 16)}px`, borderRadius: '12px', objectFit: 'cover', autoplay: true, interval: 4, shadow: 'md' };
      layoutHeight = Math.round(targetW * 9 / 16);
      break;
    case 'video':
      element = { ...base, type, src: '', autoplay: true, muted: true, loop: true, controls: true, poster: '', aspectRatio: '16:9', frameWidth: '100%', shadow: 'md' };
      layoutHeight = Math.round(targetW * 9 / 16);
      break;
    case 'connect_button':
      element = { ...base, type, text: 'Kết nối WiFi ngay', color: '#ffffff', bgColor: '#2563eb', radius: '14px', buttonWidth: '100%', showPhone: false, phonePlaceholder: 'Nhập số điện thoại nhận ưu đãi', termsText: 'Bằng việc kết nối, bạn đồng ý với Điều khoản dịch vụ.', requireConfirm: false, buttonStyle: 'gradient', buttonEffect: 'pulse', buttonIcon: 'wifi', shadow: 'glow' };
      layoutHeight = 56;
      break;
    case 'attendance_gate':
      element = {
        ...base,
        type,
        dialogTitle: 'Điểm danh cuộc họp',
        dialogMessage: 'Vui lòng nhập Họ tên và Phòng ban để hoàn tất điểm danh và kết nối WiFi.',
        nameLabel: 'Họ và tên',
        namePlaceholder: 'VD: Nguyễn Văn A',
        departmentLabel: 'Phòng ban / Đơn vị',
        departmentPlaceholder: 'VD: Ban Biên tập Chính trị',
        buttonText: 'Xác nhận điểm danh & Kết nối',
        dialogTheme: 'luxury_gold',
        dialogSize: 'normal',
        borderRadius: '24px',
        overlayBlur: 'blur(10px)',
        shadow: 'glow',
        successMessage: 'Điểm danh thành công! Đang cấp quyền truy cập Internet...',
      };
      layoutHeight = 360;
      break;
    case 'video_gate':
      element = { ...base, type, videoUrl: '', skipAfter: 5, poster: '', aspectRatio: '16:9', frameWidth: '100%', dialogTitle: 'Xem video để kết nối WiFi', dialogMessage: 'Vui lòng xem video ngắn trước khi truy cập WiFi tốc độ cao.', muted: true };
      layoutHeight = 320;
      break;
    case 'announcement':
      element = { ...base, type, title: 'Thông báo & Ưu đãi đặc biệt', message: 'Nhận ngay ưu đãi hấp dẫn khi kết nối hôm nay.', bgColor: '#ffffff', buttonText: 'Tiếp tục truy cập', buttonBgColor: '#2563eb', buttonTextColor: '#ffffff', skipAfter: 0, borderRadius: '16px' };
      layoutHeight = 280;
      break;
    case 'spacer':
      element = { ...base, type, height: '24px' };
      layoutHeight = 24;
      break;
    default:
      element = { ...base, type: type as 'container' | 'divider' | 'shape', color: type === 'divider' ? '#cbd5e1' : '#2563eb', borderRadius: '8px' };
      layoutHeight = type === 'divider' ? 2 : 80;
  }
  return {
    id,
    name: COMPONENT_LABELS[type],
    element,
    layout: {
      x: 24,
      y: 24,
      width: targetW,
      height: layoutHeight,
      rotation: 0,
    },
    locked: false,
    hidden: false,
    media: {},
    ...(type === 'container' ? { children: [] } : {}),
  };
}
export function createSection(viewport: Viewport, mode: DesignSection['mode'] = 'flow'): DesignSection {
  return { id: uid(), name: mode === 'flow' ? 'Section responsive' : 'Section tự do', mode, ...viewport, gap: 16, padding: 24, columns: 1, align: 'center', background: 'transparent', locked: false, hidden: false, nodes: [] };
}
function migrateElement(el: TemplateElement, device: DeviceVariant, viewport: Viewport): DesignNode {
  const element = clone(el) as unknown as Record<string, unknown>;
  if (device !== 'mobile') {
    for (const key of Object.keys(element)) if (key.endsWith('Desktop') && element[key]) element[key.slice(0, -7)] = element[key];
  }
  for (const key of Object.keys(element)) if (key.endsWith('Desktop')) delete element[key];
  const cp = element.canvasPosition as { x: number; y: number } | undefined;
  delete element.canvasPosition;
  const targetW = viewport.width >= 1200 ? 520 : viewport.width >= 768 ? 480 : Math.min(340, viewport.width - 32);
  const node = createNode(el.type, viewport.width);
  node.id = el.id;
  node.name = COMPONENT_LABELS[el.type];
  node.element = element as unknown as TemplateElement;
  node.hidden = !el.enabled;
  const width = typeof element.width === 'string' && element.width.endsWith('px') ? parseFloat(element.width) : targetW;
  node.layout.width = width;
  if (cp) { node.layout.x = cp.x / 100 * viewport.width - width / 2; node.layout.y = cp.y / 100 * viewport.height - node.layout.height / 2; }
  for (const field of MEDIA_FIELDS) if (typeof element[field] === 'string' && element[field]) setNodeMedia(node, field, element[field] as string);
  return node;
}
export function toDocument(value: unknown): TemplateDocumentV2 {
  if (isTemplateDocumentV2(value)) return clone(value);
  if (!isTemplateConfig(value) || !Array.isArray(value.elements)) throw new Error('Định dạng mẫu cũ chưa được hỗ trợ. Dữ liệu gốc được giữ nguyên.');
  const variants = {} as Record<DeviceVariant, DesignVariant>;
  for (const device of DEVICE_KEYS) {
    const viewport = clone(DEVICES[device].presets[0]); const bg = value.background;
    const image = device === 'mobile' ? bg.imageMobile || bg.imageDesktop : bg.imageDesktop || bg.imageMobile;
    const video = device === 'mobile' ? bg.videoMobile || bg.videoDesktop : bg.videoDesktop || bg.videoMobile;
    const normal = createSection(viewport); normal.padding = parseFloat(bg.padding) || 0;
    const free = createSection(viewport, 'freeform'); free.name = 'Vị trí canvas cũ';
    const flow: DesignVariant['flow'] = {};
    for (const element of value.elements) {
      if (!(element.type in COMPONENT_LABELS)) throw new Error(`Thành phần cũ chưa hỗ trợ: ${element.type}`);
      const node = migrateElement(element, device, viewport);
      if (element.type === 'video_gate') flow.videoGate = node;
      else if (element.type === 'announcement') flow.announcement = node;
      else if (element.type === 'attendance_gate') flow.attendanceGate = node;
      else if ('canvasPosition' in element && element.canvasPosition) free.nodes.push(node);
      else normal.nodes.push(node);
    }
    variants[device] = { viewport, background: { ...clone(bg), imageMobile: '', imageDesktop: '', videoMobile: '', videoDesktop: '', padding: '0px', focalX: 50, focalY: 50, color: '#0f172a' }, backgroundMedia: { ...(image ? { image: mediaRef(image)! } : {}), ...(video ? { video: mediaRef(video)! } : {}) }, sections: [...(normal.nodes.length || !free.nodes.length ? [normal] : []), ...(free.nodes.length ? [free] : [])], flow };
  }
  return { schemaVersion: 2, variants, brandColors: ['#2563eb', '#0f172a', '#ffffff', '#10b981', '#f59e0b'] };
}
export function createDocument(): TemplateDocumentV2 { return toDocument(createDefaultTemplateConfig()); }
export function isTemplateDocumentV2(value: unknown): value is TemplateDocumentV2 {
  return !!value && typeof value === 'object' && (value as TemplateDocumentV2).schemaVersion === 2 && !!(value as TemplateDocumentV2).variants;
}
export function allNodes(variant: DesignVariant): DesignNode[] {
  const flatten = (nodes: DesignNode[]): DesignNode[] => nodes.flatMap(n => [n, ...flatten(n.children || [])]);
  return [...variant.sections.flatMap(s => flatten(s.nodes)), ...Object.values(variant.flow).filter(Boolean) as DesignNode[]];
}
export function copyVariant(doc: TemplateDocumentV2, from: DeviceVariant, to: DeviceVariant, append: boolean): TemplateDocumentV2 {
  const next = clone(doc); const source = clone(doc.variants[from]);
  const regenerate = (nodes: DesignNode[]) => nodes.forEach(n => { n.id = uid(); n.element.id = n.id; if (n.children) regenerate(n.children); });
  source.sections.forEach(s => { s.id = uid(); regenerate(s.nodes); });
  Object.values(source.flow).forEach(n => { if (n) { n.id = uid(); n.element.id = n.id; } });
  source.viewport = clone(next.variants[to].viewport);
  if (append) next.variants[to].sections.push(...source.sections); else next.variants[to] = source;
  return next;
}
export function validateDocument(value: unknown): DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const error = (message: string, variant?: DeviceVariant, nodeId?: string) => issues.push({ severity: 'error', message, variant, nodeId });
  if (!isTemplateDocumentV2(value)) return [{ severity: 'error', message: 'Document schemaVersion phải bằng 2.' }];
  for (const device of DEVICE_KEYS) {
    const v = value.variants[device];
    if (!v || !v.viewport || !Array.isArray(v.sections) || !v.background || !v.flow || !v.backgroundMedia) { error('Thiếu cấu hình thiết bị.', device); continue; }
    if (![v.viewport.width, v.viewport.height].every(n => Number.isFinite(n) && n >= 240 && n <= 4096)) error('Viewport phải trong khoảng 240–4096px.', device);
    const ids = new Set<string>(); let connect = false;
    const walk = (nodes: DesignNode[], section: DesignSection, ancestorHidden = false, depth = 0) => {
      if (depth > 10 || !Array.isArray(nodes) || nodes.length > 500) { error('Cây thành phần quá lớn hoặc không hợp lệ.', device); return; }
      for (const node of nodes) {
        if (!node || typeof node.id !== 'string' || !node.element || !(node.element.type in COMPONENT_LABELS) || !node.layout || !node.media) { error('Thành phần không hợp lệ.', device); continue; }
        if (ids.has(node.id)) error('ID thành phần trùng lặp.', device, node.id); ids.add(node.id);
        if (!Object.values(node.layout).every(n => typeof n === 'number' && Number.isFinite(n)) || node.layout.width <= 0 || node.layout.height <= 0) error('Kích thước hoặc tọa độ không hợp lệ.', device, node.id);
        const visible = !ancestorHidden && !node.hidden && node.element.enabled;
        if (visible && node.element.type === 'connect_button') connect = true;
        if (visible) {
          const el = materializeElement(node) as unknown as Record<string, unknown>;
          const required = node.element.type === 'image' || node.element.type === 'logo' || node.element.type === 'video' ? 'src' : node.element.type === 'video_gate' ? 'videoUrl' : '';
          if (required && !el[required]) error(`${node.name}: chưa chọn media.`, device, node.id);
          if (node.element.type === 'image' && !el.alt) issues.push({ severity: 'warning', message: `${node.name}: thiếu mô tả ảnh.`, variant: device, nodeId: node.id });
          if (section.mode === 'freeform' && (node.layout.x < 0 || node.layout.y < 0 || node.layout.x + node.layout.width > section.width || node.layout.y + node.layout.height > section.height)) issues.push({ severity: 'warning', message: `${node.name}: vượt khỏi section.`, variant: device, nodeId: node.id });
          if (node.element.type === 'connect_button' && node.layout.height < 44) issues.push({ severity: 'warning', message: 'Nút kết nối thấp hơn vùng bấm 44px.', variant: device, nodeId: node.id });
        }
        for (const ref of Object.values(node.media)) {
          if (!validMediaRef(ref)) error('Tham chiếu media không hợp lệ.', device, node.id);
        }
        if (node.children) walk(node.children, section, !visible, depth + 1);
      }
    };
    for (const section of v.sections) {
      if (!section || !['flow', 'freeform'].includes(section.mode) || !Array.isArray(section.nodes) || ![section.width, section.height].every(n => Number.isFinite(n) && n > 0)) { error('Section không hợp lệ.', device); continue; }
      walk(section.nodes, section, section.hidden);
    }
    for (const node of Object.values(v.flow)) if (node) walk([node], createSection(v.viewport));
    for (const ref of Object.values(v.backgroundMedia)) if (!validMediaRef(ref)) error('Ảnh nền không hợp lệ.', device);
    if (!connect) error('Thiết bị cần ít nhất một nút kết nối đang hiển thị.', device);
  }
  return issues;
}
export function validMediaRef(ref: MediaRef): boolean {
  if (!ref || typeof ref !== 'object') return false;
  if (ref.kind === 'object') return isSafeMediaKey(ref.key);
  return ref.kind === 'external' && typeof ref.url === 'string' && (
    /^https?:\/\//i.test(ref.url) ||
    ref.url.startsWith('/') ||
    ref.url.startsWith('data:')
  );
}
