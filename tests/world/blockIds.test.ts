import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BLOCKS } from "@/lib/world/blocks";
import { CHUNK } from "@/lib/world/terrain";

test("server realtime nhận đủ id khối (MAX_BLOCK_ID = BLOCKS.length − 1)", () => {
  const src = readFileSync(join(process.cwd(), "realtime", "server.mjs"), "utf8");
  const m = /const MAX_BLOCK_ID = (\d+);/.exec(src);
  assert.ok(m, "thiếu MAX_BLOCK_ID trong realtime/server.mjs");
  assert.equal(Number(m[1]), BLOCKS.length - 1);
});

test("server realtime chia cột chunk đúng cỡ CHUNK của địa hình (đăng ký khối theo chunk — G6)", () => {
  const src = readFileSync(join(process.cwd(), "realtime", "server.mjs"), "utf8");
  const m = /const CHUNK = (\d+);/.exec(src);
  assert.ok(m, "thiếu CHUNK trong realtime/server.mjs");
  assert.equal(Number(m[1]), CHUNK);
});
