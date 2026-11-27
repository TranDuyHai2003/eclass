/**
 * Phòng Nghịch Lý — toán thuần cho 10 trạm (không React). Mỗi hàm đi kèm đúng con số mà bảng giải thích hiển thị.
 */

// ── 1. Achilles và rùa (Zeno, ~450 TCN) ──────────────────────────────────────────────
/** Achilles chạy va m/s, rùa vt m/s, rùa đi trước `head` m. Bước Zeno thứ k: Achilles tới chỗ rùa vừa đứng. */
export function zenoSteps(n: number, head = 100, va = 10, vt = 1) {
  const out: { t: number; gap: number; achilles: number }[] = [];
  let t = 0;
  let gap = head;
  let a = 0;
  for (let k = 0; k < n; k++) {
    const dt = gap / va;
    t += dt;
    a += gap;
    gap = gap * (vt / va);
    out.push({ t, gap, achilles: a });
  }
  return out;
}
/** Thời điểm đuổi kịp thật sự (tổng chuỗi hình học hội tụ) */
export const catchTime = (head = 100, va = 10, vt = 1) => head / (va - vt);
/** Tổng riêng 1/2 + 1/4 + … + 1/2^n */
export const halvingSum = (n: number) => 1 - Math.pow(0.5, n);

// ── 2. Nghịch lý ngày sinh ───────────────────────────────────────────────────────────
/** Xác suất có ít nhất hai người trùng ngày sinh trong n người (365 ngày, đều nhau) */
export function birthdayP(n: number, days = 365) {
  let q = 1;
  for (let k = 0; k < n; k++) q *= (days - k) / days;
  return 1 - Math.max(0, q);
}
export function birthdayThreshold(p = 0.5, days = 365) {
  let n = 1;
  while (birthdayP(n, days) < p) n++;
  return n;
}

// ── 3. Nghịch lý Simpson — số liệu thật: điều trị sỏi thận (Charig và cộng sự, BMJ 1986) ──
export const SIMPSON = {
  A: { small: [81, 87], large: [192, 263] },
  B: { small: [234, 270], large: [55, 80] },
} as const;
export function simpsonRates() {
  const r = (x: readonly [number, number]) => x[0] / x[1];
  const tot = (t: "A" | "B") => (SIMPSON[t].small[0] + SIMPSON[t].large[0]) / (SIMPSON[t].small[1] + SIMPSON[t].large[1]);
  return {
    A: { small: r(SIMPSON.A.small), large: r(SIMPSON.A.large), all: tot("A") },
    B: { small: r(SIMPSON.B.small), large: r(SIMPSON.B.large), all: tot("B") },
  };
}

// ── 4. Banach–Tarski: nhóm tự do F₂ = ⟨a, b⟩ (A = a⁻¹, B = b⁻¹) ─────────────────────
const INV: Record<string, string> = { a: "A", A: "a", b: "B", B: "b" };
/** Rút gọn từ (bỏ các cặp xx⁻¹ kề nhau) */
export function reduceWord(w: string) {
  const st: string[] = [];
  for (const c of w) {
    if (st.length && st[st.length - 1] === INV[c]) st.pop();
    else st.push(c);
  }
  return st.join("");
}
/** Nhân trái một chữ cái rồi rút gọn */
export const leftMul = (c: string, w: string) => reduceWord(c + w);
/** Mảnh S(x) = các từ rút gọn bắt đầu bằng chữ x ("" = phần tử đơn vị) */
export const pieceOf = (w: string) => (w === "" ? "e" : w[0]);
/** Mọi từ rút gọn có độ dài ≤ n */
export function wordsUpTo(n: number) {
  const out = [""];
  let layer = [""];
  for (let k = 0; k < n; k++) {
    const next: string[] = [];
    for (const w of layer) for (const c of "aAbB") if (!w.length || INV[w[w.length - 1]] !== c) next.push(w + c);
    out.push(...next);
    layer = next;
  }
  return out;
}

