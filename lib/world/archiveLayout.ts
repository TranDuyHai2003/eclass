/**
 * Thư khố bỏ hoang — bố cục ô tất định (thuần, không phụ thuộc three.js; dùng được cả trong test).
 *
 * Lưới ô 4 × 4 m (tâm ô (i, j) ở x = 4i, z = 4j). Mỗi ô MỞ (đi được) hoặc ĐẶC (khối không vẽ). Tường / cửa hầm chỉ đặt
 * trên cạnh giữa ô mở và ô đặc, mặt quay về ô mở (lightmap mô-đun chỉ nướng một phía). Bảo đảm liên thông:
 *  • ô "hành lang" (i ≡ 0 hoặc j ≡ 0 mod 3) LUÔN mở → mạng hành lang dạng lưới, liên thông;
 *  • ô "phòng" (còn lại) mở / đặc theo băm; mọi ô phòng đều kề một ô hành lang theo trục x → kệ sách trong phòng
 *    luôn đặt lối đi dọc trục x (đi vào được từ hành lang).
 * Sảnh vào (hành lang cửa sổ vòm, 6,5 × 22 m) chiếm các ô i ∈ [−1, 1], j ∈ [−6, −1]; cửa sảnh mở vào ô (0, 0).
 * "Bất khả": ô phòng đổi dạng khi người chơi không nhìn (epoch mỗi ô do cảnh giữ; xem shouldMutate).
 */

export const CELL = 4;
export const HALF = CELL / 2;
export const CEIL = 3.2;
/** nửa bề dày tường mô-đun (tường dày 0,25 m, tâm trên cạnh ô) */
export const WALL_T = 0.125;
/** cửa hầm: lồi vào ô mở 0,4 m (khung bê tông dày 0,6 m: −2,2…−1,6 tính từ tâm ô) */
export const DOOR_IN = 0.4;
export const DOOR_OUT = 0.2;
/** cột bê tông 0,44 m ở góc ô */
export const PILLAR_R = 0.22;
/** kệ thép: hai dãy ở ±[0,95; 1,45] vuông góc lối đi, dài ±1,67 dọc lối đi */
export const SHELF = { in: 0.95, out: 1.45, len: 1.67, h: 2.14 };

/** Sảnh vào: toạ độ thế giới (đã dời so với GLB: z_gltf + HALL.dz) */
export const HALL = {
  dz: -2.125,
  /** mặt trong tường dọc */
  innerX: 3.0,
  outerX: 3.25,
  /** tường đầu sảnh (phía lưới ô): z ∈ [front0, front1], cửa |x| < door, cao doorH */
  front0: -2.1,
  front1: -1.9,
  door: 2.0,
  doorH: CEIL,
  /** mặt trong tường cuối (cửa sổ vòm) */
  end: -24.125,
  /** trần sảnh */
  ceil: 5.0,
  /** ô của sảnh */
  i0: -1,
  i1: 1,
  j0: -6,
  j1: -1,
} as const;

/** chỗ xuất hiện: đầu sảnh, nhìn về cửa sổ trăng */
export const SPAWN = { x: 0, z: -5.2 };
/** điểm quay về (dưới ô cửa sổ trăng cuối sảnh) */
export const EXIT = { x: 0, z: -22.6, r: 2.4 };

// Bit của ô
export const OPEN = 1;
export const HALLCELL = 2;
export const DARK = 4;
export const SHELFC = 8;
export const FLICKER = 16;
/** biến thể của ô kệ: hai dãy tủ hồ sơ thép (cùng chỗ chiếm / va chạm như kệ) */
export const CABINET = 32;
/** phòng đọc: bàn + ghế + đèn bàn ở giữa ô phòng (chủ yếu ô đèn hỏng → vũng sáng ấm giữa bóng tối) */
export const DESK = 64;
/** nửa cạnh khối va chạm của bàn đọc (vuông, không phụ thuộc hướng xoay) */
export const DESK_R = 0.95;

