-- Additive migration. Baseline EVERY pre-existing template: status historically did
-- not control portal eligibility. Never rewrite or infer its legacy JSON format.
ALTER TABLE "templates" ADD COLUMN "draft_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "published_revision_id" TEXT;
CREATE TABLE "template_revisions" (
  "id" TEXT PRIMARY KEY,
  "template_id" TEXT NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
  "layout_json" JSONB NOT NULL,
  "author" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "template_revisions_template_id_created_at_idx" ON "template_revisions"("template_id", "created_at");
CREATE UNIQUE INDEX "templates_published_revision_id_key" ON "templates"("published_revision_id");
INSERT INTO "template_revisions" ("id", "template_id", "layout_json", "author")
SELECT 'baseline-' || "id", "id", "layout_json", 'migration:legacy-baseline' FROM "templates";
UPDATE "templates" SET "published_revision_id" = 'baseline-' || "id";
ALTER TABLE "templates" ADD CONSTRAINT "templates_published_revision_id_fkey"
  FOREIGN KEY ("published_revision_id") REFERENCES "template_revisions"("id") ON DELETE SET NULL;
-- Enforce immutable revision contents, including for direct SQL clients.
CREATE FUNCTION reject_template_revision_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Template revisions are immutable'; END;
$$;
CREATE TRIGGER template_revisions_immutable BEFORE UPDATE ON "template_revisions"
FOR EACH ROW EXECUTE FUNCTION reject_template_revision_update();
-- Rollback: deploy prior application code while retaining these additive tables,
-- columns and snapshots. Do NOT drop revisions or copy published data onto drafts.
