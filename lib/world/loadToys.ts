/**
 * Màn chờ (khi tải / dựng thế giới, nhân vật): đồ chơi toán – vật lý chạm vào được + "Bạn có biết?".
 * Phần toán thuần (không DOM) — dùng chung cho màn chờ và test.
 */

// ── Vẽ bằng vòng tròn quay (chuỗi Fourier rời rạc) ──
export interface Epicycle {
  freq: number;
  amp: number;
  phase: number;
}
/** DFT của đường cong khép kín (điểm phức x + iy) → các vòng tròn, sắp theo bán kính giảm dần */
export function dft(points: [number, number][]): Epicycle[] {
  const N = points.length;
  const out: Epicycle[] = [];
  for (let k = 0; k < N; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      re += points[n][0] * Math.cos(a) - points[n][1] * Math.sin(a);
      im += points[n][0] * Math.sin(a) + points[n][1] * Math.cos(a);
    }
    re /= N;
    im /= N;
    const freq = k <= N / 2 ? k : k - N;
    out.push({ freq, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  return out.sort((a, b) => b.amp - a.amp);
}
/** Điểm của đường vẽ tại thời điểm t ∈ [0, 1) khi cộng các vòng tròn */
export function epicycleAt(E: Epicycle[], t: number): [number, number] {
  let x = 0;
  let y = 0;
  for (const e of E) {
    const a = 2 * Math.PI * e.freq * t + e.phase;
    x += e.amp * Math.cos(a);
    y += e.amp * Math.sin(a);
  }
  return [x, y];
}
export type CurveId = "heart" | "trefoil" | "infinity" | "star";
export const CURVES: CurveId[] = ["heart", "trefoil", "infinity", "star"];
/** Đường cong mẫu (lấy n điểm đều theo tham số), y hướng lên */
export function sampleCurve(id: CurveId, n = 128): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    if (id === "heart") return [16 * Math.sin(t) ** 3 / 17, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17];
    if (id === "trefoil") return [(Math.sin(t) + 2 * Math.sin(2 * t)) / 3, (Math.cos(t) - 2 * Math.cos(2 * t)) / 3];
    if (id === "infinity") return [Math.cos(t) / (1 + Math.sin(t) ** 2), (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)];
    // ngôi sao 5 cánh (đa giác sao nội suy)
    const k = Math.floor((i / n) * 10);
    const f = (i / n) * 10 - k;
    const R = (j: number) => (j % 2 ? 0.42 : 1);
    const A = (j: number) => Math.PI / 2 + (j * Math.PI) / 5;
    const x0 = R(k) * Math.cos(A(k));
    const y0 = R(k) * Math.sin(A(k));
    const x1 = R(k + 1) * Math.cos(A(k + 1));
    const y1 = R(k + 1) * Math.sin(A(k + 1));
    return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
  });
}

// ── Kim Buffon: kim dài L thả lên sàn kẻ vạch cách nhau d (L ≤ d) — xác suất cắt vạch = 2L / (πd) ──
export function buffonHit(rand: () => number, L = 1, d = 1): boolean {
  const y = rand() * (d / 2); // khoảng cách tâm kim tới vạch gần nhất
  const th = rand() * (Math.PI / 2);
  return y <= (L / 2) * Math.sin(th);
}
/** Ước lượng π từ số kim thả / số kim cắt vạch */
export function buffonPi(drops: number, hits: number, L = 1, d = 1): number {
  return hits ? (2 * L * drops) / (d * hits) : Infinity;
}

// ── Số nguyên tố (xoắn Ulam) ──
export function sieve(n: number): Uint8Array {
  const p = new Uint8Array(n + 1).fill(1);
  p[0] = 0;
  if (n >= 1) p[1] = 0;
  for (let i = 2; i * i <= n; i++) if (p[i]) for (let j = i * i; j <= n; j += i) p[j] = 0;
  return p;
}
/** Toạ độ ô của số k (1 ở tâm) trên xoắn Ulam */
export function ulam(k: number): [number, number] {
  if (k <= 1) return [0, 0];
  const r = Math.ceil((Math.sqrt(k) - 1) / 2);
  const t = 2 * r + 1;
  let m = t * t;
  const s = t - 1;
  if (k >= m - s) return [r - (m - k), -r];
  m -= s;
  if (k >= m - s) return [-r, -r + (m - k)];
  m -= s;
  if (k >= m - s) return [-r + (m - k), r];
  return [r, r - (m - s - k)];
}

// ── Bảng Galton: mỗi viên bi qua n hàng đinh, mỗi hàng lệch trái / phải ngẫu nhiên → số lần sang phải ~ nhị thức ──
export function galtonBin(rand: () => number, rows: number): number {
  let k = 0;
  for (let i = 0; i < rows; i++) if (rand() < 0.5) k++;
  return k;
}

