/**
 * Phòng Lăng kính (Prism Hall) — lý thuyết màu, logic thuần (không three.js), có test (tests/world/colorTheory.test.ts).
 * Kế hoạch + nguồn: docs/ai-reviews/color-theory/PLAN.md.
 *
 * Quy ước: mọi phép trộn làm trong ÁNH SÁNG TUYẾN TÍNH (linear sRGB, 0…1 hoặc lớn hơn khi cộng nhiều đèn);
 * chỉ đổi sang mã sRGB (gamma) khi hiển thị số cho người đọc. Độ chênh màu đo trong OKLab (Ottosson 2020).
 */

export type RGB = [number, number, number];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const wrap360 = (h: number) => ((h % 360) + 360) % 360;

// ───────── sRGB ↔ tuyến tính (IEC 61966-2-1) ─────────
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const toSrgb = (c: RGB): RGB => [linearToSrgb(clamp01(c[0])), linearToSrgb(clamp01(c[1])), linearToSrgb(clamp01(c[2]))];
export const toLinear = (c: RGB): RGB => [srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])];
/** Mã hex sRGB 8 bit của một màu tuyến tính */
export function hexOf(lin: RGB): string {
  return "#" + toSrgb(lin).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export const byte = (lin: number) => Math.round(linearToSrgb(clamp01(lin)) * 255);

// ───────── HSV / HSL (lục giác: hexcone) ─────────
/** h độ, s, v ∈ [0, 1] → RGB (cùng không gian với đầu vào; HSV là phép đổi toạ độ của khối RGB) */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + wrap360(h) / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}
export function rgbToHsv(c: RGB): [number, number, number] {
  const [r, g, b] = c;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-12) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [wrap360(h), mx > 1e-12 ? d / mx : 0, mx];
}
export function hslToRgb(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + wrap360(h) / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}
export function rgbToHsl(c: RGB): [number, number, number] {
  const [h] = rgbToHsv(c);
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d < 1e-12 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

// ───────── Phối màu hài hoà (trên vòng sắc độ) ─────────
export const HARMONIES = ["complement", "split", "triad", "analogous", "square"] as const;
export type Harmony = (typeof HARMONIES)[number];
/** Độ lệch góc (độ) của từng màu trong bộ phối so với màu gốc */
export const HARMONY_OFFSETS: Record<Harmony, number[]> = {
  complement: [0, 180],
  split: [0, 150, 210],
  triad: [0, 120, 240],
  analogous: [-30, 0, 30],
  square: [0, 90, 180, 270],
};
export const harmonyHues = (h: number, kind: Harmony) => HARMONY_OFFSETS[kind].map((o) => wrap360(h + o));
export const nextHarmony = (k: Harmony): Harmony => HARMONIES[(HARMONIES.indexOf(k) + 1) % HARMONIES.length];

/**
 * Vòng màu hoạ sĩ RYB (Itten) ↔ vòng ánh sáng RGB/HSV: nội suy tuyến tính từng khúc qua 6 mốc
 * (đỏ, cam, vàng, lục, lam, tím). Trên vòng RYB, đối của đỏ là LỤC; trên vòng ánh sáng, đối của đỏ là LAM LỤC (cyan).
 */
const RYB_KNOTS: [number, number][] = [
  [0, 0],
  [60, 30],
  [120, 60],
  [180, 120],
  [240, 240],
  [300, 285],
  [360, 360],
];
function pw(x: number, from: 0 | 1, to: 0 | 1) {
  const v = wrap360(x);
  for (let i = 0; i < RYB_KNOTS.length - 1; i++) {
    const a = RYB_KNOTS[i];
    const b = RYB_KNOTS[i + 1];
    if (v >= a[from] && v <= b[from]) return a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  return v;
}
export const rybToHue = (ryb: number) => wrap360(pw(ryb, 0, 1));
export const hueToRyb = (hue: number) => wrap360(pw(hue, 1, 0));
/** Màu đối (180°) trên vòng đang dùng, trả về sắc độ HSV */
export const complementHue = (hue: number, wheel: "rgb" | "ryb") => (wheel === "rgb" ? wrap360(hue + 180) : rybToHue(hueToRyb(hue) + 180));

// ───────── Trộn cộng (ánh sáng) và trộn trừ (kính lọc) ─────────
/** Tổng vectơ của các đèn (r, g, b)·k — KHÔNG kẹp: hai đèn trắng chồng nhau sáng gấp đôi */
export function addLights(lights: { color: RGB; k: number }[]): RGB {
  const s: RGB = [0, 0, 0];
  for (const l of lights) for (let i = 0; i < 3; i++) s[i] += l.color[i] * l.k;
  return s;
}
/** Kính lọc chồng nhau: ánh sáng ra = ánh sáng vào ⊙ T₁ ⊙ T₂ … (nhân từng kênh) — xấp xỉ "lối tắt RGB" */
export function filterRgb(light: RGB, ts: RGB[]): RGB {
  const o: RGB = [...light];
  for (const t of ts) for (let i = 0; i < 3; i++) o[i] *= t[i];
  return o;
}

// ───────── Quang phổ: hàm phối màu CIE 1931 (xấp xỉ giải tích Wyman–Sloan–Shirley 2013) ─────────
const g = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
/** x̄(λ), ȳ(λ), z̄(λ) — λ tính bằng nm */
export function cmf(l: number): [number, number, number] {
  const x = 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const y = 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const z = 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  return [x, y, z];
}
/** Ma trận linear sRGB (D65) → XYZ và ngược lại (IEC 61966-2-1) */
export const M_RGB2XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
] as const;
export const M_XYZ2RGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
] as const;
const mul = (m: readonly (readonly number[])[], v: readonly number[]): RGB => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
export const rgbToXyz = (c: RGB) => mul(M_RGB2XYZ, c);
export const xyzToRgb = (c: RGB) => mul(M_XYZ2RGB, c);
/** Toạ độ sắc độ CIE xy */
export function xyOf(xyz: RGB): [number, number] {
  const s = xyz[0] + xyz[1] + xyz[2];
  return s > 1e-12 ? [xyz[0] / s, xyz[1] / s] : [0.3127, 0.329];
}
export const SRGB_PRIMARIES = { r: [0.64, 0.33], g: [0.3, 0.6], b: [0.15, 0.06], white: [0.3127, 0.329] } as const;

