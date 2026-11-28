import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32 } from "@/lib/world/music";
import {
  COALESCE_MAX,
  ELEMENTS,
  SFX_CAP,
  SPELL_ELEMENT,
  VOICE_CAPS,
  VoicePool,
  WEAPON_ELEMENT,
  centsJitter,
  dbJitter,
  duckDb,
  hitLayers,
  pickNoRepeat,
  spellElement,
  weaponElement,
} from "@/lib/world/musicVoices";

test("trần nhóm: giọng thứ 7 cướp giọng cũ nhất của nhóm 'hit'", () => {
  const p = new VoicePool();
  const ids: number[] = [];
  for (let i = 0; i < VOICE_CAPS.hit; i++) ids.push(p.request("hit", 3, i * 0.1, 5)!.id);
  const g = p.request("hit", 3, 1, 5)!;
  assert.deepEqual(g.steal, [ids[0]]);
  assert.equal(p.count("hit"), VOICE_CAPS.hit);
});

test("giọng kém quan trọng không cướp được giọng quan trọng hơn", () => {
  const p = new VoicePool();
  for (let i = 0; i < VOICE_CAPS.ui; i++) p.request("ui", 4, i * 0.1, 5);
  assert.equal(p.request("ui", 1, 1, 5), null);
});

test("gộp đòn trùng khung: nhỏ dần 1/√k, quá COALESCE_MAX thì bỏ", () => {
  const p = new VoicePool();
  const gains = [];
  for (let i = 0; i < COALESCE_MAX; i++) gains.push(p.request("hit", 3, 2, 0.5)!.gain);
  assert.deepEqual(
    gains.map((x) => x.toFixed(3)),
    [1, 1 / Math.SQRT2, 1 / Math.sqrt(3)].map((x) => x.toFixed(3)),
  );
  assert.equal(p.request("hit", 3, 2.01, 0.5), null);
  // qua cửa sổ gộp thì lại được
  assert.ok(p.request("hit", 3, 2.1, 0.5));
});

test("trần tổng hiệu ứng: cướp giọng ưu tiên thấp nhất; nhạc không tính vào trần hiệu ứng", () => {
  const p = new VoicePool();
  let t = 0;
  const cats = ["hit", "swing", "spell", "impact", "move", "ui", "ambient"] as const;
  let n = 0;
  outer: for (const c of cats)
    for (let i = 0; i < VOICE_CAPS[c]; i++) {
      if (n >= SFX_CAP) break outer;
      p.request(c, c === "move" ? 0 : 3, (t += 0.1), 99);
      n++;
    }
  for (let i = 0; i < 8; i++) p.request("music", 1, (t += 0.1), 99);
  assert.equal(p.count(), SFX_CAP);
  assert.equal(p.count("music"), 8);
  const g = p.request("ambient", 2, (t += 0.1), 1);
  assert.ok(g && g.steal.length >= 1);
  assert.equal(p.count(), SFX_CAP);
});

test("giọng hết hạn được dọn", () => {
  const p = new VoicePool();
  p.request("hit", 3, 0, 0.2);
  p.request("hit", 3, 0.1, 0.2);
  p.prune(1);
  assert.equal(p.count("hit"), 0);
});

test("biến thiên: trong biên, không lặp liền", () => {
  const r = mulberry32(11);
  for (let i = 0; i < 2000; i++) {
    const c = centsJitter(r, 50);
    assert.ok(c >= Math.pow(2, -50 / 1200) - 1e-12 && c <= Math.pow(2, 50 / 1200) + 1e-12);
    const d = dbJitter(r, 1.5);
    assert.ok(d >= Math.pow(10, -1.5 / 20) - 1e-12 && d <= Math.pow(10, 1.5 / 20) + 1e-12);
  }
  let last = -1;
  for (let i = 0; i < 500; i++) {
    const k = pickNoRepeat(r, 4, last);
    assert.ok(k >= 0 && k < 4 && k !== last);
    last = k;
  }
});

test("ducking nhạc: 3–5 dB, cộng dồn nhưng không quá 6 dB", () => {
  assert.equal(duckDb(1), 3);
  assert.equal(duckDb(2), 5);
  let d = 0;
  for (let i = 0; i < 10; i++) d = duckDb(1.5, d);
  assert.ok(d <= 6 && d >= 4);
});

test("mọi vũ khí và phép đều có nguyên tố; công thức lớp âm trong khoảng nghiên cứu", () => {
  for (const id of ["blade", "bow", "staff", "lever", "pendulum", "coil", "spiral", "prism"]) assert.ok(WEAPON_ELEMENT[id], id);
  for (const id of ["shield", "bolt", "vortex", "meteor", "wave"]) assert.ok(SPELL_ELEMENT[id], id);
  assert.equal(weaponElement("nope"), "steel");
  assert.equal(spellElement("bolt"), "lightning");
  for (const [el, r] of Object.entries(ELEMENTS)) {
    assert.ok(r.tr.ms >= 5 && r.tr.ms <= 15, `${el} transient`);
    assert.ok(r.body.ms >= 40 && r.body.ms <= 220, `${el} body`);
    assert.ok(r.tail.ms >= 100 && r.tail.ms <= 600, `${el} tail`);
  }
  assert.deepEqual(hitLayers(2), { transient: true, body: true, tail: true, glint: true, sub: true, duck: 1.2 });
  assert.equal(hitLayers(0).glint, false);
});

test("lớp nhạc chiến đấu: mẫu đủ 16 phách, trống trầm ở phách 1, cường độ tắt dần (bán rã) về lặng sau ~8 s", async () => {
  const { COMBAT_PATTERN, COMBAT_HALF_LIFE, combatDecay } = await import("@/lib/world/musicVoices");
  for (const k of ["kick", "snare", "hat", "bass"] as const) assert.equal(COMBAT_PATTERN[k].length, 16);
  assert.equal(COMBAT_PATTERN.kick[0], 1);
  assert.ok(Math.abs(combatDecay(1, COMBAT_HALF_LIFE) - 0.5) < 1e-12);
  assert.ok(combatDecay(1, 8) < 0.15);
  assert.equal(combatDecay(0.7, 0), 0.7);
});
