import { beforeEach, describe, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({
  persisted: [] as unknown[],
  queued: [] as string[],
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    operationalLog: {
      create: async ({ data }: any) => {
        store.persisted.push(data);
      },
    },
  },
}));
vi.mock("@/lib/redis", () => ({
  redis: {
    multi: () => {
      const transaction = {
        lpush: (_key: string, value: string) => {
          store.queued.push(value);
          return transaction;
        },
        ltrim: () => transaction,
        exec: async () => [],
      };
      return transaction;
    },
  },
}));
import { enqueueLog, persistLog, redactLog } from "@/lib/monitor/logs";
beforeEach(() => {
  store.persisted.length = 0;
  store.queued.length = 0;
});
describe("operational log secret redaction", () => {
  it("removes network secret fields and quoted textual values before queueing and persistence", async () => {
    const secrets = [
      "secret passphrase",
      "secret WPA key",
      "secret private key",
      "secret shared key",
      "secret community",
    ];
    const keys = [
      "passphrase",
      "wpa_psk",
      "private-key",
      "preshared-key",
      "community",
    ];
    const metadata = Object.fromEntries(
      keys.map((key, i) => [key, secrets[i]]),
    );
    const message = keys
      .map((key, i) => `"${key}": "${secrets[i]}"`)
      .join(", ");
    const input = {
      source: "syslog",
      severity: "warning",
      message,
      metadata: { nested: metadata },
    };
    await enqueueLog(input);
    await persistLog(input);
    expect(store.persisted).toHaveLength(1);
    expect(store.queued).toHaveLength(1);
    for (const output of [JSON.stringify(store.persisted), ...store.queued])
      for (const secret of secrets) expect(output).not.toContain(secret);
    expect((store.persisted[0] as any).metadata.nested).toEqual(
      Object.fromEntries(keys.map((key) => [key, "[REDACTED]"])),
    );
  });
  it("redacts RouterOS assignments, authorization, errors and embedded credential URLs", () => {
    const text =
      'passphrase="phrase with spaces" wpa_psk=rawpsk preshared-key=rawshared community=rawcommunity Authorization: Basic abc123 https://user:pass@router/api';
    const output = JSON.stringify(
      redactLog({ error: new Error(text), message: text }),
    );
    for (const secret of [
      "phrase with spaces",
      "rawpsk",
      "rawshared",
      "rawcommunity",
      "abc123",
      "user:pass",
    ])
      expect(output).not.toContain(secret);
  });
});
