import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { mkdtemp, writeFile, appendFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const state = vi.hoisted(() => ({
  checkpoints: new Map<string, any>(),
  logs: new Map<string, any>(),
  persisted: 0,
  failCheckpoint: false,
}));
vi.mock("../src/lib/prisma", () => ({
  prisma: {
    monitoringCheckpoint: {
      findUnique: async ({ where }: any) =>
        state.checkpoints.get(where.key) || null,
      upsert: async ({ where, create, update }: any) => {
        if (
          state.failCheckpoint &&
          (create.value.offset > 0 || update.value.offset > 0)
        ) {
          state.failCheckpoint = false;
          throw new Error("Database restart");
        }
        const value = state.checkpoints.has(where.key) ? update : create;
        state.checkpoints.set(where.key, structuredClone(value));
      },
    },
    operationalLog: {
      upsert: async ({ where, create }: any) => {
        state.persisted++;
        if (!state.logs.has(where.fingerprint))
          state.logs.set(where.fingerprint, create);
      },
      create: async ({ data }: any) =>
        state.logs.set(String(Math.random()), data),
    },
  },
}));
vi.mock("../src/lib/redis", () => ({ redis: {} }));
import { tailSyslog } from "../src/lib/monitor/syslog";
import { redactLog } from "../src/lib/monitor/logs";
let directory: string, path: string;
beforeEach(async () => {
  state.checkpoints.clear();
  state.logs.clear();
  state.persisted = 0;
  state.failCheckpoint = false;
  directory = await mkdtemp(join(tmpdir(), "monitor-test-"));
  path = join(directory, "devices.ndjson");
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const row = (message: string) =>
  JSON.stringify({
    message,
    severity: "info",
    timestamp: "2026-01-01T00:00:00Z",
    host: "router",
  });
describe("restart-safe syslog ingestion", () => {
  it("keeps partial lines until complete and resumes append to short files", async () => {
    await writeFile(path, `${row("one")}\n${row("two").slice(0, 20)}`);
    await tailSyslog(path);
    expect(state.logs.size).toBe(1);
    await appendFile(path, `${row("two").slice(20)}\n`);
    await tailSyslog(path);
    expect(state.logs.size).toBe(2);
    await tailSyslog(path);
    expect(state.logs.size).toBe(2);
  });
  it("finds unread rotated inode and a new active inode", async () => {
    await writeFile(path, `${row("one")}\n`);
    await tailSyslog(path);
    await appendFile(path, `${row("late old file")}\n`);
    await rename(path, `${path}.1`);
    await writeFile(path, `${row("new file")}\n`);
    await tailSyslog(path);
    expect(
      Array.from(state.logs.values())
        .map((v) => v.message)
        .sort(),
    ).toEqual(["late old file", "new file", "one"]);
  });
  it("deduplicates replay after persistence succeeded and checkpoint failed", async () => {
    await writeFile(path, `${row("durable")}\n`);
    state.failCheckpoint = true;
    await expect(tailSyslog(path)).rejects.toThrow("restart");
    expect(state.logs.size).toBe(1);
    await tailSyslog(path);
    expect(state.persisted).toBe(2);
    expect(state.logs.size).toBe(1);
  });
  it("keeps the initial generation across first-checkpoint failure and producer append", async () => {
    await writeFile(path, `${row("first persisted")}\n`);
    state.failCheckpoint = true;
    await expect(tailSyslog(path)).rejects.toThrow("restart");
    expect(state.logs.size).toBe(1);
    await appendFile(path, `${row("appended before retry")}\n`);
    await tailSyslog(path);
    expect(
      Array.from(state.logs.values())
        .map((v) => v.message)
        .sort(),
    ).toEqual(["appended before retry", "first persisted"]);
  });
  it("detects same-inode truncation or rewritten prefix", async () => {
    await writeFile(path, `${row("long old message with bytes")}\n`);
    await tailSyslog(path);
    await writeFile(path, `${row("replacement")}\n`);
    await tailSyslog(path);
    expect(state.logs.size).toBe(2);
  });
  it("marks missing syslog unavailable explicitly", async () => {
    expect(await tailSyslog(path)).toEqual({ available: false, lines: 0 });
  });
  it("redacts structured and textual credentials before persistence", () => {
    const safe = redactLog({
      password: "p",
      nested: {
        apiKey: "a",
        message: "token=raw Bearer abc https://user:pass@router/api",
      },
    });
    expect(JSON.stringify(safe)).not.toMatch(/raw|abc|user:pass|"p"|"a"/);
    expect(safe.nested.apiKey).toBe("[REDACTED]");
    expect(redactLog('{"password":"hidden"}')).not.toContain("hidden");
  });
});
