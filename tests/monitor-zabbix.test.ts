import { describe, it, expect, vi } from "vitest";
import { ZabbixClient } from "../src/lib/monitor/zabbix";
const reply = (result: any) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", result }), { status: 200 });
describe("Zabbix 7 transport", () => {
  it("rejects HTTP, JSONRPC and per-item errors", async () => {
    const http = new ZabbixClient(
      "http://local",
      "server-token",
      vi.fn(async () => new Response("", { status: 503 })) as any,
    );
    await expect(http.call("history.get")).rejects.toThrow("HTTP 503");
    const rpc = new ZabbixClient(
      "http://local",
      "server-token",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: -32602, message: "Invalid params" },
            }),
          ),
      ) as any,
    );
    await expect(rpc.call("history.get")).rejects.toThrow("Invalid params");
    const partial = new ZabbixClient(
      "http://local",
      "server-token",
      vi.fn(async () =>
        reply({ data: [{ itemid: "1", error: "Item disabled" }] }),
      ) as any,
    );
    await expect(
      partial.push([{ itemid: "1", value: 10, clock: 1 }]),
    ).rejects.toThrow("rejected");
  });
  it("rejects missing and mismatched push acknowledgements", async () => {
    for (const data of [[], [{ itemid: "2" }]]) {
      const client = new ZabbixClient(
        "http://local",
        "token",
        vi.fn(async () => reply({ data })) as any,
      );
      await expect(
        client.push([{ itemid: "1", value: 10, clock: 1 }]),
      ).rejects.toThrow();
    }
  });
  it("accepts numeric Zabbix 7 item acknowledgements and rejects duplicated IDs", async () => {
    const client = new ZabbixClient(
      "http://local",
      "token",
      vi.fn(async () => reply({ data: [{ itemid: 1 }] })) as any,
    );
    await expect(
      client.push([{ itemid: "1", value: 10, clock: 1 }]),
    ).resolves.toBeUndefined();
    const duplicate = new ZabbixClient(
      "http://local",
      "token",
      vi.fn(async () => reply({ data: [{ itemid: 1 }, { itemid: 1 }] })) as any,
    );
    await expect(
      duplicate.push([
        { itemid: "1", value: 10, clock: 1 },
        { itemid: "2", value: 10, clock: 1 },
      ]),
    ).rejects.toThrow("mismatched");
  });
  it("keeps token server side and sends bearer authentication only for authenticated calls", async () => {
    const fetcher = vi.fn(async () => reply("7.0.0"));
    const client = new ZabbixClient(
      "http://local",
      "sensitive",
      fetcher as any,
    );
    await client.call("apiinfo.version");
    expect(
      (fetcher.mock.calls[0] as any)[1].headers.Authorization,
    ).toBeUndefined();
    await client.call("item.get");
    expect((fetcher.mock.calls[1] as any)[1].headers.Authorization).toBe(
      "Bearer sensitive",
    );
    expect((fetcher.mock.calls[1] as any)[1].body).not.toContain("sensitive");
  });
  it("uses trend averages for long windows and raw typed history otherwise", async () => {
    const fetcher = vi.fn(async (_url: any, request: any) =>
      reply(
        JSON.parse(request.body).method === "trend.get"
          ? [{ clock: "1", value_avg: "42" }]
          : [{ clock: "2", value: "43", itemid: "1" }],
      ),
    );
    const client = new ZabbixClient("http://local", "token", fetcher as any);
    const item = {
      itemid: "1",
      key_: "cpu.percent",
      name: "CPU",
      value_type: "0",
    };
    expect(await client.history(item, 604800)).toEqual([
      { at: 1000, value: 42 },
    ]);
    expect(await client.history(item, 3600)).toEqual([{ at: 2000, value: 43 }]);
  });
  it("provisions idempotently with explicit retention and sustained thresholds", async () => {
    const groups: any[] = [],
      templates: any[] = [],
      hosts: any[] = [],
      items: Record<string, any[]> = {},
      triggers: any[] = [];
    const created: any[] = [];
    const transport = vi.fn(async (_url: any, request: any) => {
      const { method, params: p } = JSON.parse(request.body);
      let result: any = [];
      if (method === "hostgroup.get") result = groups;
      if (method === "hostgroup.create") {
        groups.push({ groupid: "1" });
        result = { groupids: ["1"] };
      }
      if (method === "templategroup.get") result = [{ groupid: "9" }];
      if (method === "template.get") result = templates;
      if (method === "template.create") {
        templates.push({ templateid: "2" });
        items["2"] = [];
        result = { templateids: ["2"] };
      }
      if (method === "host.get") result = hosts;
      if (method === "host.create") {
        hosts.push({ hostid: "3" });
        items["3"] = [...items["2"]];
        result = { hostids: ["3"] };
      }
      if (method === "item.get") result = items[p.hostids[0]] || [];
      if (method === "item.create") {
        const item = { ...p, itemid: String(created.length + 10) };
        created.push(item);
        (items[p.hostid] ||= []).push(item);
        result = { itemids: [item.itemid] };
      }
      if (method === "trigger.get") result = triggers;
      if (method === "trigger.create") {
        triggers.push(p);
        result = { triggerids: ["1"] };
      }
      return reply(result);
    });
    const client = new ZabbixClient("http://local", "token", transport as any);
    await client.provision("router1", "Router", {
      "cpu.percent": 40,
      "disk.percent": 20,
    });
    const count = created.length;
    await client.provision("router1", "Router", {
      "cpu.percent": 42,
      "disk.percent": 30,
    });
    expect(created.length).toBe(count);
    expect(groups).toHaveLength(1);
    expect(hosts).toHaveLength(1);
    expect(
      created.every(
        (i) => i.type === 2 && i.history === "30d" && i.trends === "365d",
      ),
    ).toBe(true);
    expect(
      triggers.some(
        (t) => t.expression.includes("5m") && t.expression.includes(">=10"),
      ),
    ).toBe(true);
    expect(
      triggers.some((t) => t.description === "Offline for three polls"),
    ).toBe(true);
  });
});

