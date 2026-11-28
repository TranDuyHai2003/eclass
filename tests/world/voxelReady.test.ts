import { test } from "node:test";
import assert from "node:assert/strict";
import { blockAt, columnReady } from "@/lib/world/voxels";
import { genChunk, genStats } from "@/lib/world/worldgen";
import { CHUNK } from "@/lib/world/terrain";

test("columnReady: hỏi trước KHÔNG sinh chunk (tia nhắm khối không kéo việc sinh đồng bộ về luồng chính)", () => {
  const x = 913 * CHUNK + 5;
  const z = -771 * CHUNK + 9;
  const before = genStats.chunks;
  assert.equal(columnReady(x, z), false);
  assert.equal(columnReady(x + 3, z + 7), false);
  assert.equal(genStats.chunks, before, "columnReady không được sinh chunk");
  genChunk(913, -771);
  assert.equal(columnReady(x, z), true);
  assert.equal(genStats.chunks, before + 1);
  // tra khối sau khi đã có dữ liệu: không sinh lại
  blockAt(x, 5, z);
  assert.equal(genStats.chunks, before + 1);
});

test("columnReady: toạ độ âm / mép chunk đúng chunk chứa cột", () => {
  genChunk(-1, -1);
  assert.equal(columnReady(-1, -1), true);
  assert.equal(columnReady(-CHUNK, -CHUNK), true);
  assert.equal(columnReady(-CHUNK - 0.5, -1), columnReady(-CHUNK - 1, -1));
});
