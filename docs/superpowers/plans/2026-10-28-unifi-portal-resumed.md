# UniFi external portal deployment — resumed implementation plan

> Use subagent-driven-development for independent review and fixes; do not commit, stash, reset or disturb unrelated user work.

**Goal:** Deploy the UniFi external portal and compare it with MikroTik Hotspot for the user's current shared LAN.

**Authority:** Latest user explicitly requested continuing UniFi portal deployment and comparison. This supersedes the previous MikroTik-only architecture preference. Keep existing PPPoE, interfaces, bridge, DHCP, pool and firewall unchanged. Leave staged MikroTik Hotspot disabled to avoid simultaneous enforcement.

**Architecture:** Reuse the tested, archived UniFi feature. Backend worker manages only its owned `is_guest` fields on open WLANs with effective published campaigns. Existing WPA WLANs remain unchanged. Legacy controller external callback enters application server TCP80 and redirects to configured public HTTPS portal; signed sessions and live identity checks precede controller authorization.

## Task 1: Restore and review the application

- [x] Restore archived source only after checking existing files match the pre-feature snapshots.
- [x] Run policy, worker, portal, campaign-target and attendance regression tests (78/78).
- [x] Independent review of the precise restored diff and authorization/cleanup boundaries. Resolve material findings and recheck affected tests.

## Task 2: Deploy and verify

- [x] Build from current production image plus the scoped source overlay, preserving previous images for rollback.
- [x] Start the fixed-origin port80 callback, configure only the UniFi site portal fields/preauthorization needed for `solutionai.com.vn`, preserving WLAN/network configuration.
- [x] Enable backend reconciliation, recreate only application services and verify public callback/portal, Redis worker status and unchanged WPA SSIDs.
- [x] Compare router export with the disabled staged snapshot: no MikroTik changes including no FastTrack modification.
- [x] Document comparison, actual deployment status and limitation that no real guest authorization can be claimed without an open SSID and active campaign.

No demo SSIDs, campaigns, database migrations or network topology changes were made for testing. The subsequent exact CMS click reproduced a zero-height editor caused by the admin transition transform. A route-specific layout fix passed 11 browser tests, 12 CMS unit tests and TypeScript, then was independently reviewed, built and verified by the same click against production. See `docs/unifi-portal-production-2026-10-28.md` for results and the pending real WiFi client check.
