import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS, B } from "@/lib/world/blocks";
import { CHUNK } from "@/lib/world/terrain";
import { DirtyRevs, cellNum, cellOfNum, chunkNum, chunkOfNum, indexCell, invRecord, mergeLegacy, packChunk, parseInvRecord, parseLegacy, unpackChunk } from "@/lib/world/voxelSave";
import { addItem, emptyInv } from "@/lib/world/inventory";
import { genChunk, genColumn } from "@/lib/world/worldgen";
import { naturalAt } from "@/lib/world/voxels";
import { surfaceNodes, surfaceOreCells } from "@/lib/world/ores";

const MAX = BLOCKS.length - 1;

test("lưu: khoá ô / chunk khứ hồi (cả toạ độ âm)", () => {
  for (const [lx, y, lz] of [[0, -40, 0], [31, 80, 31], [7, 0, 19]]) assert.deepEqual(cellOfNum(cellNum(lx, y, lz)), [lx, y, lz]);
  for (const [cx, cz] of [[0, 0], [-1, -1], [-300, 451]]) assert.deepEqual(chunkOfNum(chunkNum(cx, cz)), [cx, cz]);
});

test("lưu: đóng gói / mở chunk giữ đúng khối (kể cả không khí = đã đào), bỏ bản ghi hỏng / id lạ", () => {
  const by = new Map<number, Map<number, number>>();
  const k = indexCell(by, -33, 5, 70, B.air);
  indexCell(by, -40, -3, 64, B.torch);
  assert.equal(by.size, 1);
  const [cx, cz] = chunkOfNum(k);
  assert.deepEqual([cx, cz], [-2, 2]);
  const rec = packChunk(cx, cz, by.get(k)!, 3);
  assert.equal(rec.rev, 3);
  const flat = unpackChunk(rec, MAX);
  const cells = new Set<string>();
  for (let i = 0; i < flat.length; i += 4) cells.add(flat.slice(i, i + 4).join(","));
  assert.deepEqual(cells, new Set([`-33,5,70,${B.air}`, `-40,-3,64,${B.torch}`]));
  assert.deepEqual(unpackChunk(null, MAX), []);
  assert.deepEqual(unpackChunk({ w: "khác", cx: 0, cz: 0, d: [1, 2, 3, 1] }, MAX), []);
  assert.deepEqual(unpackChunk({ w: "expanse", cx: 0, cz: 0, d: [1, 2, 3, 99, 40, 2, 3, 1, 1, 2, 3, 1] }, MAX), [1, 2, 3, 1]);
});

test("lưu: chuyển localStorage cũ → theo chunk, LUỸ ĐẲNG (chạy hai lần không đổi gì; ô IndexedDB mới hơn được giữ)", () => {
  const raw = JSON.stringify([["1,2,3", B.stone], ["-1,2,3", B.gold], ["40,2,3", B.wood], ["bad", 1], ["5,200,5", 1], ["6,1,6", 999]]);
  const legacy = parseLegacy(raw, MAX);
  assert.equal(legacy.size, 3); // (0,0), (−1,0), (1,0)
  assert.equal(parseLegacy("{hỏng", MAX).size, 0);
  assert.equal(parseLegacy(null, MAX).size, 0);
  const k0 = chunkNum(0, 0);
  const first = mergeLegacy(0, 0, null, legacy.get(k0)!, MAX)!;
  assert.ok(first);
  assert.deepEqual(unpackChunk(first, MAX), [1, 2, 3, B.stone]);
  assert.equal(mergeLegacy(0, 0, first, legacy.get(k0)!, MAX), null, "chạy lại phải không đổi gì");
  // IndexedDB đã có ô (1,2,3) = không khí (đã đào sau khi chuyển) → dữ liệu cũ không được ghi đè
  const newer = packChunk(0, 0, new Map([[cellNum(1, 2, 3), B.air]]), 5);
  assert.equal(mergeLegacy(0, 0, newer, legacy.get(k0)!, MAX), null);
});

test("lưu: túi đồ khứ hồi + chế độ; bản ghi hỏng → null", () => {
  const inv = addItem(addItem(emptyInv(), "plank", 70).inv, "axis_pick", 1).inv;
  const rec = invRecord(inv, "creative", 4);
  const back = parseInvRecord(JSON.parse(JSON.stringify(rec)))!;
  assert.deepEqual(back.slots, inv);
  assert.equal(back.mode, "creative");
  assert.equal(back.rev, 4);
  assert.equal(parseInvRecord({ k: "x" }), null);
  assert.equal(parseInvRecord({ k: "inv", slots: "?", mode: "god" })!.mode, "survival");
});

test("lưu: bẩn có phiên bản — sửa trong lúc đang ghi thì vẫn bẩn", () => {
  const d = new DirtyRevs<number>();
  d.mark(1);
  d.mark(2);
  const snap = d.snapshot();
  d.mark(2); // sửa mới khi giao dịch đang chạy
  d.committed(snap);
  assert.equal(d.size, 1);
  assert.deepEqual(d.snapshot(), [[2, 2]]);
  d.committed(d.snapshot());
  assert.equal(d.size, 0);
});

// ───────────── Quặng ─────────────
test("quặng: tất định, không gần điểm xuất phát; quanh vùng có đủ Tinh thể Số nguyên lộ thiên và Đồng Tỉ lệ", () => {
  assert.deepEqual(surfaceOreCells(3, -2), surfaceOreCells(3, -2));
  let intNodes = 0;
  let copperNodes = 0;
  let near = Infinity;
  for (let cx = -6; cx <= 5; cx++)
    for (let cz = -6; cz <= 5; cz++) {
      const n = surfaceNodes(cx, cz);
      for (let i = 0; i < n.length; i += 3) {
        if (n[i + 2] === B.intcrystal) {
          intNodes++;
          near = Math.min(near, Math.hypot(n[i], n[i + 1]));
        } else copperNodes++;
        assert.ok(Math.hypot(n[i], n[i + 1]) >= 14);
      }
    }
  assert.ok(intNodes >= 40, `chỉ ${intNodes} mỏ Tinh thể`);
  assert.ok(near < 60, `mỏ Tinh thể gần nhất cách ${near} m`);
  // ô mỏ thật sự là khối quặng (bộ sinh đã ghi) — ở chunk có mỏ đầu tiên
  let checked = 0;
  for (let cx = -3; cx <= 3 && checked < 3; cx++)
    for (let cz = -3; cz <= 3 && checked < 3; cz++) {
      const cells = surfaceOreCells(cx, cz);
      if (!cells.length) continue;
      genChunk(cx, cz);
      let hit = 0;
      for (let i = 0; i < cells.length; i += 4) if (naturalAt(cells[i], cells[i + 1], cells[i + 2]) === cells[i + 3]) hit++;
      assert.ok(hit >= cells.length / 8, `chunk ${cx},${cz}: ${hit}/${cells.length / 4} ô quặng`);
      checked++;
    }
  assert.ok(checked >= 1);
  // vách hang có quặng (chunk có hang xa điểm xuất phát)
  let caveOre = 0;
  for (let cx = 3; cx <= 10 && caveOre === 0; cx++)
    for (let cz = -4; cz <= 4; cz++) {
      const g = genChunk(cx, cz);
      for (const c of g.cols) if (c) for (const id of c.ids) if (id === B.copper || id === B.intcrystal) caveOre++;
    }
  assert.ok(caveOre > 0, "không thấy quặng nào");
  assert.equal(genColumn(0, 0), undefined);
  void CHUNK;
});
