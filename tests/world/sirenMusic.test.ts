import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHORD_PLATES,
  DISSONANCE_START,
  HARMONY_COURT,
  INTERVALS,
  MONOCHORDS,
  MONO_STOPS,
  MONSTER_SPAWNS,
  OFFKEY_PERIOD,
  PENDULUM,
  ROOT,
  SUSTAIN_MS,
  WAVE_TARGET,
  chordState,
  cents,
  fourierSum,
  harmonySolved,
  isConsonant,
  monoLength,
  monoRatio,
  monsterDamage,
  nameInterval,
  nextStop,
  noiseVulnerable,
  onBeat,
  onPlate,
  pendulumDecay,
  pendulumPeriod,
  pendulumPush,
  pendulumRings,
  tet,
  tuneUp,
  waveError,
  waveSolved,
} from "../../lib/world/sirenMusic";
import { GATES, GATE_OPEN, mazeBlocked, mazeGround, VOID } from "../../lib/world/sirenMaze";

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;

test("quãng âm: tỉ lệ nguyên thuần gần 12-TET trong vài cent; thuận tai = tỉ lệ đơn giản", () => {
  for (const iv of INTERVALS) assert.ok(Math.abs(cents(iv.p / iv.q) - iv.semis * 100) < 18, iv.en);
  assert.equal(nameInterval(3 / 2)?.en, "perfect fifth");
  assert.equal(nameInterval(Math.pow(2, 7 / 12))?.en, "perfect fifth");
  assert.equal(nameInterval(2)?.semis, 12);
  assert.ok(isConsonant(2, 1) && isConsonant(3, 2) && isConsonant(4, 3) && isConsonant(5, 4));
  assert.ok(!isConsonant(16, 15) && !isConsonant(45, 32) && !isConsonant(15, 8));
  assert.ok(near(tet(0), 440) && near(tet(12), 880));
  assert.ok(ROOT > 261 && ROOT < 262);
});

test("đàn một dây: nửa dây kêu quãng tám, 2/3 dây kêu quãng năm; ba đàn đúng quãng thì mở rương", () => {
  const oct = MONO_STOPS.findIndex(([p, q]) => p === 2 && q === 1);
  assert.ok(near(monoLength(oct), 0.5) && near(monoRatio(oct), 2));
  const fifth = MONO_STOPS.findIndex(([p, q]) => p === 3 && q === 2);
  assert.ok(near(monoLength(fifth), 2 / 3));
  // xoay vòng các nấc quay về đầu
  let s = 0;
  for (let i = 0; i < MONO_STOPS.length; i++) s = nextStop(s);
  assert.equal(s, 0);
  assert.deepEqual(
    MONOCHORDS.map((m) => nameInterval(monoRatio(m.target))?.en),
    ["octave", "perfect fifth", "perfect fourth"],
  );
  assert.ok(harmonySolved(MONOCHORDS.map((m) => m.target)));
  assert.ok(!harmonySolved([0, 0, 0]));
  // đàn đặt trên Sân Hoà âm, đứng cạnh được
  for (const m of MONOCHORDS) assert.equal(mazeGround(m.x, m.z, 0.1), HARMONY_COURT.y, m.id);
});

test("ống Fourier: ghép hoạ âm lẻ ra sóng vuông, mọi hoạ âm ra răng cưa (π − t)/2", () => {
  const on = (set: number[]) => [1, 2, 3, 4, 5, 6].map((n) => set.includes(n));
  assert.ok(waveSolved(on(WAVE_TARGET.square.set), "square"));
  assert.ok(!waveSolved(on([1, 3]), "square"));
  assert.ok(waveError(on([1, 3]), "square") < waveError(on([1]), "square"), "thêm đúng hoạ âm thì gần mục tiêu hơn");
  // nhiều hoạ âm hơn thì tổng riêng tiến dần về (π − t)/2
  const t = 1;
  const err6 = Math.abs(fourierSum(on([1, 2, 3, 4, 5, 6]), t) - (Math.PI - t) / 2);
  const err2 = Math.abs(fourierSum(on([1, 2]), t) - (Math.PI - t) / 2);
  assert.ok(err6 < err2);
});

