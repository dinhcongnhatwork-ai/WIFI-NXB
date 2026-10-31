# Monitoring and Zabbix 7.0 LTS

The monitoring page is `/admin/monitor` with Overview, Devices, Resources, Alerts and Logs tabs. The application database stores target mapping, deduplicated operational logs, audit records and tail checkpoints. Zabbix stores every historical metric. CPU/RAM values are real device API, process or Agent2 samples; unavailable values are never filled with zero. Charts break across gaps and show stale retained history if Zabbix fails.

## Start the isolated stack

1. Apply the application migration and regenerate Prisma using the normal application release procedure. Back up the application database first.
2. Set a dedicated random `ZABBIX_DB_PASSWORD` in `.env`. Keep application `DATABASE_URL`, `REDIS_URL` and encrypted network registry configuration there. Zabbix uses its own `zabbix-db` volume/database, never the application DB.
3. The checked-in `monitoring/images.lock.env` pins real registry digests. Refresh deliberately with `npm run monitor:lock-images` and review the diff. It resolves Docker Registry V2 manifests, validates their digest, and fails if unavailable; it never fabricates a digest.
4. Start the monitoring services (collector can start after token setup):

   ```sh
   docker compose --env-file .env --env-file monitoring/images.lock.env \
     -f docker-compose.yml -f compose.monitoring.yml --profile monitoring \
     up -d zabbix-db zabbix-server zabbix-web zabbix-agent2 syslog-ng
   ```

5. Open `http://127.0.0.1:8088` on the host or through an SSH tunnel. Complete Zabbix onboarding, immediately replace the vendor initial administrator password, create a dedicated service user/token, and grant API access and read/write to **WiFi Marketing** host/template groups. First bootstrap needs hostgroup/template-group/template/host/item/trigger creation permissions (Zabbix super-admin for initial group creation). Restrict the token after bootstrap if groups/templates are managed separately. Never place the token in browser settings/local storage.
6. Set `ZABBIX_API_URL=http://127.0.0.1:8088/api_jsonrpc.php` and `ZABBIX_API_TOKEN=...` in `.env` for backend and collector. Restart application processes so the API can query the same server.
7. Start collection:

   ```sh
   docker compose --env-file .env --env-file monitoring/images.lock.env \
     -f docker-compose.yml -f compose.monitoring.yml --profile monitoring \
     up -d --build monitor-collector
   ```

Standalone: `npm run monitor:collector`. A Redis token lease allows one active collector across replicas; extension/release compare its unique ownership token. Collection runs every 30 seconds with a default maximum of three connection requests in flight (`MONITOR_CONCURRENCY`, capped at eight). Lease failure aborts subsequent metric publishing. A cycle longer than 30 seconds starts the next cycle after completion; it never overlaps itself. `--once` is available via `npm run monitor:collector -- --once`.

The monitoring profile adds about 2.3 GiB of memory caps to the existing app on an 8 GiB host. Size PostgreSQL history storage for device count, polling interval and interface count. No Zabbix DB port is published. Admin/API/server ports bind loopback only. Agent2 has host PID visibility and a read-only `/hostfs` mount to measure the actual host. Keep management access/firewall rules explicit before changing any bind address.

## Sources and device capabilities

Collector reads every UniFi/MikroTik entry in the encrypted connection registry, using its server-side resolver; browser connection headers and credentials are ignored. MikroTik RouterOS REST supplies identity, model/version, CPU, total/free memory, disk, uptime and interface counters. Rates require two fresh observations; first sample, counter reset, link restart or polling gap yields missing rate. UniFi supplies raw optional CPU/RAM, uptime, counters, device model, radio, port/PoE and associated client signal fields where supported. UniFi uses the configured site (or `config.sites` array for several sites). Unsupported client/radio/PoE fields remain unavailable. No device settings or SNMP configuration are mutated.

The collector idempotently creates **WiFi Marketing collector** template, common trapper items and per-device additional items. History is 30 days, trends 365 days. `history.push` validates each item acknowledgement and rejects partial failures. New Zabbix items may need one server configuration-cache cycle before accepting pushes; failures are visible and the next collection retries. Historical reads use typed `history.get` for 1h/24h and hourly `trend.get` averages for 7d/30d.

