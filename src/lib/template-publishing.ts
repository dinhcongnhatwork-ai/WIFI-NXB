import { Prisma, PrismaClient } from '@prisma/client';
import { COMPONENT_LABELS, DEVICE_KEYS, isTemplateDocumentV2, validMediaRef, validateDocument } from '@/lib/template-document';
import { normalizeLegacyMediaUrl } from '@/lib/minio';
import { isTemplateConfig, normalizeTemplateConfigMedia } from '@/types';

export class PublishingError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export function expectedVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new PublishingError(400, 'expectedVersion must be a positive integer');
  return value as number;
}
export function normalizeStoredMedia(value: unknown): unknown {
  if (typeof value === 'string') return normalizeLegacyMediaUrl(value);
  if (Array.isArray(value)) return value.map(normalizeStoredMedia);
  if (value && typeof value === 'object') {
    const normalized = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, normalizeStoredMedia(entry)]));
    if (normalized.kind === 'external' && typeof normalized.url === 'string' && normalized.url.startsWith('/api/media/')) {
      return { kind: 'object', key: normalized.url.slice(11).split('/').map(decodeURIComponent).join('/') };
    }
    return normalized;
  }
  return value;
}
// Normalize response copies only: immutable snapshots remain byte-for-byte in DB.
export function templateForRead<T extends { layoutJson: unknown; publishedRevision?: { layoutJson: unknown } | null }>(template: T): T {
  return { ...template, layoutJson: normalizeStoredMedia(template.layoutJson), ...(template.publishedRevision ? { publishedRevision: { ...template.publishedRevision, layoutJson: normalizeStoredMedia(template.publishedRevision.layoutJson) } } : {}) } as T;
}
// Drafts may be incomplete, but malformed structures must never enter the editor.
function validateDraftStructure(value: Record<string, unknown>) {
  if (value.schemaVersion === undefined) return;
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const fail = () => { throw new PublishingError(400, 'Malformed V2 document structure'); };
  if (value.schemaVersion !== 2 || !object(value.variants) || !Array.isArray(value.brandColors)) fail();
  let count = 0;
  const media = (v: unknown) => { if (!object(v) || !Object.values(v).every(ref => validMediaRef(ref as Parameters<typeof validMediaRef>[0]))) fail(); };
  const walk = (v: unknown, ids: Set<string>, depth = 0): void => {
    if (!object(v) || ++count > 2000 || depth > 10) return fail();
    if (typeof v.id !== 'string' || ids.has(v.id) || !object(v.element) || typeof v.element.type !== 'string' || !Object.hasOwn(COMPONENT_LABELS, v.element.type) || !object(v.layout)) return fail();
    ids.add(v.id);
    for (const key of ['x', 'y', 'width', 'height', 'rotation']) if (typeof v.layout[key] !== 'number' || !Number.isFinite(v.layout[key])) fail();
    if ((v.layout.width as number) <= 0 || (v.layout.height as number) <= 0) fail();
    media(v.media);
    if (v.children !== undefined) { if (!Array.isArray(v.children)) return fail(); v.children.forEach(child => walk(child, ids, depth + 1)); }
  };
  for (const device of DEVICE_KEYS) {
    const variant = (value.variants as Record<string, unknown>)[device];
    if (!object(variant) || !object(variant.viewport) || !object(variant.background) || !object(variant.flow) || !Array.isArray(variant.sections)) return fail();
    if (![variant.viewport.width, variant.viewport.height].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 240 && n <= 4096)) fail();
    media(variant.backgroundMedia);
    const ids = new Set<string>();
    for (const section of variant.sections) {
      if (!object(section) || !['flow', 'freeform'].includes(section.mode as string) || !Array.isArray(section.nodes) || ![section.width, section.height].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return fail();
      section.nodes.forEach(node => walk(node, ids));
    }
    for (const node of Object.values(variant.flow)) if (node !== undefined && node !== null) walk(node, ids);
  }
}
export function normalizeDraft(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublishingError(400, 'layoutJson must be a document object');
  if (isTemplateDocumentV2(value)) value = normalizeStoredMedia(value);
  validateDraftStructure(value as Record<string, unknown>);
  // Preserve unfamiliar legacy formats exactly. Never substitute an empty layout.
  return (isTemplateConfig(value) ? normalizeTemplateConfigMedia(value) : value) as Prisma.InputJsonValue;
}
export function validatePublish(value: unknown) {
  if (isTemplateDocumentV2(value)) {
    validateDraftStructure(value as unknown as Record<string, unknown>);
    const issues = validateDocument(value);
    if (issues.some(issue => issue.severity === 'error')) throw new PublishingError(422, 'Draft is not ready to publish', issues);
    return issues;
  }
  // Legacy snapshots are preserved for compatibility; reject unrecognized drafts.
  if (!isTemplateConfig(value) && !(value && typeof value === 'object' && 'type' in value && value.type === 'page' && 'children' in value && Array.isArray(value.children))) {
    throw new PublishingError(422, 'Unsupported legacy document; migrate it before publishing');
  }
  return [];
}
export async function saveDraft(db: PrismaClient, id: string, version: number | undefined, data: Prisma.TemplateUpdateManyMutationInput) {
  if (data.status !== undefined && (typeof data.status !== 'string' || data.status === 'published')) throw new PublishingError(400, 'Use the publish endpoint to publish a validated revision');
  return db.$transaction(async tx => {
    const current = await tx.template.findUnique({ where: { id } });
    if (!current) throw new PublishingError(404, 'Template not found');
    if (version === undefined && data.layoutJson !== undefined) throw new PublishingError(400, 'expectedVersion is required when changing layoutJson');
    const changed = await tx.template.updateMany({ where: { id, draftVersion: version ?? current.draftVersion }, data: { ...data, draftVersion: { increment: 1 } } });
    if (!changed.count) throw new PublishingError(409, 'Draft changed; reload before saving');
    return tx.template.findUniqueOrThrow({ where: { id }, include: { campaigns: true, publishedRevision: true } });
  });
}
export async function publishDraft(db: PrismaClient, id: string, version: number, author: string) {
  return db.$transaction(async tx => {
    const current = await tx.template.findUnique({ where: { id } });
    if (!current) throw new PublishingError(404, 'Template not found');
    if (current.draftVersion !== version) throw new PublishingError(409, 'Draft changed; reload before publishing');
    const warnings = validatePublish(current.layoutJson);
    // Claim this exact draft before snapshot creation; concurrent writers wait and
    // re-evaluate the version predicate, so a stale publish cannot win.
    const claimed = await tx.template.updateMany({ where: { id, draftVersion: version }, data: { draftVersion: { increment: 1 } } });
    if (!claimed.count) throw new PublishingError(409, 'Draft changed; reload before publishing');
    const revision = await tx.templateRevision.create({ data: { templateId: id, layoutJson: current.layoutJson as Prisma.InputJsonValue, author } });
    const template = await tx.template.update({ where: { id }, data: { publishedRevisionId: revision.id, status: 'published' }, include: { publishedRevision: true, campaigns: true } });
    return { ...template, warnings };
  });
}
export async function restoreRevision(db: PrismaClient, id: string, revisionId: string, version: number) {
  const revision = await db.templateRevision.findFirst({ where: { id: revisionId, templateId: id } });
  if (!revision) throw new PublishingError(404, 'Revision not found');
  return saveDraft(db, id, version, { layoutJson: revision.layoutJson as Prisma.InputJsonValue, status: 'draft' });
}
