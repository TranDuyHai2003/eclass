import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOUNCE_CAP,
  CONES,
  CUBE,
  G0,
  HOLE,
  JUMP,
  MOON,
  PLANET,
  RUN,
  WALK,
  WORM,
  angleBetween,
  bounceHeight,
  bounceSpeed,
  coneAt,
  coneSteer,
  cubeCamT,
  easeUp,
  enterMode,
  escapeSpeed,
  gravityScale,
  len,
  orbitEnergy,
  orbitSpeed,
  stepGravity,
  sub,
  upOf,
  wormEnter,
  wormTraverse,
  type GState,
  type V3,
} from "../../lib/world/sirenGravity";
import { SURF_BY_ID, mazeGround, VOID } from "../../lib/world/sirenMaze";

const DT = 1 / 60;
const st = (over: Partial<GState>): GState => ({ mode: "world", pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, face: { k: 1, s: -1 }, ...over });
const idle = { dir: [0, 0, 0] as V3, run: false, jump: false };

test("hành tinh tí hon: đứng yên bám mặt cầu, đi một vòng lớn quay về chỗ cũ", () => {
  let s = st({ mode: "planet", pos: [PLANET.c[0], PLANET.c[1] + PLANET.R, PLANET.c[2]] });
  for (let i = 0; i < 300; i++) s = stepGravity(s, idle, DT);
  assert.ok(Math.abs(len(sub(s.pos, PLANET.c)) - PLANET.R) < 1e-6);
  const start: V3 = [...s.pos];
  // đi "về phía trước" theo kinh tuyến: hướng muốn đi luôn là tiếp tuyến theo trục x quay quanh z
  const T = (2 * Math.PI * PLANET.R) / WALK;
  let travelled = 0;
  for (let t = 0; t < T + 0.12; t += DT) {
    const up = upOf(s);
    // hướng tiếp tuyến của vòng lớn trong mặt phẳng x–y
    const dir: V3 = [up[1], -up[0], 0];
    const before: V3 = [...s.pos];
    s = stepGravity(s, { dir, run: false, jump: false }, DT);
    travelled += len(sub(s.pos, before));
  }
  assert.ok(Math.abs(len(sub(s.pos, PLANET.c)) - PLANET.R) < 1e-6);
  assert.ok(len(sub(s.pos, start)) < 1.2, `cách điểm đầu ${len(sub(s.pos, start)).toFixed(2)} m sau ${travelled.toFixed(1)} m`);
});

test("vận tốc thoát: đi bộ mà nhảy thì rơi lại, chạy rồi nhảy thì thoát khỏi hành tinh", () => {
  const vEsc = escapeSpeed();
  assert.ok(Math.hypot(WALK, JUMP) < vEsc && Math.hypot(RUN, JUMP) > vEsc, `v_thoát ${vEsc.toFixed(2)}`);
  assert.ok(orbitSpeed() < vEsc);
  for (const [run, expect] of [
    [false, "land"],
    [true, "exit"],
  ] as const) {
    let s = st({ mode: "planet", pos: [PLANET.c[0], PLANET.c[1] + PLANET.R, PLANET.c[2]] });
    const dir: V3 = [1, 0, 0];
    for (let i = 0; i < 40; i++) s = stepGravity(s, { dir, run, jump: false }, DT);
    s = stepGravity(s, { dir, run, jump: true }, DT);
    assert.equal(s.grounded, false);
    let ev: string | undefined;
    for (let i = 0; i < 60 * 20 && !ev; i++) {
      const r = stepGravity(s, { dir: [0, 0, 0], run, jump: false }, DT);
      if (r.event === "land" || r.event === "exit") ev = r.event;
      s = r;
    }
    assert.equal(ev, expect, run ? "chạy" : "đi");
  }
});

