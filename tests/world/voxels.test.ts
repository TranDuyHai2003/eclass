import { test } from "node:test";
import assert from "node:assert/strict";
import { B, blockAt, columnRange, setBlock } from "../../lib/world/voxels";

test("voxels: khoá số — đặt / đọc đúng cả toạ độ âm, không đụng ô lân cận", () => {
  setBlock(-123, 5, 987, B.gold, true);
  setBlock(-123, 6, 987, B.crystal, true);
  setBlock(-122, 5, 987, B.wood, true);
  assert.equal(blockAt(-123, 5, 987), B.gold);
  assert.equal(blockAt(-123, 6, 987), B.crystal);
  assert.equal(blockAt(-122, 5, 987), B.wood);
  // ô chưa sửa vẫn theo địa hình tự nhiên
  assert.notEqual(blockAt(-124, 5, 987), B.gold);
});

test("voxels: columnRange bao trùm khối đã sửa trên cao", () => {
  setBlock(40, 70, 40, B.stone, true);
  const [lo, hi] = columnRange(40, 40);
  assert.ok(lo <= 69 && hi >= 71);
});
