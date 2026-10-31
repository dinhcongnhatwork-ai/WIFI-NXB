# Builder Task 2 — attendance and public backend

Implemented locally on the existing checkout. No commits, push, deployment, database migration application, or database seed was performed. The existing user edit in `src/lib/api.ts` was preserved.

## Result

- Optional `AttendanceSession.templateId` relation with indexed additive migration, `ON DELETE RESTRICT`, and a `.gitignore` exception so the migration is reviewable.
- Shared create/update validation covers required strings, timezone-qualified ISO times, time order, status, warning threshold, AP arrays, custom form fields, existing references, and overlapping READY/ACTIVE sessions on the same SSID/site/AP scope. DRAFT sessions may select unpublished templates. A new activation, or template/campaign change while active, requires a published enabled attendance controller.
- Authenticated attendance list/create/detail/update/delete and registration read/device-update routes. Existing list/live dashboard requests now send the admin Bearer token; the shared form does likewise.
- Create/log and update/status/log/interval closure are transactional. Session ending closes every open interval and stamps the same ending time within the update transaction. SSID/site scheduling advisory locks prevent concurrent overlap validation from silently producing two competing active sessions (see the review round below).
- Shared `AttendanceSessionForm` used by both create and edit pages, with optional campaign inheritance and explicit direct template priority, published/draft labels, preview/editor links to the attendance screen, manual SSID/site/AP fields, and UniFi SSID/device refresh with manual fallback. Selected APs are not arbitrarily preselected.
- Browser-local `datetime-local` values convert to ISO UTC on submit and back to local values on load. Editing omits formSchema, name/id keys, and dialog fields, preserving legacy custom attendance schema instead of resetting it.
- One shared public resolver matches ACTIVE sessions by SSID, current scheduled interval, optional site and AP target. Missing/wrong AP excludes an AP-targeted session. Missing SSID, mismatched explicit session IDs, expired sessions, and ambiguous matches produce no attendance session. There is no arbitrary ACTIVE-meeting fallback.
- Public runtime selects the session's directly assigned published snapshot first, linked campaign published snapshot second, and then a scheduled published network campaign. Draft layout is never used by portal/login/connect/video-complete. An explicit portal assignment remains available when no SSID context is supplied.
- Stable signed portal IDs bind network, AP, normalized MAC, meeting, effective template/revision, and campaign. Video completion validates the current signed context, published video controller type, and MAC before writing the existing Redis completion key. Announcement IDs cannot be used as video-session IDs; an announcement controller in a historical V2 video slot cannot count either.
- Login and redirect-based connect enforce published video completion and attendance registration before authorization. Template DELETE returns 409 for directly referenced attendance templates; the FK additionally prevents referential deletion races.

## Public interface

`GET /api/portal` retains `layout`, `templateId`, `campaignId`, `redirectUrl`, `params`, `attendanceSession`, and `isAlreadyRegistered` and adds:

```ts
{
  effectiveTemplateId: string | null;
  publishedRevisionId: string | null;
  portalSessionId: string; // stable signed context, opaque to UI
  params: {
    mac: string; ip: string; ssid: string; apMac: string; unifiSite: string;
    device: 'mobile' | 'tablet' | 'desktop';
    'link-login': string; 'link-login-only': string;
    'link-orig': string; trial: string;
  };
  attendanceSession: AttendanceSessionDto | null;
}
```

The attendance session preserves all previous dialog/form keys and now returns the full DTO (identity keys, network/site/AP scope, times, status, created/updated times, optional direct template ID). The admin list/detail additionally supplies template/campaign display names. SSID aliases and AP aliases (`apMac`, `ap-mac`, `ap`, `AP`) remain accepted by the portal endpoint.

- Video completion: `{ portalSessionId, mac }`; `sessionId` is a legacy alias for the same signed portal ID.
- Login/connect: pass `portalSessionId`; `sessionId` is retained as the signed-ID alias. MAC and optionally SSID/AP are checked against the token; the signed context supplies omitted network values.
- Attendance submit: `{ sessionId: attendanceSession.id, ssid, apMac, mac, answers, portalSessionId? }`. An optional portal token can supply missing SSID/AP/site and is checked for MAC/meeting mismatches. Submit-generated connect URLs preserve the portal token and AP, so video completion is reusable at connect.

## Test evidence

Behavior tests were added before substantive backend edits:

1. Initial `npm test -- tests/attendance-routes.test.ts`: **11 failed**, with expected behavior differences:
   - unrelated ACTIVE meeting exposed instead of null;
   - campaign template selected instead of direct published template;
   - wrong target AP still exposing a meeting;
   - cross-SSID submission returning schema errors instead of 404;
   - unauthenticated list returning 200 instead of 401;
   - invalid update time accepted instead of 400;
   - direct template/campaign edits ignored;
   - activation with unpublished template accepted;
   - referenced template deletion accepted;
   - arbitrary announcement video completion accepted;
   - connect redirecting before video completion.
