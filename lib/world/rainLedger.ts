/**
 * Sổ Mưa (Rain Ledger) — boss 2 của Vùng Kỳ quan (nghiên cứu Terraria; docs/ai-reviews/voxel-world/BOSSES.md).
 * Logic THUẦN → test ở tests/world/rainLedger.test.ts.
 *
 * Bến 4 làn (mỗi làn rộng 4 m, dài 22 m). Cái trống mưa lơ lửng cuối bến, quanh nó là TÚI HẠT: mỗi làn có w hạt
 * (vd. 1, 1, 2, 4 → làn D bị rút với xác suất 4/8). Mỗi lượt trống RÚT một hạt (có hoàn lại) → mưa đổ xuống đúng làn đó.
 *
 * ĐIỀU KIỆN THẮNG = XÁC SUẤT + KỲ VỌNG. Trống được niêm (chỉ nhận ×0,12) cho tới khi Sổ đầy:
 *  • Lúc CHỐT (trước khi lộ kết quả) làn em đang đứng là "cược". Làn cược KHÔNG bị rút → Sổ cộng điểm của làn đó.
 *  • Pha 1: mọi làn 1 điểm → nên đứng ở làn có xác suất bị rút NHỎ NHẤT (P(an toàn) = 1 − p).
 *  • Pha 2: mỗi làn một mức điểm v và trống RÚT HAI LẦN có hoàn lại → P(an toàn) = (1 − p)², kỳ vọng E = v·(1 − p)².
 *    Cùng một túi, rút 1 lần thì làn rủi ro cao có E lớn nhất, rút 2 lần thì làn giữa thắng — phải tính lại mỗi lượt.
 * Sổ đầy → Xả lũ (sóng chạy dọc 2 làn, có mũi tên báo trước) → trống hạ xuống, lộ ra 7 s (×1,8).
 * Bị rút trúng làn của mình thì phải RỜI làn trước khi mưa rơi (báo trước 1,2 s) — cược hỏng nhưng không mất máu.
 */
import { createRng, type Rng } from "./rng";

export const RL = {
  LANES: 4,
  LANE_W: 4,
  /** nửa chiều dài bến: v ∈ [−HALF_LEN, HALF_LEN] */
  HALF_LEN: 11,
  /** trống: cuối bến, cao 4,5 m (hạ xuống còn 1,2 m khi lộ) */
  DRUM_V: 13,
  DRUM_Y: 4.5,
  HP: 1600,
  SHAKE_MS: 900,
  REVEAL_GAP_MS: 750,
  RAIN_LEAD_MS: 1200,
  RAIN_MS: 900,
  SPILL_TELE_MS: 1400,
  SPILL_SPEED: 7,
  SPILL_HALF: 1.3,
  EXPOSED_MS: 7000,
  DMG: { rain: 14, spill: 16 },
  MUL: { sealed: 0.12, exposed: 1.8 },
  /** điểm Sổ cần để xả lũ (pha 1 / pha 2) */
  NEED: [4, 6] as const,
  GAP_MS: [1500, 1200] as const,
} as const;

/** Túi hạt pha 1 (lượt đầu đều nhau để làm quen) và các cặp (trọng số, điểm) pha 2 */
export const BAGS1: number[][] = [
  [1, 1, 1, 1],
  [1, 1, 2, 4],
  [4, 2, 1, 1],
  [2, 4, 1, 1],
  [1, 2, 4, 1],
  [1, 4, 1, 2],
];
export const BAGS2: { w: number[]; pay: number[] }[] = [
  { w: [4, 2, 1, 1], pay: [4, 2, 1, 1] },
  { w: [1, 1, 2, 4], pay: [1, 1, 2, 4] },
  { w: [2, 3, 2, 1], pay: [2, 3, 2, 1] },
  { w: [1, 4, 2, 1], pay: [1, 4, 2, 1] },
  { w: [3, 1, 3, 1], pay: [3, 1, 3, 1] },
];

// ───────────── Xác suất ─────────────