/** Dải bước sóng dùng trong mô phỏng phổ (nm) */
export const L0 = 380;
export const L1 = 720;
export const DL = 5;
export const LAMBDAS: number[] = Array.from({ length: (L1 - L0) / DL + 1 }, (_, i) => L0 + i * DL);

/** XYZ của một phổ công suất S(λ) (lấy mẫu theo LAMBDAS) */
export function spectrumXyz(S: (l: number) => number): RGB {
  const o: RGB = [0, 0, 0];
  for (const l of LAMBDAS) {
    const c = cmf(l);
    const s = S(l) * DL;
    o[0] += c[0] * s;
    o[1] += c[1] * s;
    o[2] += c[2] * s;
  }
  return o;
}

/**
 * Màu hiển thị được của ánh sáng đơn sắc λ (linear sRGB, max kênh = 1). Màu phổ nằm NGOÀI tam giác sRGB → kéo thẳng về
 * điểm trắng D65 với cùng độ chói Y tới khi hết kênh âm (giữ bước sóng trội — cùng đường thẳng qua điểm trắng trên giản đồ
 * xy — chỉ mất độ bão hoà: màn hình không hiện nổi màu phổ thuần).
 */
export function spectralRgb(l: number): RGB {
  const xyz = cmf(l);
  const c = xyzToRgb(xyz);
  const Y = xyz[1];
  let t = 1;
  for (let i = 0; i < 3; i++) if (c[i] < 0) t = Math.min(t, Y / (Y - c[i]));
  const d: RGB = [Y + t * (c[0] - Y), Y + t * (c[1] - Y), Y + t * (c[2] - Y)];
  const mx = Math.max(d[0], d[1], d[2]);
  // mờ dần ở hai đầu phổ (mắt kém nhạy) — theo ȳ, có sàn để vẫn thấy tím / đỏ thẫm
  const fade = Math.min(1, 0.22 + 1.5 * Math.max(Y, l < 500 ? xyz[2] * 0.3 : 0));
  return mx > 1e-9 ? [(Math.max(0, d[0]) / mx) * fade, (Math.max(0, d[1]) / mx) * fade, (Math.max(0, d[2]) / mx) * fade] : [0, 0, 0];
}
/** Đường cong phổ (spectral locus) trên giản đồ xy */
export const locusXy = (l: number) => xyOf(cmf(l));

