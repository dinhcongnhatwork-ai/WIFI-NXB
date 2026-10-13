# CMS V2 implementation ledger

User-approved plan: independent Mobile/Tablet/PC documents; hybrid section layouts; shared renderer; same-origin media; drafts/revisions/publication; tests and safe rollout.

Ruling: work on feat/portal-design-cms-v2 in the existing workspace to retain the user's uncommitted changes, including MinIO endpoint formatting. No deployment or production database migration during development.

- Document model, interaction math, editor, integration: root (in progress).
- Same-origin media, safe uploads, shared preview/library: media agent (in progress).
- Draft/publish/revision API, additive SQL, backend tests: publishing agent (in progress).
- Shared V2 runtime, iframe device frames, simulation and preview: renderer agent (in progress).
- Integration tests, visual checks, build and review: pending.

Physical captive browser and pre-auth guest-network checks require the actual network/devices; automated browser tests cannot establish those properties.
