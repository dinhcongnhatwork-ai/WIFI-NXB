# Task 3 — shared renderer and preview

Implemented `DocumentRenderer` screen selection, independent surface background/sections,
and one inline functional block for video, attendance or announcement. Editing keeps the
disabled screen design visible; simulation shows an explicit disabled prompt with an
editor return link in standalone preview. Node/section selection attributes and section
scale remain available. Parent overlays render before nested children.

The runtime renders one active screen at a time in video → eligible attendance →
announcement → portal order. Attendance requires the resolved ACTIVE session and an
unregistered device. The form uses that session's dynamic schema (text, textarea,
number/email/phone/date, select, radio and checkbox), validates required answers, and
submits session ID, network/AP context, stable portalSessionId and answers. Completion
errors keep the current gate open. Video completion uses the stable API-issued session;
announcement never records video completion. Final connect carries portalSessionId.

Public portal requests its device variant and uses the resolved response variant so
design and backend gate checks agree. It forwards AP/site aliases and removes the
independent participant popup and floating attendance prompt. Valid legacy templates
normalize through the shared renderer; unsupported layouts display an error.

Standalone preview supports query `screen`, single screen/whole flow, mobile/tablet/PC,
presets, zoom, rotation and restart. Mocked attendance is isolated from live context.
Edit/simulation gate actions resolve locally and final connect is intercepted in
simulation; success/error/wait outcomes can be exercised without API mutations.
Portrait gate video remains 9:16 on desktop; constrained media uses contain sizing.
Slider state resets for independent device media.

## Verification

- Before implementation, all four existing-renderer behavioral tests failed for the
  expected missing screen selection/inline content/disabled preview/portrait ratio.
- `npm test -- tests/renderer.test.ts tests/renderer-runtime.test.ts`: 10 tests pass.
  Coverage includes sequential eligibility, registered/ended/missing meetings, stable
  gate payloads, edit/simulate API isolation, announcement isolation and API failure.
- Full `npm test` at 14:23 UTC: 96 passed, 1 skipped, 3 failures in concurrently unfinished
  preset media/create work; no renderer failures.
- `npx tsc --noEmit --pretty false`: exit 0 after final renderer and device changes.
- Browser/build verification belongs to root to avoid competing processes. No database,
  commits, push or deployment performed.

## Review round 1

Nested edit wrappers now use z-index 31 inside their parent's stacking context,
above parent editor hit areas at 20/30. Root wrappers retain normal layer ordering.
A selected-parent regression with rotated child and grandchild failed before this
fix and now passes. The standalone disabled-screen editor link targets `/builder`.

Fresh focused verification: 11 renderer tests pass; TypeScript exits 0. Two isolated
Playwright tests in `tests/e2e/renderer.spec.ts` verify single attendance field reset
and video countdown reset on internal restart and assert zero API mutations across
both replays. Root runs these against the shared development server.