test("Lồng Escher: bước vào chân tường thì tường thành sàn; đi tiếp lên trần; bước qua cửa thì ra ngoài", () => {
  const C = CUBE;
  let s = st({ mode: "cube", pos: [C.c[0], C.c[1] - C.a, C.c[2]], face: { k: 1, s: -1 } });
  // đi về phía đông (+x) tới khi đổi mặt
  let faced = false;
  for (let i = 0; i < 300 && !faced; i++) {
    const r = stepGravity(s, { dir: [1, 0, 0], run: false, jump: false }, DT);
    if (r.event === "face") faced = true;
    s = r;
  }
  assert.ok(faced);
  assert.deepEqual(s.face, { k: 0, s: 1 });
  assert.deepEqual(upOf(s), [-1, 0, 0]);
  // trên tường đông, "đi tới" = đi lên (+y) → tới trần, trọng lực hướng lên trần
  faced = false;
  for (let i = 0; i < 400 && !faced; i++) {
    const r = stepGravity(s, { dir: [0, 1, 0], run: false, jump: false }, DT);
    if (r.event === "face") faced = true;
    s = r;
  }
  assert.deepEqual(s.face, { k: 1, s: 1 });
  assert.ok(Math.abs(s.pos[1] - (C.c[1] + C.a)) < 1e-9, "đứng trên trần");
  // nhảy trên trần rồi rơi lại trần
  s = stepGravity(s, { dir: [0, 0, 0], run: false, jump: true }, DT);
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) {
    const r = stepGravity(s, idle, DT);
    if (r.event === "land") landed = true;
    s = r;
  }
  assert.ok(landed && s.face.k === 1 && s.face.s === 1);
  // về sàn, đi ra cửa tây
  let f = st({ mode: "cube", pos: [C.c[0], C.c[1] - C.a, C.c[2]], face: { k: 1, s: -1 } });
  let out = false;
  for (let i = 0; i < 400 && !out; i++) {
    const r = stepGravity(f, { dir: [-1, 0, 0], run: false, jump: false }, DT);
    if (r.event === "exit") out = true;
    f = r;
  }
  assert.ok(out && f.mode === "world");
  assert.ok(f.pos[0] < C.c[0] - C.a, "ra phía tây");
  // ra tới hành lang nón sáng: có sàn ngay ngoài cửa
  assert.equal(mazeGround(f.pos[0], f.pos[2], f.pos[1] + 0.1), 8);
});

test("vào lồng từ hành lang: chế độ cube, sàn là mặt dưới", () => {
  assert.equal(enterMode([CUBE.c[0] - CUBE.a + 0.4, CUBE.c[1] - CUBE.a, CUBE.c[2]]), "cube");
  assert.equal(enterMode([PLANET.c[0], PLANET.c[1] + PLANET.R + 2, PLANET.c[2]]), "planet");
  assert.equal(enterMode([0, 0, 0]), "world");
});

test("hành lang nón sáng: không lùi được, đi ngang bị ép vào mép nón 45°", () => {
  const c = CONES[0];
  assert.deepEqual(coneSteer(-1, 0, c), [0, 0]);
  const [x, z] = coneSteer(0.2, 1, c);
  assert.ok(Math.abs(z) <= x + 1e-9 && x > 0, `${x} ${z}`);
  assert.deepEqual(coneSteer(1, 0.3, c), [1, 0.3]);
  assert.equal(coneAt(20, 8, -49)?.id, "coneA");
  assert.equal(coneAt(27, 8, -30), null, "nút giao trước cửa lồng là tự do");
});

test("đệm nảy: e < 1 nảy thấp dần theo e^{2n}, e > 1 cao dần nhưng có trần", () => {
  assert.ok(Math.abs(bounceHeight(4, 0.8, 1) - 2.56) < 1e-9);
  assert.ok(Math.abs(bounceHeight(4, 0.8, 3) - 4 * 0.8 ** 6) < 1e-9);
  assert.equal(bounceSpeed(-1, 1.2), null);
  assert.ok(Math.abs(bounceSpeed(-10, 0.7)! - 7) < 1e-9);
  assert.equal(bounceSpeed(-40, 1.25), BOUNCE_CAP);
  // nảy cao dần từ một cú nhảy thường tới được góc Tây Nam (đệm Đáy) và Giếng vô tận (đệm góc Tây Bắc)
  for (const [pad, target] of [
    ["padSW", "k3"],
    ["padNW", "wellNW"],
  ]) {
    const p = SURF_BY_ID[pad];
    let v = JUMP;
    for (let i = 0; i < 40; i++) v = bounceSpeed(-v, p.bounce!) ?? 0;
    assert.ok((v * v) / (2 * G0) > SURF_BY_ID[target].y - p.y + 0.5, pad);
  }
});

test("Đảo Trăng: trọng lực ¼, nhảy đủ cao lên bậc đá kế tiếp", () => {
  assert.equal(gravityScale(MOON.x, 40, MOON.z), MOON.scale);
  assert.equal(gravityScale(0, 0, 0), 1);
  const h = (JUMP * JUMP) / (2 * G0 * MOON.scale);
  for (let i = 1; i < 4; i++) assert.ok(h > SURF_BY_ID[`moonS${i}`].y - SURF_BY_ID[`moonS${i - 1}`].y + 0.8);
  assert.ok(h > SURF_BY_ID.summit.y - SURF_BY_ID.moonS3.y + 0.8);
  assert.ok(h > SURF_BY_ID.moonS0.y - SURF_BY_ID.moonI.y + 0.8);
});