export const sum = (a: readonly number[]) => a.reduce((s, x) => s + x, 0);
/** Xác suất làn i bị rút trong một lần */
export const laneProb = (w: readonly number[], i: number) => w[i] / sum(w);
/** Xác suất làn i KHÔNG bị rút trong k lần rút có hoàn lại = (1 − p)^k */
export const safeProb = (w: readonly number[], i: number, k: number) => Math.pow(1 - laneProb(w, i), k);
/** Kỳ vọng điểm khi cược làn i: E = v·(1 − p)^k */
export const expectedGain = (w: readonly number[], pay: readonly number[], i: number, k: number) => pay[i] * safeProb(w, i, k);
/** Làn có kỳ vọng lớn nhất (hoà → làn an toàn hơn, rồi chỉ số nhỏ) */
export function bestLane(w: readonly number[], pay: readonly number[], k: number): number {
  let best = 0;
  for (let i = 1; i < w.length; i++) {
    const a = expectedGain(w, pay, i, k);
    const b = expectedGain(w, pay, best, k);
    if (a > b + 1e-12 || (Math.abs(a - b) <= 1e-12 && w[i] < w[best])) best = i;
  }
  return best;
}
/** Rút một làn theo trọng số với r ∈ [0, 1) (phân phối rời rạc qua hàm tích luỹ) */
export function drawLane(w: readonly number[], r: number): number {
  const t = r * sum(w);
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i];
    if (t < acc) return i;
  }
  return w.length - 1;
}

// ───────────── Hình học bến ─────────────

/** Làn chứa điểm (u, v) theo toạ độ bến; −1 nếu ngoài bến */
export function laneOf(u: number, v: number): number {
  const half = (RL.LANES * RL.LANE_W) / 2;
  if (u < -half || u >= half || v < -RL.HALF_LEN || v > RL.HALF_LEN) return -1;
  return Math.floor((u + half) / RL.LANE_W);
}
/** Tâm làn i theo u */
export const laneCenter = (i: number) => -(RL.LANES * RL.LANE_W) / 2 + RL.LANE_W * (i + 0.5);
export const LANE_NAMES = ["A", "B", "C", "D"] as const;

// ───────────── Lượt rút ─────────────

export interface Draw {
  t0: number;
  /** số lần rút (1 hoặc 2) và các làn đã rút (tất định từ rng lúc tạo) */
  k: 1 | 2;
  lanes: number[];
  /** làn cược của chủ trận / người chơi một mình (−1 = không đứng trên bến lúc chốt) */
  bet: number;
  /** nhiều người: làn cược của mọi người trong trận lúc chốt (bets[0] = bet) */
  bets: number[];
  committed: boolean;
  settled: boolean;
  hit: boolean[];
  /** điểm Sổ cộng ở lượt này (để HUD báo) */
  gain: number;
}

/** Mốc thời gian của một lượt (ms tính từ t0) */
export function drawTimes(k: 1 | 2) {
  const commit = RL.SHAKE_MS;
  const reveal = (i: number) => commit + 350 + i * RL.REVEAL_GAP_MS;
  const rain = (i: number) => reveal(i) + RL.RAIN_LEAD_MS;
  const end = rain(k - 1) + RL.RAIN_MS + 300;
  return { commit, reveal, rain, end };
}

export type LedgerMode = "intro" | "fight" | "spill" | "exposed" | "dead";
export interface Ledger {
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  mode: LedgerMode;
  modeAt: number;
  bag: { w: number[]; pay: number[] };
  round: number;
  draw: Draw | null;
  points: number;
  need: number;
  /** số lần mỗi làn đã bị rút (nhật ký tần suất quan sát được) */
  counts: number[];
  /** tổng trọng số đã "kỳ vọng" theo từng lượt (để so tần suất quan sát với kỳ vọng) */
  expect: number[];
  draws: number;
  nextAt: number;
  /** Xả lũ: hai làn bị sóng quét */
  spill: [number, number];
  spillHit: boolean;
  rng: Rng;
  deadAt: number;
}

export const INTRO_MS = 2800;

