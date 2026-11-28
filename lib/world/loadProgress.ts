/**
 * Tiến độ tải THẬT theo giai đoạn cho màn chờ (học từ rayshader 1.0: đẹp là điều kiện tối thiểu — con số phải đúng).
 *  assets  → tệp do drei useProgress đếm (tính từ lúc "lên dây")
 *  build   → cảnh đã gắn xong (Suspense) + (Vùng Kỳ quan) số chunk gần đã có lưới / cần
 *  shaders → PrewarmShaders biên dịch + đẩy texture lên GPU xong
 *  settle  → vài khung hình liên tiếp đủ mượt
 * Giá trị mục tiêu đơn điệu, chặn dưới 100 % đến khi mọi giai đoạn xong; hiển thị đuổi theo bằng lò xo tắt dần tới hạn.
 * Thuần (không DOM) — dùng chung cho màn chờ và test.
 */
import type { L } from "./i18n";

export type StageId = "assets" | "build" | "shaders" | "settle";
export const STAGES: readonly StageId[] = ["assets", "build", "shaders", "settle"];

export const STAGE_LABEL: Record<StageId | "ready", L> = {
  assets: { en: "Fetching models & textures", vi: "Tải mô hình & hoạ tiết" },
  build: { en: "Building the world", vi: "Dựng thế giới" },
  shaders: { en: "Compiling shaders", vi: "Biên dịch shader" },
  settle: { en: "Steadying the frame rate", vi: "Ổn định khung hình" },
  ready: { en: "Ready", vi: "Sẵn sàng" },
};
/** nhãn ngắn cho các nấc trên thanh (điện thoại) */
export const STAGE_SHORT: Record<StageId, L> = {
  assets: { en: "Assets", vi: "Tải" },
  build: { en: "World", vi: "Dựng" },
  shaders: { en: "Shaders", vi: "Shader" },
  settle: { en: "Frames", vi: "Khung" },
};

/** Thế giới dựng dần sau khi gắn (chunk voxel) → giai đoạn build có tiến độ riêng */
const INCREMENTAL = new Set(["expanse"]);
export const buildsIncrementally = (scene: string) => INCREMENTAL.has(scene);

const WEIGHT: Record<StageId, number> = { assets: 0.5, build: 0.22, shaders: 0.18, settle: 0.1 };
const WEIGHT_INC: Record<StageId, number> = { assets: 0.4, build: 0.35, shaders: 0.15, settle: 0.1 };
/** quá thời gian (ms, tính từ lúc giai đoạn thành hiện hành) → coi như xong, không để kẹt màn chờ. Tải tệp: không giới hạn. */
export const STAGE_TIMEOUT: Record<StageId, number> = { assets: Infinity, build: 15000, shaders: 8000, settle: 3000 };
export const STABLE_FRAMES = 4;
/** chặn trên khi chưa xong hết — không bao giờ hiện 100 % sớm */
export const CAP = 0.985;

export interface LoadInput {
  now: number;
  scene: string;
  /** loader đang tải */
  active: boolean;
  /** số tệp đã tải / đã xếp hàng KỂ TỪ lúc lên dây */
  loaded: number;
  total: number;
  /** ms kể từ lúc loader rảnh (0 nếu đang tải) */
  quietMs: number;
  /** cảnh hiện tại đã gắn xong (Suspense đã qua) */
  mounted: boolean;
  /** chunk gần: đã có lưới / cần (chỉ thế giới dựng dần) */
  build: { done: number; need: number } | null;
  shadersDone: boolean;
  /** số khung mượt liên tiếp sau khi shader xong */
  stableFrames: number;
}

export interface LoadSnapshot {
  /** 0..1, đơn điệu, ≤ CAP khi chưa xong */
  target: number;
  /** giai đoạn hiện hành (đầu tiên chưa xong) hoặc "ready" */
  stage: StageId | "ready";
  ready: boolean;
  /** phần đã xong của từng giai đoạn 0..1 */
  frac: Record<StageId, number>;
  /** các giai đoạn đã bị coi là xong vì quá thời gian */
  timedOut: StageId[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : Number.isFinite(x) ? x : 0);

/** Bộ theo dõi một lượt tải (tạo mới mỗi lần lên dây) */
export function createLoadTracker() {
  let best = 0;
  const since: Partial<Record<StageId, number>> = {};
  return {
    update(i: LoadInput): LoadSnapshot {
      const inc = buildsIncrementally(i.scene);
      const files = i.total > 0 ? clamp01(i.loaded / i.total) : i.active ? 0 : 1;
      const frac: Record<StageId, number> = {
        assets: i.active ? Math.min(files, 0.97) : files,
        build: !i.mounted ? 0 : inc ? (i.build && i.build.need > 0 ? clamp01(i.build.done / i.build.need) : 0) : 1,
        shaders: i.shadersDone ? 1 : 0,
        settle: clamp01(i.stableFrames / STABLE_FRAMES),
      };
      const done: Record<StageId, boolean> = {
        assets: !i.active && files >= 1 && i.quietMs >= 200,
        build: frac.build >= 1,
        shaders: i.shadersDone && i.mounted,
        settle: frac.settle >= 1,
      };
      // giai đoạn hiện hành = đầu tiên chưa xong; tính thời gian để áp quá hạn
      const timedOut: StageId[] = [];
      let stage: StageId | "ready" = "ready";
      for (const s of STAGES) {
        if (done[s]) continue;
        since[s] ??= i.now;
        // build chỉ quá hạn khi cảnh đã gắn (chưa gắn = Suspense vẫn đang chờ tải thật)
        const canTimeout = s !== "assets" && (s !== "build" || i.mounted);
        if (canTimeout && i.now - since[s]! > STAGE_TIMEOUT[s]) {
          done[s] = true;
          frac[s] = 1;
          timedOut.push(s);
          continue;
        }
        stage = s;
        break;
      }
      const ready = stage === "ready";
      const W = inc ? WEIGHT_INC : WEIGHT;
      let v = 0;
      for (const s of STAGES) v += W[s] * (done[s] ? 1 : frac[s]);
      best = Math.max(best, ready ? 1 : Math.min(CAP, v));
      return { target: best, stage, ready, frac, timedOut };
    },
  };
}

/** Lò xo tắt dần tới hạn: x đuổi theo target, không vượt, không lùi. Trả về trạng thái mới. */
export function approach(x: number, v: number, target: number, dt: number, omega = 7): [number, number] {
  if (target <= x) return [x, 0];
  let px = x;
  let pv = v;
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let k = 0; k < steps; k++) {
    const a = omega * omega * (target - px) - 2 * omega * pv;
    pv += a * h;
    if (pv < 0) pv = 0;
    px += pv * h;
    if (px >= target) {
      px = target;
      pv = 0;
      break;
    }
  }
  return [px, pv];
}

