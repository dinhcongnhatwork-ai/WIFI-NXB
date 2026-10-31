# Starter templates: implementation and verification

Implemented the starter-template portion of Task 4 without database seeding,
backend changes, dependency changes, or a Next.js build. Applied the
`frontend-design` skill to give each sample a distinct palette, original artwork,
wordmark, real Vietnamese copy, and restrained button treatment.

## Delivered

- Exactly **Mẫu 1** through **Mẫu 5**: corporate navy/white, hotel cream/editorial,
  café earth tones with two-image slider, high-contrast event with prepared 9:16
  Video Gate, and retail promotion with slider and prepared 16:9 Video Gate.
- Each document contains mobile, tablet, and desktop variants, with independent
  portal, video, attendance, and announcement surfaces. Every custom gate surface
  contains one visible matching `flow_content`; settings stay in variant.flow.
- Only the portal is active initially. Gate controllers have valid demo media and
  complete copy/settings, so enabling them passes publication validation.
- `createPresetDocument` clones a private master and regenerates all section/node
  IDs, including every gate screen and controller. A user edit cannot affect
  another created template or the catalogue.
- Shared `PresetGallery` appears on the template listing and create page. The
  listing retains search, filters, selection, management menus, and existing
  template cards. Blank creation remains available and now uses schemaVersion 2.
- A preview dialog exposes all four screens and three device variants; it has
  focus trapping, Escape dismissal, body-scroll restoration, and editable-content
  rendering without creating records. Choosing a preset explicitly posts a fresh
  draft and thumbnail through the existing authenticated `/api/templates`, then
  navigates to its builder. An optional entered name overrides the preset name.
  Pending state prevents duplicate selection requests; errors allow retry.

## Media and licensing

`public/template-presets/` contains 13 original SVG illustrations/wordmarks, five
WebP thumbnails captured from the actual shared renderer, and two six-second
silent H.264 baseline MP4s. The videos animate original local artwork; no external
footage, stock image, or third-party logo is included. Original artwork and
fictional demo identities were created for this repository. No external media
attribution is required. DejaVu was used as a local font fallback to rasterize
thumbnails/video frames; no fonts or generation-tool binaries are shipped.

Both videos have MP4 faststart and yuv420p pixel format. Landscape is 640×360;
portrait is 360×640. The complete asset directory is approximately 380 KB.
All references are `/template-presets/...`; there are no remote runtime media
URLs. Asset inventory and provenance are also in the directory's README.

## Evidence

1. Before implementation, `tests/presets.test.ts` recorded nine expected failures
   against an empty catalogue/factory stub. The create-helper tests recorded two
   expected failures against its unimplemented stub.
2. `npx vitest run tests/presets.test.ts tests/presets-create.test.ts` passed
   **12/12 tests**. Coverage includes five exact names, all variants and screens,
   draft normalization, publication with every gate enabled, clone isolation and
   globally fresh IDs, local asset existence, MP4 container signatures, image
   sliders and orientation, authenticated POST payload, default/custom names,
   missing auth and unknown IDs without a request, and propagation of API errors.
3. `npx tsc --noEmit --incremental false` passed after implementation.
4. Playwright loaded both local MP4s, verified dimensions and six-second duration,
   called `play()`, and observed currentTime advancing past 0.15 seconds.
5. Playwright captured all five portal documents from static renderer markup;
   all images decoded locally. Corporate, hotel, café and event thumbnails were
   inspected visually for text, artwork, hierarchy and cropping. Full-page capture
   retains taller café/event content before fitting into 780×585 WebP thumbnails.
6. Scoped `git diff --check` is clean. No server/build was launched for these
   checks, and no application database calls were made.

## Integration notes and limits

- The preview dialog depends on the renderer's new `screen` prop and uses edit
  mode, which shows prepared gates independently even while their controllers
  remain disabled. Screen/device controls should be included in the root agent's
  existing browser integration run.
- Browser dependencies in this environment include fonts under
  `/tmp/wifi-browser-deps/root/usr/share/fonts/truetype`, but no default system font
  configuration. Captures needed `FONTCONFIG_FILE=/tmp/wifi-preset-fonts.conf`;
  otherwise text silently disappears. The configuration exists in `/tmp` and was
  shared with the root agent. This does not affect ordinary installed browsers.
- Demo videos are intentionally silent original motion artwork. Replace them,
  demo identities and sample text with approved customer material before launch.
- Blank templates retain the ordinary incomplete starter document; the builder
  requires media selection before publishing that separate blank workflow.
- Full-suite, application-browser, production-build and live database integration
  checks remain with the root agent; focused tests mock fetch and never seed DB.