2. After initial implementation: **11/11 passed**.
3. Additional registration-auth regression was observed returning 200 instead of 401 before its route guard was added.
4. Local-time helper test initially returned undefined instead of an ISO value; after implementation it passed both in UTC and with `TZ=Asia/Ho_Chi_Minh`.
5. A historical V2 announcement-controller regression initially returned 200 instead of 400 for completion. Explicit controller-type validation changed it to 400.
6. Further integration coverage verifies successful signed video completion/connect, normalized MAC reuse, rejection of another MAC, ignoring draft video settings, and transactional ending/interval closure.

Latest focused command:

```sh
npm test -- tests/attendance-routes.test.ts tests/attendance-form-time.test.ts tests/attendance-state-machine.test.ts tests/attendance-excel.test.ts
```

**27/27 tests passed across four files** (17 route, one time, seven existing state-machine, two existing Excel tests). Vitest emitted the existing Vite CJS deprecation notice.

Other verification:

- `npm run db:generate`: passed; generated Prisma client only.
- `npx prisma validate`: passed.
- `TZ=Asia/Ho_Chi_Minh npm test -- tests/attendance-form-time.test.ts`: passed.
- `git diff --check`: passed.
- `npx tsc --noEmit --pretty false`: remaining error is the concurrent CMS/renderer integration (`CmsCanvas.tsx` passing `screen` to DocumentRenderer before renderer Props is extended). No attendance errors remained in this run.

## Changed files owned by this task

- `.gitignore`
- `prisma/schema.prisma`
- `prisma/migrations/20261013141000_attendance_direct_template/migration.sql`
- `src/types/attendance.ts`
- `src/lib/attendance/constants.ts`
- `src/lib/attendance/runtime.ts` (new)
- `src/lib/attendance/session-validation.ts` (new)
- `src/components/attendance/AttendanceSessionForm.tsx` (new)
- `src/app/admin/attendance/new/page.tsx`
- `src/app/admin/attendance/[id]/edit/page.tsx`
- `src/app/admin/attendance/page.tsx`
- `src/app/admin/attendance/[id]/page.tsx`
- `src/app/api/attendance/sessions/route.ts`
- `src/app/api/attendance/sessions/[id]/route.ts`
- `src/app/api/attendance/sessions/[id]/registrations/route.ts`
- `src/app/api/attendance/portal/submit/route.ts`
- `src/app/api/portal/route.ts`
- `src/app/api/login/route.ts`
- `src/app/api/connect/route.ts`
- `src/app/api/video-complete/route.ts`
- `src/app/api/templates/[id]/route.ts` (DELETE guard only)
- `tests/attendance-routes.test.ts` (new)
- `tests/attendance-form-time.test.ts` (new)
- `docs/builder-attendance-report.md` (this report)

## Integration work and limits

- Root owns the fresh dev server, browser smoke, renderer/public UI wiring, whole-project TypeScript, and production build. This task did not start a competing Next server or claim browser/build success.
- The additive migration remains unapplied as required. The changed Prisma queries need this migration applied by the normal deployment workflow before running against an existing database.
- AP matching is used when the network supplies an AP. If AP is unknown, a single network/time candidate may match; multiple candidates are ambiguous and cannot authorize or enroll a visitor. See the review round below for the corrected implementation.
- Stable portal IDs have no client-side fabricated UUID fallback; use the server-returned ID. Revision or meeting/network-context changes invalidate previous completion IDs. Redis completion retains its existing one-hour TTL.
- Gate enforcement uses the signed device variant and excludes hidden controllers. Activation checks attendance readiness on all three V2 variants. See the review round below for the corrected interface.
- Existing standalone export/SSE/monitor routes were outside this changed CRUD/auth scope and were left unchanged, following root's request to finish focused work rather than extend unrelated auth coverage.


## Review fix round 1

The review identified real gaps in the first implementation. The following fixes supersede the earlier all-variants gate policy, unknown-AP rejection, and reliance on serializable transactions alone.

### Authorization and authoritative selection

- Client-provided campaign IDs no longer filter effective public campaign selection. An invalid or alternate selector cannot remove the currently selected network's published gates.
- Connect/login require a signed portal ID when the resolved runtime has an attendance meeting, ambiguous meeting scope, or an enabled visible video/attendance/announcement gate. Ungated published network portals retain legacy unsigned access with SSID.
- Missing SSID without a signed context is rejected. A signed ID issued for the informational fallback with no effective published portal also cannot authorize; connect/login return 403 when no published effective portal is resolved.
- AP-less router requests now match exactly one ACTIVE meeting eligible for SSID/site/time. Multiple eligible candidates remain ambiguous, even if a client supplies one candidate's session ID; ambiguity prevents enrollment and authorization. A supplied incorrect AP still excludes targeted sessions.