Application frontend/backend/collector samples originate in the corresponding Node process using `process.cpuUsage()` normalized by available CPU count, RSS as percentage of host total memory, RSS/heap bytes, event-loop mean delay, uptime and aggregate API error/request/latency counters. `APP_SERVER_MODE` tags snapshots in Redis. The Node instrumentation calls `startProcessSampler()` and `startAppLogCapture()`. Redis outage leaves missing/stale samples; collector does not pretend the process is healthy. Collector separately probes WebUI `/admin` (the unauthenticated login shell) and backend `/api/monitor/health`, PostgreSQL (`SELECT 1`), Redis (`PING`), and MinIO `/minio/health/live`. These probes do not call monitoring aggregation routes. Override HTTP probes using `MONITOR_WEBUI_URL`/`MONITOR_BACKEND_URL`; URLs are trusted server configuration. Attendance uses `monitor:attendance:heartbeat`; missing/stale heartbeat appears explicitly.

### Host resources through Agent2

The collector automatically creates the **WiFi Marketing host active** template, host `wifi-marketing-host`, CPU/RAM/disk/uptime/ping active-agent items and the application's host target mapping on normal stack startup. No manual host mapping is needed. CPU uses `system.cpu.util[,idle]` with `100 - idle` preprocessing; RAM uses `vm.memory.size[pused]`; disk uses `vfs.fs.size[/hostfs,pused]`, measuring the actual host mount. Agent2 has host PID visibility and reads `/hostfs`. Defaults retain 30-day history/365-day trends and use the same sustained alerts. Allow about two polling cycles for the initial configuration/data to arrive; missing agent samples stay missing. Keep the default hostname consistent, or set `MONITOR_AGENT_HOSTNAME` for both collector and Agent2. Set `MONITOR_AGENT_ENABLED=false` to manage host templates/mapping yourself.

For an existing host managed through another official Zabbix template, disable automatic host provisioning and use explicit mapping below. Never map an idle CPU percentage directly to CPU used: use an item with `100 - idle` preprocessing or the template's CPU usage dependent item. Verify CPU/memory/disk against host `top`, `free`, and `df` before accepting monitoring. Never substitute application-process memory for host memory.

Register its host/item mapping as ADMIN via `POST /api/monitor/targets`, using a regular authenticated application session:

```json
{"hostId":"12345","name":"Application host","itemKeys":{"cpu.percent":"system.cpu.util[,idle]","memory.percent":"vm.memory.size[pused]","disk.percent":"vfs.fs.size[/hostfs,pused]","uptime.seconds":"system.uptime"}}
```

Use the actual keys displayed by `item.get`/the linked template; the API rejects absent mappings. Some Linux templates expose available-memory percentage rather than used-memory percentage: create the correct `vm.memory.size[pused]` item instead of mapping an available percentage to used memory. Agent2 target snapshots use Zabbix item timestamps and become stale when the agent stops. SNMP is explicitly **unconfigured** until an operator configures polling externally in Zabbix (prefer SNMPv3), verifies it, and maps the resulting host. API metrics do not imply SNMP has been enabled.

## Alerts and authorization

Read endpoints require VIEWER/OPERATOR/ADMIN; event acknowledgement requires OPERATOR/ADMIN; external host mapping requires ADMIN. Guards verify current database role and disabled status. Acknowledgement checks the event belongs to a managed target, calls Zabbix `event.acknowledge` with an operator note and records an application audit. Recovery and acknowledgement state come from Zabbix, so repeated polls cannot create duplicate application alerts. Configure email/webhook actions separately in Zabbix if required.

