import { allNodes, clone, DEVICE_KEYS, flattenNodes, flowNode, GATE_SCREENS, screenSurface, type DesignNode, type DeviceVariant, type ScreenId, type TemplateDocumentV2 } from '../template-document';

export type DeviceSyncMode = 'off' | 'content' | 'content-style';
export interface SyncResult { updated: number; skipped: number }
const contentFields = new Set(['enabled', 'content', 'text', 'alt', 'src', 'poster', 'videoUrl', 'imageUrl', 'imageSrc', 'images', 'title', 'message', 'dialogTitle', 'dialogMessage', 'buttonText', 'successMessage', 'nameLabel', 'namePlaceholder', 'departmentLabel', 'departmentPlaceholder', 'phonePlaceholder', 'termsText', 'showPhone', 'requireConfirm', 'skipAfter', 'autoplay', 'muted', 'loop', 'controls', 'interval', 'required', 'sessionId']);
// These remain local even when visual styles are linked: each device keeps its composition.
const localFields = new Set(['id', 'type', 'screen', 'width', 'height', 'fontSize', 'lineHeight', 'letterSpacing', 'align', 'position', 'aspectRatio', 'objectFit', 'zoom', 'posX', 'posY', 'frameWidth', 'imageWidth', 'buttonWidth', 'maxWidth', 'paddingX', 'paddingY', 'marginTop', 'marginBottom']);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fieldsFor = (node: DesignNode, mode: DeviceSyncMode, fields: string[]) => fields.filter(field => !localFields.has(field) && !/Desktop$/.test(field) && (mode === 'content-style' || contentFields.has(field)));
const signature = (node: DesignNode) => JSON.stringify(Object.fromEntries(Object.entries(node.element).filter(([key]) => ['content', 'text', 'alt', 'src', 'title', 'message'].includes(key))));

function counterpart(source: DesignNode, sourceNodes: DesignNode[], targetNodes: DesignNode[]) {
  const typed = targetNodes.filter(n => n.element.type === source.element.type);
  const identified = typed.filter(n => n.id === source.id);
  if (identified.length === 1) return identified[0];
  const named = typed.filter(n => n.name === source.name);
  const sourceNamed = sourceNodes.filter(n => n.element.type === source.element.type && n.name === source.name);
  if (named.length === 1 && sourceNamed.length === 1) return named[0];
  // Repeated descriptions may be matched only by unique previous content, never by order.
  const candidates = named.filter(n => signature(n) === signature(source));
  if (candidates.length === 1 && sourceNamed.filter(n => signature(n) === signature(source)).length === 1) return candidates[0];
}

function synchronize(before: TemplateDocumentV2, after: TemplateDocumentV2, device: DeviceVariant, mode: DeviceSyncMode, force: boolean): SyncResult {
  const result = { updated: 0, skipped: 0 };
  if (mode === 'off') return result;
  const oldById = new Map(allNodes(before.variants[device]).map(n => [n.id, n]));
  const pairs: { node: DesignNode; old: DesignNode; peers: DesignNode[]; screen?: ScreenId; gate?: typeof GATE_SCREENS[number] }[] = [];
  for (const screen of ['portal', ...GATE_SCREENS] as ScreenId[]) {
    const nodes = screenSurface(after.variants[device], screen).sections.flatMap(s => flattenNodes(s.nodes));
    const peers = screenSurface(before.variants[device], screen).sections.flatMap(s => flattenNodes(s.nodes));
    for (const node of nodes) { const old = oldById.get(node.id); if (old && node.element.type !== 'flow_content') pairs.push({ node, old, peers, screen }); }
  }
  for (const gate of GATE_SCREENS) { const node = flowNode(after.variants[device], gate); if (node) { const old = oldById.get(node.id); if (old) pairs.push({ node, old, peers: [], gate }); } }
  for (const { node, old, peers, screen, gate } of pairs) {
    const previous = old.element as unknown as Record<string, unknown>, current = node.element as unknown as Record<string, unknown>;
    const fields = fieldsFor(node, mode, Array.from(new Set([...Object.keys(previous), ...Object.keys(current)]))).filter(field => force || !same(previous[field], current[field]) || !same(old.media[field], node.media[field]));
    if (!fields.length) continue;
    for (const target of DEVICE_KEYS.filter(key => key !== device)) {
      const targetNodes = screen ? screenSurface(after.variants[target], screen).sections.flatMap(s => flattenNodes(s.nodes)) : [];
      const match = gate ? flowNode(after.variants[target], gate) : counterpart(old, peers, targetNodes);
      if (!match || match.locked) { result.skipped++; continue; }
      const element = match.element as unknown as Record<string, unknown>;
      let changed = false;
      for (const field of fields) {
        if (same(element[field], current[field]) && same(match.media[field], node.media[field])) continue;
        if (current[field] === undefined) delete element[field]; else element[field] = clone(current[field]);
        if (node.media[field]) match.media[field] = clone(node.media[field]); else delete match.media[field];
        changed = true;
      }
      if (changed) result.updated++;
    }
  }
  return result;
}
export function syncDeviceChanges(before: TemplateDocumentV2, after: TemplateDocumentV2, device: DeviceVariant, mode: DeviceSyncMode) { return synchronize(before, after, device, mode, false); }
export function syncDeviceContent(document: TemplateDocumentV2, device: DeviceVariant, mode: DeviceSyncMode) { return synchronize(clone(document), document, device, mode, true); }
