import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Composer,
  SCALES,
  ZONES,
  cadence,
  chordPcs,
  degreeToMidi,
  enoOnsets,
  fitBeats,
  hzToMidi,
  inScale,
  makeMotif,
  mulberry32,
  nextDegree,
  nightFromHour,
  planCycle,
  seqValue,
  shepardPartials,
  vary,
  zoneProfile,
  type Variation,
} from "@/lib/world/music";

test("PRNG tất định theo hạt giống", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const r = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});

test("bậc → midi quấn quãng tám, kể cả bậc âm", () => {
  const P = SCALES.majorPenta;
  assert.equal(degreeToMidi(P, 60, 0), 60);
  assert.equal(degreeToMidi(P, 60, 5), 72);
  assert.equal(degreeToMidi(P, 60, -1), 57);
  assert.equal(degreeToMidi(P, 60, 7), 76);
});

test("giai điệu Markov: luôn trong tầm, không lặp một nốt quá 2 lần, sau bước nhảy thì đi ngược lại", () => {
  const r = mulberry32(1);
  let back = 0;
  let same = 0;
  for (let i = 0; i < 3000; i++) {
    const d = nextDegree(r, 5, 4, 0, 12);
    assert.ok(d >= 0 && d <= 12);
    if (d < 5) back++;
    else if (d > 5) same++;
  }
  // luật lấp khoảng trống: sau nhảy lên 4 bậc, đi xuống áp đảo
  assert.ok(back > same * 3, `back ${back} same ${same}`);
  for (let i = 0; i < 500; i++) assert.notEqual(nextDegree(r, 6, 0, 0, 12, 1), 6);
  // sát trần: không vượt
  for (let i = 0; i < 500; i++) assert.ok(nextDegree(r, 12, 1, 0, 12) <= 12);
});

test("động cơ + mọi biến tấu giữ đúng tổng phách và tầm", () => {
  const r = mulberry32(9);
  const kinds: Variation[] = ["repeat", "transpose", "invert", "retro", "augment", "ornament", "thin", "displace"];
  for (let k = 0; k < 200; k++) {
    const m = makeMotif(r, 8, 2, 11);
    const sum = (x: { beats: number }[]) => x.reduce((s, n) => s + n.beats, 0);
    assert.ok(Math.abs(sum(m) - 8) < 1e-6);
    for (const v of kinds) {
      const o = vary(r, m, v, 2, 11);
      assert.ok(Math.abs(sum(o) - 8) < 1e-6, v);
      for (const n of o) assert.ok(n.deg >= 2 && n.deg <= 11, `${v} ${n.deg}`);
    }
  }
  assert.equal(fitBeats([{ deg: 0, beats: 3, vel: 1 }], 4).length, 2);
});

test("nốt cuối câu rơi vào âm của hợp âm", () => {
  const r = mulberry32(3);
  const S = SCALES.major;
  for (let k = 0; k < 100; k++) {
    const m = makeMotif(r, 8, 0, 9);
    const ch = chordPcs({ semis: [0, 5, 7, 9][k % 4], q: "maj" });
    const c = cadence(m, S, ch);
    const last = [...c].reverse().find((n) => !n.rest)!;
    assert.ok(ch.includes(((degreeToMidi(S, 0, last.deg) % 12) + 12) % 12));
  }
});

test("kế hoạch câu: mở bằng A, có câu nghỉ / im lặng", () => {
  const r = mulberry32(5);
  let rests = 0;
  let silences = 0;
  for (let i = 0; i < 400; i++) {
    const p = planCycle(r, 0.7);
    assert.equal(p[0], "A");
    rests += p.filter((x) => x === "rest").length;
    silences += p.filter((x) => x === "silence").length;
  }
  assert.ok(rests > 150 && silences > 80, `${rests} ${silences}`);
});

test("ngày ↔ đêm Quảng trường: cùng tập nốt (Rê trưởng ngũ cung = Si thứ ngũ cung)", () => {
  const pcs = (p: (typeof ZONES)[string]) => new Set(SCALES[p.scale].map((s) => (p.root + s) % 12));
  assert.deepEqual([...pcs(ZONES.hubDay)].sort(), [...pcs(ZONES.hubNight)].sort());
  assert.equal(zoneProfile("hub", 0.2)!.id, "hubDay");
  assert.equal(zoneProfile("hub", 0.9)!.id, "hubNight");
  assert.equal(zoneProfile("siren"), null);
  assert.equal(zoneProfile("study"), null);
  assert.equal(zoneProfile("babel")!.lead, "harpsichord");
  assert.equal(zoneProfile("impossible")!.pad, "shepard");
});

test("mức đêm theo giờ thật", () => {
  assert.equal(nightFromHour(12), 0);
  assert.equal(nightFromHour(23), 1);
  assert.equal(nightFromHour(2), 1);
  assert.ok(Math.abs(nightFromHour(18.5) - 0.5) < 1e-9);
  assert.ok(Math.abs(nightFromHour(5.5) - 0.5) < 1e-9);
  assert.equal(nightFromHour(8), 0);
});

