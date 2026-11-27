/**
 * Bộ sinh texture thủ tục (thuần, không three.js) — chạy OFFLINE bằng `scripts/world-gen-textures.ts` → PNG trong public/world/fx/tex/.
 * (Sinh lúc chạy mất ~12 s trên luồng chính — caustics 3,7 s, nhiễu 7,5 s — nên nướng sẵn như các game làm.)
 * Mọi texture lặp liền ô (tuần hoàn), RGBA8.
 */
export interface TexData {
  name: string;
  size: number;
  data: Uint8Array;
}
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** nhiễu giá trị tuần hoàn chu kỳ P (lưới nguyên) */
function periodicNoise(P: number) {
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = (i: number, j: number) => g[(((j % P) + P) % P) * P + (((i % P) + P) % P)];
    return (a(xi, yi) * (1 - fx) + a(xi + 1, yi) * fx) * (1 - fy) + (a(xi, yi + 1) * (1 - fx) + a(xi + 1, yi + 1) * fx) * fy;
  };
}
function fbmP(n: (x: number, y: number) => number, x: number, y: number, oct: number, P: number) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * n(x * f, y * f);
    f *= 2;
    a *= 0.5;
  }
  void P;
  return s / (1 - 0.5 ** oct);
}

/** mặt sóng tuần hoàn trên [0,1)²: h = Σ a sin(2π(k·p) + φ), k nguyên → lặp liền ô; trả về độ dốc */
function waveField(count: number, kMax: number, ampFall: number) {
  seed = 977;
  const W: { kx: number; ky: number; a: number; ph: number }[] = [];
  for (let i = 0; i < count; i++) {
    let kx = 0;
    let ky = 0;
    while (kx === 0 && ky === 0) {
      kx = Math.round((rnd() * 2 - 1) * kMax);
      ky = Math.round((rnd() * 2 - 1) * kMax);
    }
    const k = Math.hypot(kx, ky);
    W.push({ kx, ky, a: 1 / Math.pow(k, ampFall), ph: rnd() * Math.PI * 2 });
  }
  return (x: number, y: number): [number, number] => {
    let dx = 0;
    let dy = 0;
    for (const w of W) {
      const c = Math.cos(2 * Math.PI * (w.kx * x + w.ky * y) + w.ph) * w.a * 2 * Math.PI;
      dx += c * w.kx;
      dy += c * w.ky;
    }
    return [dx, dy];
  };
}

export function genWaterNormal(): TexData {
  const N = 256;
  const f = waveField(18, 5, 1.6);
  const raw = new Float32Array(N * N * 2);
  let mx = 1e-6;
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const [dx, dy] = f(i / N, j / N);
      raw[(j * N + i) * 2] = dx;
      raw[(j * N + i) * 2 + 1] = dy;
      mx = Math.max(mx, Math.abs(dx), Math.abs(dy));
    }
  const d = new Uint8Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    d[k * 4] = Math.round((raw[k * 2] / mx) * 127.5 + 127.5);
    d[k * 4 + 1] = Math.round((raw[k * 2 + 1] / mx) * 127.5 + 127.5);
    d[k * 4 + 2] = 255;
    d[k * 4 + 3] = 255;
  }
  return { name: "water_normal", size: N, data: d };
}
/** ánh sóng: tia thẳng đứng qua mặt sóng → khúc xạ → chạm đáy (sâu D) → cộng dồn vào ô (lặp liền ô theo modulo) */
export function genCaustic(): TexData {
  const N = 512;
  const R = 1024; // lưới tia
  const f = waveField(22, 7, 1.2);
  const acc = new Float32Array(N * N);
  // độ lệch tia tỉ lệ với độ dốc; chuẩn hoá theo độ dốc RMS để tia vừa chớm hội tụ (mạng lưới sáng mảnh, không gấp nếp)
  let rms = 0;
  for (let k = 0; k < 4096; k++) {
    const [dx, dy] = f(Math.random(), Math.random());
    rms += dx * dx + dy * dy;
  }
  rms = Math.sqrt(rms / 4096);
  const K = 0.022 / rms;
  for (let j = 0; j < R; j++)
    for (let i = 0; i < R; i++) {
      const x = (i + 0.5) / R;
      const y = (j + 0.5) / R;
      const [dx, dy] = f(x, y);
      const ox = -dx * K;
      const oy = -dy * K;
      const u = (((x + ox) % 1) + 1) % 1;
      const v = (((y + oy) % 1) + 1) % 1;
      // phân bố song tuyến vào 4 ô
      const fx = u * N - 0.5;
      const fy = v * N - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;
      const put = (a: number, b: number, w: number) => (acc[(((b % N) + N) % N) * N + (((a % N) + N) % N)] += w);
      put(ix, iy, (1 - tx) * (1 - ty));
      put(ix + 1, iy, tx * (1 - ty));
      put(ix, iy + 1, (1 - tx) * ty);
      put(ix + 1, iy + 1, tx * ty);
    }
  // làm mờ 1 lượt 3×3 + chuẩn hoá: trung bình = (R/N)² ; giữ đường sáng (> trung bình) và nén
  const mean = (R / N) ** 2;
  const out = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) s += acc[(((j + b) % N + N) % N) * N + (((i + a) % N + N) % N)] * (a === 0 && b === 0 ? 4 : a === 0 || b === 0 ? 2 : 1);
      s /= 16;
      const v = Math.min(1, Math.max(0, (s / mean - 0.85) / 1.8));
      const k = (j * N + i) * 4;
      out[k] = out[k + 1] = out[k + 2] = Math.round(Math.pow(v, 0.85) * 255);
      out[k + 3] = 255;
    }
  return { name: "caustic", size: N, data: out };
}
/** vệt nước chảy: nhiễu tuần hoàn kéo dài 16× theo trục dọc (v) → các dải trắng dài không đều */
export function genStreak(): TexData {
  seed = 4242;
  const N = 256;
  const n = periodicNoise(32);
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / N) * 32;
      const y = (j / N) * 2;
      const a = fbmP(n, x, y, 3, 32);
      const b = fbmP(n, x * 2 + 7, y * 4 + 3, 2, 32);
      const k = (j * N + i) * 4;
      d[k] = Math.round(Math.min(1, Math.max(0, (a - 0.35) * 2.2)) * 255);
      d[k + 1] = Math.round(b * 255);
      d[k + 2] = 0;
      d[k + 3] = 255;
    }
  return { name: "streak", size: N, data: d };
}
/** nhiễu đa dụng RGBA 512² (tuần hoàn): R vân đá uốn miền · G vân phụ · B sắc độ (fbm thô) · A nhiễu mịn */
export function genNoise(): TexData {
  seed = 777;
  const N = 512;
  const P = 16;
  const n = periodicNoise(P);
  const n2 = periodicNoise(P * 2);
  const d = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = (i / N) * P;
      const y = (j / N) * P;
      const w = fbmP(n, x * 0.5 + 3.1, y * 0.5 + 1.7, 3, P);
      const v1 = fbmP(n, x + w * 2.4, y + w * 1.6, 4, P);
      const v2 = fbmP(n2, x * 2, y * 2, 4, P * 2);
      const tone = fbmP(n, x * 0.5, y * 0.5, 3, P);
      const fine = n2(x * 2 + 0.5, y * 2 + 0.5);
      const k = (j * N + i) * 4;
      d[k] = Math.round(v1 * 255);
      d[k + 1] = Math.round(v2 * 255);
      d[k + 2] = Math.round(tone * 255);
      d[k + 3] = Math.round(fine * 255);
    }
  return { name: "noise", size: N, data: d };
}