test("con lắc: đẩy đúng nhịp chu kỳ riêng thì cộng hưởng tới khi chuông kêu, lệch nhịp thì hãm", () => {
  const T = pendulumPeriod();
  assert.ok(near(T, 2 * Math.PI * Math.sqrt(PENDULUM.len / 9.81)));
  let A = 0;
  let pushes = 0;
  // mỗi chu kỳ đẩy một lần đúng pha 0, giữa hai lần tắt dần một chu kỳ
  let rang = false;
  while (pushes < 40) {
    A = pendulumPush(A, 0.02);
    pushes++;
    if (pendulumRings(A)) {
      rang = true;
      break;
    }
    A = pendulumDecay(A, T);
  }
  assert.ok(rang, `đẩy ${pushes} lần`);
  assert.ok(pushes < 20);
  // đẩy ngược nhịp làm giảm biên độ
  assert.ok(pendulumPush(0.5, 0.5) < 0.5);
  // đẩy lệch ¼ chu kỳ gần như vô ích
  assert.ok(Math.abs(pendulumPush(0.5, 0.25) - 0.5) < 1e-9);
});

test("quái: Nốt lạc điệu chỉ đau khi trúng đúng nhịp, Sóng nhiễu chỉ đau ở pha ngược, Cặp bất hoà lên dây tới quãng thuận", () => {
  const seed = 0.3;
  // đầu nhịp
  const tBeat = OFFKEY_PERIOD * 5 - seed;
  assert.ok(onBeat(tBeat, seed));
  assert.ok(!onBeat(tBeat + OFFKEY_PERIOD / 2, seed));
  assert.ok(monsterDamage("offkey", 20, tBeat, seed) > 20);
  assert.ok(monsterDamage("offkey", 20, tBeat + OFFKEY_PERIOD / 2, seed) < 0, "đánh lạc nhịp làm nó hồi máu");
  // sóng nhiễu: tìm thời điểm pha ngược / cùng pha
  let tNeg = 0;
  while (!noiseVulnerable(tNeg, seed)) tNeg += 0.01;
  assert.ok(monsterDamage("noise", 20, tNeg, seed) === 20);
  let tPos = 0;
  while (Math.sin(2 * Math.PI * 0.6 * tPos + seed) < 0.6) tPos += 0.01;
  assert.ok(monsterDamage("noise", 20, tPos, seed) < 0);
  // bất hoà: từ hai thứ, ba đòn tới ba trưởng (4 nửa cung) là tan
  let s = DISSONANCE_START;
  let hits = 0;
  let res = false;
  while (!res) {
    const r = tuneUp(s);
    s = r.semis;
    res = r.resolved;
    hits++;
  }
  assert.equal(s, 4);
  assert.equal(hits, 3);
});

test("quái đứng trên mặt đất của mê cung, không kẹt trong tường", () => {
  for (const m of MONSTER_SPAWNS) {
    assert.notEqual(mazeGround(m.x, m.z, m.y + 0.1), VOID, `${m.kind} ${m.x},${m.z}`);
    assert.ok(!mazeBlocked(m.x, m.z, m.y));
  }
});

test("bệ hợp âm: hai người cùng đứng → hợp âm ngay; một mình phải chạy sang bệ kia trong lúc nốt còn ngân", () => {
  const t = 100000;
  assert.ok(chordState([t, t], t).chord);
  // một mình: rời A lúc t, tới B sau 3 s → còn ngân
  assert.ok(chordState([t, t + 3000], t + 3000).chord);
  // tới B sau 5 s → A đã tắt
  assert.ok(!chordState([t, t + 5000], t + 5000).chord);
  // chạy được: khoảng cách hai bệ / tốc độ chạy < thời gian ngân
  const d = Math.hypot(CHORD_PLATES[0].x - CHORD_PLATES[1].x, CHORD_PLATES[0].z - CHORD_PLATES[1].z);
  assert.ok(d / 7 < SUSTAIN_MS / 1000 * 0.6);
  assert.ok(onPlate(0, CHORD_PLATES[0].x, 0, CHORD_PLATES[0].z) && !onPlate(1, CHORD_PLATES[0].x, 0, CHORD_PLATES[0].z));
  // hai bệ là quãng năm (7 nửa cung) — hợp âm thuận
  assert.equal(nameInterval(Math.pow(2, (CHORD_PLATES[1].semis - CHORD_PLATES[0].semis) / 12))?.en, "perfect fifth");
  for (const p of CHORD_PLATES) assert.equal(mazeGround(p.x, p.z, 0.1), 0);
});

test("rương thưởng: màn chắn chặn khi đóng, mở thì đi vào được; nằm trên mặt đất", () => {
  for (const g of GATES) {
    GATE_OPEN[g.id] = false;
    assert.ok(mazeBlocked(g.x + g.r * 0.5, g.z, 0), g.id);
    GATE_OPEN[g.id] = true;
    assert.ok(!mazeBlocked(g.x + g.r * 0.5, g.z, 0), g.id);
    GATE_OPEN[g.id] = false;
    assert.notEqual(mazeGround(g.x, g.z, 0.1), VOID);
  }
});
