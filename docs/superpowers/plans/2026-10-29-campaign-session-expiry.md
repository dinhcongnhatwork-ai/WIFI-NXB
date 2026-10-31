# Campaign session expiry implementation plan

**Goal:** Per-campaign session duration and forced reauthentication after expiry, configured from the campaign menu.

**Architecture:** Store versioned duration policies and per-connection/site/MAC session records in existing PostgreSQL SystemSetting rows. Persist pending authorization before a controller command. Serialize grants/revocations with renewable Redis leases. Request native UniFi time limits and run a durable five-second expiry worker that unauthorizes and kicks only clients on the managed campaign WLAN. Offline expirations remain pending for the next association. No schema migration is required.

**Constraints:** Preserve PPPoE, bridge, DHCP, VLAN/radio configuration, password SSIDs and other campaigns. Keep the direct post-authorization redirect. Keep the current default of 240 minutes until an operator saves another value. Validate integer durations 1–1440 minutes. No global MikroTik reset from the campaign menu. Do not commit unrelated staged or unstaged changes.

## 1. Session policy and authorization

- [x] Add pure policy parsing/validation and expiry calculation in `src/lib/network/campaign-session-policy.ts`; tests cover 30/60 minutes, campaign-end cap and invalid input.
- [x] Add durable session storage and renewable per-MAC lock in `src/lib/network/campaign-sessions.ts`. Persist pending before granting; preserve the original expiry on repeated clicks; retain uncertain grants for revocation.
- [x] Integrate `authorizeUnifiPortal` with the stored policy and session lifecycle. Keep all existing live identity and gate checks. Update route tests for the persistence boundary.

## 2. Expiration and operator API

- [x] Add a backend-only session worker in `src/lib/network/campaign-session-worker.ts`, registered by instrumentation. Validate durable WLAN ownership, open guest WLAN, site and current station before commands. Revoke and kick on expiry; retry failures, keep offline records until observed again, and publish a private operational heartbeat.
- [x] Add GET/PUT/POST `/api/campaigns/[id]/session-policy`: read/save minutes; optional queued reset of current sessions; explicit admin-only campaign reset. Persist administrative audit with policy changes. Queued resets must target exact WLAN clients and owned session records, never all site clients.
- [x] Write tests before implementation for authorization, expiry, offline retry, other SSIDs, lock loss, permissions and validation. Run failing tests, implement, then verify green.

## 3. UI and production

- [x] Add an accessible session-duration dialog and a campaign-menu action. Offer 30 minutes/1 hour plus integer minutes. Explain that future logins use the new duration, with an explicit option to disconnect current sessions immediately.
- [x] Replace the existing site-wide MikroTik reset action with the scoped campaign endpoint and accurate copy.
- [x] Browser-test menu/save, permissions, validation and the redirect regression. Build a scoped overlay from the current production image; verify before replacing backend/frontend only.
- [x] Verify production health and configuration snapshots. Preserve rollback image and document API, timing/retry limits and physical verification status. Do not claim a physical expiry test without observing an actual client.

Verification details and physical-test limits: `docs/campaign-session-expiry-2026-10-29.md`. Production deployment includes a read-only authenticated UI/API smoke test; no actual client was disconnected for validation.