/** epoch "bất khả" của từng ô phòng (0 = gốc) */
export type EpochFn = (i: number, j: number) => number;
const NO_EPOCH: EpochFn = () => 0;

const mod3 = (n: number) => ((n % 3) + 3) % 3;
export const isCorridor = (i: number, j: number) => mod3(i) === 0 || mod3(j) === 0;
export const inHallCells = (i: number, j: number) => i >= HALL.i0 && i <= HALL.i1 && j >= HALL.j0 && j <= HALL.j1;

/** băm số nguyên → [0, 1) (murmur3 fmix) */
export function hash3(i: number, j: number, k: number): number {
  let x = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul((k | 0) + 0x5bd1e995, 0x9e3779b1);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** độ sâu (số ô tính từ cửa sảnh) */
export const depthOf = (i: number, j: number) => Math.hypot(i, j);

/** Bit của ô (i, j): OPEN / HALLCELL / DARK / SHELFC / FLICKER */
export function cellBits(i: number, j: number, ep: EpochFn = NO_EPOCH): number {
  if (inHallCells(i, j)) return HALLCELL;
  const corr = isCorridor(i, j);
  const e = corr ? 0 : ep(i, j);
  // ô phòng: 42 % đặc
  if (!corr && hash3(i, j, 11 + e * 7) < 0.42) return 0;
  let b = OPEN;
  const d = depthOf(i, j);
  // càng sâu càng nhiều đèn hỏng (tối dần): ~14 % gần cửa → tối đa 62 % — vũng sáng huỳnh quang ngăn bởi bóng tối
  if (hash3(i, j, 23 + e * 5) < Math.min(0.62, 0.1 + d * 0.02) && !(i === 0 && j === 0)) b |= DARK;
  else if (hash3(i, j, 31) < 0.1) b |= FLICKER;
  // kệ sách: chỉ trong phòng, lối đi dọc trục x; ~30 % thành dãy tủ hồ sơ
  if (!corr && hash3(i, j, 47 + e * 3) < 0.5) {
    b |= SHELFC;
    if (hash3(i, j, 53 + e * 3) < 0.3) b |= CABINET;
  } else if (!corr && hash3(i, j, 61 + e * 3) < (b & DARK ? 0.6 : 0.12)) b |= DESK;
  return b;
}
export const isOpen = (i: number, j: number, ep: EpochFn = NO_EPOCH) => (cellBits(i, j, ep) & OPEN) !== 0;

/** hướng cạnh: 0 = −z (bắc), 1 = +x (đông), 2 = +z (nam), 3 = −x (tây) */
export const DIR_X = [0, 1, 0, -1] as const;
export const DIR_Z = [-1, 0, 1, 0] as const;
/** góc xoay quanh trục y để trục −z cục bộ của mô-đun (tường ở cạnh −z) quay về hướng d */
export const DIR_ROT = [0, -Math.PI / 2, Math.PI, Math.PI / 2] as const;

/** Cạnh d của ô mở (i, j): 0 = không có gì, 1 = tường, 2 = cửa hầm SCP. Ô đặc / sảnh → 0. */
export function edgeKind(i: number, j: number, d: number, ep: EpochFn = NO_EPOCH): 0 | 1 | 2 {
  if (!isOpen(i, j, ep)) return 0;
  const ni = i + DIR_X[d];
  const nj = j + DIR_Z[d];
  const nb = cellBits(ni, nj, ep);
  if (nb & OPEN) return 0;
  if (nb & HALLCELL) return i === 0 && j === 0 && d === 0 ? 0 : 1; // cửa sảnh
  // cửa hầm: hiếm, ổn định theo cạnh (không đổi theo epoch của phòng → khỏi nhảy cửa)
  return hash3(i * 2 + DIR_X[d], j * 2 + DIR_Z[d], 59) < 0.1 ? 2 : 1;
}

/**
 * Cột ở góc (ci, cj) = điểm (4ci − 2, 4cj − 2), chung cho 4 ô (ci−1..ci, cj−1..cj).
 * Cột ở góc lồi của tường (đúng 1 ô đặc, hoặc 2 ô đặc chéo nhau — che khe hở giữa hai tấm tường) và rải rác trong sảnh rộng.
 */
export function pillarAt(ci: number, cj: number, ep: EpochFn = NO_EPOCH): boolean {
  const a = isOpen(ci - 1, cj - 1, ep);
  const b = isOpen(ci, cj - 1, ep);
  const c = isOpen(ci - 1, cj, ep);
  const d = isOpen(ci, cj, ep);
  const n = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) + (d ? 1 : 0);
  if (n === 3) return true;
  if (n === 2 && a === d) return true; // chéo
  if (n === 4) return !isCorridor(ci, cj) || hash3(ci, cj, 71) < 0.12 ? hash3(ci, cj, 73) < 0.5 : false;
  return false;
}

