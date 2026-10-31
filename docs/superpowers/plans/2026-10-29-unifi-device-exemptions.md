# UniFi approved device portal exemption implementation plan

**Goal:** Named people/device/MAC allowlist in UniFi admin, automatic approved-device Internet without portal clicks, bulk input, and revocation after removal.

**Architecture:** Versioned per-connection/site/MAC approval rows in existing SystemSetting storage. Admin mutations and native grants use the existing renewable MAC lease. A backend association worker grants/renews native UniFi guest authorization only for approved MACs on owned effective open campaign WLANs. Campaign ledgers distinguish exempt/native grants so timed expiry and campaign resets cannot kick approved devices. Disabling/removing approval causes the normal expiry worker to revoke the exempt grant, with all existing live-scope and duplicate-MAC safeguards. Portal API also performs an approved-device fast path after live validation.

**Constraints:** Preserve PPPoE, DHCP, bridge, radio/SSID configs, other clients, direct post-login redirect and normal marketing gates. Never implement an SSID allow-only MAC filter. Never trust a caller-provided MAC alone for a grant. Support the configured default portal controller/site; no plaintext credentials in API responses or logs. Keep the dirty shared checkout and deploy a scoped overlay from the running production image. No real MAC was supplied; create no sample live approval.

- [x] Pure policy: canonical MAC validation, owner/device labels, CSV/tab/semicolon import, duplicate and size validation. Tests before code.
- [x] Authenticated read/admin CRUD APIs with atomic audit and approval, scoped keys, bulk operations and shared MAC locks. No controller configuration writes.
- [x] Session integration: approved grants use a renewable native window, normal expired sessions cannot disconnect approvals, and removal revokes only the managed guest context. Test grant/revoke/reset races and other SSIDs.
- [x] Association worker and portal fast path: check live MAC/SSID/AP, WLAN ownership, effective campaign and approval before every grant; keep temporary errors retryable and publish heartbeat. Test absent, duplicate, wired and password-network clients.
- [x] UniFi sidebar/tool navigation and accessible list/add/edit/bulk UI. Read-only roles cannot approve. Show actual WiFi/private-MAC entry guidance and synchronization delay.
- [x] Independent code review, targeted regression tests and browser tests; scoped build, candidate verification, production backend/frontend rollout, real authenticated read-only smoke test, unchanged network/infrastructure comparison and operational documentation.
