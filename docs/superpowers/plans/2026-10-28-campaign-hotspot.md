> **STOPPED — superseded by user correction:** Hotspot must run on MikroTik. UniFi guest authorization must not be deployed. See `docs/campaign-hotspot-deployment-2026-10-28.md`.

# Campaign SSID Hotspot Implementation Plan

> **For agentic workers:** Use subagent-driven-development for implementation and independent review. Preserve all existing user edits; do not commit, reset or stash this working tree.

**Goal:** Apply WiFi marketing only to open SSIDs with an effective campaign, while preserving the running MikroTik network and DHCP allocation.

**Architecture:** UniFi enforces captive access at the SSID, rather than attaching a MikroTik Hotspot to the shared LAN bridge. A backend reconciler enables guest policy only on eligible WLANs and restores its own changes when campaigns end. The external portal forwards verified guest identity into the existing signed portal flow and authorizes that client through UniFi after required gates.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Redis, UniFi legacy API.

**Spec:** User instructions in this session, including explicit approval to configure UniFi and application campaign synchronization.

## Global Constraints

- Do not modify MikroTik PPPoE, interface, bridge, address, pool, DHCP, firewall, routing or DNS configuration. Do not import either full backup export.
- Existing DHCP: `dhcp-lan`, bridge `bridge`, gateway `192.168.0.1/22`, pool `192.168.0.20-192.168.0.255,192.168.1.2-192.168.3.254`.
- Password protected WLANs always bypass marketing, including when assigned to a campaign. Never change WLAN passwords, security, VLAN, network, radio or enabled state.
- Open WLANs without a matching active in-date campaign and published template retain direct access. A disabled campaign or its deletion/expiration removes only guest policy managed by this feature.
- Current controller site `m5npy6bn`; existing WLANs `NXBCTQGST` and `WIFI_PHÒNG HỌP` use WPA PSK. Database currently has no campaigns. Do not create a campaign or change those WLANs just to test.
- Public portal `https://solutionai.com.vn/portal` currently returns HTTP 200. Public URLs must come from server configuration.
- Preserve signed session validation and video/attendance gates. Validate live controller client SSID/AP/site before guest authorization; fail closed on mismatch or controller failure.
- No new package dependencies or database migration is necessary. Use existing SystemSetting for management ownership and state, Redis for cross-process exclusion.

### Task 1: Implement and test campaign portal integration

**Files:** Create focused modules under `src/lib/network/`, external portal handler under `src/app/guest/s/[site]/route.ts` and tests under `tests/`. Update portal, connect/login routes and backend instrumentation as required. Preserve existing MikroTik login behavior.

- [ ] Write failing behavioral tests for password/open eligibility, campaign time/site/WLAN selection, expiration/deletion cleanup and no changes to unmanaged WLANs.
- [ ] Write failing tests for external portal query normalization (`id` is MAC, never template ID), rejection of unknown sites/clients, signed guest authorization and existing gate preservation.
- [ ] Implement a backend-only reconciler with a cross-process lock, owned-field persistence before device mutation, readback verification and retryable cleanup. Operate only on UniFi guest policy and explicitly required site portal fields. On empty eligibility and no owned state, perform no configuration writes.
- [ ] Handle the legacy external portal callback `/guest/s/<site>/` and preserve MAC/SSID/AP/site through the signed portal flow. Authorization must verify the connected client and effective open SSID campaign, then call the configured site's `authorizeGuest`, with duration capped by campaign end. Keep existing trial login for MikroTik requests.
- [ ] Run focused tests and TypeScript verification; resolve failures caused by the change.

### Task 2: Review and deploy without network changes

**Files:** Deployment report `docs/campaign-hotspot-deployment-2026-10-28.md`; environment or deploy override only when necessary.

- [ ] Independently review task 1 against all global constraints and fix material issues.
- [ ] Build an isolated production artifact, preserving current images for rollback, then recreate only backend/frontend services.
- [ ] Configure the external portal entry and public pre-auth access only where verified compatible with the current UniFi controller. Do not enable guest policy on the existing WPA WLANs.
- [ ] Verify public portal and callback, worker health, no changes to the two current WLANs and exact unchanged MikroTik static configuration. Report that an actual client authentication requires an open SSID and a published active campaign, currently absent.

## Execution decisions

- Work in the existing feature checkout because it contains extensive user changes on which the running application depends. Snapshot the files being changed and deployment images; avoid git operations that would package or discard unrelated edits.
- No codegraph cache exists; use targeted `rg` and direct reads instead of creating a new index for this bounded change.
- Do not enable MikroTik Hotspot on `bridge`: all wired clients and both WPA SSIDs share it. The approved UniFi scope resolves that conflict while retaining DHCP.
