/**
 * Trạng thái hoạ âm DÙNG CHUNG của Mê cung Hoạ âm (thuần — test được): một nguồn duy nhất cho mọi chuyển động / shader
 * của màn, để môi trường, boss, bầu trời, con rối… phản ứng NHẤT QUÁN (nghiên cứu: docs/ai-reviews/siren-witch/PLAN.md).
 *  - Đồng hồ nhạc: BPM cố định → beat, phase trong beat, ô nhịp (4/4). Chỉ cho HÌNH ẢNH; luật chơi / đòn boss giữ đồng hồ riêng.
 *  - Hoạt hình nhiều nhịp (multi-temporal): máy quay / nhân vật / kiến trúc 60 Hz liên tục; con rối giấy đổi dáng 12 Hz,
 *    sinh vật stop-motion 8 Hz, tranh cắt dán thay 4 Hz — "lượng tử hoá" thời gian, không giới hạn FPS.
 *  - decomposition 0…1: boss càng yếu, thế giới càng mất "hệ số Fourier" (bớt chi tiết, màu, hoạ âm) — cao trào bằng sự biến mất.
 *  - dissonance 0…1: pha boss II/III → lệch pha, detune giữa các lớp.
 *  - Lò xo giảm chấn (không phụ thuộc FPS) thay cho lerp(…, 0,1) mỗi khung.
 */
export const HARMONIC_BPM = 96;

export type HarmonicState = {
  /** giây (liên tục) */
  time: number;
  /** số beat (liên tục) */
  beat: number;
  /** pha trong beat 0…1 */
  beatPhase: number;
  /** ô nhịp (4 beat) */
  bar: number;
  /** thời gian lượng tử hoá cho con rối (12 Hz) / stop-motion (8 Hz) / cắt dán (4 Hz) */
  puppetTime: number;
  stopTime: number;
  collageTime: number;
  /** 0 = đủ hoạ âm, 1 = chỉ còn âm cơ bản (boss gần gục) */
  decomposition: number;
  /** 0 = thuận (pha I), 1 = bất hoà mạnh (pha III) */
  dissonance: number;
  /** số hoạ âm còn "sống" (8 → 1 theo decomposition) — dùng cho shader / vertex Fourier */
  harmonics: number;
};

export const HARMONIC: HarmonicState = {
  time: 0,
  beat: 0,
  beatPhase: 0,
  bar: 0,
  puppetTime: 0,
  stopTime: 0,
  collageTime: 0,
  decomposition: 0,
  dissonance: 0,
  harmonics: 8,
};

export const quantize = (t: number, hz: number) => Math.floor(t * hz) / hz;

/** cập nhật mỗi khung (một chỗ duy nhất — SirenDirector). hpFrac: máu boss 0…1 (1 nếu chưa đánh); phase: 1…3 */
export function updateHarmonic(s: HarmonicState, time: number, hpFrac: number, phase: number, dt: number): HarmonicState {
  s.time = time;
  s.beat = (time * HARMONIC_BPM) / 60;
  s.beatPhase = s.beat - Math.floor(s.beat);
  s.bar = Math.floor(s.beat / 4);
  s.puppetTime = quantize(time, 12);
  s.stopTime = quantize(time, 8);
  s.collageTime = quantize(time, 4);
  // phân rã bắt đầu dưới 60 % máu, đầy ở 5 %; đi mượt (không giật khi trúng đòn)
  const decTarget = Math.min(1, Math.max(0, (0.6 - hpFrac) / 0.55));
  const disTarget = Math.min(1, Math.max(0, (phase - 1) / 2));
  const k = 1 - Math.exp(-dt * 1.5);
  s.decomposition += (decTarget - s.decomposition) * k;
  s.dissonance += (disTarget - s.dissonance) * k;
  s.harmonics = Math.max(1, Math.round(8 - 7 * s.decomposition));
  return s;
}

/**
 * Lò xo giảm chấn (tích phân ẩn nửa — ổn định với dt lớn): x'' + 2ζω x' + ω² (x − target) = 0.
 * ζ < 1 vượt đích rồi rung (phím đàn, cổng giấy), ζ = 1 tới hạn, ζ > 1 chậm không vượt.
 */
export type Spring = { x: number; v: number };
export function springStep(s: Spring, target: number, omega: number, zeta: number, dt: number): Spring {
  const h = Math.min(dt, 1 / 20);
  const f = 1 + 2 * h * zeta * omega;
  const oo = omega * omega;
  const hoo = h * oo;
  const det = 1 / (f + h * hoo);
  const x = (f * s.x + h * s.v + h * hoo * target) * det;
  const v = (s.v + hoo * (target - s.x)) * det;
  s.x = x;
  s.v = v;
  return s;
}

/** trường Chladni cách điệu trên tấm vuông [−1, 1]² — |F| nhỏ = đường nút (an toàn), dùng CHUNG CPU (luật) + GLSL (hình) */
export function chladni(x: number, y: number, m: number, n: number): number {
  return Math.cos(m * Math.PI * x) * Math.cos(n * Math.PI * y) - Math.cos(n * Math.PI * x) * Math.cos(m * Math.PI * y);
}
export const CHLADNI_GLSL = /* glsl */ `
float chladni(vec2 p, float m, float n) {
  return cos(m * 3.14159265 * p.x) * cos(n * 3.14159265 * p.y) - cos(n * 3.14159265 * p.x) * cos(m * 3.14159265 * p.y);
}`;

/** chuỗi Fourier vuông bậc lẻ rút gọn theo số hoạ âm còn sống: Σ sin((2k+1)x)/(2k+1) — biến dạng đỉnh / dây đàn */
export function squareSeries(x: number, harmonics: number): number {
  let s = 0;
  for (let k = 0; k < harmonics; k++) {
    const n = 2 * k + 1;
    s += Math.sin(n * x) / n;
  }
  return (4 / Math.PI) * s;
}
