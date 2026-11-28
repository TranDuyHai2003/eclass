import { test } from "node:test";
import assert from "node:assert/strict";
import { DOOR_BY_ID, ZONE_FLAGS, ZVOID, doorLanding, zoneBlocked, zoneGround, zoneIndex, type ZoneId } from "@/lib/world/zoneGraph";
import { chladni } from "@/lib/world/harmonicState";
import { BELL, BOARD, LCM_ROUNDS, MACHINE, TIMELINE, bellAt, demoAt, lcm, machineTarget, nextCoincidence, stampAt, tileAt, tileX } from "@/lib/world/zones/waitHall";
import { KEY_N, OCTAVE_ROUNDS, PIER_E, isBlack, isOctave, keyAt, keyFreq, keyX, noteName, octaveTarget, pitchClass } from "@/lib/world/zones/keySea";
import { DANGER, GATE_E, GATE_W, LEVER, MODES, MODE_ANSWER, PLATE, TOWER, WITCH_ARENA, beetleStep, nodalConnected, plateDanger, plateF } from "@/lib/world/zones/bronzeDesert";

/** BFS đi bộ trên lưới h (mặc định 0,5 m) (bước lên ≤ 0,8 m, rơi xuống tuỳ ý, không xuyên tường); avoid: ô cấm thêm (luật khu) */
function reach(zone: Exclude<ZoneId, "hub">, from: [number, number, number], avoid?: (x: number, z: number) => boolean, h = 0.5) {
  const ix = zoneIndex(zone);
  const key = (x: number, z: number, y = 0) => `${Math.round(x / h)},${Math.round(z / h)},${Math.round(y)}`;
  const flat = new Set<string>();
  const seen = new Map<string, number>();
  const q: [number, number, number][] = [[from[0], from[2], from[1]]];
  seen.set(key(from[0], from[2], from[1]), from[1]);
  while (q.length) {
    const [x, z, y] = q.pop()!;
    for (const [dx, dz] of [
      [h, 0],
      [-h, 0],
      [0, h],
      [0, -h],
    ]) {
      const nx = x + dx;
      const nz = z + dz;
      const g = zoneGround(ix, nx, nz, y);
      const k = key(nx, nz, g);
      if (seen.has(k)) continue;
      if (g === ZVOID || g < -0.5) continue;
      if (zoneBlocked(ix, nx, nz, y) && zoneBlocked(ix, nx, nz, g)) continue;
      if (avoid?.(nx, nz)) continue;
      seen.set(k, g);
      flat.add(`${Math.round(nx / h)},${Math.round(nz / h)}`);
      q.push([nx, nz, g]);
    }
  }
  return (x: number, z: number) => flat.has(`${Math.round(x / h)},${Math.round(z / h)}`);
}

test("Phòng Chờ: BCNN, lịch chuông / dập và màn diễn kiểm chứng", () => {
  assert.equal(lcm(3, 4), 12);
  assert.equal(lcm(4, 6), 12);
  assert.equal(lcm(6, 9), 18);
  for (const [a, b] of LCM_ROUNDS) {
    const l = lcm(a, b);
    assert.ok(l < TIMELINE.n, "BCNN nằm trong dải 24 ô");
    assert.equal(nextCoincidence(a, b), l);
    assert.equal(nextCoincidence(a, b, l), 2 * l);
    // lần trùng đầu tiên sau 0 đúng là BCNN (không ô nào sớm hơn có cả hai)
    for (let i = 1; i < l; i++) assert.ok(!(bellAt(i, a) && stampAt(i, b)));
    assert.ok(bellAt(l, a) && stampAt(l, b));
    // màn diễn: con trỏ 1 ô / phách, dừng ở max(dấu, BCNN), xong sau ô cuối 1 phách
    const d0 = demoAt(10, 9.5, a, b, l);
    assert.equal(d0.tile, -1);
    assert.equal(demoAt(10, 13.2, a, b, l).tile, 3);
    assert.ok(demoAt(10, 10 + l + 2.1, a, b, l).done);
    assert.ok(demoAt(10, 11, a, b, l).correct);
    const wrong = demoAt(10, 11, a, b, l + a);
    assert.ok(!wrong.correct);
    assert.equal(wrong.last, l + a);
  }
  assert.equal(tileAt(tileX(5), TIMELINE.z), 5);
  assert.equal(tileAt(tileX(5), TIMELINE.z + 3), -1);
  const out: [number, number] = [0, 0];
  machineTarget(MACHINE.x, MACHINE.z + 2, out);
  assert.ok(Math.hypot(out[0] - MACHINE.x, out[1] - (MACHINE.z + 2)) >= 1.9, "máy phát số lùi khi tới gần");
  machineTarget(-30, -20, out);
  assert.deepEqual(out, [MACHINE.x, MACHINE.z], "ở xa thì đứng chỗ cũ");
});

test("Phòng Chờ: từ cửa đến đi tới mọi ô phách, chuông, bảng số và cửa tấm vé", () => {
  const r = reach("wait", doorLanding(DOOR_BY_ID.W_keys));
  for (let i = 0; i < TIMELINE.n; i++) assert.ok(r(tileX(i), TIMELINE.z), `ô ${i}`);
  assert.ok(r(BELL.x + 1.5, BELL.z));
  assert.ok(r(BOARD.x, BOARD.z + 3));
  const t = doorLanding(DOOR_BY_ID.W_desert, 1.5);
  assert.ok(r(t[0], t[2]), "tới được trước lỗ vé");
});

