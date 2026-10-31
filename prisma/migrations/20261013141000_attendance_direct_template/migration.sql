-- Existing sessions continue inheriting their campaign template.
ALTER TABLE "attendance_sessions" ADD COLUMN "template_id" TEXT;
CREATE INDEX "attendance_sessions_template_id_idx" ON "attendance_sessions"("template_id");
ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
