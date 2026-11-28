import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOORS,
  DOOR_BY_ID,
  ZONE_DEFS,
  ZONE_DOORS,
  ZONE_FLAGS,
  ZONE_IDS,
  ZONE_WIRE,
  ZVOID,
  buildIndex,
  doorCrossing,
  doorInView,
  doorLanding,
  doorLocal,
  doorPeerCounts,
  doorTraverse,
  doorYawDelta,
  normZone,
  sameZone,
  streamPlan,
  toWorld,
  zoneAtWorld,
  zoneBlocked,
  zoneEdges,
  zoneGround,
  zoneGroundLinear,
  zoneIndex,
  zoneJump,
  JUMP_MAX,
  type Door,
  type V3,
  type ZoneId,
} from "@/lib/world/zoneGraph";
import { mazeBlocked, mazeGround } from "@/lib/world/sirenMaze";
import { zfMerge, type ZoneFlags } from "@/lib/world/zoneId";
import { WORM } from "@/lib/world/sirenGravity";
import type { ZoneColliders } from "@/lib/world/zones/types";

const groundOf = (z: ZoneId, x: number, zz: number, y: number) => (z === "hub" ? mazeGround(x, zz, y) : zoneGround(zoneIndex(z), x, zz, y));
const blockedOf = (z: ZoneId, x: number, zz: number, y: number) => (z === "hub" ? mazeBlocked(x, zz, y) : zoneBlocked(zoneIndex(z), x, zz, y));