const inBox = (x: number, z: number, x0: number, x1: number, z0: number, z1: number, r: number) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r;

/** trong vùng sảnh? (các ô sảnh, phía sau mặt trong tường đầu sảnh) */
export const inHall = (x: number, z: number) => z < HALL.front0 + 0.05 && z > (HALL.j0 - 0.5) * CELL && Math.abs(x) < (HALL.i1 + 0.5) * CELL;

/**
 * Va chạm: true nếu vòng tròn bán kính r tại (x, z) chạm tường / cửa / cột / kệ / khối đặc.
 * Không cấp phát (gọi nhiều lần mỗi khung: người chơi + máy quay).
 */
export function archiveBlocked(x: number, z: number, r: number, ep: EpochFn = NO_EPOCH): boolean {
  if (inHall(x, z)) {
    if (Math.abs(x) > HALL.innerX - r) return true;
    if (z < HALL.end + r) return true;
    if (z > HALL.front0 - r && Math.abs(x) > HALL.door - r) return true;
    return false;
  }
  const ci = Math.round(x / CELL);
  const cj = Math.round(z / CELL);
  const own = cellBits(ci, cj, ep);
  if (!(own & OPEN)) {
    // ô đặc: chặn (trừ mép cửa sảnh — điểm thuộc ô sảnh nhưng ngoài vùng sảnh)
    if (own & HALLCELL) return Math.abs(x) > HALL.door - r || z < HALL.front0;
    return true;
  }
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const i = ci + di;
      const j = cj + dj;
      const b = di === 0 && dj === 0 ? own : cellBits(i, j, ep);
      if (!(b & OPEN)) continue;
      const cx = i * CELL;
      const cz = j * CELL;
      // kệ (lối đi dọc x → hai dãy song song trục x ở z = ±[in, out])
      if (b & SHELFC) {
        if (inBox(x, z, cx - SHELF.len, cx + SHELF.len, cz - SHELF.out, cz - SHELF.in, r)) return true;
        if (inBox(x, z, cx - SHELF.len, cx + SHELF.len, cz + SHELF.in, cz + SHELF.out, r)) return true;
      }
      if (b & DESK && inBox(x, z, cx - DESK_R, cx + DESK_R, cz - DESK_R, cz + DESK_R, r)) return true;
      // tường / cửa trên 4 cạnh của ô mở này
      for (let d = 0; d < 4; d++) {
        const k = edgeKind(i, j, d, ep);
        if (!k) continue;
        const inn = k === 2 ? DOOR_IN : WALL_T;
        const out = k === 2 ? DOOR_OUT : WALL_T;
        if (d === 0 && inBox(x, z, cx - HALF, cx + HALF, cz - HALF - out, cz - HALF + inn, r)) return true;
        if (d === 2 && inBox(x, z, cx - HALF, cx + HALF, cz + HALF - inn, cz + HALF + out, r)) return true;
        if (d === 1 && inBox(x, z, cx + HALF - inn, cx + HALF + out, cz - HALF, cz + HALF, r)) return true;
        if (d === 3 && inBox(x, z, cx - HALF - out, cx - HALF + inn, cz - HALF, cz + HALF, r)) return true;
      }
    }
  // cột ở 4 góc của ô đang đứng
  for (let a = 0; a <= 1; a++)
    for (let b = 0; b <= 1; b++) {
      const gi = ci + a;
      const gj = cj + b;
      const px = gi * CELL - HALF;
      const pz = gj * CELL - HALF;
      if (Math.abs(x - px) < PILLAR_R + r && Math.abs(z - pz) < PILLAR_R + r && pillarAt(gi, gj, ep)) return true;
    }
  return false;
}

