/**
 * Fourier Siren — co-op boss logic (pure, deterministic; wall-clock ms).
 * Used locally when playing solo; realtime/boss.mjs mirrors it as the authority in multiplayer (keep in sync).
 *
 * Every attack teaches a wave idea and is telegraphed ≥ 700 ms:
 *  - standing   Standing wave: concentric antinode bands hurt; nodes at r = n·λ/2 are safe.
 *  - beat       Beat pulses: three rings at a fixed beat — jump or dash through them on time.
 *  - lissajous  Two comets on Lissajous curves x = A·sin(a·t + δ), z = A·sin(b·t); the path is shown first.
 *  - twin       (phase 2) Twin nodes: the Siren is shielded until BOTH nodes break within 1 s of each other.
 * Coherence (break bar): hits drain it, twice as fast while the halo is lit (in phase).
 * At 0 the Siren is broken for 6 s and takes ×1.5 damage.
 */
export type BossAtk = "standing" | "beat" | "lissajous" | "twin";
export const ATK: Record<BossAtk, { tele: number; dur: number }> = {
  standing: { tele: 1400, dur: 500 },
  beat: { tele: 800, dur: 2000 },
  lissajous: { tele: 1000, dur: 4400 },
  twin: { tele: 900, dur: 12000 },
};
export const BOSS_DMG = { standing: 20, beat: 12, lissajous: 15 };
export const LAMBDA = 3.2;
export const ARENA_R = 15;
const SEQ1: BossAtk[] = ["standing", "beat", "lissajous", "beat", "standing", "lissajous"];
const SEQ2: BossAtk[] = ["twin", "standing", "beat", "lissajous", "beat", "standing", "lissajous"];

export interface BossSim {
  hp: number;
  maxHp: number;
  coh: number;
  cohMax: number;
  brokenUntil: number;
  phase: 1 | 2;
  atk: BossAtk | null;
  atkAt: number;
  n: number;
  nextAt: number;
  /** Máu 2 nút giao thoa (pha 2); 0 = đã vỡ / không có */
  nodes: [number, number];
  nodeBrokeAt: [number, number];
  shield: boolean;
  deadAt: number;
}

export function newBoss(players: number, now: number): BossSim {
  const maxHp = Math.round(2400 * (0.6 + 0.4 * Math.max(1, players)));
  return { hp: maxHp, maxHp, coh: 300, cohMax: 300, brokenUntil: 0, phase: 1, atk: null, atkAt: 0, n: 0, nextAt: now + 2500, nodes: [0, 0], nodeBrokeAt: [0, 0], shield: false, deadAt: 0 };
}

/** Vầng sáng bừng lên theo chu kỳ 4 s — đánh lúc này rút Coherence gấp đôi */
export function inPhase(now: number): boolean {
  return Math.sin(((now / 1000) * 2 * Math.PI) / 4) > 0.3;
}

export function tickBoss(b: BossSim, now: number) {
  if (b.deadAt) return;
  if (b.phase === 1 && b.hp < b.maxHp / 2) {
    b.phase = 2;
    b.n = 0;
  }
  if (b.atk) {
    const a = ATK[b.atk];
    if (b.atk === "twin") {
      // Một nút vỡ mà nút kia không vỡ trong 1 s → nút đã vỡ hồi lại (phải phối hợp)
      for (const i of [0, 1] as const) {
        const j = i === 0 ? 1 : 0;
        if (b.nodes[i] <= 0 && b.nodes[j] > 0 && b.nodeBrokeAt[i] && now - b.nodeBrokeAt[i] > 1000) {
          b.nodes[i] = nodeHp(b);
          b.nodeBrokeAt[i] = 0;
        }
      }
      if (b.nodes[0] <= 0 && b.nodes[1] <= 0) {
        b.shield = false;
        b.atk = null;
        b.nextAt = now + 1500;
        b.brokenUntil = now + 4000; // phá khiên → choáng ngắn
        return;
      }
    }
    if (now - b.atkAt > a.tele + a.dur) {
      if (b.atk === "twin") {
        // Hết giờ mà chưa phá được: khiên tan nhưng Siren hồi 8% máu
        b.shield = false;
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.08);
        b.nodes = [0, 0];
      }
      b.atk = null;
      b.nextAt = now + 1600;
    }
    return;
  }
  if (now < b.nextAt || now < b.brokenUntil) return;
  const seq = b.phase === 1 ? SEQ1 : SEQ2;
  b.atk = seq[b.n % seq.length];
  b.n++;
  b.atkAt = now;
  if (b.atk === "twin") {
    b.shield = true;
    b.nodes = [nodeHp(b), nodeHp(b)];
    b.nodeBrokeAt = [0, 0];
  }
}