### Device contract

```ts
interface NetworkContext {
  // Previous fields retained.
  device?: 'mobile' | 'tablet' | 'desktop';
}
hasPublishedGate(layout, screen, device = 'mobile'): boolean;
isAttendanceTemplateReady(layout): boolean;
```

- `parseDevice` validates selectors; absent values default to mobile for legacy callers.
- The device is included in the signed portal ID and returned as `params.device`; `params.unifiSite` and `params.apMac` are also retained.
- Public video completion/login/connect evaluate the token's authoritative device only, checking typed, enabled, non-hidden controllers in that V2 variant. A supplied different device cannot override the signed choice.
- Activation separately requires visible enabled attendance controllers on all three V2 variants. Legacy single-layout snapshots use their single attendance controller.
- Public response also adds `attendanceAmbiguous: boolean` for callers to identify unresolved attendance scope.
- Root/renderer handoff: request `device=variantForWidth(window.innerWidth)` when loading the portal; render using the returned `params.device`. Video completion payload remains `{portalSessionId, mac}`.

### Session transition and scheduling coordination

- Added `src/lib/attendance/locking.ts` with parameterized `SELECT ... FOR UPDATE` for the attendance session row. Submit and PATCH/END acquire the same lock before reading current status, scheduled times, network/AP scope, registrations, or open intervals.
- Submit resolves an ID before entering its transaction, locks it, then rechecks ACTIVE/time/context inside the transaction. Registration, new interval, unregistered-client cleanup, and registration log are written together. A submitted token is revalidated against the current effective runtime inside that lock.
- END waits for any in-flight submission to finish before reading and closing intervals. If END commits first, a waiting submit sees ENDED and returns 404 without creating a registration or interval.
- Scheduling create/PATCH acquire transaction-scoped advisory locks on SSID/site before checking overlap. PATCH locks both old and new scopes in sorted order. ReadCommitted isolation ensures the post-lock validation reads the last committed schedule rather than a snapshot taken before waiting.
- Submit-generated connect URLs always include the server's signed portal ID, including legacy submissions that did not initially supply one.

### Form correction

- `TemplateOption` includes thumbnail metadata.
- The shared form now offers an expandable thumbnail radio grid, including campaign inheritance, with draft/published labels and a selected-template thumbnail. The existing dropdown remains for larger libraries.
- The AP hint explains the unique network/time fallback when the router supplies no AP.

### Red and green evidence

- Eight new route regressions initially failed for the reviewed bypass/ambiguity/device/readiness scenarios: unsigned connect returned 302, a forged campaign selector removed gates, AP-less unique meeting was not returned, ambiguity authorized, device was not returned/signed, invalid device was accepted, and an attendance controller hidden in one variant still allowed activation.
- A ninth regression caught a signed informational fallback ID authorizing without a resolved published portal: observed 302 before correction, 403 afterward.
- New `tests/attendance-concurrency.test.ts` uses a stateful DB double with transaction-scoped lock queues and persisted registration/interval state, not merely assertions that a lock function was called. All four tests failed before coordination:
  1. END-first race registered afterward (200 instead of 404).
  2. Submit-first race left the newly created interval open after END.
  3. Concurrent overlapping READY creates both returned 200.
  4. Concurrent overlapping DRAFT-to-READY updates both returned 200.
- After row/scheduling coordination, both race orderings preserve the ended session's interval state; concurrent scheduling admits one mutation and rejects the overlapping one with 400.

Latest focused verification:

```sh
npm test -- tests/attendance-routes.test.ts tests/attendance-concurrency.test.ts tests/attendance-form-time.test.ts tests/attendance-state-machine.test.ts tests/attendance-excel.test.ts
```

**40/40 tests passed across five files** (26 route, four concurrency, one local-time, seven state-machine, two Excel). `npx tsc --noEmit --pretty false` also passed after the round-one changes. The Vite CJS deprecation notice remains pre-existing.

The concurrency tests model the PostgreSQL row/advisory-lock behavior without applying migrations or writing to an actual database. Production/database integration and browser smoke remain root-owned. Whole-checkout whitespace checking observed an extra EOF blank line in the concurrently changed `PortalRenderer.tsx`; no owned attendance file produced a whitespace error.

Additional owned files in this round: `src/lib/attendance/locking.ts` and `tests/attendance-concurrency.test.ts`. No renderer or public portal UI files were modified by this task.