/** Phần trăm hiển thị: làm tròn XUỐNG — 100 chỉ khi thật sự xong */
export const pctOf = (p: number, ready: boolean) => (ready && p >= 0.999 ? 100 : Math.min(99, Math.floor(p * 100)));

// ── Biến thể "hội tụ" theo thế giới ──
export type ConvergeMode = "relief" | "riemann" | "voxel" | "fourier" | "penrose";
export const CONVERGE_MODE: Record<string, ConvergeMode> = { hub: "riemann", expanse: "voxel", siren: "fourier", impossible: "penrose" };
export const MODE_INDEX: Record<ConvergeMode, number> = { relief: 0, riemann: 1, voxel: 2, fourier: 3, penrose: 4 };

/** số mẫu Monte Carlo mỗi điểm ảnh: 1 → 4096 (mỗi 1/12 tiến độ gấp đôi) */
export const samplesAt = (p: number) => Math.max(1, Math.round(2 ** (clamp01(p) * 12)));
/** độ nhiễu của ước lượng Monte Carlo ∝ 1/√N */
export const noiseOf = (n: number) => 1 / Math.sqrt(Math.max(1, n));
/** số hình chữ nhật Riemann: 2 → 128 */
export const riemannN = (p: number) => 2 ** Math.min(7, 1 + Math.floor(clamp01(p) * 7));
/** số hoạ âm của chuỗi Fourier sóng vuông: 1 → 16 */
export const harmonicsAt = (p: number) => Math.min(16, 1 + Math.floor(clamp01(p) * 16));
/** số bậc thang Penrose mỗi vòng: 4 → 16 */
export const stepsAt = (p: number) => 4 + Math.floor(clamp01(p) * 12);

/** Tổng Riemann trái của f trên [a, b] với n hình chữ nhật */
export function riemannSum(f: (x: number) => number, a: number, b: number, n: number): number {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) s += f(a + i * h) * h;
  return s;
}
/** Tổng riêng chuỗi Fourier của sóng vuông (biên độ 1): (4/π) Σ sin((2k−1)x)/(2k−1), k = 1..n */
export function squareWavePartial(x: number, n: number): number {
  let s = 0;
  for (let k = 1; k <= n; k++) s += Math.sin((2 * k - 1) * x) / (2 * k - 1);
  return (4 / Math.PI) * s;
}

/** Con số "N" hiện cạnh thanh, kèm đơn vị */
export function counterOf(mode: ConvergeMode, p: number): { n: number; unit: L } {
  switch (mode) {
    case "riemann":
      return { n: riemannN(p), unit: { en: "Riemann rectangles", vi: "hình chữ nhật Riemann" } };
    case "fourier":
      return { n: harmonicsAt(p), unit: { en: "harmonics", vi: "hoạ âm" } };
    case "penrose":
      return { n: stepsAt(p), unit: { en: "steps per loop", vi: "bậc mỗi vòng" } };
    case "voxel":
      return { n: samplesAt(p), unit: { en: "light samples", vi: "mẫu tia sáng" } };
    default:
      return { n: samplesAt(p), unit: { en: "light samples", vi: "mẫu tia sáng" } };
  }
}
/** công thức nhỏ cạnh thanh */
export const FORMULA: Record<ConvergeMode, string> = {
  relief: "σ ∝ 1/√N",
  voxel: "σ ∝ 1/√N",
  riemann: "Σ f(xᵢ)·Δx → ∫ f dx",
  fourier: "Σ sin((2k−1)x)/(2k−1) → ⊓",
  penrose: "↑ ↑ ↑ ↑ = ⟲",
};

/** Người dùng muốn giảm chuyển động (cùng khoá với cài đặt trong game, mặc định theo hệ điều hành) */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem("world.reduceMotion");
    if (v === "on") return true;
    if (v === "off") return false;
  } catch {}
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