export function newLedger(seed: number, now: number, players = 1): Ledger {
  const maxHp = Math.round(RL.HP * (0.6 + 0.4 * Math.max(1, players)));
  return {
    hp: maxHp,
    maxHp,
    phase: 1,
    mode: "intro",
    modeAt: now,
    bag: { w: BAGS1[0].slice(), pay: [1, 1, 1, 1] },
    round: 0,
    draw: null,
    points: 0,
    need: RL.NEED[0],
    counts: [0, 0, 0, 0],
    expect: [0, 0, 0, 0],
    draws: 0,
    nextAt: now + INTRO_MS,
    spill: [1, 2],
    spillHit: false,
    rng: createRng(seed),
    deadAt: 0,
  };
}

function nextBag(l: Ledger) {
  l.round++;
  if (l.phase === 1) {
    // lượt đầu đều nhau (BAGS1[0]); sau đó túi lệch ngẫu nhiên
    l.bag = { w: BAGS1[1 + l.rng.int(0, BAGS1.length - 2)].slice(), pay: [1, 1, 1, 1] };
  } else {
    const b = l.rng.pick(BAGS2);
    l.bag = { w: b.w.slice(), pay: b.pay.slice() };
  }
}

function startDraw(l: Ledger, now: number) {
  const k: 1 | 2 = l.phase === 2 ? 2 : 1;
  const lanes: number[] = [];
  for (let i = 0; i < k; i++) lanes.push(drawLane(l.bag.w, l.rng.next()));
  l.draw = { t0: now, k, lanes, bet: -1, bets: [], committed: false, settled: false, hit: lanes.map(() => false), gain: 0 };
}

/**
 * Một bước. (pu, pv) = người chơi theo toạ độ bến. Trả sự kiện: "commit", "reveal", "tally" (cược thắng), "bust" (cược bị rút),
 * "spill", "exposed", "phase2", "dead" hoặc null.
 */
export function tickLedger(l: Ledger, now: number, pu: number, pv: number, others?: ArrayLike<number>): string | null {
  if (l.mode === "dead") return null;
  if (l.hp <= 0) {
    l.mode = "dead";
    l.deadAt = now;
    l.draw = null;
    return "dead";
  }
  if (l.mode === "intro") {
    if (now >= l.nextAt) {
      l.mode = "fight";
      l.modeAt = now;
      l.nextAt = now + 600;
    }
    return null;
  }
  if (l.mode === "exposed") {
    if (now - l.modeAt >= RL.EXPOSED_MS) {
      l.mode = "fight";
      l.modeAt = now;
      l.points = 0;
      l.nextAt = now + 1200;
      if (l.phase === 1 && l.hp <= l.maxHp / 2) {
        l.phase = 2;
        l.need = RL.NEED[1];
        nextBag(l);
        return "phase2";
      }
      nextBag(l);
    }
    return null;
  }
  if (l.mode === "spill") {
    if (now - l.modeAt >= spillDuration()) {
      l.mode = "exposed";
      l.modeAt = now;
      return "exposed";
    }
    return null;
  }
  // chiến đấu
  const d = l.draw;
  if (d) {
    const T = drawTimes(d.k);
    const t = now - d.t0;
    if (!d.committed && t >= T.commit) {
      d.committed = true;
      d.bet = laneOf(pu, pv);
      d.bets = [d.bet];
      if (others) for (let k = 0; k + 1 < others.length; k += 2) d.bets.push(laneOf(others[k], others[k + 1]));
      return "commit";
    }
    if (!d.settled && t >= T.reveal(d.k - 1)) {
      d.settled = true;
      for (const ln of d.lanes) {
        l.counts[ln]++;
        l.draws++;
      }
      for (let i = 0; i < 4; i++) l.expect[i] += d.k * laneProb(l.bag.w, i);
      // nhiều người: Sổ cộng TRUNG BÌNH điểm của những người đã cược (một người = đúng điểm làn của mình)
      l.points += ledgerGain(d.bets, d.lanes, l.bag.pay);
      if (d.bet >= 0 && !d.lanes.includes(d.bet)) {
        d.gain = l.bag.pay[d.bet];
        return "tally";
      }
      return d.bet >= 0 ? "bust" : null;
    }
    if (t >= T.end) {
      l.draw = null;
      if (l.points >= l.need) {
        l.mode = "spill";
        l.modeAt = now;
        const pair = l.rng.int(0, 2);
        l.spill = [pair, pair + 1];
        l.spillHit = false;
        return "spill";
      }
      nextBag(l);
      l.nextAt = now + RL.GAP_MS[l.phase - 1];
    }
    return null;
  }
  if (now >= l.nextAt) {
    startDraw(l, now);
    return "shake";
  }
  return null;
}