test("Biển Phím: lớp cao độ lặp mỗi 12 phím, quãng tám = ×2 tần số, phím dưới chân đúng", () => {
  for (let k = 0; k + 12 < KEY_N; k++) {
    assert.equal(pitchClass(k), pitchClass(k + 12));
    assert.equal(isBlack(k), isBlack(k + 12));
    assert.ok(Math.abs(keyFreq(k + 12) / keyFreq(k) - 2) < 1e-12);
    assert.ok(isOctave(k, k + 12));
    assert.ok(Math.abs(keyX(k + 12) - keyX(k) - 7 * 3.4) < 1e-9, "quãng tám cách 7 phím trắng");
  }
  assert.equal(noteName(0, "vi"), "Đô3");
  assert.equal(noteName(13, "en"), "C♯4");
  for (let k = 0; k < KEY_N; k++) assert.equal(keyAt(keyX(k), isBlack(k) ? -2 : 3), k, `phím ${k}`);
  for (const k of OCTAVE_ROUNDS) {
    assert.ok(octaveTarget(k) < KEY_N);
    assert.ok(!isBlack(k), "cua kẹp phím trắng (dễ thấy)");
  }
  assert.equal(keyAt(-40, 0), -1);
});

test("Biển Phím: đê sứ chặn đường tới cửa Phòng Chờ cho tới khi giải xong", () => {
  const from = doorLanding(DOOR_BY_ID.K_hub);
  const goal = doorLanding(DOOR_BY_ID.K_wait, 1.5);
  delete ZONE_FLAGS.dike;
  const closed = reach("keys", from);
  for (const k of [0, 12, 24, 35]) assert.ok(closed(keyX(k), 3), `phím ${k}`);
  assert.ok(!closed(goal[0], goal[2]), "đê đóng: không tới được cửa");
  ZONE_FLAGS.dike = true;
  const open = reach("keys", from);
  assert.ok(open(goal[0], goal[2]), "đê mở: tới được cửa");
  assert.ok(open(PIER_E.x, 0));
  delete ZONE_FLAGS.dike;
});

test("Sa Mạc: đúng MỘT mode có đường nút nối hai cổng; cùng hàm chladni với shader", () => {
  const ok = MODES.map(([m, n]) => nodalConnected(m, n));
  assert.deepEqual(
    ok.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
    [MODE_ANSWER],
  );
  // mọi mode đều chạm cả hai cổng (không đoán được chỉ bằng nhìn cổng)
  for (const [m, n] of MODES) {
    const touch = (v: number) => [-0.06, -0.03, 0, 0.03, 0.06].some((d) => Math.abs(chladni(-1, v + d, m, n)) <= DANGER);
    assert.ok(touch(GATE_W) && touch(GATE_E), `(${m}, ${n}) không chạm cổng`);
  }
  assert.equal(plateF(PLATE.half / 2, -PLATE.half / 4, 1, 4), chladni(0.5, -0.25, 1, 4));
  assert.ok(!plateDanger(0, 0, 1, 4), "tâm tấm F(0,0) = 0");
  assert.ok(!plateDanger(PLATE.half + 5, 0, 1, 4), "ngoài tấm không nguy hiểm");
});

test("Sa Mạc: đi bộ thật — mode đúng qua được tấm sang bờ Đông, mode sai thì không; đài quan sát tới được", () => {
  const from = doorLanding(DOOR_BY_ID.D_wait);
  const goal = doorLanding(DOOR_BY_ID.D_hub, 1.5);
  // né thêm 0,4 m (bán kính thân) quanh bụng sóng
  const avoid = (m: number, n: number) => (x: number, z: number) => plateDanger(x, z, m, n) || plateDanger(x + 0.4, z, m, n) || plateDanger(x - 0.4, z, m, n) || plateDanger(x, z + 0.4, m, n) || plateDanger(x, z - 0.4, m, n);
  const [am, an] = MODES[MODE_ANSWER];
  const good = reach("desert", from, avoid(am, an));
  assert.ok(good(goal[0], goal[2]), "mode đúng: sang được bờ Đông");
  assert.ok(good(WITCH_ARENA.x, WITCH_ARENA.z), "tới sân phù thuỷ");
  MODES.forEach(([m, n], i) => {
    if (i === MODE_ANSWER) return;
    assert.ok(!reach("desert", from, avoid(m, n))(goal[0], goal[2]), `mode sai (${m}, ${n}) lại qua được`);
  });
  const free = reach("desert", from, undefined, 0.25);
  assert.ok(free(LEVER.x, LEVER.z), "tới cần gạt");
  // lên đỉnh đài (bậc thang)
  const ix = zoneIndex("desert");
  assert.equal(zoneGround(ix, TOWER.x, TOWER.z, TOWER.top + 0.3), TOWER.top);
  assert.ok(free(TOWER.x, TOWER.z + 1.5) && zoneBlocked(ix, TOWER.x, TOWER.z + 1.5, 0), "đi lên được đỉnh đài (dưới chân đài là trụ)");
});

test("Sa Mạc: bọ gom cát trôi về đường nút và ở trong tấm", () => {
  const st = new Float32Array([10, -7, 1, -20, 15, -1]);
  const [m, n] = MODES[MODE_ANSWER];
  for (let i = 0; i < 600; i++) for (let b = 0; b < 2; b++) beetleStep(st, b, m, n, 1 / 60);
  for (let b = 0; b < 2; b++) {
    assert.ok(Math.abs(plateF(st[b * 3], st[b * 3 + 1], m, n)) < DANGER, `bọ ${b} không ở đường nút`);
    assert.ok(Math.abs(st[b * 3]) < PLATE.half && Math.abs(st[b * 3 + 1]) < PLATE.half);
  }
});