function nodeHp(b: BossSim) {
  return Math.round(b.maxHp * 0.05);
}

/** Trả về sát thương thực nhận và có làm vỡ thế (break) không */
export function hitBoss(b: BossSim, dmg: number, now: number): { dealt: number; broke: boolean } {
  if (b.deadAt || b.shield) return { dealt: 0, broke: false };
  const broken = now < b.brokenUntil;
  const dealt = Math.round(dmg * (broken ? 1.5 : 1));
  b.hp = Math.max(0, b.hp - dealt);
  let broke = false;
  if (!broken) {
    b.coh -= dmg * (inPhase(now) ? 2 : 1);
    if (b.coh <= 0) {
      b.coh = b.cohMax;
      b.brokenUntil = now + 6000;
      if (b.atk !== "twin") b.atk = null;
      b.nextAt = b.brokenUntil + 800;
      broke = true;
    }
  }
  if (b.hp <= 0) b.deadAt = now;
  return { dealt, broke };
}

export function hitNode(b: BossSim, i: 0 | 1, dmg: number, now: number): number {
  if (b.atk !== "twin" || b.nodes[i] <= 0) return 0;
  b.nodes[i] = Math.max(0, b.nodes[i] - dmg);
  if (b.nodes[i] === 0) b.nodeBrokeAt[i] = now;
  return dmg;
}

// ───────────── Hình học đòn đánh (tâm đấu trường = vị trí boss) ─────────────

/** Sóng dừng: dải bụng sóng gây sát thương, nút sóng (|sin| nhỏ) an toàn */
export function standingDanger(r: number): boolean {
  if (r < 2 || r > ARENA_R - 0.5) return false;
  return Math.abs(Math.sin((2 * Math.PI * r) / LAMBDA)) > 0.5;
}

/** Bán kính vòng nhịp thứ i (null nếu chưa phát / đã tắt) */
export function beatRadius(sinceTele: number, i: number): number | null {
  const t = sinceTele - i * 650;
  if (t < 0 || t > 700) return null;
  return 1.5 + (t / 700) * 13;
}

/** Sao chổi Lissajous k ∈ {0,1}: tỉ số tần số 3:2 và 2:3 */
export function lissajous(k: 0 | 1, sinceTele: number): { x: number; z: number } {
  const tau = (sinceTele / 1000) * 0.85;
  const [a, b, d] = k === 0 ? [3, 2, Math.PI / 2] : [2, 3, Math.PI / 4];
  return { x: 10 * Math.sin(a * tau + d), z: 10 * Math.sin(b * tau) };
}

export const NODE_POS: [number, number][] = [
  [-9, 0],
  [9, 0],
];

/** Gói trạng thái gửi qua mạng (mảng gọn) */
export function packBoss(b: BossSim): number[] {
  return [b.hp, b.maxHp, Math.round(b.coh), b.cohMax, b.brokenUntil, b.phase, ["standing", "beat", "lissajous", "twin"].indexOf(b.atk ?? "") , b.atkAt, b.nodes[0], b.nodes[1], b.shield ? 1 : 0, b.deadAt];
}
export function unpackBoss(a: number[], into: BossSim) {
  const atks: BossAtk[] = ["standing", "beat", "lissajous", "twin"];
  into.hp = a[0];
  into.maxHp = a[1];
  into.coh = a[2];
  into.cohMax = a[3];
  into.brokenUntil = a[4];
  into.phase = a[5] === 2 ? 2 : 1;
  into.atk = a[6] >= 0 ? atks[a[6]] : null;
  into.atkAt = a[7];
  into.nodes = [a[8], a[9]];
  into.shield = a[10] === 1;
  into.deadAt = a[11];
}