// ───────── Kính lọc CMY thật (phổ truyền qua) ─────────
const sig = (x: number) => 1 / (1 + Math.exp(-x));
/** Phổ truyền qua T(λ) ∈ [0, 1] của kính lọc thuốc nhuộm: cyan chặn đỏ, magenta chặn lục, vàng chặn lam */
export const FILTER_T = {
  c: (l: number) => 0.03 + 0.93 * sig((586 - l) / 9),
  m: (l: number) => 0.03 + 0.94 * (1 - sig((l - 492) / 7) * sig((594 - l) / 7)),
  y: (l: number) => 0.02 + 0.95 * sig((l - 500) / 8),
} as const;
export type FilterId = keyof typeof FILTER_T;
export const FILTER_IDS: FilterId[] = ["c", "m", "y"];
/** Đèn trắng (phổ dẹt, rồi cân bằng trắng → (1,1,1)) */
const LAMP_XYZ = spectrumXyz(() => 1);
const WHITE_RGB = xyzToRgb(LAMP_XYZ);
/** Màu (linear sRGB, đèn trắng = (1,1,1)) của ánh sáng trắng qua các kính lọc — nhân PHỔ rồi mới quy ra RGB */
export function filterSpectral(ids: FilterId[]): RGB {
  const xyz = spectrumXyz((l) => ids.reduce((t, id) => t * FILTER_T[id](l), 1));
  const c = xyzToRgb(xyz);
  return [Math.max(0, c[0] / WHITE_RGB[0]), Math.max(0, c[1] / WHITE_RGB[1]), Math.max(0, c[2] / WHITE_RGB[2])];
}
/** "Lối tắt RGB": màu của từng kính đơn rồi nhân từng kênh (gần đúng, lệch với kết quả phổ) */
export const filterShortcut = (ids: FilterId[]): RGB => filterRgb([1, 1, 1], ids.map((id) => filterSpectral([id])));
/** 8 tổ hợp (bit 0 = C, 1 = M, 2 = Y) → màu; bảng cho shader */
export function filterTable(): RGB[] {
  return Array.from({ length: 8 }, (_, m) => filterSpectral(FILTER_IDS.filter((_, i) => m & (1 << i))));
}

// ───────── Đồng sắc (metamerism): vàng phổ 580 nm ≡ đỏ 630 nm + lục 532 nm ─────────
/**
 * Tìm tỉ lệ hai vạch phổ a, b sao cho hỗn hợp có ĐÚNG sắc độ xy của vạch c (đường thẳng trên giản đồ xy):
 * trả về [ka, kb] với cùng độ chói Y như vạch c (cường độ 1).
 */
export function metamerWeights(c: number, a: number, b: number): [number, number] {
  const A = cmf(a);
  const B = cmf(b);
  const C = cmf(c);
  // ka·A + kb·B ∝ C  ⇔  khớp 2 tỉ số x, y; giải ka·(A·u) + kb·(B·u) = 0 với u ⟂ C trong mặt phẳng (X, Z) đã chuẩn theo Y
  // Dùng: (ka·Ax + kb·Bx) / (ka·Ay + kb·By) = Cx / Cy
  const rx = C[0] / C[1];
  const ka = rx * B[1] - B[0];
  const kb = A[0] - rx * A[1];
  // chuẩn theo Y
  const Y = ka * A[1] + kb * B[1];
  return [(ka * C[1]) / Y, (kb * C[1]) / Y];
}

