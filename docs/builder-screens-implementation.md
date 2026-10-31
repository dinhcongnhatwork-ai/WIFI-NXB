# Builder screens implementation

User-approved plan: four independent editable screens (portal, video_gate,
attendance_gate, announcement), accurate pointer coordinates and transactional
Undo, thumbnail media library, five local starter templates, direct meeting
template selection with campaign inheritance, and shared safe preview/runtime.

## Global constraints
- Keep Next.js 14 / React 18 / Tailwind 3, schemaVersion 2 and published snapshots.
- Preserve the existing user change in src/lib/api.ts. Do not seed application DB.
- Work in this checkout on feat/builder-screens-attendance; no commits/push/deploy.
- Use failing behavior tests before substantive implementation; run relevant checks.

## Task 1: Document and editor (root)
Add ScreenId, GateScreenId, PreviewTarget, optional DesignVariant.screens mapping
to DesignSurface { background, backgroundMedia, sections }. Existing variant
sections remain the portal. Gate settings remain variant.flow. Add flow_content
element { id, type, enabled, screen: GateScreenId }. Export screenSurface(variant,
screen), ensureScreens(document), flowNode(variant,screen), findNode(nodes,id).
Ensure exactly one visible flow_content in each custom gate screen, correct
controller, recursive media/validation/copy, and preserve immutable legacy reads.
Build screen tabs, persistent library/layers and independent inspector, transient
pointer transforms, DOM-measured Flow conversion, one Undo per gesture and Escape.

## Task 2: Attendance and public backend
Add optional AttendanceSession.templateId relation and additive migration. Complete
CRUD and shared create/edit form, direct template selector/preview/editor links,
optional campaigns, SSID/AP inputs, correct ISO local-time conversion. Share create
and update validation; preserve old formSchema, close intervals transactionally.
Template direct overrides campaign; enforce published enabled attendance gate for
new activation. Guard template deletion. Shared network/time/AP session resolution
in public portal and submit; never use arbitrary active meeting. Public response
includes effective template/revision and stable portalSessionId reused by video
completion/login/connect. Do not use draft for public runtime. Protect admin CRUD
with existing auth and retain runtime compatibility. Test route behavior with mocks.

## Task 3: Renderer and preview
Shared DocumentRenderer accepts screen?: ScreenId, previewTarget?: PreviewTarget,
attendanceContext?: {session: AttendanceSessionDto; isAlreadyRegistered:boolean},
portalSessionId?: string. Render flow_content inline using extracted functional
gate bodies, surrounding free editable media. Sequential Video -> attendance ->
announcement -> portal, skip disabled/completed meeting. Preview cannot mutate API.
Remove independent participant popup. Keep 9:16 video on desktop, contain sizing.
Standalone preview supports screen choice, devices/presets/rotation/restart.

## Task 4: Media and starter templates
Thumbnail-only media grid; callback URL first + optional MediaItem second; add
multi-selection. Integrate image/video selection and sliders in editor. Five
templates named Mẫu 1..5: corporate, hotel, cafe, event/vertical video, retail.
All variants and gate screens, locally packaged demo media and actual thumbnails,
only portal enabled. Copy starter through existing create API, no database seed.

## Task 5: Integration and review
Run Vitest, TypeScript, production build and Playwright gestures/preview/CRUD.
Browser dependencies may need local cached libraries; keep application DB intact.
Check legacy revisions, autosave conflicts, network matching and media references.
