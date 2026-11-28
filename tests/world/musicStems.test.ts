import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { CellPlanner, ClockAnchor, barSec, glitchChance, layerMix, loopSec, lowpassFor, selectTrack, stingerRate } from "@/lib/world/musicStems";
import { STINGERS, TRACKS } from "@/lib/world/musicTracks";
import { StrideCounter, surfaceFor } from "@/lib/world/foleyLogic";
import { mulberry32 } from "@/lib/world/music";

test("selectTrack: cảnh → bản, boss ưu tiên (trừ siren / study), cảnh khác → null", () => {
  const day = { night: 0, boss: false };
  assert.equal(selectTrack("hub", day), "hubDay");
  assert.equal(selectTrack("hub", { night: 1, boss: false }), "hubNight");
  assert.equal(selectTrack("expanse", { night: 0.8, boss: false }), "expNight");
  assert.equal(selectTrack("impossible", day), "impossible");
  assert.equal(selectTrack("siren", { night: 0, boss: true }), "siren");
  assert.equal(selectTrack("study", { night: 0, boss: true }), "study");
  assert.equal(selectTrack("archive", day), "archive");
  assert.equal(selectTrack("expanse", { night: 0, boss: true }), "boss");
  assert.equal(selectTrack("valley", day), null);
  assert.equal(selectTrack("babel", day), null);
});

test("selectTrack: trễ ngưỡng ngày / đêm (không nhảy qua lại quanh 0,5)", () => {
  assert.equal(selectTrack("hub", { night: 0.55, boss: false }, "hubDay"), "hubDay");
  assert.equal(selectTrack("hub", { night: 0.65, boss: false }, "hubDay"), "hubNight");
  assert.equal(selectTrack("hub", { night: 0.45, boss: false }, "hubNight"), "hubNight");
  assert.equal(selectTrack("hub", { night: 0.35, boss: false }, "hubNight"), "hubDay");
});

test("stingerRate: dịch về chủ âm gần nhất trong −6…+5 nửa cung", () => {
  assert.equal(stingerRate(62, 62), 1);
  assert.ok(Math.abs(stingerRate(62, 74) - 1) < 1e-9); // cùng lớp cao độ
  assert.ok(Math.abs(stingerRate(62, 64) - Math.pow(2, 2 / 12)) < 1e-9);
  assert.ok(Math.abs(stingerRate(62, 60) - Math.pow(2, -2 / 12)) < 1e-9);
  for (let k = 40; k < 90; k++) {
    const r = stingerRate(62, k);
    assert.ok(r >= Math.pow(2, -6 / 12) - 1e-9 && r <= Math.pow(2, 5 / 12) + 1e-9);
  }
});

test("CellPlanner: chỉ biến thể đúng khe, không lặp liền, không nghỉ hai lần liền", () => {
  for (const t of Object.values(TRACKS)) {
    const p = new CellPlanner(t, mulberry32(7));
    const slots = Math.floor(t.bars / t.slotBars);
    const last: (string | null)[] = [];
    let rests = 0;
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const s = i % slots;
      const f = p.next(s);
      if (f === null) {
        assert.notEqual(last[s], null, "nghỉ hai lần liền");
        rests++;
      } else {
        assert.equal(t.cells.find((c) => c.f === f)?.slot, s);
        if (t.cells.filter((c) => c.slot === s).length > 1) assert.notEqual(f, last[s], "lặp liền biến thể");
      }
      last[s] = f;
      n++;
    }
    assert.ok(rests > 0 && rests < n * 0.5, `${t.id}: tỉ lệ nghỉ ${rests}/${n}`);
  }
});

test("manifest: file tồn tại (ogg + m4a), hợp âm đủ ô, độ dài ≥ vòng", () => {
  for (const t of Object.values(TRACKS)) {
    assert.ok(t.bed, t.id);
    assert.equal(t.chords.length, t.bars, t.id);
    assert.ok(t.bed!.dur >= loopSec(t) - 1e-3, `${t.id}: bed ngắn hơn vòng`);
    for (const c of t.cells) assert.ok(c.dur >= barSec(t) * t.slotBars - 1e-3, `${c.f} ngắn hơn khe`);
    for (const r of [t.bed!, ...t.cells, ...t.layers, ...t.glitch])
      for (const e of [".ogg", ".m4a"]) assert.ok(existsSync(`public/world/audio/${r.f}${e}`), r.f + e);
  }
  assert.equal(TRACKS.siren.bpm, 96, "Mê cung phải khớp HARMONIC_BPM");
  for (const k of ["amen", "victory", "defeat", "bossReveal", "portal"]) assert.ok(STINGERS.cues[k], k);
});

test("ClockAnchor: EMA bám, nhảy khi lệch lớn", () => {
  const a = new ClockAnchor();
  assert.equal(a.update(10), 10);
  a.update(10.02);
  assert.ok(a.offset > 10 && a.offset < 10.02);
  assert.equal(a.update(12), 12);
});

test("layerMix / glitchChance / lowpassFor", () => {
  const m0 = layerMix(0);
  const m1 = layerMix(1);
  assert.equal(m0.clean, 1);
  assert.ok(m0.dis < 1e-9 && m1.clean < 1e-9);
  const mh = layerMix(0.5);
  assert.ok(Math.abs(mh.clean ** 2 + mh.dis ** 2 - 1) < 1e-9);
  assert.equal(glitchChance(0.2), 0);
  assert.ok(glitchChance(1) > glitchChance(0.5));
  assert.ok(Math.abs(lowpassFor(0) - 16000) < 1e-6 && Math.abs(lowpassFor(1) - 900) < 1e-6);
});

test("foley: mặt đất + bộ đếm sải", () => {
  assert.equal(surfaceFor("expanse", "plank"), "wood");
  assert.equal(surfaceFor("siren"), "paper");
  assert.equal(surfaceFor("impossible"), "stone");
  const s = new StrideCounter();
  let steps = 0;
  for (let i = 0; i < 40; i++) if (s.step(0.15, 0, 0.05, true)) steps++; // 3 m/s trong 2 s = 6 m → 8 sải 0,75 m
  assert.equal(steps, 8);
  assert.equal(s.step(5, 0, 0.05, true), false); // dịch chuyển tức thời
  assert.equal(s.step(0.15, 0, 0.05, false), false); // trên không
});
