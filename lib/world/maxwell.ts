/**
 * Quỷ Maxwell (J. C. Maxwell 1867; Szilárd 1929; Landauer 1961; Bennett 1982) — mô phỏng khí lý tưởng thuần, không React.
 * Hộp 3 × 1,1 × 1,1 m chia đôi ở x = 0, ô cửa vuông 0,4 m giữa vách. Ngăn TRÁI x < 0, ngăn PHẢI x > 0.
 * Phân tử va đàn hồi với thành hộp (không va nhau). Mỗi lần một phân tử chạm ô cửa, "quỷ" đo nó (1 bit) rồi quyết định mở/đóng.
 * Quỷ tự động: cho phân tử NHANH sang phải, phân tử CHẬM sang trái → phải nóng lên, trái nguội đi, entropy khí giảm —
 * nhưng quỷ phải ghi nhớ các phép đo; xoá trí nhớ tốn ít nhất kT ln 2 mỗi bit (Landauer) → tổng entropy không giảm.
 */
import { mulberry32, type Rand } from "./monty";

export const BOX = { hx: 1.5, h: 1.1, hz: 0.55, ap: 0.2, r: 0.03 };
/** độ lệch chuẩn mỗi thành phần vận tốc (m/s) ở nhiệt độ ban đầu */
export const SIGMA = 0.6;
/** ngưỡng "nhanh/chậm" ≈ tốc độ trung vị của phân bố Maxwell–Boltzmann 3D (≈ 1,538 σ) */
export const SPEED_MEDIAN = 1.538 * SIGMA;

export type Gas = {
  n: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  /** số lần quỷ đo một phân tử ở ô cửa (= số bit phải ghi nhớ) */
  bits: number;
  /** số phân tử đã đi qua cửa */
  passed: number;
};

function gauss(r: Rand) {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createGas(n = 140, seed = 1867): Gas {
  const r = mulberry32(seed);
  const g: Gas = { n, px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n), vz: new Float32Array(n), bits: 0, passed: 0 };
  const m = BOX.r;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    g.px[i] = side * (m + r() * (BOX.hx - 2 * m));
    g.py[i] = m + r() * (BOX.h - 2 * m);
    g.pz[i] = -BOX.hz + m + r() * (2 * BOX.hz - 2 * m);
    g.vx[i] = gauss(r) * SIGMA;
    g.vy[i] = gauss(r) * SIGMA;
    g.vz[i] = gauss(r) * SIGMA;
  }
  return g;
}

/** Quyết định của quỷ cho một phân tử đang tới cửa: `toRight` = đi từ trái sang phải */
export type Policy = (toRight: boolean, speed: number) => boolean;
export const demonPolicy: Policy = (toRight, speed) => (toRight ? speed > SPEED_MEDIAN : speed < SPEED_MEDIAN);
export const closedPolicy: Policy = () => false;
export const openPolicy: Policy = () => true;

const inAperture = (y: number, z: number) => Math.abs(y - BOX.h / 2) < BOX.ap - BOX.r && Math.abs(z) < BOX.ap - BOX.r;

/**
 * Tiến một bước dt. `policy` = null nghĩa là KHÔNG có quỷ đo (cửa đóng hẳn, không tốn bit);
 * `measure` = false khi cửa do người chơi giữ (không đo phân tử nào) — vẫn đếm bit nếu policy là quỷ.
 */
export function stepGas(g: Gas, dt: number, policy: Policy | null, measure = true) {
  const m = BOX.r;
  for (let i = 0; i < g.n; i++) {
    let x = g.px[i] + g.vx[i] * dt;
    let y = g.py[i] + g.vy[i] * dt;
    let z = g.pz[i] + g.vz[i] * dt;
    // vách ngăn ở x = 0 (dày 2r): qua được chỉ khi ở trong ô cửa và cửa mở
    const was = g.px[i];
    if ((was < 0 && x > -m) || (was > 0 && x < m)) {
      const toRight = was < 0;
      let open = false;
      if (policy && inAperture(y, z)) {
        // một phân tử chạm ô cửa = một phép đo (trừ khi đã vượt nửa đường)
        if (measure) g.bits++;
        open = policy(toRight, Math.hypot(g.vx[i], g.vy[i], g.vz[i]));
      }
      if (open) {
        // đi qua; nếu dừng giữa bề dày vách thì đẩy sang hẳn phía bên kia
        if (Math.abs(x) < m) x = toRight ? m + 1e-4 : -m - 1e-4;
        g.passed++;
      } else {
        // bật lại khỏi mặt vách
        x = toRight ? -m - (x + m) : m + (m - x);
        g.vx[i] = -g.vx[i];
      }
    }
    // thành hộp
    if (x < -BOX.hx + m) {
      x = 2 * (-BOX.hx + m) - x;
      g.vx[i] = Math.abs(g.vx[i]);
    } else if (x > BOX.hx - m) {
      x = 2 * (BOX.hx - m) - x;
      g.vx[i] = -Math.abs(g.vx[i]);
    }
    if (y < m) {
      y = 2 * m - y;
      g.vy[i] = Math.abs(g.vy[i]);
    } else if (y > BOX.h - m) {
      y = 2 * (BOX.h - m) - y;
      g.vy[i] = -Math.abs(g.vy[i]);
    }
    if (z < -BOX.hz + m) {
      z = 2 * (-BOX.hz + m) - z;
      g.vz[i] = Math.abs(g.vz[i]);
    } else if (z > BOX.hz - m) {
      z = 2 * (BOX.hz - m) - z;
      g.vz[i] = -Math.abs(g.vz[i]);
    }
    g.px[i] = x;
    g.py[i] = y;
    g.pz[i] = z;
  }
}

/** Nhiệt độ mỗi ngăn (đơn vị: σ² ban đầu = 1) và số phân tử */
export function chambers(g: Gas) {
  let nL = 0, nR = 0, eL = 0, eR = 0;
  for (let i = 0; i < g.n; i++) {
    const e = (g.vx[i] ** 2 + g.vy[i] ** 2 + g.vz[i] ** 2) / 3 / (SIGMA * SIGMA);
    if (g.px[i] < 0) {
      nL++;
      eL += e;
    } else {
      nR++;
      eR += e;
    }
  }
  return { nL, nR, tL: nL ? eL / nL : 0, tR: nR ? eR / nR : 0 };
}

/** Entropy khí lý tưởng (đơn vị k, bỏ hằng số): Σ N (ln(V/N) + 3/2 ln T), hai ngăn cùng thể tích */
export function gasEntropy(g: Gas) {
  const c = chambers(g);
  const s = (n: number, t: number) => (n > 0 && t > 0 ? n * (Math.log(1 / n) + 1.5 * Math.log(t)) : 0);
  return s(c.nL, c.tL) + s(c.nR, c.tR);
}

/** Tổng động năng (để kiểm tra va chạm đàn hồi) */
export function energy(g: Gas) {
  let e = 0;
  for (let i = 0; i < g.n; i++) e += g.vx[i] ** 2 + g.vy[i] ** 2 + g.vz[i] ** 2;
  return e;
}

/** Màu theo tốc độ: 0 = chậm (xanh) → 1 = nhanh (đỏ) */
export const speedHeat = (speed: number) => Math.max(0, Math.min(1, (speed / SIGMA - 0.6) / 2.4));