describe("host Agent2 automatic onboarding", () => {
  it("creates active host template, transforms idle into used CPU, and retains actual item mapping", async () => {
    const created: any[] = [],
      groups: any[] = [],
      templates: any[] = [],
      hosts: any[] = [],
      items: Record<string, any[]> = {},
      triggers: any[] = [];
    const transport = vi.fn(async (_url: any, request: any) => {
      const { method, params: p } = JSON.parse(request.body);
      let result: any = [];
      if (method === "hostgroup.get") result = groups;
      if (method === "hostgroup.create") {
        groups.push({ groupid: "1" });
        result = { groupids: ["1"] };
      }
      if (method === "templategroup.get") result = [{ groupid: "2" }];
      if (method === "template.get") result = templates;
      if (method === "template.create") {
        templates.push({ templateid: "3" });
        items["3"] = [];
        result = { templateids: ["3"] };
      }
      if (method === "host.get") result = hosts;
      if (method === "host.create") {
        hosts.push({ hostid: "4" });
        items["4"] = [...items["3"]];
        result = { hostids: ["4"] };
      }
      if (method === "item.get") result = items[p.hostids[0]] || [];
      if (method === "item.create") {
        const item = { ...p, itemid: String(created.length + 10) };
        created.push(item);
        (items[p.hostid] ||= []).push(item);
        result = { itemids: [item.itemid] };
      }
      if (method === "trigger.get") result = triggers;
      if (method === "trigger.create") {
        triggers.push(p);
        result = { triggerids: ["1"] };
      }
      return reply(result);
    });
    const client = new ZabbixClient("http://local", "token", transport as any);
    const first = await client.provisionAgentHost();
    await client.provisionAgentHost();
    expect(created).toHaveLength(5);
    expect(created.every((i) => i.type === 7 && i.delay === "30s")).toBe(true);
    const cpu = created.find((i) => i.name === "cpu.percent");
    expect(cpu.key_).toBe("system.cpu.util[,idle]");
    expect(cpu.preprocessing[0]).toMatchObject({
      type: 21,
      params: "return 100 - Number(value);",
    });
    expect(first.itemKeys["disk.percent"]).toBe("vfs.fs.size[/hostfs,pused]");
    expect(
      triggers.some((t) => t.expression.includes("system.cpu.util[,idle]")),
    ).toBe(true);
  });
});

describe("Zabbix explicit history bounds", () => {
  it("forwards time_from and time_till to both history and trend queries", async () => {
    const requests: any[] = [];
    const transport = vi.fn(async (_url: any, request: any) => {
      requests.push(JSON.parse(request.body));
      return reply([]);
    });
    const client = new ZabbixClient("http://local", "token", transport as any),
      item = {
        itemid: "1",
        key_: "available",
        name: "Available",
        value_type: "0",
      };
    const end = Date.parse("2026-10-22T12:00:00Z");
    await client.history(item, 3600, end);
    await client.history(item, 604800, end);
    expect(requests[0]).toMatchObject({
      method: "history.get",
      params: { time_from: end / 1000 - 3600, time_till: end / 1000 },
    });
    expect(requests[1]).toMatchObject({
      method: "trend.get",
      params: { time_from: end / 1000 - 604800, time_till: end / 1000 },
    });
  });
});