/** Trần tại (x, z): sảnh cao 5 m, lưới ô 3,2 m */
export const ceilingAt = (x: number, z: number) => (inHall(x, z) ? HALL.ceil : CEIL);

/**
 * Máy quay góc ba: lùi từ đích (đầu nhân vật) về vị trí mong muốn, dừng trước vật cản đầu tiên; kẹp dưới trần.
 * Trả hệ số t ∈ [0, 1] của đoạn đích → máy quay (1 = không bị chặn).
 */
export function cameraReach(tx: number, tz: number, cx: number, cz: number, ep: EpochFn = NO_EPOCH, r = 0.18): number {
  const len = Math.hypot(cx - tx, cz - tz);
  if (len < 1e-4) return 1;
  const steps = Math.min(40, Math.ceil(len / 0.12));
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (archiveBlocked(tx + (cx - tx) * t, tz + (cz - tz) * t, r, ep)) return Math.max(0, (s - 1) / steps);
  }
  return 1;
}

/**
 * "Phòng phía sau đổi khi không nhìn": ô PHÒNG (không phải hành lang / sảnh) ở xa ≥ 2 ô, nằm hẳn sau lưng máy quay
 * (cos góc với hướng nhìn < −0,25) và trúng thăm băm của lượt này. (fx, fz) = hướng nhìn trên mặt đất (đã chuẩn hoá).
 */
export function shouldMutate(i: number, j: number, px: number, pz: number, fx: number, fz: number, tick: number): boolean {
  if (isCorridor(i, j) || inHallCells(i, j)) return false;
  const dx = i * CELL - px;
  const dz = j * CELL - pz;
  const d = Math.hypot(dx, dz);
  if (d < CELL * 2) return false;
  if ((dx * fx + dz * fz) / d > -0.25) return false;
  return hash3(i, j, 97 + tick) < 0.3;
}

/** Ô (i, j) chứa điểm (x, z) */
export const cellOf = (v: number) => Math.round(v / CELL);

/** Cửa hầm thép dẫn vào Thư khố, đứng ở mép đông sân Thế giới Bất Khả (mặt cửa quay về −x, rộng 4 m) */
export const GATE = { x: 18.2, z: -1.5, halfW: 2.0, halfT: 0.3 };
/** đứng trước cửa (phía −x) */
export const GATE_FRONT = { x: GATE.x - 1.6, z: GATE.z, r: 2.0 };
export const gateBlocked = (x: number, z: number, r: number) => Math.abs(x - GATE.x) < GATE.halfT + r && Math.abs(z - GATE.z) < GATE.halfW + r;

