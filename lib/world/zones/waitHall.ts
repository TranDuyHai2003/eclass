/**
 * Khu "Phòng Chờ Đến Hôm Qua" (id wait) — sảnh nhà văn hoá lát terrazzo trôi giữa trời hoàng hôn; rèm nếp gấp làm tường,
 * hàng ghế gập, bảng số gọi lượt đã qua, máy phát số lùi xa khi người chơi tới gần.
 * Luật (BCNN): chuông gọi mỗi a phách, bảng dập mỗi b phách, cùng bắt đầu ở phách 0 → lần trùng kế tiếp ở phách BCNN(a, b).
 * Người chơi đứng lên ô phách dự đoán trên dải thời gian rồi bấm F; con trỏ chạy theo HARMONIC diễn lại để kiểm chứng.
 * Toạ độ cục bộ (gốc khu: lib/world/zoneGraph.ts). Thuần — test: tests/world/sirenZones.test.ts.
 */
import { zbox, zwall, type ZCyl, type ZoneColliders } from "./types";

export const WAIT_HALF = { x: 32.5, z: 25 };

/** Dải thời gian: 24 ô phách (0…23) chạy dọc x, mỗi ô 1,5 m */
export const TIMELINE = { n: 24, x0: -18, w: 1.5, z: -6, d: 2.4 };
export const tileX = (i: number) => TIMELINE.x0 + (i + 0.5) * TIMELINE.w;
/** ô phách dưới chân (−1 nếu không đứng trên dải) */
export function tileAt(x: number, z: number): number {
  if (Math.abs(z - TIMELINE.z) > TIMELINE.d / 2) return -1;
  const i = Math.floor((x - TIMELINE.x0) / TIMELINE.w);
  return i >= 0 && i < TIMELINE.n ? i : -1;
}

/** Mốc: bảng số (lơ lửng, có chuông trên nóc), bệ chuông (tháp ghế chồng), máy phát số (vị trí gốc — nó lùi xa khi người chơi tới gần) */
export const BOARD = { x: 0, z: -19, y0: 5.5, w: 12, h: 5.5 };
export const BELL = { x: -21.5, z: -6 };
export const MACHINE = { x: 4, z: 7, minX: -10, maxX: 16, minZ: 2, maxZ: 12, keep: 7 };

/** Hàng ghế gập (nhìn về bảng số, phía bắc) */
export const CHAIRS: [number, number][] = [];
for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) if (!(r === 1 && (c === 4 || c === 5))) CHAIRS.push([-15.5 + c * 2.2 + (r % 2) * 0.4, 13 + r * 2.6]);

/** Trụ terrazzo (mốc + bóng) */
export const PILLARS: [number, number][] = [
  [-26, -16],
  [26, -16],
  [-26, 18],
  [26, 18],
  [-10, -14],
  [10, -14],
];

export const WAIT_COLLIDERS: ZoneColliders = {
  surfs: [zbox("floor", 0, 0, 0, WAIT_HALF.x, WAIT_HALF.z, 1.2), ...Array.from({ length: TIMELINE.n }, (_, i) => zbox(`tile${i}`, tileX(i), 0.06, TIMELINE.z, TIMELINE.w / 2 - 0.04, TIMELINE.d / 2, 0.3, 0, `tile:${i}`))],
  walls: [
    // rèm bốn phía (khoét nhỏ không cần: cửa đứng trong sảnh)
    zwall("cN", 0, -WAIT_HALF.z - 0.3, WAIT_HALF.x + 0.6, 0.3, -1, 9),
    zwall("cS", 0, WAIT_HALF.z + 0.3, WAIT_HALF.x + 0.6, 0.3, -1, 9),
    zwall("cW", -WAIT_HALF.x - 0.3, 0, 0.3, WAIT_HALF.z + 0.6, -1, 9),
    zwall("cE", WAIT_HALF.x + 0.3, 0, 0.3, WAIT_HALF.z + 0.6, -1, 9),
  ],
  cyls: [
    ...PILLARS.map(([x, z], i): ZCyl => ({ id: `p${i}`, x, z, r: 1.1, y0: -1, y1: 14 })),
    ...CHAIRS.map(([x, z], i): ZCyl => ({ id: `ch${i}`, x, z, r: 0.42, y0: 0, y1: 1.4 })),
    { id: "bell", x: BELL.x, z: BELL.z, r: 0.7, y0: 0, y1: 2.6 },
  ],
};

// ───────────── Luật BCNN ─────────────
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
/** Ba vòng (chuông a, bảng b); BCNN luôn nằm trong dải 24 ô */
export const LCM_ROUNDS: readonly (readonly [number, number])[] = [
  [3, 4],
  [4, 6],
  [6, 9],
];
/** Lần trùng sớm nhất SAU phách after (cả hai cùng gõ) */
export function nextCoincidence(a: number, b: number, after = 0): number {
  const l = lcm(a, b);
  return (Math.floor(after / l) + 1) * l;
}
export const bellAt = (i: number, a: number) => i % a === 0;
export const stampAt = (i: number, b: number) => i % b === 0;

/**
 * Màn diễn kiểm chứng sau khi đặt dấu: con trỏ đi 1 ô / phách từ ô 0 (bắt đầu ở phách start), dừng ở ô cuối = max(dấu, BCNN).
 * Trả về ô đang diễn (−1 trước khi bắt đầu), đã xong chưa, và kết quả (đúng khi dấu = BCNN).
 */
export function demoAt(start: number, beat: number, a: number, b: number, mark: number): { tile: number; done: boolean; correct: boolean; last: number } {
  const last = Math.max(mark, lcm(a, b));
  const k = Math.floor(beat - start);
  return { tile: k < 0 ? -1 : Math.min(k, last), done: k > last + 1, correct: mark === lcm(a, b), last };
}

/** Máy phát số đổi ý: lùi để giữ khoảng cách keep với người chơi (trong khung cho phép) — trả về đích (x, z) */
export function machineTarget(px: number, pz: number, out: [number, number]): [number, number] {
  let x = MACHINE.x;
  let z = MACHINE.z;
  const dx = x - px;
  const dz = z - pz;
  const d = Math.hypot(dx, dz);
  if (d < MACHINE.keep) {
    const k = d > 1e-3 ? MACHINE.keep / d : 0;
    x = px + (d > 1e-3 ? dx * k : MACHINE.keep);
    z = pz + dz * k;
  }
  out[0] = Math.min(MACHINE.maxX, Math.max(MACHINE.minX, x));
  out[1] = Math.min(MACHINE.maxZ, Math.max(MACHINE.minZ, z));
  return out;
}
