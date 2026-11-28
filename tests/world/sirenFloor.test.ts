import { test } from "node:test";
import assert from "node:assert/strict";
import { HARMONIC } from "@/lib/world/harmonicState";
import {
  KEYS,
  KEY_AMP,
  KEY_LEAD,
  KEY_TRAVEL,
  PLAT_CYCLE,
  PLAT_N,
  STAFF,
  STAFF_GLSL,
  STAFF_MAX_H,
  keyTarget,
  platBob,
  platYaw,
  resetKeys,
  staffBound,
  staffEnvelope,
  staffHeight,
  stepKeys,
} from "@/lib/world/sirenFloor";
import { ARENA_PLATFORMS, RISE, STEP_UP, SURFS, SURF_BY_ID, mazeBlocked, mazeGround, surfAt, surfTop } from "@/lib/world/sirenMaze";

const at = (beat: number, harmonics = 8) => {
  HARMONIC.beat = beat;
  HARMONIC.harmonics = harmonics;
};

test("đài nổi: tần số 2 : 3 : 5 (: 4), tuần hoàn theo PLAT_CYCLE beat, 0 ở beat 0", () => {
  assert.deepEqual([...PLAT_N].slice(0, 3), [2, 3, 5]);
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.abs(platBob(i, 0)) < 1e-12);
    for (const b of [0.3, 1.7, 5.25]) assert.ok(Math.abs(platBob(i, b) - platBob(i, b + PLAT_CYCLE)) < 1e-9);
    // số lần đổi dấu trong một chu kỳ = 2n (n dao động)
    let cross = 0;
    let prev = platBob(i, 0.001);
    for (let k = 1; k <= 4000; k++) {
      const v = platBob(i, 0.001 + (k * PLAT_CYCLE) / 4000);
      if (Math.sign(v) !== Math.sign(prev)) cross++;
      prev = v;
    }
    assert.equal(cross, 2 * PLAT_N[i]);
  }
  assert.ok(platYaw(0, 4) > 0 && platYaw(1, 4) < 0, "đài kề nhau quay ngược chiều");
});

test("đài nổi: va chạm CPU theo CÙNG hàm nhấp nhô", () => {
  for (const beat of [0, 0.4, 1.1, 3.3]) {
    at(beat);
    ARENA_PLATFORMS.forEach((p, i) => {
      const want = p.top + platBob(i, beat);
      assert.ok(Math.abs(mazeGround(p.x, p.z, want + 0.1) - want) < 1e-9);
      assert.ok(Math.abs(surfTop(SURF_BY_ID[`plat${i}`], p.x, p.z) - want) < 1e-12);
      assert.equal(surfAt(p.x, p.z, want)?.id, `plat${i}`);
    });
  }
  at(0);
});

test("cầu khuông nhạc: ghim hai đầu, bị chặn, H = 1 là sóng sin thuần, tuần hoàn theo chu kỳ beat", () => {
  assert.equal(staffEnvelope(STAFF.s0), 0);
  assert.equal(staffEnvelope(STAFF.s1), 0);
  assert.equal(staffHeight(STAFF.s0 - 1, 1.3, 8), 0);
  assert.equal(staffHeight(STAFF.s1 + 1, 1.3, 8), 0);
  for (let H = 1; H <= STAFF_MAX_H; H++)
    for (let s = STAFF.s0; s <= STAFF.s1; s += 0.37)
      for (const b of [0, 0.7, 2.2, 3.9]) assert.ok(Math.abs(staffHeight(s, b, H)) <= staffBound(H) + 1e-12);
  const s = 1.2;
  const k = (2 * Math.PI) / STAFF.waveLen;
  const w = (2 * Math.PI) / STAFF.cycle;
  const pure = staffEnvelope(s) * STAFF.amp * Math.sin(k * (s - STAFF.s0) - w * 0.9);
  assert.ok(Math.abs(staffHeight(s, 0.9, 1) - pure) < 1e-12);
  assert.ok(Math.abs(staffHeight(s, 0.9, 6) - staffHeight(s, 0.9 + 3 * STAFF.cycle, 6)) < 1e-9);
  // càng nhiều hoạ âm càng khác sóng sin (phân rã → còn âm cơ bản)
  assert.notEqual(staffHeight(s, 0.9, 8), staffHeight(s, 0.9, 1));
  // GLSL sinh từ cùng hằng số: đủ 8 hoạ âm, đúng biên độ
  assert.equal((STAFF_GLSL.match(/h \+= sin/g) ?? []).length, STAFF_MAX_H);
  assert.ok(STAFF_GLSL.includes(STAFF.amp.toFixed(4)));
});