/** Điểm Sổ của một lượt: trung bình điểm các cược an toàn trên số người có cược (người ngoài bến không tính) */
export function ledgerGain(bets: readonly number[], drawn: readonly number[], pay: readonly number[]): number {
  let n = 0;
  let g = 0;
  for (const b of bets) {
    if (b < 0) continue;
    n++;
    if (!drawn.includes(b)) g += pay[b];
  }
  return n ? g / n : 0;
}

export const spillDuration = () => RL.SPILL_TELE_MS + ((2 * RL.HALF_LEN + 2) / RL.SPILL_SPEED) * 1000;
/** Vị trí đầu sóng xả lũ (v) theo thời gian; null khi còn báo trước */
export function spillFront(l: Ledger, now: number): number | null {
  const t = now - l.modeAt - RL.SPILL_TELE_MS;
  if (l.mode !== "spill" || t < 0) return null;
  return RL.HALF_LEN + 1 - (t / 1000) * RL.SPILL_SPEED;
}

/** Sát thương lên người chơi lúc này (mưa ở làn bị rút; sóng xả lũ) — mỗi mưa / sóng trúng tối đa một lần */
export function ledgerHurt(l: Ledger, now: number, pu: number, pv: number): number {
  const lane = laneOf(pu, pv);
  if (l.mode === "spill") {
    const f = spillFront(l, now);
    if (f === null || l.spillHit || lane < 0) return 0;
    if ((lane === l.spill[0] || lane === l.spill[1]) && Math.abs(pv - f) <= RL.SPILL_HALF) {
      l.spillHit = true;
      return RL.DMG.spill;
    }
    return 0;
  }
  const d = l.draw;
  if (!d || lane < 0) return 0;
  const T = drawTimes(d.k);
  const t = now - d.t0;
  for (let i = 0; i < d.k; i++) {
    if (d.hit[i] || d.lanes[i] !== lane) continue;
    if (t >= T.rain(i) && t < T.rain(i) + RL.RAIN_MS) {
      d.hit[i] = true;
      return RL.DMG.rain;
    }
  }
  return 0;
}

export function ledgerMul(l: Ledger): number {
  if (l.mode === "dead" || l.mode === "intro") return 0;
  return l.mode === "exposed" ? RL.MUL.exposed : RL.MUL.sealed;
}

export function hitLedger(l: Ledger, raw: number): number {
  const m = ledgerMul(l);
  if (m <= 0 || l.hp <= 0) return 0;
  const before = l.hp;
  l.hp = Math.max(0, l.hp - Math.round(raw * m));
  return before - l.hp;
}

/** Trạng thái làn để vẽ: 0 bình thường · 1 vừa lộ (báo trước) · 2 đang mưa */
export function laneState(l: Ledger, now: number, lane: number): 0 | 1 | 2 {
  const d = l.draw;
  if (!d) return 0;
  const T = drawTimes(d.k);
  const t = now - d.t0;
  let s: 0 | 1 | 2 = 0;
  for (let i = 0; i < d.k; i++) {
    if (d.lanes[i] !== lane || t < T.reveal(i)) continue;
    if (t >= T.rain(i) && t < T.rain(i) + RL.RAIN_MS) return 2;
    if (t < T.rain(i)) s = 1;
  }
  return s;
}
