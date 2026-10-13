import { test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { expectedVersion, normalizeDraft, publishDraft, restoreRevision, saveDraft } from '../src/lib/template-publishing';
import { GET as getDraft } from '../src/app/api/templates/[id]/route';
import { GET as getRevisions } from '../src/app/api/templates/[id]/revisions/route';
import { GET as getPortal } from '../src/app/api/portal/route';
import { createDocument, createNode } from '../src/lib/template-document';
import { prisma } from '../src/lib/prisma';

test('draft and revision reads require authentication before database access', async () => {
  for (const route of [getDraft, getRevisions]) {
    const response = await route(new NextRequest('http://localhost/api/templates/example'), { params: { id: 'example' } });
    assert.equal(response.status, 401);
  }
});
test('versions reject absent or invalid values; unknown legacy JSON is preserved', () => {
  for (const value of [undefined, null, '1', 0, -1, 1.5]) assert.throws(() => expectedVersion(value));
  assert.equal(expectedVersion(1), 1);
  const unfamiliar = { customLegacyDocument: { untouched: true } };
  assert.deepEqual(normalizeDraft(unfamiliar), unfamiliar);
});
test('drafts allow incomplete content but reject malformed geometry and media', () => {
  const document = createDocument();
  document.variants.mobile.sections[0].nodes.push(createNode('image'));
  assert.doesNotThrow(() => normalizeDraft(document));
  document.variants.mobile.sections[0].nodes[0].layout.width = -1;
  assert.throws(() => normalizeDraft(document), { status: 400 });
  assert.throws(() => normalizeDraft({ schemaVersion: 2, variants: {} }), { status: 400 });
});
test('public portal returns only the immutable snapshot', async () => {
  const original = prisma.campaign.findFirst;
  prisma.campaign.findFirst = (async () => ({ id: 'campaign', redirectUrl: null, template: { id: 'template', layoutJson: { secretDraft: true }, publishedRevision: { layoutJson: { published: true } } } })) as unknown as typeof original;
  try {
    const response = await getPortal(new NextRequest('http://localhost/api/portal'));
    const body = await response.json();
    assert.deepEqual(body.data.layout, { published: true });
    assert.equal(JSON.stringify(body).includes('secretDraft'), false);
  } finally { prisma.campaign.findFirst = original; }
});

// Opt-in ONLY: provision an isolated DB and apply migrations externally first.
// Never reads DATABASE_URL as a fallback and never creates/drops schemas.
const isolatedUrl = process.env.PUBLISHING_TEST_DATABASE_URL;
test.skipIf(!isolatedUrl)('isolated database: conflict, snapshot isolation, restore and immutable revisions', async () => {
  assert.notEqual(isolatedUrl, process.env.DATABASE_URL, 'Test database must differ from application database');
  const url = new URL(isolatedUrl!);
  assert.match(url.pathname, /test/i, 'Isolated database name must contain test');
  const db = new PrismaClient({ datasources: { db: { url: isolatedUrl } } });
  const initial = { type: 'page', children: [] };
  const template = await db.template.create({ data: { name: 'publishing isolated test', layoutJson: initial } });
  try {
    assert.equal(template.publishedRevisionId, null);
    const results = await Promise.allSettled([
      saveDraft(db, template.id, 1, { name: 'writer one' }),
      saveDraft(db, template.id, 1, { name: 'writer two' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.status, 409);
    const published = await publishDraft(db, template.id, 2, 'test-author');
    assert.deepEqual(published.publishedRevision!.layoutJson, initial);
    const draft = await saveDraft(db, template.id, published.draftVersion, { layoutJson: { type: 'page', children: [{ type: 'text' }] } });
    assert.deepEqual(draft.publishedRevision!.layoutJson, initial);
    await assert.rejects(publishDraft(db, template.id, published.draftVersion, 'stale'), { status: 409 });
    const restored = await restoreRevision(db, template.id, published.publishedRevisionId!, draft.draftVersion);
    assert.deepEqual(restored.layoutJson, initial);
    assert.equal(restored.publishedRevisionId, published.publishedRevisionId);
    await assert.rejects(db.templateRevision.update({ where: { id: published.publishedRevisionId! }, data: { author: 'tampered' } }));
  } finally {
    await db.template.delete({ where: { id: template.id } });
    await db.$disconnect();
  }
});
