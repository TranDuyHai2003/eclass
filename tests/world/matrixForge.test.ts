import { test } from "node:test";
import assert from "node:assert/strict";
import { CARDS, det3, mul, transformCells, type Cell } from "../../lib/world/matrixForge";

const cube = (n: number): Cell[] => {
  const out: Cell[] = [];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) out.push({ x, y, z, id: 7 });
  return out;
};
const M = (id: string) => CARDS.find((c) => c.id === id)!.m;
const P = { x: 1, y: 0, z: 1 };

test("forge: số khối nhân đúng |det| (phóng ×2 → ×8, kéo dãn → ×2, quay → ×1)", () => {
  const c = cube(2);
  assert.equal(transformCells(c, M("scale"), P).length, c.length * 8);
  assert.equal(transformCells(c, M("stretch"), P).length, c.length * 2);
  assert.equal(transformCells(c, M("rot"), P).length, c.length);
  assert.equal(det3(M("mirror")), -1);
});

test("forge: det = 0 ép dẹt (khối 2×2×2 → 4 khối)", () => {
  assert.equal(transformCells(cube(2), M("flatten"), P).length, 4);
});

test("forge: phép nhân ma trận không giao hoán (quay·trượt ≠ trượt·quay)", () => {
  assert.notDeepEqual(mul(M("rot"), M("shear")), mul(M("shear"), M("rot")));
});
