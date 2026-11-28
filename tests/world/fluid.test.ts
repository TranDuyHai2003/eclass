import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOW_MAX, buildVolume, computeFlow, computeLight, fluidMesh, type Access, type BlockTraits } from "@/lib/world/voxel/chunkMesh";
import { B, isSolidBlock, isTargetBlock } from "@/lib/world/blocks";

const W_ID = B.water;
const T: BlockTraits = { transparent: () => false, emit: () => 0, glow: () => false, sprite: (id) => id === W_ID, fluid: (id) => id === W_ID };
/** thế giới thử: nền đá y ≤ 0, khối thêm / đào theo bảng (giá trị 0 = đào rỗng) */
function world(extra: Map<string, number>): Access {
  return {
    blockAt: (x, y, z) => extra.get(`${x},${y},${z}`) ?? (y <= 0 ? 1 : 0),
    columnRange: () => [-6, 12],
    color: () => [1, 1, 1],
  };
}
const at = (v: ReturnType<typeof buildVolume>, lvl: Uint8Array, x: number, y: number, z: number) => lvl[((y - v.lo) * v.W + (z - v.z0)) * v.W + (x - v.x0)];

test("nước: nguồn trên nền phẳng lan ngang 7 ô, mỗi ô giảm 1 mức (khoảng cách Manhattan)", () => {
  const v = buildVolume(0, 0, 16, world(new Map([["8,1,8", W_ID]])), 8);
  const lvl = computeFlow(v, T);
  assert.equal(at(v, lvl, 8, 1, 8), FLOW_MAX);
  for (let d = 1; d <= 9; d++) {
    const want = d <= 7 ? FLOW_MAX - d : 0;
    assert.equal(at(v, lvl, 8 + d, 1, 8), want, `x + ${d}`);
    if (d <= 4) assert.equal(at(v, lvl, 8 + d, 1, 8 + (d >> 1)), Math.max(0, FLOW_MAX - d - (d >> 1)), `chéo ${d}`);
  }
  assert.equal(at(v, lvl, 8, 2, 8), 0, "không chảy lên");
});

test("nước: gặp giếng thì rơi thẳng xuống (không lan ngang khi đang rơi), chạm đáy lan lại 7 theo đường hầm", () => {
  // giếng 1 × 1 tại (10, 8) từ y = 0 xuống y = −3, đáy nối đường hầm có trần chạy theo +z (y = −3, z = 9…14)
  const ex = new Map<string, number>([["8,1,8", W_ID]]);
  for (let y = 0; y >= -3; y--) ex.set(`10,${y},8`, 0);
  for (let z = 9; z <= 14; z++) ex.set(`10,-3,${z}`, 0);
  const v = buildVolume(0, 0, 16, world(ex), 8);
  const lvl = computeFlow(v, T);
  assert.equal(at(v, lvl, 10, 1, 8), 6, "dòng chảy tới miệng giếng");
  for (let y = 0; y >= -3; y--) assert.equal(at(v, lvl, 10, y, 8), FLOW_MAX, `rơi y = ${y}`);
  assert.equal(at(v, lvl, 10, -3, 9), FLOW_MAX - 1);
  assert.equal(at(v, lvl, 10, -3, 12), FLOW_MAX - 4);
});

test("nước: tất định — bỏ nguồn là hết nước; hai chunk kề nhau tính trùng khớp ở vùng chung", () => {
  const none = buildVolume(0, 0, 16, world(new Map()), 8);
  assert.ok(computeFlow(none, T).every((l) => l === 0));
  const src = new Map([["14,1,5", W_ID]]);
  const a = buildVolume(0, 0, 16, world(src), 8);
  const b = buildVolume(1, 0, 16, world(src), 8);
  const la = computeFlow(a, T);
  const lb = computeFlow(b, T);
  for (let x = 12; x < 24; x++)
    for (let z = 0; z < 12; z++) {
      if (x < a.x0 || x >= a.x0 + a.W || x < b.x0 || x >= b.x0 + b.W) continue;
      assert.equal(at(a, la, x, 1, z), at(b, lb, x, 1, z), `(${x}, ${z})`);
    }
});

test("nước: lưới nước — mặt trên thấp theo mức, mặt quay ra ngoài, không có mặt giữa hai ô nước", () => {
  const v = buildVolume(0, 0, 16, world(new Map([["8,1,8", W_ID]])), 8);
  computeLight(v, T);
  const lvl = computeFlow(v, T);
  const m = fluidMesh(v, lvl, T);
  assert.ok(m.quads > 0);
  // mỗi ô nước có đúng 1 mặt trên (y = 1 + h); nguồn h = 0,875, ô mức 1 h = 0,12
  let tops = 0;
  for (let q = 0; q < m.quads; q++) {
    const vi = m.idx[q * 6];
    if (m.n[vi * 3 + 1] > 0) tops++;
  }
  let wet = 0;
  for (const l of lvl) if (l) wet++;
  assert.equal(tops, wet);
  const ys = new Set<number>();
  for (let i = 0; i < m.p.length; i += 3) ys.add(Math.round(m.p[i + 1] * 1000) / 1000);
  assert.ok(ys.has(1.875) && ys.has(1.12), [...ys].join(" "));
  // cuộn: pháp tuyến tam giác cùng chiều pháp tuyến đỉnh
  for (let t = 0; t < m.idx.length; t += 3) {
    const P = (k: number) => [m.p[k * 3], m.p[k * 3 + 1], m.p[k * 3 + 2]];
    const [a, b, c] = [P(m.idx[t]), P(m.idx[t + 1]), P(m.idx[t + 2])];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const k = m.idx[t] * 3;
    assert.ok(cr[0] * m.n[k] + cr[1] * m.n[k + 1] + cr[2] * m.n[k + 2] > 0, "mặt nước phải quay ra ngoài");
  }
});

test("va chạm: đuốc / nước đi xuyên; tia nhắm bỏ qua nước nhưng trúng đuốc", () => {
  assert.equal(isSolidBlock(B.water), false);
  assert.equal(isSolidBlock(B.torch), false);
  assert.equal(isSolidBlock(B.stone), true);
  assert.equal(isTargetBlock(B.water), false);
  assert.equal(isTargetBlock(B.torch), true);
  assert.equal(isTargetBlock(B.air), false);
});