test("dãy số Thư viện Babel", () => {
  assert.deepEqual([0, 1, 2].map((i) => seqValue("pi", i, 10)), [3, 1, 4]);
  // Fibonacci mod 7: chu kỳ Pisano 16
  for (let i = 0; i < 40; i++) assert.equal(seqValue("fib", i, 7), seqValue("fib", i + 16, 7));
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => seqValue("prime", i, 7)), [2, 3, 5, 0, 4]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => seqValue("recaman", i, 100)), [0, 1, 3, 6, 2, 7]);
  assert.deepEqual([0, 1, 2].map((i) => seqValue("collatz", i, 1000)), [27, 82, 41]);
});

test("Shepard: tròn quãng tám (pc và pc+12 cùng phổ), trọng tâm ở giữa dải nghe", () => {
  const a = shepardPartials(3);
  const b = shepardPartials(15);
  assert.deepEqual(
    a.map((x) => x.hz.toFixed(3)),
    b.map((x) => x.hz.toFixed(3)),
  );
  for (let pc = 0; pc < 12; pc += 0.5) {
    const p = shepardPartials(pc);
    const w = p.reduce((s, x) => s + x.amp, 0);
    const centroid = Math.pow(2, p.reduce((s, x) => s + x.amp * Math.log2(x.hz), 0) / w);
    assert.ok(centroid > 300 && centroid < 1300, `${pc} ${centroid}`);
    assert.ok(p.length >= 3);
  }
});

test("vòng lặp lệch nhau kiểu Eno: đúng chu kỳ, sắp xếp, không chồng < 0,3 s", () => {
  const o = enoOnsets(0, 300);
  for (let i = 1; i < o.length; i++) assert.ok(o[i].t - o[i - 1].t >= 0.3);
  const s0 = o.filter((x) => x.stream === 0).map((x) => x.t);
  for (let i = 1; i < s0.length; i++) assert.ok(Math.abs(s0[i] - s0[i - 1] - 23) < 1e-9);
  // ghép cửa sổ liên tiếp = cả đoạn
  const parts = [...enoOnsets(0, 100), ...enoOnsets(100, 300)];
  assert.equal(parts.length, o.length);
});

test("bộ soạn mọi vùng: nốt thuộc thang, trong tầm, mật độ thấp, có khoảng lặng, không lặp máy móc", () => {
  for (const id of Object.keys(ZONES)) {
    const p = ZONES[id];
    const c = new Composer(p, 1234);
    let time = 0;
    let leads = 0;
    let restPh = 0;
    let silentPadOk = true;
    const seqs = new Set<string>();
    const N = 240;
    for (let i = 0; i < N; i++) {
      const ph = c.nextPhrase();
      assert.ok(ph.dur > 0);
      if (ph.kind === "rest" || ph.kind === "silence") restPh++;
      if (ph.kind === "silence" && ph.events.some((e) => e.kind === "pad" || e.kind === "shepard" || e.kind === "bass")) silentPadOk = false;
      const L = ph.events.filter((e) => e.kind === "lead");
      leads += L.length;
      if (L.length) seqs.add(L.map((e) => Math.round(hzToMidi(e.hz[0]))).join(","));
      for (const e of ph.events) {
        assert.ok(e.at >= 0 && e.at <= ph.dur + 1e-6, `${id} at ${e.at}`);
        for (const hz of e.hz) assert.ok(hz > 20 && hz < 8000, `${id} ${e.kind} ${hz}`);
      }
      for (const e of L) {
        const m = hzToMidi(e.hz[0]);
        if (p.mode === "harmonics") {
          const n = e.hz[0] / (440 * Math.pow(2, (p.root - 69) / 12));
          assert.ok(Math.abs(n - Math.round(n)) < 1e-6 && n >= p.lo && n <= p.hi, `${id} harmonic ${n}`);
        } else {
          assert.ok(inScale(SCALES[p.scale], p.root, Math.round(m)), `${id} out of scale ${m}`);
          assert.ok(Math.round(m) >= degreeToMidi(SCALES[p.scale], p.root, p.lo) && Math.round(m) <= degreeToMidi(SCALES[p.scale], p.root, p.hi + 1), `${id} range ${m}`);
        }
      }
      time += ph.dur;
    }
    const per10 = (leads / time) * 10;
    // nghiên cứu: 4–10 nốt nổi / 10 s khi khám phá — vùng tĩnh có thể thưa hơn
    assert.ok(per10 > 0.8 && per10 < 14, `${id} density ${per10.toFixed(2)}/10s`);
    assert.ok(restPh / N > 0.12, `${id} rests ${restPh}`);
    assert.ok(silentPadOk, `${id} silence has pad`);
    assert.ok(seqs.size > 25, `${id} only ${seqs.size} distinct phrases`);
  }
});

test("đổi hồ sơ giữa chừng (ngày → đêm) áp dụng từ câu kế, không lỗi", () => {
  const c = new Composer(ZONES.hubDay, 3);
  c.nextPhrase();
  c.setProfile(ZONES.hubNight);
  for (let i = 0; i < 20; i++) {
    const ph = c.nextPhrase();
    for (const e of ph.events.filter((x) => x.kind === "lead")) assert.ok(inScale(SCALES.minorPenta, 59, Math.round(hzToMidi(e.hz[0]))));
  }
});
