import { test } from "node:test";
import assert from "node:assert/strict";
import { GRACE_MS, MOVESETS, judge, moveTimes, nextStep, rhythmMul } from "../../lib/world/combo";
import { WEAPON_DEFS } from "../../components/world/combat/items";

// Clip có trong public/world/anim/ual.glb (UAL1) và ual2.glb (UAL2, đã lọc) — kèm thời lượng (s)
const CLIPS: Record<string, number> = {
  Sword_Attack: 1.53, Punch_Jab: 0.87, Punch_Cross: 1.0, Spell_Simple_Shoot: 0.5, Roll: 1.47,
  Sword_Regular_A: 0.43, Sword_Regular_B: 0.53, Sword_Regular_C: 2.0, Sword_Regular_Combo: 3.0, Sword_Heavy_Combo: 4.33,
  Sword_Dash: 1.57, Shield_Dash: 1.1, Melee_Hook: 0.47, OverhandThrow: 1.33,
};

test("mọi vũ khí đều có thế võ: chuỗi ≥ 3 nhát + tụ lực + kỹ năng", () => {
  for (const id of Object.keys(WEAPON_DEFS)) {
    const ms = MOVESETS[id];
    assert.ok(ms, id);
    assert.ok(ms.chain.length >= 3, id);
    assert.ok(ms.charged && ms.skill, id);
  }
});

test("mỗi nhát dùng clip có thật, đoạn cắt nằm trong clip, khung trúng nằm trong đoạn cắt", () => {
  for (const [id, ms] of Object.entries(MOVESETS))
    for (const m of [...ms.chain, ms.charged, ms.skill]) {
      const dur = CLIPS[m.clip];
      assert.ok(dur, `${id}/${m.clip}`);
      assert.ok(m.from >= 0 && m.from < m.to && m.to <= dur + 1e-6, `${id}/${m.name.en} [${m.from}, ${m.to}] / ${dur}`);
      assert.ok(m.hits.length >= 1, `${id}/${m.name.en}`);
      for (const h of m.hits) assert.ok(h.t >= m.from && h.t <= m.to, `${id}/${m.name.en} hit ${h.t}`);
    }
});

test("mốc thời gian: trúng < mở nối < hoàn hảo < kết thúc + ân hạn", () => {
  for (const ms of Object.values(MOVESETS))
    for (const m of ms.chain) {
      const tm = moveTimes(m);
      const last = Math.max(...tm.hits);
      assert.ok(last < tm.linkOpen && tm.linkOpen < tm.perfectFrom && tm.perfectFrom < tm.perfectTo, m.name.en);
      assert.ok(tm.perfectTo <= tm.end + GRACE_MS, m.name.en);
    }
});

test("chấm nhịp: sớm → xếp hàng, ngay sau khung trúng → hoàn hảo, trễ quá → bỏ chuỗi", () => {
  const tm = moveTimes(MOVESETS.blade.chain[0]);
  assert.equal(judge(10, tm), "early");
  assert.equal(judge(tm.perfectFrom + 20, tm), "perfect");
  assert.equal(judge(tm.end + GRACE_MS + 1, tm), "late");
  const between = tm.perfectTo + 5;
  if (between <= tm.end + GRACE_MS) assert.equal(judge(between, tm), "link");
});

test("nhát kế vòng lại; hệ số nhịp", () => {
  assert.equal(nextStep(0, 4), 1);
  assert.equal(nextStep(3, 4), 0);
  assert.equal(rhythmMul(false, 0, false), 1);
  assert.equal(rhythmMul(true, 1, false), 1.35);
  assert.ok(Math.abs(rhythmMul(true, 3, true) - 1.35 * 1.5) < 1e-9);
});