Defaults: CPU/RAM warning 80%, critical 90%, sustained five minutes with at least ten 30-second observations; disk 85%/95%; offline after three consecutive failed availability polls; data missing at 120 seconds. Environment overrides: `MONITOR_RESOURCE_WARN`, `MONITOR_RESOURCE_CRIT`, `MONITOR_DISK_WARN`, `MONITOR_DISK_CRIT`, `MONITOR_STALE_SECONDS`. Threshold changes apply to newly provisioned triggers; update existing Zabbix triggers deliberately when changing policy. Source outages produce stale/source-unavailable states and a nodata alert, not healthy device samples.

## Operational logs and syslog

Application warning/error capture redacts credential keys, bearer/basic credentials, password-like text and credentialed URLs before queue and stdout. Use exported `enqueueLog` for structured info/audit-independent operational events. Redis queue is bounded at 10,000 records; failed persistence retains an in-flight record for replay. If Redis fails, redacted JSON is written to stdout; ship container stdout with the normal host log agent. Queue eviction during a prolonged outage is an explicit capacity limitation; increase capacity before a high-volume rollout.

`syslog-ng` writes redacted JSON lines in a persistent volume. Default listener binds **127.0.0.1:5514** TCP/UDP. To accept devices, set `MONITOR_SYSLOG_BIND` to the management interface address, replace the example subnet allowlist in `monitoring/syslog-ng.conf` with exact approved device addresses/CIDRs, and firewall the port. Prefer TLS: `monitoring/syslog-tls.conf.example` contains a mutually authenticated TLS listener; mount server cert/key and trusted CA, include that source in the log path, and publish only the management-interface TCP/6514. TLS is not implicitly enabled. Unencrypted UDP/TCP has no sender authentication; only use it on an isolated management network.

The tailer persists inode/offset/prefix/generation checkpoints after DB insertion. Unique fingerprints make replay after a crash idempotent. It reads uncompressed renamed files as well as the active file, holds partial trailing lines, and detects truncation/replaced prefixes. Use rename/reopen rotation (`monitoring/logrotate.conf`), not copytruncate. Do not compress/delete rotated files until ingestion catches up. Copytruncate that regrows past the previous offset with an identical prefix cannot be detected reliably; rename rotation avoids this race. Configure upstream size limiting below 4 MiB per JSON line; larger unterminated lines prevent forward progress and require operator intervention. Device source time is preserved when valid, otherwise ingestion time is used.

Log API filters source/severity/search/time/connection/device, uses cursor pagination (100 rows), and CSV exports at most 5,000 matching records. Formula-like cells are prefixed with an apostrophe. Narrow filters if the export cap is reached. Operational retention runs daily in the collector in batches (30 days logs, 365 days audits); run `npm run monitor:retention` to catch up manually. Overrides: `MONITOR_LOG_RETENTION_DAYS` and `MONITOR_AUDIT_RETENTION_DAYS`. Syslog files use independent 30-day rotation; Zabbix history/trends use Zabbix housekeeping.

## Validation and troubleshooting

`npm test -- tests/monitor-core.test.ts tests/monitor-zabbix.test.ts tests/monitor-syslog.test.ts tests/monitor-process.test.ts` exercises reset-safe rates, missing/stale values, token-safe locks, concurrency, partial push rejection, idempotent retention provisioning, redaction, filesystem rotation and checkpoint replay. `npx playwright test tests/e2e/monitor.spec.ts` exercises the UI with explicit source failures and retained chart gaps. These fixtures never contact network devices.

Use `docker compose ... logs monitor-collector` and inspect collector warnings in `/admin/monitor`. Missing credentials/configuration is an unavailable source, not an empty success. Check token permissions, Zabbix API connectivity, server config-cache propagation, item state, active Agent2 hostname, and Redis heartbeat freshness. A cached series is retained up to 24 hours and labeled stale; a device metadata snapshot is retained in the DB with its last observation timestamp.

Zabbix API contracts: [history.push](https://www.zabbix.com/documentation/7.0/en/manual/api/reference/history/push), [template.create](https://www.zabbix.com/documentation/7.0/en/manual/api/reference/template/create), [item.create](https://www.zabbix.com/documentation/7.0/en/manual/api/reference/item/create), [trigger.create](https://www.zabbix.com/documentation/7.0/en/manual/api/reference/trigger/create).