// ───────────── ánh sáng nướng theo ô (hệ số nhân lightmap từng instance) ─────────────
/**
 * Lightmap mỗi mô-đun nướng MỘT lần trong ngữ cảnh 3 × 3 ô sáng (đèn huỳnh quang ở mọi ô). Khi ghép, ô "đèn hỏng" và tường /
 * kệ / cửa của nó phải tối thật → mỗi instance nhân lightmap với một hệ số theo đèn còn sáng quanh nó:
 *  • ô sáng: 1;
 *  • ô tối (lưới mod_cell_dark đã nướng với 8 ô sáng xung quanh): × spill² (spill = tỉ lệ ô sáng trong 8 ô kề) — tối hẳn khi cả cụm hỏng;
 *  • tường / cửa / kệ trong ô tối (lightmap nướng với đèn của chính ô): chỉ còn ánh sáng tràn ≈ DARK_LEAK × spill.
 */
export const DARK_LEAK = 0.06;
/** ô mở còn đèn sáng (không tính sảnh) */
export function lampOn(i: number, j: number, ep: EpochFn = NO_EPOCH): boolean {
  const b = cellBits(i, j, ep);
  return (b & OPEN) !== 0 && (b & DARK) === 0;
}
/** tỉ lệ ô có đèn sáng trong 8 ô kề (sảnh tính nửa — đèn tường + trăng) */
export function spillAt(i: number, j: number, ep: EpochFn = NO_EPOCH): number {
  let s = 0;
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const b = cellBits(i + di, j + dj, ep);
      s += b & HALLCELL ? 0.5 : (b & OPEN) !== 0 && (b & DARK) === 0 ? 1 : 0;
    }
  return s / 8;
}
/** hệ số lightmap cho lưới SÀN / TRẦN của ô (mod_cell hoặc mod_cell_dark) */
export function floorLight(i: number, j: number, ep: EpochFn = NO_EPOCH): number {
  const b = cellBits(i, j, ep);
  if (!(b & OPEN)) return 0;
  const sp = spillAt(i, j, ep);
  return b & DARK ? sp * sp : 1;
}
/** hệ số lightmap cho tường / cửa / kệ thuộc ô (i, j) */
export function propLight(i: number, j: number, ep: EpochFn = NO_EPOCH): number {
  const b = cellBits(i, j, ep);
  if (!(b & OPEN)) return 0;
  return b & DARK ? DARK_LEAK * spillAt(i, j, ep) : 1;
}
/** hệ số cho cột ở góc (ci, cj) (chung 4 ô): trung bình propLight của các ô mở quanh góc */
export function pillarLight(ci: number, cj: number, ep: EpochFn = NO_EPOCH): number {
  let s = 0;
  let n = 0;
  for (const [i, j] of [
    [ci - 1, cj - 1],
    [ci, cj - 1],
    [ci - 1, cj],
    [ci, cj],
  ] as const) {
    if (!isOpen(i, j, ep)) continue;
    s += propLight(i, j, ep);
    n++;
  }
  return n ? s / n : 0;
}
/** độ sâu chuẩn hoá 0…1 (≈ 70 m) — càng sâu đèn càng yếu + lạnh */
export const depth01 = (x: number, z: number) => Math.min(1, Math.hypot(x, z) / 70);
/** màu ánh sáng nướng theo độ sâu: ấm → lạnh, yếu dần (rgb tuyến tính, nhân vào lightmap) */
export function depthTint(d: number, out: [number, number, number] = [1, 1, 1]): [number, number, number] {
  const k = 1 - 0.5 * d;
  out[0] = k * (1 - 0.38 * d);
  out[1] = k * (1 - 0.24 * d);
  out[2] = k;
  return out;
}