test("đồ thị khu: mọi cửa có đối ngẫu hai chiều, khác khu, và mọi khu liên thông với hub", () => {
  for (const d of DOORS) {
    const o = DOOR_BY_ID[d.to];
    assert.ok(o, `cửa ${d.id} trỏ tới ${d.to} không tồn tại`);
    assert.equal(o.to, d.id, `${d.id} ↔ ${o.id} không đối ngẫu`);
    assert.notEqual(o.zone, d.zone, `${d.id} nối trong cùng khu`);
  }
  const adj = new Map<ZoneId, ZoneId[]>();
  for (const [a, b] of zoneEdges()) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const seen = new Set<ZoneId>(["hub"]);
  const q: ZoneId[] = ["hub"];
  while (q.length) for (const n of adj.get(q.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
  assert.deepEqual([...seen].sort(), [...ZONE_IDS].sort());
  // vòng hub → keys → wait → desert → hub (không ngõ cụt)
  assert.equal(zoneEdges().length, 4);
});

test("cửa: mọi cặp thiết kế Δ = 0 (máy quay chỉ tịnh tiến) và lỗ cửa cùng hình ở hai đầu", () => {
  for (const d of DOORS) {
    const o = DOOR_BY_ID[d.to];
    assert.ok(Math.abs(doorYawDelta(d, o)) < 1e-9, `${d.id}: Δ = ${doorYawDelta(d, o)}`);
    assert.equal(d.shape, o.shape);
    assert.equal(d.r, o.r);
    assert.equal(d.w, o.w);
  }
});

test("cửa: điểm đặt chân hợp lệ (có sàn đúng cao độ, không vướng, có đường chạy ≥ 3 m) ở cả hai phía khu", () => {
  for (const d of DOORS) {
    for (const ahead of [0.6, 1.2, 2, 3]) {
      const p = doorLanding(d, ahead);
      const g = groundOf(d.zone, p[0], p[2], d.y + 0.5);
      assert.ok(Math.abs(g - d.y) < 0.06, `${d.id}: sàn trước cửa ${ahead} m = ${g} (cần ${d.y})`);
      assert.ok(!blockedOf(d.zone, p[0], p[2], d.y), `${d.id}: bị chặn trước cửa ${ahead} m`);
    }
    // hai mép lỗ cũng có sàn (đi lệch vẫn qua được)
    for (const side of [-0.45, 0.45]) {
      const s = Math.sin(d.yaw);
      const c = Math.cos(d.yaw);
      const w = d.shape === "circle" ? (d.r ?? 1) : d.w / 2;
      const x = d.x + side * w * c + 1.2 * s;
      const z = d.z - side * w * s + 1.2 * c;
      assert.ok(Math.abs(groundOf(d.zone, x, z, d.y + 0.5) - d.y) < 0.06, `${d.id}: mép lỗ không có sàn`);
    }
  }
  // cửa hub dưới đáy không mở ra ngay miệng lỗ sâu
  const h = DOOR_BY_ID.H_desert;
  for (const ahead of [0.5, 1.5, 3, 5]) {
    const p = doorLanding(h, ahead);
    assert.ok(Math.hypot(p[0] - WORM.a[0], p[2] - WORM.a[2]) > WORM.R * 1.3, `H_desert: ${ahead} m trước cửa quá gần lỗ sâu`);
  }
});

test("qua cửa: liên tục vị trí (đối xứng gương), giữ vận tốc, cao độ theo cửa đích", () => {
  const src = DOOR_BY_ID.W_desert;
  const dst = DOOR_BY_ID.D_wait;
  // bước 0,05 m sau mặt cửa, lệch 0,3 m, cao thân 0,9 m
  const s = Math.sin(src.yaw);
  const c = Math.cos(src.yaw);
  const p: V3 = [src.x + 0.3 * c - 0.05 * s, 0.9, src.z - 0.3 * s - 0.05 * c];
  const a: V3 = [p[0] + 0.1 * s, 0.9, p[2] + 0.1 * c];
  assert.ok(doorCrossing(src, a, p), "phải phát hiện xuyên mặt cửa");
  const v: V3 = [-6 * s + 1, -2, -6 * c];
  const r = doorTraverse(src, dst, p, v);
  const l = doorLocal(dst, r.pos[0], r.pos[1], r.pos[2], [0, 0, 0]);
  assert.ok(Math.abs(l[2] - 0.05) < 1e-9, "ra trước mặt cửa đích đúng 0,05 m");
  assert.ok(Math.abs(l[0] + 0.3) < 1e-9, "lệch ngang lật gương");
  assert.ok(Math.abs(r.pos[1] - (dst.y + 0.9)) < 1e-9);
  assert.ok(Math.abs(Math.hypot(...r.vel) - Math.hypot(...v)) < 1e-9, "giữ độ lớn vận tốc");
  assert.equal(r.vel[1], -2, "giữ vận tốc đứng");
  // ra theo +n của cửa đích
  const nd = Math.sin(dst.yaw) * r.vel[0] + Math.cos(dst.yaw) * r.vel[2];
  assert.ok(nd > 5.9);
  // đi ngược (từ sau ra trước) không tính
  assert.equal(doorCrossing(src, p, a), null);
  // ngoài lỗ tròn (cao 3,6 m) không tính
  assert.equal(doorCrossing(src, [a[0], 3.8, a[2]], [p[0], 3.8, p[2]]), null);
});

test("qua cửa Δ ≠ 0: xoay vận tốc ngang đúng Δ (hạ tầng tổng quát)", () => {
  const A: Door = { ...DOOR_BY_ID.H_keys, id: "A", yaw: 0, x: 0, z: 0 };
  const B: Door = { ...DOOR_BY_ID.K_hub, id: "B", yaw: Math.PI / 2, x: 10, z: 0 };
  const d = doorYawDelta(A, B);
  // vào A theo −n_A = (0, 0, −1) → ra B theo +n_B = (1, 0, 0)
  const r = doorTraverse(A, B, [0, 1, -0.1], [0, 0, -5]);
  assert.ok(Math.abs(r.vel[0] - 5) < 1e-9 && Math.abs(r.vel[2]) < 1e-9, `vận tốc ra ${r.vel}`);
  assert.ok(Math.abs(r.dYaw - d) < 1e-12);
  assert.ok(Math.abs(Math.abs(d) - Math.PI / 2) < 1e-9);
});

test("khu ↔ thế giới: zoneAtWorld nhận đúng mọi điểm đặt chân và gốc khu cách nhau > camera.far", () => {
  for (const d of DOORS) {
    const w = toWorld(d.zone, doorLanding(d));
    assert.equal(zoneAtWorld(w[0], w[2]), d.zone, d.id);
  }
  for (const a of ZONE_IDS)
    for (const b of ZONE_IDS) {
      if (a >= b) continue;
      const oa = ZONE_DEFS[a].origin;
      const ob = ZONE_DEFS[b].origin;
      assert.ok(Math.hypot(oa[0] - ob[0], oa[2] - ob[2]) > 1500, `${a}–${b} quá gần`);
    }
  assert.equal(zoneAtWorld(70, -70), "hub");
});

test("chỉ mục va chạm lưới băm khớp quét tuyến tính (5000 điểm / khu) và tường có cờ mở được", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (const id of ["keys", "wait", "desert"] as const) {
    const ix = zoneIndex(id);
    const [hx, hz] = ZONE_DEFS[id].half;
    for (let i = 0; i < 5000; i++) {
      const x = rnd() * (hx + 4);
      const z = rnd() * (hz + 4);
      const y = rnd() * 4 + 1;
      assert.equal(zoneGround(ix, x, z, y), zoneGroundLinear(ix.col, x, z, y), `${id} (${x}, ${z}, ${y})`);
    }
  }
  const col: ZoneColliders = { surfs: [{ id: "f", kind: "box", x: 0, z: 0, y: 0, hx: 10, hz: 10, thick: 1 }], walls: [{ id: "w", x: 3, z: 0, hx: 0.5, hz: 5, y0: 0, y1: 3, flag: "tst" }], cyls: [] };
  const ix = buildIndex(col, 4);
  assert.ok(zoneBlocked(ix, 3, 0, 0));
  ZONE_FLAGS.tst = true;
  assert.ok(!zoneBlocked(ix, 3, 0, 0));
  delete ZONE_FLAGS.tst;
  assert.equal(zoneGround(ix, 50, 0, 0), ZVOID);
});

test("streaming: khu hiện tại luôn gắn, tải trước khu sau cửa đang nhìn, cache LRU giới hạn", () => {
  const a = streamPlan("keys", [{ to: "wait", inView: true }, { to: "hub", inView: true }], []);
  assert.deepEqual(a.mount, ["keys", "wait"]);
  assert.deepEqual(a.prefetch, ["wait"]);
  const b = streamPlan("wait", [{ to: "desert", inView: false }], a.cache, 1);
  assert.deepEqual(b.mount, ["wait", "keys"]);
  const c = streamPlan("desert", [], ["wait", "keys"], 1);
  assert.deepEqual(c.mount, ["desert", "wait"], "giữ đúng 1 khu vừa rời");
  const d = streamPlan("hub", [{ to: "keys", inView: true }], ["desert", "wait"], 2);
  assert.deepEqual(d.mount, ["keys", "desert", "wait"]);
  assert.ok(!d.mount.includes("hub"));
  // trong nón nhìn
  assert.equal(doorInView([0, 2, 0], [0, 0, -1], [0, 2, -30]).inView, true);
  assert.equal(doorInView([0, 2, 0], [0, 0, -1], [0, 2, 30]).inView, false);
  assert.equal(doorInView([0, 2, 0], [0, 0, -1], [0, 2, -90]).inView, false);
  assert.equal(doorInView([0, 2, 0], [0, 0, -1], [0, 2, 4]).inView, true, "rất gần thì luôn tải");
});

test("nhiều người chơi: id khu chuẩn hoá (thiếu = hub), cùng khu, đếm người ở bên kia mỗi cửa", () => {
  assert.equal(normZone(undefined), "hub");
  assert.equal(normZone(""), "hub");
  assert.equal(normZone("bogus"), "hub");
  assert.equal(normZone("desert"), "desert");
  assert.ok(sameZone(null, "hub"));
  assert.ok(!sameZone("keys", "hub"));
  const c = doorPeerCounts("hub", ["keys", "keys", "desert", "hub", undefined, "wait"]);
  assert.equal(c.H_keys, 2);
  assert.equal(c.H_desert, 1);
  const w = doorPeerCounts("wait", ["desert", "keys", "hub"]);
  assert.equal(w.W_desert, 1);
  assert.equal(w.W_keys, 1);
  for (const id of ZONE_IDS) assert.ok(ZONE_WIRE.test(id));
  assert.ok(!ZONE_WIRE.test("Hub"));
  assert.ok(!ZONE_WIRE.test("a".repeat(17)));
  for (const z of ZONE_IDS) assert.ok(ZONE_DOORS[z].length >= 1);
});

test("cú nhảy xa qua cửa đồ thị khu: bộ điều khiển cổng cũ của hub nhận ra (zoneJump) ở CẢ HAI chiều, bước thường thì không", () => {
  // Kịch bản: khung k, ZoneDriver đưa người chơi qua cửa (dời ~2000 m); khung k+1, usePortalDriver (chạy TRƯỚC ZoneDriver) thấy
  // đoạn prev (trước cửa, khu cũ) → cur (sau cửa, khu mới). Không có chốt chặn, đoạn này được kiểm như đường đi thật.
  for (const d of DOORS) {
    const dst = DOOR_BY_ID[d.to];
    const s = Math.sin(d.yaw);
    const c = Math.cos(d.yaw);
    const yb = d.shape === "circle" ? (d.cy ?? 1.7) : 0.9;
    // vị trí thế giới ngay trước mặt cửa nguồn và ngay sau khi ra cửa đích (tâm thân)
    const preL: V3 = [d.x + 0.2 * c + 0.1 * s, d.y + yb, d.z - 0.2 * s + 0.1 * c];
    const postL = doorTraverse(d, dst, [preL[0] - 0.2 * s, preL[1], preL[2] - 0.2 * c], [0, 0, 0]).pos;
    const pre = toWorld(d.zone, preL);
    const post = toWorld(dst.zone, postL);
    assert.notEqual(zoneAtWorld(pre[0], pre[2]), zoneAtWorld(post[0], post[2]), `${d.id}: hai đầu khác khu`);
    assert.ok(zoneJump(pre[0], pre[2], post[0], post[2]), `${d.id}: phải nhận ra cú nhảy xa`);
    // vận tốc ảo nếu không chặn (dt = 1/60): ≫ mọi tốc độ thật
    const vFake = Math.hypot(post[0] - pre[0], post[2] - pre[2]) * 60;
    assert.ok(vFake > 1e4, `${d.id}: vận tốc ảo ${vFake.toFixed(0)} m/s`);
    // bước thường quanh cửa (≤ 2 m) và trong cùng khu: không phải cú nhảy
    for (const [dx, dz] of [
      [0.3, 0],
      [0, -1.5],
      [1.4, 1.4],
    ])
      assert.ok(!zoneJump(pre[0], pre[2], pre[0] + dx, pre[2] + dz), `${d.id}: bước thường bị nhận nhầm`);
  }
  // hồi sinh trong hub (dời > JUMP_MAX) cũng là cú nhảy; quấn biên trong cùng khung không bao giờ tới đây (prev đặt sau quấn)
  assert.ok(zoneJump(0, 10, 0, 10 + JUMP_MAX + 1));
  assert.ok(!zoneJump(0, 10, 0, 10 + JUMP_MAX - 1));
});

test("co-op: cờ câu đố dùng chung (zfMerge — cùng luật với server) chốt đê / vé, nhận mode 0…15, lọc rác, ≤ 8 khoá", () => {
  const f: ZoneFlags = {};
  assert.equal(zfMerge(f, "dike", true), true);
  assert.equal(zfMerge(f, "dike", 1), false, "không đổi → không phát lại");
  assert.equal(zfMerge(f, "dike", 0), false, "đê đã hạ không dựng lại");
  assert.equal(f.dike, 1);
  assert.equal(zfMerge(f, "desert", 2), true);
  assert.equal(zfMerge(f, "desert", 0), true, "mode sa mạc đổi qua lại được");
  for (const [k, v] of [
    ["Bad Key", 1],
    ["desert", 16],
    ["desert", -1],
    ["desert", 1.5],
    ["desert", "2"],
    [42, 1],
    ["__proto__", 1],
  ] as [unknown, unknown][])
    assert.equal(zfMerge(f, k, v), false, `rác bị bỏ: ${String(k)}=${String(v)}`);
  // tên trùng thuộc tính Object.prototype không lách được giới hạn số khoá
  zfMerge(f, "constructor", 1);
  zfMerge(f, "tostring", 1);
  for (let i = 0; i < 10; i++) zfMerge(f, `k${i}`, 1);
  assert.equal(Object.keys(f).length, 8, "≤ 8 khoá mỗi phòng");
  assert.equal(zfMerge(f, "desert", 3), true, "khoá có sẵn vẫn đổi được khi đã đủ 8");
});
