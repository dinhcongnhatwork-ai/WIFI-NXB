# Template publishing deployment

The application now needs `draft_version`, `published_revision_id`, and
`template_revisions`. Do not start the new application against the old schema.
No database migration was executed during development of this change.

The repository previously used `prisma db push` and did not version a complete
migration history. Two tracked migrations now provide that history:

- `20260909000000_existing_schema_baseline`: the schema before publishing,
  including the existing `portal_enabled` column.
- `20260909120000_template_revisions`: additive publishing columns, snapshots,
  pointer constraints, and the immutable revision update trigger.

## Existing installation created with db push

1. Back up the database and rehearse on an isolated copy. Stop application writes
   during migration and deployment so the baseline captures the final live state.
2. Compare the actual schema with `20260909000000_existing_schema_baseline/migration.sql`.
   Confirm the tables and columns already exist, including `campaigns.portal_enabled`.
   Investigate drift before proceeding. Do not execute the baseline CREATE TABLE
   SQL against an existing installation.
3. If the old ignored `20260519100000_add_portal_enabled` directory exists locally,
   move it outside `prisma/migrations` for this deployment. Its column is already
   represented in the complete baseline. Retain a copy; do not rerun its ALTER.
4. Mark only the verified existing schema as applied:

   ```sh
   npx prisma migrate resolve --applied 20260909000000_existing_schema_baseline
   ```

5. Apply the additive publication migration, then generate the client:

   ```sh
   npx prisma migrate deploy
   npx prisma generate
   ```

6. Verify every pre-existing template has a published revision whose layout
   matches the pre-migration layout. Test an existing live campaign before
   resuming writes and routing traffic to the new application.

The migration baselines **all existing templates**, regardless of their old
`status`: the old public API did not use status to determine live eligibility.
It copies JSON exactly without interpreting unknown legacy formats. New templates
created after migration have no published pointer and stay private until publish.

If this installation already has `_prisma_migrations`, review its history before
using the steps above; do not mark migrations applied merely to hide failures.

## Empty isolated database

Use a clean checkout containing only the two tracked migration directories.
`prisma migrate deploy` creates the baseline and then adds publication support.
Never use `db push` alone for this feature: it does not install the immutable
revision trigger or create compatibility snapshots.

## Verification

```sh
npx vitest run tests/publishing.test.ts
```

Database coverage is opt-in. Provision and migrate a separate database whose name
contains `test`, then set `PUBLISHING_TEST_DATABASE_URL` when running that command.
The suite refuses the application `DATABASE_URL`, does not fall back to it, and
never creates/drops a database or schema. It deletes only its own test template.
Without that variable the database integration test is explicitly skipped.

## Rollback

Stop writes and deploy the previous application version, retaining both additive
migrations, all columns, revision rows, and the immutable trigger. Do not drop
revision storage, clear published pointers, or overwrite drafts with snapshots.
The old application reads `layout_json` directly, so rollback restores the old
behavior where drafts may be public; review campaign exposure before routing
traffic. Re-deploying the new application restores snapshot-based publication.