// ───────────── "Hồi âm": trang ghi chép toán rải trong Thư khố ─────────────
/** 5 trang nằm trên sàn ô HÀNH LANG (luôn mở, không kệ / bàn), sâu dần; (i, j) ô + (ox, oz) lệch trong ô */
export const PAGES: readonly { i: number; j: number; ox: number; oz: number; rot: number }[] = [
  { i: 0, j: 3, ox: 0.9, oz: 0.6, rot: 0.4 },
  { i: -6, j: 6, ox: -0.7, oz: 0.8, rot: 2.1 },
  { i: 6, j: 9, ox: 0.6, oz: -0.9, rot: 1.2 },
  { i: -9, j: 12, ox: 0.8, oz: -0.5, rot: 3.0 },
  { i: 3, j: 15, ox: -0.9, oz: 0.7, rot: 0.9 },
];
export const pagePos = (k: number) => ({ x: PAGES[k].i * CELL + PAGES[k].ox, z: PAGES[k].j * CELL + PAGES[k].oz });
/** trang chưa nhặt gần (x, z) nhất trong bán kính r, hoặc −1 (got: mặt nạ bit trang đã nhặt) */
export function pageNear(x: number, z: number, got: number, r = 1.4): number {
  let best = -1;
  let bd = r;
  for (let k = 0; k < PAGES.length; k++) {
    if (got & (1 << k)) continue;
    const p = pagePos(k);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

// ───────────── hiện diện vô hình (chỉ di chuyển khi không bị nhìn) ─────────────
/** ô đứng được của "người thủ thư": mở, không sảnh, không kệ / bàn */
export const presenceCell = (i: number, j: number, ep: EpochFn = NO_EPOCH) => {
  const b = cellBits(i, j, ep);
  return (b & OPEN) !== 0 && (b & (SHELFC | DESK | HALLCELL)) === 0;
};
/** khoảng cách gần nhất (ô, Chebyshev) mà nó tự tiến tới */
export const PRESENCE_MIN = 3;
/**
 * Một bước của hiện diện: KHÔNG BAO GIỜ di chuyển khi đang bị nhìn thấy (seen); khi không bị nhìn, nhích tối đa 1 ô (4 hướng,
 * không qua tường / cửa) về phía người chơi (pi, pj) nhưng dừng ở khoảng cách ≥ PRESENCE_MIN ô. Tất định theo tick.
 * Trả ô mới [i, j].
 */
export function presenceStep(i: number, j: number, pi: number, pj: number, seen: boolean, tick: number, ep: EpochFn = NO_EPOCH): [number, number] {
  if (seen) return [i, j];
  const cheb = (a: number, b: number) => Math.max(Math.abs(a - pi), Math.abs(b - pj));
  const now = cheb(i, j);
  let bi = i;
  let bj = j;
  let bs = now <= PRESENCE_MIN ? -1 : 0;
  for (let d = 0; d < 4; d++) {
    if (edgeKind(i, j, d, ep)) continue;
    const ni = i + DIR_X[d];
    const nj = j + DIR_Z[d];
    if (!presenceCell(ni, nj, ep)) continue;
    const c = cheb(ni, nj);
    if (c < PRESENCE_MIN) continue;
    // ưu tiên lại gần; hoà → băm theo tick (đi lang thang chứ không thẳng tắp)
    const score = now - c + hash3(ni, nj, 131 + tick) * 0.5;
    if (score > bs) {
      bs = score;
      bi = ni;
      bj = nj;
    }
  }
  return [bi, bj];
}
/** chỗ xuất hiện lại: ô đứng được cách người chơi 4–6 ô, sau lưng hướng nhìn (fx, fz) — hoặc null */
export function presenceRespawn(pi: number, pj: number, fx: number, fz: number, tick: number, ep: EpochFn = NO_EPOCH): [number, number] | null {
  for (let t = 0; t < 40; t++) {
    const a = hash3(pi, pj, 211 + tick * 41 + t) * Math.PI * 2;
    const r = 4 + Math.floor(hash3(pi, pj, 223 + tick * 43 + t) * 3);
    const i = pi + Math.round(Math.cos(a) * r);
    const j = pj + Math.round(Math.sin(a) * r);
    if (!presenceCell(i, j, ep) || inHallCells(i, j)) continue;
    const dx = i - pi;
    const dz = j - pj;
    if ((dx * fx + dz * fz) / Math.hypot(dx, dz) > -0.2) continue;
    return [i, j];
  }
  return null;
}