// ── 5. Người thợ cạo (Russell, 1901) ────────────────────────────────────────────────
/** "Thợ cạo cạo cho đúng những ai không tự cạo." Gán giá trị shaves(thợ cạo, chính mình) có nhất quán không? */
export const barberConsistent = (shavesHimself: boolean) => shavesHimself === !shavesHimself;

// ── 6. Bài toán Newcomb ──────────────────────────────────────────────────────────────
/** Hộp A trong suốt có $1 000; hộp B kín có $1 000 000 nếu kẻ tiên tri đoán bạn chỉ lấy B. p = độ chính xác của kẻ tiên tri. */
export function newcombEV(p: number) {
  return { oneBox: p * 1_000_000, twoBox: (1 - p) * 1_000_000 + 1_000 };
}
export const newcombBreakEven = () => 0.5 + 1_000 / 2_000_000;

// ── 7. Nghịch lý đường bờ biển (Richardson 1961, Mandelbrot 1967) ───────────────────
export const KOCH_D = Math.log(4) / Math.log(3);
/** Đo đường Koch (cạnh 1) bằng thước dài 3⁻ᵏ: số bước 4ᵏ → chiều dài (4/3)ᵏ */
export const kochLength = (k: number) => Math.pow(4 / 3, k);
/** Đỉnh của đường Koch mức k trên đoạn [0,1] (mặt phẳng xy) */
export function kochPoints(k: number): [number, number][] {
  let pts: [number, number][] = [
    [0, 0],
    [1, 0],
  ];
  for (let l = 0; l < k; l++) {
    const next: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const dx = (x1 - x0) / 3;
      const dy = (y1 - y0) / 3;
      const a: [number, number] = [x0 + dx, y0 + dy];
      const b: [number, number] = [x0 + 2 * dx, y0 + 2 * dy];
      const c: [number, number] = [a[0] + dx * 0.5 - dy * (Math.sqrt(3) / 2), a[1] + dy * 0.5 + dx * (Math.sqrt(3) / 2)];
      next.push(a, c, b, [x1, y1]);
    }
    pts = next;
  }
  return pts;
}

// ── 8. Nghịch lý Braess (1968) ──────────────────────────────────────────────────────
/**
 * 4 000 xe đi từ S tới E. Đường S→X và Y→E: T/100 phút (T = số xe, tắc dần); S→Y và X→E: 45 phút cố định.
 * Có thêm cầu tắt X→Y (0 phút): ai cũng đi S→X→Y→E (cân bằng Nash) → mỗi người mất 80 phút thay vì 65.
 */
export function braess(n = 4000, shortcut = false) {
  if (!shortcut) return { time: n / 2 / 100 + 45, routes: { top: n / 2, bottom: n / 2, cross: 0 } };
  // với cầu tắt: đi đường chéo luôn ≤ hai đường kia khi mọi người cùng đi (n/100 ≤ 45 khi n ≤ 4500)
  const t = n / 100;
  return { time: t + 0 + t, routes: { top: 0, bottom: 0, cross: n } };
}

// ── 9. Chuỗi Grandi 1 − 1 + 1 − 1 + … & đèn Thomson ─────────────────────────────────
export const grandiPartial = (n: number) => (n % 2 === 1 ? 1 : 0);
/** Trung bình Cesàro của n tổng riêng đầu tiên → 1/2 */
export function cesaro(n: number) {
  let s = 0;
  for (let k = 1; k <= n; k++) s += grandiPartial(k);
  return s / n;
}
/** Đèn Thomson: lần bật/tắt thứ k xảy ra lúc 1 − 2^(−k) phút */
export const thomsonTime = (k: number) => 1 - Math.pow(2, -k);

// ── 10. Nghịch lý anh em sinh đôi (thuyết tương đối hẹp) ────────────────────────────
export const gamma = (v: number) => 1 / Math.sqrt(1 - v * v);
/** Chuyến đi khứ hồi tới ngôi sao cách d năm ánh sáng với tốc độ v (phần của c) */
export function twinAges(d: number, v: number) {
  const earth = (2 * d) / v;
  return { earth, traveler: earth / gamma(v), gamma: gamma(v) };
}