// ── Con lắc kép (hỗn loạn) — tích phân Runge–Kutta 4, l₁ = l₂ = 1, m₁ = m₂ = 1, g = 9,81 ──
export type Pend = [number, number, number, number]; // θ₁, θ₂, ω₁, ω₂
function pendF(s: Pend): Pend {
  const [a, b, wa, wb] = s;
  const g = 9.81;
  const d = a - b;
  const den = 3 - Math.cos(2 * d);
  const dwa = (-g * 3 * Math.sin(a) - g * Math.sin(a - 2 * b) - 2 * Math.sin(d) * (wb * wb + wa * wa * Math.cos(d))) / den;
  const dwb = (2 * Math.sin(d) * (wa * wa * 2 + g * 2 * Math.cos(a) + wb * wb * Math.cos(d))) / den;
  return [wa, wb, dwa, dwb];
}
export function pendStep(s: Pend, dt: number): Pend {
  const add = (x: Pend, y: Pend, k: number): Pend => [x[0] + y[0] * k, x[1] + y[1] * k, x[2] + y[2] * k, x[3] + y[3] * k];
  const k1 = pendF(s);
  const k2 = pendF(add(s, k1, dt / 2));
  const k3 = pendF(add(s, k2, dt / 2));
  const k4 = pendF(add(s, k3, dt));
  for (let i = 0; i < 4; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return s;
}
/** Năng lượng toàn phần (để kiểm tra tích phân bảo toàn) */
export function pendEnergy(s: Pend): number {
  const [a, b, wa, wb] = s;
  const g = 9.81;
  const T = wa * wa + 0.5 * wb * wb + wa * wb * Math.cos(a - b);
  const V = -2 * g * Math.cos(a) - g * Math.cos(b);
  return T + V;
}

// ── Bạn có biết? (đã kiểm chứng) ──
export const FACTS: { vi: string; en: string }[] = [
  { vi: "Chỉ cần 23 người trong phòng là xác suất có hai người trùng ngày sinh đã vượt 50%.", en: "With just 23 people in a room, the chance that two share a birthday is over 50%." },
  { vi: "Xáo kỹ một bộ bài 52 lá: gần như chắc chắn thứ tự đó chưa từng xuất hiện trong lịch sử — có 52! ≈ 8·10⁶⁷ cách.", en: "Shuffle a deck well: almost surely that order has never existed before — there are 52! ≈ 8·10⁶⁷ orders." },
  { vi: "Ánh sáng Mặt Trời bạn thấy lúc này đã rời bề mặt Mặt Trời khoảng 8 phút 20 giây trước.", en: "The sunlight you see right now left the Sun's surface about 8 minutes 20 seconds ago." },
  { vi: "e^{iπ} + 1 = 0 nối năm hằng số quan trọng nhất của toán học trong một đẳng thức.", en: "e^{iπ} + 1 = 0 links the five most important constants of mathematics in one equation." },
  { vi: "Có \"nhiều\" số thực trong đoạn [0, 1] hơn tất cả số tự nhiên — Cantor chứng minh bằng đường chéo.", en: "There are \"more\" real numbers in [0, 1] than all natural numbers — Cantor's diagonal argument." },
  { vi: "Đồng hồ nguyên tử đo được: thời gian trôi chậm hơn một chút khi bạn ở thấp hơn (gần Trái Đất hơn) — chỉ cần chênh 33 cm.", en: "Atomic clocks measure it: time runs slightly slower when you are lower (closer to Earth) — even 33 cm lower." },
  { vi: "Một thìa cà phê vật chất sao neutron nặng cỡ một tỉ tấn.", en: "A teaspoon of neutron-star matter weighs about a billion tonnes." },
  { vi: "Euclid đã chứng minh có vô hạn số nguyên tố từ hơn 2300 năm trước — chỉ trong vài dòng.", en: "Euclid proved there are infinitely many primes over 2300 years ago — in a few lines." },
  { vi: "Không thể chải phẳng lông trên một quả bóng mà không có chỗ xoáy (định lý quả bóng lông) — nên luôn có nơi trên Trái Đất gió lặng.", en: "You can't comb a hairy ball flat without a cowlick (hairy ball theorem) — so somewhere on Earth the wind is always still." },
  { vi: "Mọi bản đồ trên mặt phẳng chỉ cần 4 màu để hai nước kề nhau khác màu — chứng minh đầu tiên cần máy tính (1976).", en: "Any map needs only 4 colours so neighbours differ — the first proof needed a computer (1976)." },
  { vi: "Một hình có chu vi vô hạn vẫn có thể bao một diện tích hữu hạn — bông tuyết Koch.", en: "A shape with infinite perimeter can enclose a finite area — the Koch snowflake." },
  { vi: "Phân tử nước trong cốc của bạn rất có thể từng đi qua cơ thể một con khủng long.", en: "Water molecules in your glass very likely once passed through a dinosaur." },
  { vi: "Không có công thức nghiệm (dùng căn) cho phương trình bậc 5 tổng quát — Abel và Galois đã chứng minh.", en: "There is no formula in radicals for the general quintic — proved by Abel and Galois." },
  { vi: "Trong tam giác vẽ trên mặt cầu, tổng ba góc lớn hơn 180° — hình học trên Trái Đất không phải hình học Euclid.", en: "On a sphere, a triangle's angles add up to more than 180° — Earth's geometry is not Euclid's." },
  { vi: "Mỗi giây có khoảng 65 tỉ hạt neutrino từ Mặt Trời xuyên qua mỗi cm² cơ thể bạn mà không chạm vào gì.", en: "Every second about 65 billion solar neutrinos pass through each cm² of your body without touching anything." },
  { vi: "0,999… (lặp mãi) bằng đúng 1 — không phải \"gần bằng\".", en: "0.999… (forever) is exactly 1 — not \"almost\"." },
];
