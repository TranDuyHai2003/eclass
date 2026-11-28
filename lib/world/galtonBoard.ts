/**
 * Bảng Galton cỡ lớn trên tường sàn chính phòng Siêu khối (TESSERACT_BOOTH.md §13 I2) — logic thuần, không vật lý.
 * Mỗi viên qua ROWS hàng đinh, mỗi hàng nảy phải với xác suất p → số lần phải ~ Nhị thức(ROWS, p) → máng k.
 * Đủ nhiều viên thì chồng sỏi thành hình chuông (de Moivre–Laplace: Nhị thức → chuẩn, μ = np, σ = √(np(1 − p))).
 * Đường bay giải tích (nhảy parabol giữa các đinh 0,12 s / hàng) → mọi máy thấy như nhau theo (seed, p).
 * Khung cục bộ bảng: x ngang (tiếp tuyến tường), y lên, z hướng vào phòng; khớp mô hình Blender (galton_build.py).
 */
import { mulberry32 } from "./monty";

export const GB = {
  rows: 10,
  dx: 0.2, // khoảng cách đinh theo x = bề rộng máng
  dy: 0.16,
  pegY0: 3.6, // hàng đinh đầu
  pegR: 0.022,
  ballR: 0.03,
  binY: 0.5, // đáy máng
  binTop: 1.95,
  hopperY: 3.98,
  balls: 240,
  gap: 0.045, // s giữa hai viên
  hop: 0.12, // s mỗi hàng
  perLayer: 3, // số viên mỗi lớp trong một máng
  bearing: 30,
  r: 13.45,
  g: 9.81,
} as const;

export const BINS = GB.rows + 1;
export const pegY = (j: number) => GB.pegY0 - j * GB.dy;
/** x của đinh thứ i (0…j) ở hàng j */
export const pegX = (j: number, i: number) => (i - j / 2) * GB.dx;
export const binX = (k: number) => (k - GB.rows / 2) * GB.dx;

export interface GaltonRun {
  seed: number;
  p: number;
  /** số lần nảy phải tích luỹ sau mỗi hàng: lanes[i][j] (j = 0…rows), lanes[i][rows] = máng */
  lanes: Uint8Array[];
  bin: Uint8Array;
  /** thứ tự viên trong máng (để xếp chồng) */
  slot: Uint16Array;
  counts: number[];
}

export function galtonRun(seed: number, p = 0.5, n: number = GB.balls): GaltonRun {
  const rand = mulberry32(seed);
  const lanes: Uint8Array[] = [];
  const bin = new Uint8Array(n);
  const slot = new Uint16Array(n);
  const counts = new Array(BINS).fill(0);
  for (let i = 0; i < n; i++) {
    const l = new Uint8Array(GB.rows + 1);
    let r = 0;
    for (let j = 0; j < GB.rows; j++) {
      if (rand() < p) r++;
      l[j + 1] = r;
    }
    lanes.push(l);
    bin[i] = r;
    slot[i] = counts[r]++;
  }
  return { seed, p, lanes, bin, slot, counts };
}

/** chỗ đậu của viên thứ s trong máng k (xếp PER_LAYER viên một lớp, lớp lẻ lệch nửa viên cho khít) */
export function stackPos(k: number, s: number): [number, number] {
  const layer = Math.floor(s / GB.perLayer);
  const c = s % GB.perLayer;
  const w = GB.ballR * 2.05;
  const off = layer % 2 ? 0.25 * w : -0.25 * w;
  return [binX(k) + (c - (GB.perLayer - 1) / 2) * w + off * 0.5, GB.binY + GB.ballR + layer * GB.ballR * 1.85];
}

/** thời điểm (s, tính từ lúc thả) viên i chạm đỉnh hàng 0, và lúc rời hàng cuối */
export const tStart = (i: number) => i * GB.gap;
const tFallIn = GB.hop;

/**
 * Vị trí (x, y) của viên i ở thời điểm t (s, từ lúc thả). null = chưa thả.
 * Pha: rơi từ phễu xuống đinh đầu → ROWS lần nảy parabol → rơi tự do xuống chỗ đậu.
 */
export function ballAt(run: GaltonRun, i: number, t: number): [number, number] | null {
  let u = t - tStart(i);
  if (u < 0) return null;
  const top = GB.pegR + GB.ballR;
  if (u < tFallIn) {
    const s = u / tFallIn;
    return [0, GB.hopperY + (pegY(0) + top - GB.hopperY) * s * s];
  }
  u -= tFallIn;
  const l = run.lanes[i];
  const j = Math.floor(u / GB.hop);
  if (j < GB.rows - 1) {
    const s = (u - j * GB.hop) / GB.hop;
    const x0 = pegX(j, l[j]);
    const x1 = pegX(j + 1, l[j + 1]);
    const y0 = pegY(j) + top;
    const y1 = pegY(j + 1) + top;
    return [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s + 0.05 * 4 * s * (1 - s)];
  }
  // rời hàng cuối: nảy ra giữa máng rồi rơi tự do
  const k = run.bin[i];
  const [sx, sy] = stackPos(k, run.slot[i]);
  const x0 = pegX(GB.rows - 1, l[GB.rows - 1]);
  const y0 = pegY(GB.rows - 1) + top;
  const tf = Math.sqrt((2 * Math.max(0.01, y0 - sy)) / GB.g);
  const v = u - (GB.rows - 1) * GB.hop;
  if (v >= tf) return [sx, sy];
  const s = v / tf;
  const xm = binX(k);
  // nửa đầu dạt về giữa máng, sau đó lắng vào chỗ đậu
  const x = s < 0.35 ? x0 + (xm - x0) * (s / 0.35) : xm + (sx - xm) * ((s - 0.35) / 0.65);
  return [x, y0 - 0.5 * GB.g * (v * v)];
}

/** thời gian cả lượt (s) — viên cuối đã đậu */
export const runDuration = (n: number = GB.balls) => tStart(n - 1) + tFallIn + GB.rows * GB.hop + 0.8;

/** Nhị thức kỳ vọng: số viên trong máng k */
export function expected(k: number, p: number, n: number = GB.balls): number {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (GB.rows - k + i)) / i;
  return n * c * p ** k * (1 - p) ** (GB.rows - k);
}

/** Hai bệ trước bảng (toạ độ cục bộ phòng): nút thả (trái) và cần nghiêng (phải) */
export const GB_STATIONS = { drop: { b: 22, r: 12.9 }, tilt: { b: 38, r: 12.9 } } as const;
const RAD = Math.PI / 180;
export function nearGalton(x: number, z: number, y: number): "drop" | "tilt" | null {
  if (y > 1.2) return null;
  let best: "drop" | "tilt" | null = null;
  let bd = 1.4;
  for (const id of ["drop", "tilt"] as const) {
    const s = GB_STATIONS[id];
    const d = Math.hypot(x - Math.sin(s.b * RAD) * s.r, z + Math.cos(s.b * RAD) * s.r);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}
/** chu kỳ nghiêng: ½ → 0,7 → 0,3 → ½ */
export const nextTilt = (p: number) => (p === 0.5 ? 0.7 : p === 0.7 ? 0.3 : 0.5);
