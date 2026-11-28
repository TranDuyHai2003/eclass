import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { CARDS, FORGE_AT, FORGE_H, FORGE_MAX_OUT, FORGE_MAX_SRC, FORGE_SIZE, encodeForge, expandForge, forgePivot, transformCells, validForge, type Cell, type Mat3 } from "../../lib/world/matrixForge";

const ROOT = join(__dirname, "..", "..");
const Y0 = 12;
const M = (id: string) => CARDS.find((c) => c.id === id)!.m;
/** tháp 2×2×3 ở giữa đế + một khối lệch góc */
const build = (): Cell[] => {
  const out: Cell[] = [];
  for (let x = 2; x < 4; x++) for (let z = 3; z < 5; z++) for (let y = 0; y < 3; y++) out.push({ x: FORGE_AT.x + x, y: Y0 + y, z: FORGE_AT.z + z, id: 6 + y });
  out.push({ x: FORGE_AT.x, y: Y0, z: FORGE_AT.z + 6, id: 7 });
  return out;
};

test("forge op: mã hoá → khai triển ra đúng như transformCells (xoá nguồn rồi đặt kết quả)", () => {
  for (const card of CARDS) {
    const cells = build();
    const op = encodeForge(cells, card.m, Y0);
    assert.equal(op.c.length, cells.length * 2);
    const edits = expandForge(op);
    const clears = edits.slice(0, cells.length);
    assert.ok(clears.every((e) => e[3] === 0), "các ô nguồn bị xoá trước");
    const want = transformCells(cells, card.m, forgePivot(Y0), FORGE_MAX_OUT).filter((c) => c.y >= Y0 - 2 && c.y < Y0 + 40);
    const got = edits.slice(cells.length);
    assert.equal(got.length, want.length, card.id);
    const key = (x: number, y: number, z: number, id: number) => `${x},${y},${z}:${id}`;
    assert.deepEqual(new Set(got.map((e) => key(...e))), new Set(want.map((c) => key(c.x, c.y, c.z, c.id))));
  }
});

test("forge op: tất định — thứ tự ô đầu vào không đổi thông điệp lẫn kết quả", () => {
  const a = build();
  const b = [...a].reverse();
  const opA = encodeForge(a, M("scale"), Y0);
  const opB = encodeForge(b, M("scale"), Y0);
  assert.deepEqual(opA, opB);
  assert.deepEqual(expandForge(opA), expandForge(opB));
  // |det| = 8 → 13 khối nguồn thành 104 khối
  assert.equal(expandForge(opA).length - a.length, a.length * 8);
});

test("forge op: qua JSON (mạng) rồi kiểm lại vẫn khai triển y hệt", () => {
  const op = encodeForge(build(), M("shear"), Y0);
  const wire = validForge(JSON.parse(JSON.stringify({ t: "forge", ...op })), 16);
  assert.ok(wire);
  assert.deepEqual(expandForge(wire!), expandForge(op));
});

test("forge op: bỏ ô ngoài hộp đế, ô rỗng, ô trùng", () => {
  const cells: Cell[] = [
    { x: FORGE_AT.x - 1, y: Y0, z: FORGE_AT.z, id: 3 },
    { x: FORGE_AT.x, y: Y0 + FORGE_H, z: FORGE_AT.z, id: 3 },
    { x: FORGE_AT.x, y: Y0, z: FORGE_AT.z + FORGE_SIZE, id: 3 },
    { x: FORGE_AT.x + 1, y: Y0, z: FORGE_AT.z, id: 0 },
    { x: FORGE_AT.x + 2, y: Y0 + 1, z: FORGE_AT.z + 2, id: 4 },
    { x: FORGE_AT.x + 2, y: Y0 + 1, z: FORGE_AT.z + 2, id: 5 },
  ];
  assert.equal(encodeForge(cells, M("rot"), Y0).c.length, 2);
});

test("forge op: kiểm thông điệp — ma trận sai, quá nhiều khối, chỉ số / id / y sai đều bị từ chối", () => {
  const ok = encodeForge(build(), M("rot"), Y0);
  assert.ok(validForge(ok, 16));
  const bad = (patch: Record<string, unknown>) => validForge({ ...ok, ...patch }, 16);
  assert.equal(bad({ m: [3, 0, 0, 0, 1, 0, 0, 0, 1] }), null, "phần tử > 2");
  assert.equal(bad({ m: [1, 0, 0, 0, 1, 0, 0, 0] }), null, "thiếu phần tử");
  assert.equal(bad({ m: [0.5, 0, 0, 0, 1, 0, 0, 0, 1] }), null, "không nguyên");
  assert.equal(bad({ m: "rot" }), null);
  assert.equal(bad({ y: 1.5 }), null);
  assert.equal(bad({ y: 200 }), null);
  assert.equal(bad({ c: [] }), null, "không có khối");
  assert.equal(bad({ c: [5, 3, 5, 3] }), null, "chỉ số trùng");
  assert.equal(bad({ c: [7, 3, 5, 3] }), null, "không tăng dần");
  assert.equal(bad({ c: [FORGE_MAX_SRC, 3] }), null, "chỉ số ngoài hộp");
  assert.equal(bad({ c: [1, 17] }), null, "id quá lớn");
  assert.equal(bad({ c: [1, 0] }), null, "id rỗng");
  assert.equal(bad({ c: [1] }), null, "lẻ");
  const tooMany: number[] = [];
  for (let i = 0; i <= FORGE_MAX_SRC; i++) tooMany.push(i, 3);
  assert.equal(bad({ c: tooMany }), null, "quá nhiều khối");
  assert.equal(validForge(null, 16), null);
});

test("forge op: trường hợp xấu nhất vẫn bị chặn (đế đầy, ma trận det lớn nhất) ≤ FORGE_MAX_OUT", () => {
  const c: number[] = [];
  for (let i = 0; i < FORGE_MAX_SRC; i++) c.push(i, 3);
  const m: Mat3 = [2, -2, 2, 2, 2, -2, -2, 2, 2];
  const op = validForge({ m, y: Y0, c }, 16)!;
  assert.ok(op);
  const t = Date.now();
  const edits = expandForge(op);
  assert.ok(edits.length <= FORGE_MAX_SRC + FORGE_MAX_OUT);
  assert.ok(Date.now() - t < 2000, "khai triển nhanh");
});

test("forge op: realtime/forge.mjs (server) cho cùng kết quả với bản TypeScript", async () => {
  const url = "file://" + join(ROOT, "realtime", "forge.mjs").replace(/\\/g, "/");
  const mod = (await (new Function("u", "return import(u)") as (u: string) => Promise<Record<string, (...a: unknown[]) => unknown>>)(url)) as Record<string, (...a: unknown[]) => unknown>;
  for (const card of CARDS) {
    const op = encodeForge(build(), card.m, Y0);
    assert.deepEqual(mod.expandForge(mod.validForge(JSON.parse(JSON.stringify(op)), 16)), expandForge(op), card.id);
  }
});
