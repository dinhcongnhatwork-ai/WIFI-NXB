import { finite } from "./core";
export interface ZabbixItem {
  itemid: string;
  key_: string;
  name: string;
  value_type: string;
  lastvalue?: string;
  lastclock?: string;
  units?: string;
}
export interface HistoryPoint {
  clock: string;
  value: string;
  itemid: string;
}
export class ZabbixClient {
  private sequence = 0;
  constructor(
    private endpoint = process.env.ZABBIX_API_URL || "",
    private token = process.env.ZABBIX_API_TOKEN || "",
    private transport: typeof fetch = fetch,
  ) {}
  async call<T = any>(method: string, params: unknown = {}): Promise<T> {
    if (!this.endpoint || (method !== "apiinfo.version" && !this.token))
      throw new Error("Zabbix is not configured");
    const response = await this.transport(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-rpc",
        ...(method === "apiinfo.version"
          ? {}
          : { Authorization: `Bearer ${this.token}` }),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++this.sequence,
        method,
        params,
      }),
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Zabbix HTTP ${response.status}`);
    const body = await response.json();
    if (body.error)
      throw new Error(
        `Zabbix ${method}: ${body.error.message} (${body.error.code})`,
      );
    if (!Object.prototype.hasOwnProperty.call(body, "result"))
      throw new Error("Invalid Zabbix response");
    return body.result;
  }
  async push(
    data: { itemid: string; value: number; clock: number; ns?: number }[],
  ) {
    if (!data.length) return;
    const result = await this.call<{
      data: { itemid: string | number; error?: string }[];
    }>("history.push", data);
    if (
      !Array.isArray(result.data) ||
      result.data.length !== data.length ||
      result.data.some((row) => row.error)
    )
      throw new Error("Zabbix rejected one or more metric samples");
    const expected = new Map<string, number>();
    for (const row of data)
      expected.set(
        String(row.itemid),
        (expected.get(String(row.itemid)) || 0) + 1,
      );
    for (const row of result.data) {
      const id = String(row.itemid),
        remaining = expected.get(id) || 0;
      if (!remaining) throw new Error("Zabbix push returned mismatched items");
      expected.set(id, remaining - 1);
    }
  }
  private provisioning: Promise<unknown> = Promise.resolve();
  provision(
    key: string,
    name: string,
    metrics: Record<string, number | undefined>,
  ) {
    const pending = this.provisioning.then(() =>
      this.provisionNow(key, name, metrics),
    );
    this.provisioning = pending.catch(() => {});
    return pending;
  }
  private async provisionNow(
    key: string,
    name: string,
    metrics: Record<string, number | undefined>,
  ) {
    const host = `wifi.${key.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    let groups = await this.call<any[]>("hostgroup.get", {
      filter: { name: ["WiFi Marketing"] },
    });
    if (!groups.length) {
      const result = await this.call("hostgroup.create", {
        name: "WiFi Marketing",
      });
      groups = [{ groupid: result.groupids[0] }];
    }
    let templateGroups = await this.call<any[]>("templategroup.get", {
      filter: { name: ["WiFi Marketing"] },
    });
    if (!templateGroups.length) {
      const result = await this.call("templategroup.create", {
        name: "WiFi Marketing",
      });
      templateGroups = [{ groupid: result.groupids[0] }];
    }
    const templateName = "WiFi Marketing collector";
    let templates = await this.call<any[]>("template.get", {
      filter: { host: [templateName] },
    });
    if (!templates.length) {
      const result = await this.call("template.create", {
        host: templateName,
        groups: [{ groupid: templateGroups[0].groupid }],
      });
      templates = [{ templateid: result.templateids[0] }];
    }
    // Common template metrics are inherited by every managed target; absent metrics remain unsupported/missing.
    let templateItems = await this.items(templates[0].templateid);
    for (const metric of [
      "cpu.percent",
      "memory.percent",
      "uptime.seconds",
      "available",
    ])
      if (!templateItems.some((i) => i.key_ === metric))
        await this.call("item.create", {
          hostid: templates[0].templateid,
          name: metric,
          key_: metric,
          type: 2,
          value_type: 0,
          delay: "0",
          history: "30d",
          trends: "365d",
          units: metric.endsWith("percent") ? "%" : "",
        });
    let hosts = await this.call<any[]>("host.get", {
      filter: { host: [host] },
    });
    if (!hosts.length) {
      const result = await this.call("host.create", {
        host,
        name,
        groups: [{ groupid: groups[0].groupid }],
        templates: [{ templateid: templates[0].templateid }],
        tags: [{ tag: "application", value: "wifi-marketing" }],
      });
      hosts = [{ hostid: result.hostids[0] }];
    }
    const hostid = hosts[0].hostid;
    let items = await this.items(hostid);
    for (const metric of Object.keys(metrics))
      if (!items.some((i) => i.key_ === metric)) {
        await this.call("item.create", {
          hostid,
          name: metric,
          key_: metric,
          type: 2,
          value_type: 0,
          delay: "0",
          history: "30d",
          trends: "365d",
          units: metric.endsWith("percent")
            ? "%"
            : metric.endsWith("bytes")
              ? "B"
              : metric.endsWith("bytes_sec")
                ? "Bps"
                : "",
        });
      }
    items = await this.items(hostid);
    await this.ensureTriggers(hostid, host, items);
    return { hostid, items };
  }
  provisionAgentHost() {
    const pending = this.provisioning.then(async () => {
      const hostname =
          process.env.MONITOR_AGENT_HOSTNAME || "wifi-marketing-host",
        templateName = "WiFi Marketing host active";
      let groups = await this.call<any[]>("hostgroup.get", {
        filter: { name: ["WiFi Marketing"] },
      });
      if (!groups.length) {
        const result = await this.call("hostgroup.create", {
          name: "WiFi Marketing",
        });
        groups = [{ groupid: result.groupids[0] }];
      }
      let templateGroups = await this.call<any[]>("templategroup.get", {
        filter: { name: ["WiFi Marketing"] },
      });
      if (!templateGroups.length) {
        const result = await this.call("templategroup.create", {
          name: "WiFi Marketing",
        });
        templateGroups = [{ groupid: result.groupids[0] }];
      }
      let templates = await this.call<any[]>("template.get", {
        filter: { host: [templateName] },
      });
      if (!templates.length) {
        const result = await this.call("template.create", {
          host: templateName,
          groups: [{ groupid: templateGroups[0].groupid }],
        });
        templates = [{ templateid: result.templateids[0] }];
      }
      const itemKeys = {
        "cpu.percent": "system.cpu.util[,idle]",
        "memory.percent": "vm.memory.size[pused]",
        "disk.percent": "vfs.fs.size[/hostfs,pused]",
        "uptime.seconds": "system.uptime",
        available: "agent.ping",
      };
      const existing = await this.items(templates[0].templateid);
      for (const [metric, key] of Object.entries(itemKeys))
        if (!existing.some((i) => i.key_ === key))
          await this.call("item.create", {
            hostid: templates[0].templateid,
            name: metric,
            key_: key,
            type: 7,
            value_type: 0,
            delay: "30s",
            history: "30d",
            trends: "365d",
            units: metric.endsWith("percent")
              ? "%"
              : metric.endsWith("seconds")
                ? "s"
                : "",
            ...(metric === "cpu.percent"
              ? {
                  preprocessing: [
                    {
                      type: 21,
                      params: "return 100 - Number(value);",
                      error_handler: 0,
                    },
                  ],
                }
              : {}),
          });
      let hosts = await this.call<any[]>("host.get", {
        filter: { host: [hostname] },
      });
      if (!hosts.length) {
        const result = await this.call("host.create", {
          host: hostname,
          name: "Máy chủ ứng dụng",
          groups: [{ groupid: groups[0].groupid }],
          templates: [{ templateid: templates[0].templateid }],
          tags: [{ tag: "application", value: "wifi-marketing" }],
        });
        hosts = [{ hostid: result.hostids[0] }];
      }
      const items = await this.items(hosts[0].hostid);
      await this.ensureTriggers(hosts[0].hostid, hostname, items, itemKeys);
      return { hostid: String(hosts[0].hostid), itemKeys };
    });
    this.provisioning = pending.catch(() => {});
    return pending;
  }
  items(hostid: string) {
    return this.call<ZabbixItem[]>("item.get", {
      hostids: [hostid],
      output: [
        "itemid",
        "key_",
        "name",
        "value_type",
        "lastvalue",
        "lastclock",
        "units",
      ],
    });
  }
  async ensureTriggers(
    hostid: string,
    host: string,
    items: ZabbixItem[],
    metricKeys: Record<string, string> = {},
  ) {
    const existing = await this.call<any[]>("trigger.get", {
      hostids: [hostid],
      output: ["description"],
    });
    const specs: {
      description: string;
      expression: string;
      priority: number;
    }[] = [];
    for (const metric of ["cpu.percent", "memory.percent", "disk.percent"])
      if (items.some((i) => i.key_ === (metricKeys[metric] || metric))) {
        for (const [level, priority] of [
          [
            Number(
              process.env[
                metric.startsWith("disk")
                  ? "MONITOR_DISK_WARN"
                  : "MONITOR_RESOURCE_WARN"
              ] || (metric.startsWith("disk") ? 85 : 80),
            ),
            2,
          ],
          [
            Number(
              process.env[
                metric.startsWith("disk")
                  ? "MONITOR_DISK_CRIT"
                  : "MONITOR_RESOURCE_CRIT"
              ] || (metric.startsWith("disk") ? 95 : 90),
            ),
            4,
          ],
        ])
          specs.push({
            description: `${metric} above ${level}% for 5 minutes`,
            expression: `min(/${host}/${metricKeys[metric] || metric},5m)>${level} and count(/${host}/${metricKeys[metric] || metric},5m)>=10`,
            priority,
          });
      }
    if (items.some((i) => i.key_ === (metricKeys.available || "available")))
      specs.push(
        {
          description: "Offline for three polls",
          expression: `max(/${host}/${metricKeys.available || "available"},#3)=0 and count(/${host}/${metricKeys.available || "available"},#3)=3`,
          priority: 4,
        },
        {
          description: "Collector data is stale",
          expression: `nodata(/${host}/${metricKeys.available || "available"},${Number(process.env.MONITOR_STALE_SECONDS || 120)}s)=1`,
          priority: 3,
        },
      );
    for (const spec of specs)
      if (!existing.some((t) => t.description === spec.description))
        await this.call("trigger.create", spec);
  }
  async history(
    item: ZabbixItem,
    seconds: number,
    end?: number,
  ): Promise<import("./analytics").Point[]> {
    const until = Math.floor((end ?? Date.now()) / 1000);
    const since = Math.floor((end ?? Date.now()) / 1000 - seconds);
    if (seconds > 86400) {
      const rows = await this.call<any[]>("trend.get", {
        itemids: [item.itemid],
        time_from: since,
        ...(end === undefined ? {} : { time_till: until }),
        output: "extend",
        sortfield: "clock",
        sortorder: "ASC",
        limit: 10000,
      });
      return rows.map((r) => ({
        at: Number(r.clock) * 1000,
        value: finite(r.value_avg) ?? null,
        ...(finite(r.num) !== undefined ? { samples: finite(r.num) } : {}),
        ...(finite(r.value_max) !== undefined
          ? { maximum: finite(r.value_max) }
          : {}),
      }));
    }
    const rows = await this.call<HistoryPoint[]>("history.get", {
      history: Number(item.value_type),
      itemids: [item.itemid],
      time_from: since,
      ...(end === undefined ? {} : { time_till: until }),
      output: "extend",
      sortfield: "clock",
      sortorder: "ASC",
      limit: 10000,
    });
    return rows.map((r) => ({
      at: Number(r.clock) * 1000,
      value: finite(r.value) ?? null,
    }));
  }
}
export const zabbix = new ZabbixClient();