// ───────── OKLab (Ottosson 2020): độ chênh cảm nhận ─────────
export function oklab(c: RGB): RGB {
  const [r, gg, b] = c;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gg + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gg + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gg + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function deltaE(a: RGB, b: RGB): number {
  const p = oklab(a);
  const q = oklab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// ───────── Mô phỏng mù màu (Machado, Oliveira & Fernandes 2009, mức 1,0; áp lên linear RGB) ─────────
export const CVD_IDS = ["normal", "protan", "deutan", "tritan"] as const;
export type Cvd = (typeof CVD_IDS)[number];
export const CVD: Record<Cvd, number[]> = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
export function simulateCvd(c: RGB, k: Cvd): RGB {
  const m = CVD[k];
  return [m[0] * c[0] + m[1] * c[1] + m[2] * c[2], m[3] * c[0] + m[4] * c[1] + m[5] * c[2], m[6] * c[0] + m[7] * c[1] + m[8] * c[2]].map(clamp01) as RGB;
}
export const nextCvd = (k: Cvd): Cvd => CVD_IDS[(CVD_IDS.indexOf(k) + 1) % CVD_IDS.length];

// ───────── Ảo giác: ảnh dư âm bản (cơ chế đối lập Hering) + tương phản đồng thời ─────────
/** Thời gian nhìn chăm chú (giây) trước khi chuyển sang tường trắng */
export const AFTERIMAGE_S = 15;
/** Ảnh dư ≈ màu bù (trắng − màu, rồi chuẩn hoá về độ sáng cực đại) — chỉ là mô hình định tính */
export function afterimageOf(c: RGB): RGB {
  const d: RGB = [1 - clamp01(c[0]), 1 - clamp01(c[1]), 1 - clamp01(c[2])];
  const mx = Math.max(...d);
  return mx > 1e-9 ? [d[0] / mx, d[1] / mx, d[2] / mx] : [0, 0, 0];
}
/** Cờ "đảo màu": nhìn nền lam lục + sao lam → ảnh dư là nền đỏ + sao vàng */
export const FLAG_FIELD: RGB = [0, 0.92, 0.92];
export const FLAG_STAR: RGB = [0, 0, 0.9];

// ───────── Tone mapping Khronos PBR Neutral (hậu kỳ của game) và nghịch đảo của nó ─────────
const TM_S = 0.8 - 0.04;
const TM_D = 1 - TM_S;
const TM_DESAT = 0.15;
export function neutralTonemap(c: RGB): RGB {
  let [r, gg, b] = c;
  const x = Math.min(r, gg, b);
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= off;
  gg -= off;
  b -= off;
  const peak = Math.max(r, gg, b);
  if (peak < TM_S) return [r, gg, b];
  const np = 1 - (TM_D * TM_D) / (peak + TM_D - TM_S);
  const k = np / peak;
  r *= k;
  gg *= k;
  b *= k;
  const gm = 1 - 1 / (TM_DESAT * (peak - np) + 1);
  return [r + (np - r) * gm, gg + (np - gg) * gm, b + (np - b) * gm];
}
/**
 * Đầu vào cần đưa vào tone mapping để màn hình hiện ĐÚNG giá trị tuyến tính d (max kênh ≤ 0,995):
 * các trạm màu xuất neutralInverse(d) để "trắng là trắng", đỏ + lục ra đúng vàng (không bị nén xám / ngả màu).
 */
export function neutralInverse(d: RGB): RGB {
  let [r, gg, b] = d.map((v) => Math.min(0.995, Math.max(0, v))) as RGB;
  const np = Math.max(r, gg, b);
  if (np >= TM_S) {
    const peak = (TM_D * TM_D) / (1 - np) - TM_D + TM_S;
    const gm = 1 - 1 / (TM_DESAT * (peak - np) + 1);
    // bỏ trộn về trắng rồi bỏ nén
    const k = peak / np;
    r = ((r - np * gm) / (1 - gm)) * k;
    gg = ((gg - np * gm) / (1 - gm)) * k;
    b = ((b - np * gm) / (1 - gm)) * k;
  }
  // màu rất bão hoà gần trắng tuyệt đối không tới được (Neutral tự khử bão hoà vùng sáng) → kẹp ≥ 0, sai số nhỏ
  r = Math.max(0, r);
  gg = Math.max(0, gg);
  b = Math.max(0, b);
  const mo = Math.min(r, gg, b);
  const x = mo < 0.04 ? Math.sqrt(Math.max(0, mo) / 6.25) : mo + 0.04;
  const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  return [r + off, gg + off, b + off];
}

// ───────── Bố trí Phòng Lăng kính (toạ độ cục bộ phòng Siêu khối: x đông, z nam, y cao) ─────────
/**
 * Vòm tầng lửng 90° (tess_veil_observatory, x 13,7…14,6, |z| < 1,2, y 5…8) → cổ phòng (foyer) → sảnh chính phía bắc.
 * Tránh vỏ Thiên văn đồ (tâm x 28,6, bán kính ngoài 7,3) và vòng tường phòng chính (r 14).
 */
export const PH = {
  y: 5,
  H: 5.2,
  /** khe vòm: x ∈ [ARCH0, X0], |z| < AW/2 */
  ARCH0: 13.45,
  AW: 2.4,
  AH: 3.0,
  /** cổ phòng: x ∈ [X0, FX1], z ∈ [MZ, FZ1] */
  X0: 14.7,
  FX1: 20.6,
  FZ1: 1.8,
  /** ranh giới cổ ↔ sảnh chính */
  MZ: -8.2,
  /** sảnh chính: x ∈ [X0, MX1], z ∈ [MZ0, MZ] */
  MX1: 27.4,
  MZ0: -21.4,
} as const;

/** Trong lòng Phòng Lăng kính (mặt bằng), lề m */
export function inPrismHall(x: number, z: number, m = 0): boolean {
  if (x > PH.X0 + m && x < PH.FX1 - m && z > PH.MZ - 1 && z < PH.FZ1 - m) return true; // cổ phòng (thông xuống sảnh)
  return x > PH.X0 + m && x < PH.MX1 - m && z > PH.MZ0 + m && z < PH.MZ - m + (x < PH.FX1 - m ? 1 : 0);
}
/** Khe vòm nối tầng lửng ↔ cổ phòng */
export const inPrismArch = (x: number, z: number, m = 0) => x > PH.ARCH0 - 0.05 && x <= PH.X0 + 0.05 && Math.abs(z) < PH.AW / 2 - m;
export const onPrismFloor = (x: number, z: number) => inPrismArch(x, z) || inPrismHall(x, z);

/** Các trạm (tâm, toạ độ cục bộ phòng) */
export const ST = {
  /** (a) sân khấu đèn RGB: sàn trắng tròn bán kính R, 3 đèn treo cao LH */
  stage: { x: 18.6, z: -14.2, R: 2.5, LH: 4.4, ring: 1.05 },
  /** (b) đèn chiếu qua kính lọc CMY: hộp đèn ở (x, z), màn ở tường đông */
  cmy: { x: 24.0, z: -10.4 },
  /** (c) khối RGB đi bộ: sàn S × S m */
  cube: { x: 24.2, z: -16.4, S: 3 },
  /** (d) vòng hoà sắc trên tường tây của cổ phòng */
  wheel: { x: 14.7, z: -4.6 },
  /** (e) tường ảo giác (tường đông cổ phòng) */
  illusion: { x: 20.6, z: -3.2 },
  /** (f) giản đồ CIE trên tường bắc sảnh chính */
  cie: { x: 24.0, z: -21.4 },
} as const;
/** Lăng kính Newton (flint nặng SF11): tia nắng qua lỗ ở tường bắc → lăng kính (x, z), cao y trên sàn → màn phổ đứng ở screenX */
export const PRISM = { x: 16.6, z: -19.6, y: 1.35, screenX: 21.0 } as const;

/** Vị trí 3 đèn trên sân khấu (bằng nhau 120°, vòng tròn "ring"): R ở bắc, G đông nam, B tây nam */
export function stageLamp(i: number): [number, number] {
  const a = (-90 + 120 * i) * (Math.PI / 180);
  return [ST.stage.x + Math.cos(a) * ST.stage.ring, ST.stage.z + Math.sin(a) * ST.stage.ring];
}
export const LAMP_RGB: RGB[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
/** Nấc độ sáng của mỗi đèn (F) */
export const LEVELS = [1, 0.75, 0.5, 0.25, 0] as const;
export const nextLevel = (k: number) => LEVELS[(LEVELS.findIndex((v) => Math.abs(v - k) < 1e-9) + 1) % LEVELS.length];

/** Vũng sáng của đèn i tại điểm sàn (x, z): đĩa mềm bán kính POOL_R quanh chân đèn */
export const POOL_R = 1.7;
export function poolAt(i: number, x: number, z: number): number {
  const [lx, lz] = stageLamp(i);
  const d = Math.hypot(x - lx, z - lz) / POOL_R;
  return d >= 1 ? 0 : d <= 0.85 ? 1 : 1 - (d - 0.85) / 0.15;
}

/**
 * Bóng màu (kiểu Exploratorium "Colored Shadows"): tia từ điểm sàn F tới đèn L có bị một trụ đứng (tâm C, bán kính r,
 * cao h, chân ở sàn) chặn không? Giải |F + t·(L − F) − C|² = r² theo phương ngang, t ∈ (0, 1), độ cao tại t ≤ h.
 */
export function cylBlocks(F: [number, number, number], L: [number, number, number], C: [number, number], r: number, h: number): boolean {
  const dx = L[0] - F[0];
  const dz = L[2] - F[2];
  const ox = F[0] - C[0];
  const oz = F[2] - C[1];
  const a = dx * dx + dz * dz;
  const b = 2 * (ox * dx + oz * dz);
  const c = ox * ox + oz * oz - r * r;
  if (c <= 0) return true; // điểm nằm dưới chân trụ
  const disc = b * b - 4 * a * c;
  if (a < 1e-12 || disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t <= 0 || t >= 1) return false;
  return F[1] + t * (L[1] - F[1]) <= h;
}

/** Màu sàn sân khấu tại (x, z): tổng các đèn còn chiếu tới (không bị trụ nào chặn) */
export function stageColorAt(x: number, z: number, levels: readonly number[], blockers: { c: [number, number]; r: number; h: number }[] = []): RGB {
  const out: RGB = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    const k = levels[i] * poolAt(i, x, z);
    if (k <= 0) continue;
    const [lx, lz] = stageLamp(i);
    const L: [number, number, number] = [lx, PH.y + ST.stage.LH, lz];
    if (blockers.some((bl) => cylBlocks([x, PH.y, z], L, bl.c, bl.r, PH.y + bl.h))) continue;
    for (let j = 0; j < 3; j++) out[j] += LAMP_RGB[i][j] * k;
  }
  return out;
}

/** Thử thách trộn ánh sáng: mức (r, g, b) cần đặt cho vùng giữa (cả 3 đèn chồng nhau) */
export const LIGHT_TARGETS: { lv: [number, number, number]; vi: string; en: string }[] = [
  { lv: [1, 1, 0], vi: "Vàng", en: "Yellow" },
  { lv: [0, 1, 1], vi: "Lam lục (cyan)", en: "Cyan" },
  { lv: [1, 0.5, 0], vi: "Cam", en: "Orange" },
  { lv: [1, 0.25, 0.75], vi: "Hồng cánh sen", en: "Hot pink" },
  { lv: [0.5, 0, 1], vi: "Tím", en: "Violet" },
  { lv: [1, 1, 1], vi: "Trắng", en: "White" },
];
export const sameLevels = (a: readonly number[], b: readonly number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

/** Thử thách kính lọc: tổ hợp (bit C, M, Y) cần bật để đốm giữa ra màu này */
export const FILTER_TARGETS: { mask: number; vi: string; en: string }[] = [
  { mask: 0b101, vi: "Lục", en: "Green" },
  { mask: 0b110, vi: "Đỏ", en: "Red" },
  { mask: 0b011, vi: "Lam", en: "Blue" },
  { mask: 0b111, vi: "Đen (gần như)", en: "(Almost) black" },
];

// ───────── Khối RGB / trụ HSV đi bộ ─────────
export const SLICE_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
export const nextSlice = (k: number) => SLICE_STEPS[(SLICE_STEPS.findIndex((v) => Math.abs(v - k) < 1e-9) + 1) % SLICE_STEPS.length];
export type CubeMode = "rgb" | "hsv";
/**
 * Màu tại điểm sàn (x, z) của trạm khối:
 *  - "rgb": lát cắt G = k của khối RGB, x → R (tây 0 → đông 1), z → B (nam 0 → bắc 1);
 *  - "hsv": đĩa V = k của trụ HSV, góc → sắc độ H (0° = đông, ngược chiều kim đồng hồ nhìn từ trên), bán kính → độ bão hoà S.
 * null nếu ngoài sàn. Toạ độ RGB là mã sRGB (giống bộ chọn màu) → linear để vẽ.
 */
export function cubeColorAt(x: number, z: number, mode: CubeMode, k: number): RGB | null {
  const h = ST.cube.S / 2;
  const u = (x - (ST.cube.x - h)) / ST.cube.S;
  const v = ((ST.cube.z + h) - z) / ST.cube.S;
  if (mode === "rgb") {
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return [u, k, v];
  }
  const dx = x - ST.cube.x;
  const dz = ST.cube.z - z;
  const s = Math.hypot(dx, dz) / h;
  if (s > 1) return null;
  const hue = wrap360((Math.atan2(dz, dx) * 180) / Math.PI);
  return hsvToRgb(hue, s, k);
}
/** Mục tiêu tìm màu (mã sRGB) — có cả màu chỉ có ở lát G khác (phải đổi lát) */
export const CUBE_TARGETS: { c: RGB; vi: string; en: string }[] = [
  { c: [1, 0.5, 0], vi: "Cam", en: "Orange" },
  { c: [0.5, 0.25, 0.75], vi: "Tím oải hương", en: "Lavender purple" },
  { c: [0, 0.75, 0.5], vi: "Ngọc lục bảo", en: "Emerald" },
  { c: [0.25, 0.25, 1], vi: "Lam hoàng gia", en: "Royal blue" },
  { c: [1, 1, 0.5], vi: "Vàng kem", en: "Cream yellow" },
];
export const CUBE_HIT = 0.045;
/** Chênh màu (OKLab, trên màu tuyến tính) giữa chỗ đứng và mục tiêu */
export const cubeMiss = (here: RGB, target: RGB) => deltaE(toLinear(here), toLinear(target));

// ───────── Bệ tương tác (F) ─────────
export type ColorAct =
  | "lamp-r"
  | "lamp-g"
  | "lamp-b"
  | "filter-c"
  | "filter-m"
  | "filter-y"
  | "cube-slice"
  | "cube-mode"
  | "cube-target"
  | "wheel-hue"
  | "wheel-kind"
  | "wheel-space"
  | "illusion-stare"
  | "illusion-reveal"
  | "prism-cvd"
  | "prism-probe";
/** [id, x, z] — bệ cao 1,05 m, bán kính va chạm PED_R */
export const PEDESTALS: [ColorAct, number, number][] = [
  ["lamp-r", ST.stage.x - 1.3, ST.stage.z + 3.4],
  ["lamp-g", ST.stage.x, ST.stage.z + 3.6],
  ["lamp-b", ST.stage.x + 1.3, ST.stage.z + 3.4],
  ["filter-c", ST.cmy.x - 1.7, ST.cmy.z + 1.0],
  ["filter-m", ST.cmy.x - 1.7, ST.cmy.z],
  ["filter-y", ST.cmy.x - 1.7, ST.cmy.z - 1.0],
  ["cube-slice", ST.cube.x - 1.1, ST.cube.z + 2.4],
  ["cube-mode", ST.cube.x, ST.cube.z + 2.4],
  ["cube-target", ST.cube.x + 1.1, ST.cube.z + 2.4],
  ["wheel-hue", ST.wheel.x + 1.6, ST.wheel.z + 1.1],
  ["wheel-kind", ST.wheel.x + 1.6, ST.wheel.z],
  ["wheel-space", ST.wheel.x + 1.6, ST.wheel.z - 1.1],
  ["illusion-stare", ST.illusion.x - 1.9, ST.illusion.z - 1.4],
  ["illusion-reveal", ST.illusion.x - 1.9, ST.illusion.z + 1.6],
  ["prism-probe", PRISM.x + 1.3, PRISM.z + 1.9],
  ["prism-cvd", ST.cie.x, ST.cie.z + 2.0],
];
export const PED_R = 0.32;
/** Bệ gần nhất trong tầm tay (≤ 1,25 m, đang đứng trên sàn phòng) */
export function nearColorStation(x: number, z: number, y: number): ColorAct | null {
  if (y < PH.y - 0.6 || y > PH.y + 1.2 || !inPrismHall(x, z)) return null;
  let best: ColorAct | null = null;
  let bd = 1.25;
  for (const [id, px, pz] of PEDESTALS) {
    const d = Math.hypot(x - px, z - pz);
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  return best;
}

/** Vật cản trong phòng (bệ, chân lăng kính, bàn đèn kính lọc, trụ sân khấu) */
export function prismHallBlocked(x: number, z: number): boolean {
  // khe vòm và chỗ nối vòm ↔ cổ phòng (hết bề dày tường tây)
  if (Math.abs(z) < PH.AW / 2 - 0.3 && x > PH.ARCH0 - 0.05 && x < PH.X0 + 0.35) return false;
  if (!inPrismHall(x, z, 0.3)) return true;
  for (const [, px, pz] of PEDESTALS) if (Math.hypot(x - px, z - pz) < PED_R + 0.28) return true;
  // trụ trắng giữa sân khấu (vật đổ bóng màu)
  if (Math.hypot(x - ST.stage.x, z - ST.stage.z) < STAGE_COLUMN.r + 0.3) return true;
  // hộp đèn chiếu kính lọc (0,8 × 0,8) + giá kính
  if (Math.abs(x - ST.cmy.x) < 0.7 && Math.abs(z - ST.cmy.z) < 0.7) return true;
  // bệ lăng kính, màn phổ
  if (Math.abs(x - PRISM.x) < 0.65 && Math.abs(z - PRISM.z) < 0.65) return true;
  if (Math.abs(x - PRISM.screenX) < 0.35 && z < PRISM.z + 1.25) return true;
  return false;
}
/** Trụ trắng giữa sân khấu: đổ 3 bóng màu */
export const STAGE_COLUMN = { r: 0.22, h: 1.9 } as const;

/** Bước sóng đầu dò (F) trên dải phổ + điểm trên giản đồ CIE */
export const PROBE_NM = [450, 480, 500, 520, 550, 580, 610, 650] as const;
export const nextProbe = (l: number) => PROBE_NM[(PROBE_NM.indexOf(l as (typeof PROBE_NM)[number]) + 1) % PROBE_NM.length];

// ───────── OKLCH (vòng màu cảm nhận) ─────────
export function oklabToLinear(L: number, a: number, b: number): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** OKLCH → linear sRGB; ngoài gam màu thì giảm độ sắc C (giữ L, h) tới khi hiển thị được */
export function oklchToLinear(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180;
  const inG = (c: RGB) => c.every((v) => v >= -1e-6 && v <= 1 + 1e-6);
  let c = oklabToLinear(L, C * Math.cos(h), C * Math.sin(h));
  if (inG(c)) return c.map(clamp01) as RGB;
  let lo = 0;
  let hi = C;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (inG(oklabToLinear(L, m * Math.cos(h), m * Math.sin(h)))) lo = m;
    else hi = m;
  }
  c = oklabToLinear(L, lo * Math.cos(h), lo * Math.sin(h));
  return c.map(clamp01) as RGB;
}
export const WHEELS = ["rgb", "ryb", "oklch"] as const;
export type Wheel = (typeof WHEELS)[number];
export const nextWheel = (w: Wheel): Wheel => WHEELS[(WHEELS.indexOf(w) + 1) % WHEELS.length];
/** Màu (linear) tại góc a (độ) trên vòng: rgb = HSV(a,1,1); ryb = vòng hoạ sĩ; oklch = L 0,72, C 0,13 (độ sáng đều) */
export function wheelColor(a: number, w: Wheel): RGB {
  if (w === "oklch") return oklchToLinear(0.72, 0.13, a + 29);
  return toLinear(hsvToRgb(w === "ryb" ? rybToHue(a) : a, 1, 1));
}
/** Bộ phối màu (linear) theo vòng đang chọn */
export const harmonyColors = (base: number, kind: Harmony, w: Wheel) => HARMONY_OFFSETS[kind].map((o) => wheelColor(base + o, w));

// ───────── Lăng kính: tán sắc Cauchy n(λ) = A + B/λ² (λ tính bằng µm) ─────────
/** BK7 (kính quang học thường) và SF11 (flint nặng — tán sắc mạnh, dùng cho lăng kính trong phòng); khớp n_F, n_d, n_C */
export const GLASS = { bk7: { A: 1.5046, B: 0.0042 }, sf11: { A: 1.73896, B: 0.01595 } } as const;
export type Glass = { A: number; B: number };
export const cauchyN = (nm: number, g: Glass = GLASS.bk7) => g.A + g.B / (nm / 1000) ** 2;
/** Góc lệch (độ) của tia qua lăng kính góc đỉnh apex (độ) với góc tới inc (độ); null nếu phản xạ toàn phần */
export function prismDeviation(nm: number, inc: number, apex = 60, g: Glass = GLASS.bk7): number | null {
  const n = cauchyN(nm, g);
  const R = Math.PI / 180;
  const r1 = Math.asin(Math.sin(inc * R) / n);
  const r2 = apex * R - r1;
  const s = n * Math.sin(r2);
  if (Math.abs(s) > 1) return null;
  return inc + Math.asin(s) / R - apex;
}
/** Góc tới cho độ lệch cực tiểu ở bước sóng nm: sin i = n·sin(A/2) */
export const minDevIncidence = (nm: number, apex = 60, g: Glass = GLASS.bk7) => (Math.asin(cauchyN(nm, g) * Math.sin(((apex / 2) * Math.PI) / 180)) * 180) / Math.PI;

/**
 * Hình học phòng tối Newton (mặt bằng, toạ độ cục bộ): tia trắng đi theo hướng u_in sao cho tia 550 nm ra đúng hướng +x
 * (độ lệch cực tiểu); lỗ cửa chớp là chỗ tia vào cắt tường bắc. Tia bước sóng λ quay thêm −δ(λ) (cùng chiều với 550 nm).
 */
export const PRISM_INC = minDevIncidence(550, 60, GLASS.sf11);
const D550 = prismDeviation(550, PRISM_INC, 60, GLASS.sf11)!;
/** góc (rad, atan2(z, x)) của tia vào */
export const PRISM_IN_ANGLE = (D550 * Math.PI) / 180;
export const PRISM_HOLE: [number, number] = (() => {
  const ux = Math.cos(PRISM_IN_ANGLE);
  const uz = Math.sin(PRISM_IN_ANGLE);
  const t = (PRISM.z - PH.MZ0) / uz;
  return [PRISM.x - ux * t, PH.MZ0];
})();
/** Điểm tia λ chạm màn phổ (z), null nếu không ra khỏi lăng kính */
export function spectrumHitZ(nm: number): number | null {
  const d = prismDeviation(nm, PRISM_INC, 60, GLASS.sf11);
  if (d === null) return null;
  const a = PRISM_IN_ANGLE - (d * Math.PI) / 180;
  return PRISM.z + Math.tan(a) * (PRISM.screenX - PRISM.x);
}
