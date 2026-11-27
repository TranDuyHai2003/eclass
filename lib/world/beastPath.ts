/**
 * Sinh vật vũ trụ khổng lồ (rồng / sâu) — xương sống "bám đường bay" (spine-follow), thuần (không three):
 *  • đường bay khép kín quanh cảnh: vòng hoa thị (cánh hoa k) có lên xuống, bán kính R, độ cao H ± A;
 *  • thân = n điểm bám theo đường bay phía sau đầu (cách đều theo tham số ≈ theo độ dài cung);
 *  • sóng thân lan dọc thân (biên độ tăng về đuôi, trễ pha) — uốn lượn như rắn / rồng phương Đông;
 *  • khung pháp tuyến bằng VẬN CHUYỂN SONG SONG (không xoắn đột ngột như khung Frenet ở chỗ thẳng).
 */
export type V3 = [number, number, number];

export type BeastPath = { R: number; r2: number; k: number; H: number; A: number; cx: number; cz: number };

/** điểm trên đường bay tại tham số a (rad) */
export function pathAt(p: BeastPath, a: number): V3 {
  const rr = p.R + p.r2 * Math.cos(p.k * a);
  return [p.cx + rr * Math.cos(a), p.H + p.A * Math.sin(2 * a + 0.7) + p.A * 0.4 * Math.sin(5 * a), p.cz + rr * Math.sin(a)];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** độ dài cung xấp xỉ trên một đơn vị tham số tại a (để giữ thân dài cố định theo mét) */
export function speedAt(p: BeastPath, a: number): number {
  const e = 1e-3;
  return len(sub(pathAt(p, a + e), pathAt(p, a - e))) / (2 * e);
}

export type Spine = { pos: Float32Array; nrm: Float32Array; bin: Float32Array; tan: Float32Array };

/**
 * n điểm xương sống: đầu ở tham số headA, thân dài bodyLen (m) phía sau; sóng ngang biên độ amp (m) bước sóng wl (m), pha phase.
 * Trả mảng phẳng n × 3 cho vị trí, pháp tuyến, phó pháp tuyến, tiếp tuyến (đầu → đuôi).
 */
export function spine(p: BeastPath, headA: number, n: number, bodyLen: number, amp: number, wl: number, phase: number, out?: Spine): Spine {
  const o = out ?? { pos: new Float32Array(n * 3), nrm: new Float32Array(n * 3), bin: new Float32Array(n * 3), tan: new Float32Array(n * 3) };
  // tham số các điểm: lùi theo độ dài cung (bước ds = bodyLen / (n − 1))
  const ds = bodyLen / (n - 1);
  const base: V3[] = [];
  let a = headA;
  for (let i = 0; i < n; i++) {
    base.push(pathAt(p, a));
    a -= ds / Math.max(1e-3, speedAt(p, a));
  }
  // tiếp tuyến (hướng đi tới: từ điểm sau về điểm trước)
  const tans: V3[] = base.map((_, i) => norm(sub(base[Math.max(0, i - 1)], base[Math.min(n - 1, i + 1)])));
  // vận chuyển song song: bắt đầu bằng "lên" chiếu vuông góc tiếp tuyến đầu
  let N: V3 = norm(sub([0, 1, 0], tans[0].map((x) => x * tans[0][1]) as V3));
  for (let i = 0; i < n; i++) {
    const T = tans[i];
    // chiếu N cũ lên mặt vuông góc T mới
    N = norm(sub(N, T.map((x) => x * dot(N, T)) as V3));
    const B = cross(T, N);
    // sóng ngang (theo B) + nhẹ theo N; biên độ tăng dần về đuôi
    const u = i / (n - 1);
    const w = Math.sin((u * bodyLen) / wl * Math.PI * 2 - phase) * amp * (0.25 + 0.75 * u);
    const v = Math.sin((u * bodyLen) / (wl * 1.7) * Math.PI * 2 - phase * 0.8 + 1.3) * amp * 0.35 * u;
    const P = base[i];
    o.pos.set([P[0] + B[0] * w + N[0] * v, P[1] + B[1] * w + N[1] * v, P[2] + B[2] * w + N[2] * v], i * 3);
    o.nrm.set(N, i * 3);
    o.bin.set(B, i * 3);
    o.tan.set(T, i * 3);
  }
  return o;
}
