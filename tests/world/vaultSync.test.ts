import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

test("realtime/vault.mjs (server) khớp lib/world/vault/*.ts — sinh lại bằng scripts/gen-realtime.mjs", () => {
  let ok = true;
  let msg = "";
  try {
    execFileSync(process.execPath, [join(ROOT, "scripts", "gen-realtime.mjs"), "--check"], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    ok = false;
    msg = String((e as { stderr?: Buffer }).stderr ?? e);
  }
  assert.ok(ok, msg);
});

test("bản server chạy được và cho cùng kết quả với bản TypeScript (một lượt Ngưỡng cửa)", async () => {
  const url = "file://" + join(ROOT, "realtime", "vault.mjs").replace(/\\/g, "/");
  // import động ESM từ test CommonJS: qua Function để ts-node không đổi thành require()
  const mod = (await (new Function("u", "return import(u)") as (u: string) => Promise<Record<string, (...a: unknown[]) => unknown>>)(url)) as Record<string, (...a: unknown[]) => unknown>;
  const ts = await import("../../lib/world/vault/run");
  const play = (m: Record<string, (...a: unknown[]) => unknown>) => {
    const r = m.newRun("ACDE", 9, 0) as Record<string, unknown>;
    m.seatJoin(r, "u1", "A", 0);
    m.startRun(r, 0);
    for (let i = 1; i <= 30; i++) m.tickRun(r, [[0, 0, 3.4]], i * 100, 0.1);
    m.actRun(r, 0, { k: "ping", kind: "here", x: 0, y: 0, z: -3.4 }, 3100, [0, 0, 3.4]);
    for (let i = 32; i <= 80; i++) m.tickRun(r, [[0, 0, 3.4]], i * 100, 0.1);
    return JSON.stringify(m.packRun(r));
  };
  assert.equal(play(mod), play(ts as unknown as Record<string, (...a: unknown[]) => unknown>));
});
