import { test } from "node:test";
import assert from "node:assert/strict";
import { AO_LEVEL, meshChunk, vertexAO, type MeshAccess } from "@/lib/world/mesher";

/** thế giới giả: tập khối đặt tay */
function world(blocks: [number, number, number, number?][]): MeshAccess {
  const m = new Map(blocks.map(([x, y, z, id]) => [`${x},${y},${z}`, id ?? 1]));
  return {
    blockAt: (x, y, z) => m.get(`${x},${y},${z}`) ?? 0,
    columnRange: () => [0, 4],
    isGlow: (id) => id === 7,
    color: () => [1, 1, 1],
  };
}
const faces = (d: { idx: Uint32Array }) => d.idx.length / 6;

test("một khối lẻ: 6 mặt, 24 đỉnh có chỉ mục; hai khối kề: 10 mặt (mặt chung bị bỏ)", () => {
  const one = meshChunk(0, 0, 8, world([[2, 1, 2]])).solid;
  assert.equal(faces(one), 6);
  assert.equal(one.p.length / 3, 24);
  const two = meshChunk(0, 0, 8, world([[2, 1, 2], [3, 1, 2]])).solid;
  assert.equal(faces(two), 10);
});

test("khối phát sáng tách sang lưới glow", () => {
  const r = meshChunk(0, 0, 8, world([[2, 1, 2, 7], [5, 1, 5]]));
  assert.equal(faces(r.glow), 6);
  assert.equal(faces(r.solid), 6);
});

test("AO đỉnh: hai cạnh cùng che → mức tối đa bất kể góc; mặt trống → sáng nhất", () => {
  assert.equal(vertexAO(true, true, false), 3);
  assert.equal(vertexAO(false, false, false), 0);
  assert.equal(vertexAO(true, false, true), 2);
  // mặt trên của khối nằm sát chân một bức tường: các đỉnh giáp tường tối hơn đỉnh xa tường
  const r = meshChunk(0, 0, 8, world([[2, 1, 2], [3, 2, 2]])).solid;
  // tìm mặt trên của khối (2,1,2): 4 đỉnh y = 2, x ∈ {2, 3}
  const top: { x: number; c: number }[] = [];
  for (let v = 0; v < r.p.length / 3; v++) if (r.n[v * 3 + 1] === 1 && r.p[v * 3 + 1] === 2) top.push({ x: r.p[v * 3], c: r.c[v * 3] });
  assert.equal(top.length, 4);
  const near = top.filter((t) => t.x === 3).map((t) => t.c);
  const far = top.filter((t) => t.x === 2).map((t) => t.c);
  assert.ok(Math.max(...near) < Math.min(...far), `gần tường phải tối hơn: ${near} vs ${far}`);
  assert.ok(Math.abs(Math.max(...far) - AO_LEVEL[0]) < 1e-6);
});

test("khoảng y theo từng cột: vách hố sâu của cột bên cạnh vẫn lộ mặt; dưới khoảng không sinh mặt thừa", () => {
  // mặt đất đặc tới y = 4 (y < 5); cột (3, ·, 3) bị đào thành giếng sâu từ y = −5 tới 4
  const hole = (x: number, z: number) => x === 3 && z === 3;
  const A: MeshAccess = {
    blockAt: (x, y, z) => (y >= 5 ? 0 : hole(x, z) && y >= -5 ? 0 : 1),
    columnRange: (x, z) => (hole(x, z) ? [-6, 5] : [4, 5]),
    isGlow: () => false,
    color: () => [1, 1, 1],
  };
  const r = meshChunk(0, 0, 8, A).solid;
  // 4 vách × 10 tầng (y = −5…4) + đáy giếng (y = −6) + 63 mặt trên của đất
  let walls = 0;
  let bottom = 0;
  for (let q = 0; q < r.idx.length; q += 6) {
    const v = r.idx[q];
    const [nx, ny, nz] = [r.n[v * 3], r.n[v * 3 + 1], r.n[v * 3 + 2]];
    if (ny === 1 && r.p[v * 3 + 1] === -5) bottom++;
    else if (ny === 0 && (nx !== 0 || nz !== 0)) walls++;
  }
  assert.equal(walls, 40);
  assert.equal(bottom, 1);
  assert.equal(faces(r), 40 + 1 + 63);
});
