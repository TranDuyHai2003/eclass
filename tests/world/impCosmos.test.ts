import { test } from "node:test";
import assert from "node:assert/strict";
import { COURT_HALF, FLY, ISLES, LAB_IDS, RING_R, crossesRing, flightRings, isleBlocked, isleGround, labSpot, onCourt, soarVertical } from "../../lib/world/impCosmos";

test("đứng được ở mép mọi đảo, rơi xuống vực ở ngoài", () => {
  for (const i of ISLES) {
    assert.equal(isleGround(i.x + i.r - 0.3, i.z, i.h + 2), i.h);
    assert.equal(isleGround(i.x + i.r + 0.5, i.z, i.h + 2), null);
  }
  assert.equal(isleGround(0, 140), null);
});

test("đảo cao hơn đầu không 'hút' người chơi đang ở dưới", () => {
  const i = ISLES[0];
  assert.equal(isleGround(i.x, i.z, i.h - 5), null);
});

test("các đảo không chồng nhau và không chạm sân / hành lang", () => {
  for (const a of ISLES) {
    // cách sân (kể cả đế đá) ít nhất 12 m
    const dx = Math.max(0, Math.abs(a.x) - COURT_HALF);
    const dz = Math.max(0, Math.abs(a.z) - COURT_HALF);
    assert.ok(Math.hypot(dx, dz) - a.r > 12, a.id);
    assert.ok(!onCourt(a.x, a.z), a.id);
    for (const b of ISLES) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > a.r + b.r + 8, `${a.id}-${b.id}`);
  }
});

test("hành lang Hilbert vươn ra ngoài sân vẫn là đất liền", () => {
  assert.ok(onCourt(7, -40));
  assert.ok(!onCourt(12, -40));
});

test("lõi kỳ quan chặn khi đi bộ, bay cao hơn thì qua", () => {
  const s = ISLES.find((i) => i.id === "sierp")!;
  assert.ok(isleBlocked(s.x, s.z, s.h));
  assert.ok(!isleBlocked(s.x, s.z, s.h + s.coreH + 1));
});

test("vòng bay: 20–40 vòng, cách đều, không đâm vào đảo / kỳ quan / sân", () => {
  const R = flightRings();
  assert.ok(R.length >= 20 && R.length <= 40, String(R.length));
  for (let k = 0; k < R.length; k++) {
    const a = R[k].p;
    const b = R[(k + 1) % R.length].p;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    assert.ok(d > 10 && d < 30, `khoảng cách vòng ${k}: ${d}`);
    assert.ok(Math.abs(Math.hypot(...R[k].n) - 1) < 1e-6);
  }
  for (const { p } of R) {
    assert.ok(!(Math.abs(p[0]) < COURT_HALF + RING_R && Math.abs(p[2]) < COURT_HALF + RING_R && p[1] < 6), `vòng trong sân ${p}`);
    assert.ok(!onCourt(p[0], p[2]) || p[1] > 8, `vòng chạm hành lang ${p}`);
    for (const i of ISLES) {
      const hd = Math.hypot(p[0] - i.x, p[2] - i.z);
      // không nằm trong khối đảo (mặt đảo → đáy đá sâu ~ 6 + 0,7 r)
      if (hd < i.r + RING_R) assert.ok(p[1] - RING_R > i.h + 1 || p[1] + RING_R < i.h - 6 - i.r * 0.7 - 1, `vòng trong đảo ${i.id}`);
      // cách kỳ quan
      if (i.lmR > 0) assert.ok(Math.hypot(p[0] - i.x, p[1] - (i.h + i.lmY), p[2] - i.z) > i.lmR + RING_R + 1, `vòng chạm kỳ quan ${i.id}`);
    }
  }
});

test("bay xuyên qua vòng: trong bán kính thì tính, ngoài / không cắt mặt thì không", () => {
  const ring = { p: [0, 10, 0] as [number, number, number], n: [0, 0, 1] as [number, number, number] };
  assert.ok(crossesRing([0, 10, -1], [0, 10, 1], ring));
  assert.ok(crossesRing([1, 11, 1], [1, 11, -1], ring));
  assert.ok(!crossesRing([5, 10, -1], [5, 10, 1], ring));
  assert.ok(!crossesRing([0, 10, 1], [0, 10, 2], ring));
});

test("bay lượn: nhìn xuống lao nhanh dần, nhìn lên leo chậm lại, buông tay rơi chậm", () => {
  const [dv, dk] = soarVertical(1.1, true);
  assert.ok(dv < -5 && dk > 1);
  const [cv, ck] = soarVertical(-0.6, true);
  assert.ok(cv > 3 && cv <= FLY.climb && ck < 1);
  const [lv] = soarVertical(FLY.level, true);
  assert.ok(Math.abs(lv) < 1e-9);
  assert.deepEqual(soarVertical(0.5, false), [-FLY.sink, 1]);
});

test("trạm thí nghiệm: điểm đứng nằm trên mặt đảo, không trong lõi kỳ quan", () => {
  for (const id of LAB_IDS) {
    const L = labSpot(id);
    const i = ISLES.find((x) => x.id === id)!;
    assert.equal(isleGround(L.x, L.z, i.h + 1), i.h, id);
    // đứng được ở mép vùng kích hoạt
    const ok = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => !isleBlocked(L.x + Math.cos(k) * (L.r - 0.5), L.z + Math.sin(k) * (L.r - 0.5), i.h));
    assert.ok(ok, id);
  }
});