test("cầu khuông nhạc: mazeGround trên cầu = staffHeight (cùng hàm CPU), đi được (dốc / bước nhỏ)", () => {
  const br = SURF_BY_ID[STAFF.id];
  assert.equal(br.dyn, "staff");
  for (const beat of [0, 1.25, 2.5]) {
    for (const H of [8, 3, 1]) {
      at(beat, H);
      let prev = mazeGround(0, 15.7, 0.5);
      for (let z = 15.7; z < 34; z += 0.25) {
        const s = z - br.z;
        const g = mazeGround(0.5, z, 0.6);
        assert.ok(Math.abs(g - staffHeight(s, beat, H)) < 1e-9, `z ${z}`);
        assert.ok(Math.abs(g - prev) < 0.25, "không có bậc gãy dọc cầu");
        assert.ok(!mazeBlocked(0.5, z, g), `không bị chặn trên cầu z ${z}`);
        prev = g;
      }
    }
  }
  // nối êm: mép đấu trường / sân khu ở cao độ 0
  at(1.7);
  assert.equal(mazeGround(0, 15.5, 0.3), 0);
  assert.equal(mazeGround(0, 34.2, 0.3), 0);
  at(0, 8);
});

test("phím sàn: nhô lên TRƯỚC khi sóng tới (dự báo), lún khi sóng qua, so le theo thứ tự bậc", () => {
  // sóng tới bậc frac lúc beat = frac · KEY_TRAVEL
  assert.equal(keyTarget(0.5, 0.5 * KEY_TRAVEL - KEY_LEAD * 0.5), 1);
  assert.equal(keyTarget(0.5, 0.5 * KEY_TRAVEL + 0.1), -0.5);
  assert.equal(keyTarget(0.5, 0.5 * KEY_TRAVEL + 1.5), 0);
  assert.equal(keyTarget(0.5, 0.5 * KEY_TRAVEL - KEY_LEAD - 0.3), 0);
  // bậc chân (frac 0) dự báo ở cuối ô nhịp trước
  assert.equal(keyTarget(0, 3.8), 1);
  // so le: bậc cao hơn nhô sau
  const first = (f: number) => {
    for (let b = 0; b < 4; b += 0.01) if (keyTarget(f, b) === 1) return b;
    return -1;
  };
  assert.ok(first(0.8) > first(0.3));
});

test("phím sàn: lò xo vượt đích rồi về; va chạm đọc cùng trạng thái; bậc vẫn ≤ STEP_UP", () => {
  assert.ok(KEYS.n >= 100, `đủ phím: ${KEYS.n}`);
  resetKeys();
  const i = 0;
  const f = KEYS.frac[i];
  const arrive = f * KEY_TRAVEL + 4; // ô nhịp sau
  let maxLift = 0;
  let minAfter = 0;
  let beat = arrive - 1.2;
  const dt = 1 / 60;
  const bps = 96 / 60;
  while (beat < arrive + 1.5) {
    stepKeys(beat, dt);
    if (beat < arrive) maxLift = Math.max(maxLift, KEYS.lift[i]);
    else minAfter = Math.min(minAfter, KEYS.lift[i]);
    beat += dt * bps;
  }
  assert.ok(maxLift > 1.05, `vượt đích trước khi sóng tới: ${maxLift}`);
  assert.ok(minAfter < -0.3, "lún khi bị gõ");
  // bậc nhô lên → mặt đất CPU nhô theo
  const st = SURFS.find((s) => s.dyn === "key" && s.di === i)!;
  KEYS.lift[i] = 1.37;
  const g = mazeGround(st.x, st.z, st.y + 0.5);
  assert.ok(Math.abs(g - (st.y + 1.37 * KEY_AMP)) < 1e-9);
  assert.ok(1.37 * KEY_AMP + RISE <= STEP_UP, "phím nhô vẫn bước lên được");
  resetKeys();
});