test("hố đen: quỹ đạo tròn giữ bán kính, năng lượng gần như bảo toàn; chạm chân trời bị nuốt", () => {
  const r0 = 6;
  const v0 = Math.sqrt(HOLE.gm / r0);
  let s = st({ mode: "hole", pos: [HOLE.c[0] + r0, HOLE.c[1], HOLE.c[2]], vel: [0, 0, v0], grounded: false });
  const e0 = orbitEnergy(s.pos, s.vel);
  const T = (2 * Math.PI * r0) / v0;
  const dt = 1 / 120;
  let rMin = Infinity;
  let rMax = 0;
  for (let t = 0; t < 2 * T; t += dt) {
    s = stepGravity(s, idle, dt);
    const r = len(sub(s.pos, HOLE.c));
    rMin = Math.min(rMin, r);
    rMax = Math.max(rMax, r);
  }
  assert.ok(rMin > r0 * 0.95 && rMax < r0 * 1.05, `${rMin} ${rMax}`);
  assert.ok(Math.abs(orbitEnergy(s.pos, s.vel) - e0) < Math.abs(e0) * 0.02);
  // rơi thẳng vào tâm
  let f = st({ mode: "hole", pos: [HOLE.c[0] + 8, HOLE.c[1], HOLE.c[2]], grounded: false });
  let ev: string | undefined;
  for (let i = 0; i < 600 && !ev; i++) {
    const r = stepGravity(f, idle, 1 / 120);
    ev = r.event;
    f = r;
  }
  assert.equal(ev, "swallowed");
});

test("lỗ sâu: đi thẳng vào miệng này, đi thẳng ra miệng kia (đứng được ở chỗ ra)", () => {
  const a = WORM.a;
  const b = WORM.b;
  const from: V3 = [a[0] - 3, a[1], a[2]];
  assert.ok(wormEnter(a, from, [a[0] + 0.2, a[1], a[2]]));
  assert.ok(!wormEnter(a, from, [a[0] - 2, a[1], a[2]]));
  for (const [m, o] of [
    [a, b],
    [b, a],
  ] as const) {
    const r = wormTraverse(m, o, [m[0] - 0.5, m[1], m[2]], [5, 0, 0]);
    assert.ok(len(sub(r.pos, o)) > WORM.R, "ra ngoài vỏ cầu");
    assert.ok(r.vel[0] > 3.9, "giữ hướng đi");
    const g = mazeGround(r.pos[0], r.pos[2], r.pos[1]);
    assert.ok(g !== VOID && r.pos[1] - 0.9 - g < 2, `có chỗ đứng gần dưới điểm ra (${g})`);
  }
});

test("máy quay đổi hướng lên mượt: không xoay quá tốc độ tối đa, rồi hội tụ", () => {
  let u: V3 = [0, 1, 0];
  const target: V3 = [1, 0, 0];
  const max = Math.PI / 1.5;
  for (let i = 0; i < 120; i++) {
    const n = easeUp(u, target, DT, max);
    assert.ok(angleBetween(u, n) <= max * DT + 1e-9);
    u = n;
  }
  assert.ok(angleBetween(u, target) < 0.01);
  // lật ngược 180° vẫn không có NaN
  const flip = easeUp([0, 1, 0], [0, -1, 0], DT);
  assert.ok(flip.every(Number.isFinite));
});

test("máy quay trong Lồng Escher bị kéo về dọc cần máy cho tới khi nằm trong lồng", () => {
  const C = CUBE;
  const target: V3 = [C.c[0] + C.a - 1.3, C.c[1], C.c[2]];
  const pos: V3 = [C.c[0] + C.a + 3, C.c[1] + 1, C.c[2]];
  const t = cubeCamT(target, pos);
  const cam = target.map((a, i) => a + (pos[i] - a) * t);
  assert.ok(t > 0 && t < 1);
  assert.ok(cam[0] <= C.c[0] + C.a - 0.35 + 1e-9);
  // máy đã ở trong thì giữ nguyên
  assert.equal(cubeCamT(target, [C.c[0], C.c[1], C.c[2]]), 1);
});

test("hồi quy: ra khỏi lỗ sâu không trượt khỏi mép đài (Đỉnh / đệm sen Đáy)", () => {
  for (const [m, o] of [
    [WORM.a, WORM.b],
    [WORM.b, WORM.a],
  ] as const) {
    for (const vin of [[4, 0, 0], [7, 0, 0], [0, 0, -7], [-5, -3, 5]] as V3[]) {
      const r = wormTraverse(m, o, [m[0], m[1], m[2]], vin);
      const sp = Math.hypot(r.vel[0], r.vel[2]);
      assert.ok(sp <= 4 + 1e-9 && Math.abs(r.vel[1]) < 1e-9);
      // quãng trượt tối đa: bay ~0,35 s (trọng lực ¼) + trượt trên đất v / 8
      const reach = sp * (0.35 + 1 / 8);
      const end: V3 = [r.pos[0] + (r.vel[0] / sp) * reach, r.pos[1], r.pos[2] + (r.vel[2] / sp) * reach];
      const g = mazeGround(end[0], end[2], r.pos[1]);
      assert.ok(g !== VOID && r.pos[1] - 0.9 - g < 1, `ra ${vin} từ ${m}`);
    }
  }
});
