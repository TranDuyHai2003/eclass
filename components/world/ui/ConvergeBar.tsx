"use client";
/**
 * Thanh tiến độ "hội tụ" (ý từ rayshader 1.0): một sa bàn z = f(x, y) như đang được DÒ TIA (path tracing) —
 *  • nhiễu Monte Carlo ∝ 1/√N, N = số mẫu tia sáng mỗi điểm ảnh (gấp đôi sau mỗi 1/12 tiến độ) → 100 % = ảnh sạch;
 *  • "mặt cắt" dựng hình chạy từ trái sang phải đúng bằng tiến độ: bên phải còn là ô dựng (bucket) nhiễu nặng;
 *  • mặt trời quét theo tiến độ, bóng đổ mềm, mặt cắt đất kiểu sa bàn.
 * Biến thể theo thế giới: tổng Riemann (Quảng trường), khối voxel chồng dần (Vùng Kỳ quan), chuỗi Fourier thêm hoạ âm
 * thành sóng vuông (Mê cung Hoạ âm), cầu thang Penrose (Sảnh Bất Khả), địa hình có đường đồng mức (còn lại).
 * Một canvas WebGL nhỏ (~0,6× độ phân giải CSS), vẽ ≤ 30 khung / giây, dừng khi tab ẩn. Tiến độ hiển thị đuổi theo mục tiêu
 * THẬT bằng lò xo tắt dần tới hạn (không vượt, không lùi). Không có WebGL → thanh CSS.
 */
import { useEffect, useRef, useState } from "react";
import { approach, CONVERGE_MODE, counterOf, FORMULA, MODE_INDEX, harmonicsAt, noiseOf, pctOf, riemannN, samplesAt, squareWavePartial, stepsAt, type ConvergeMode } from "@/lib/world/loadProgress";
import type { Lang } from "@/lib/world/i18n";
import { REALM_PALETTE } from "./WormholeTravel";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
uniform vec2 uRes; uniform float uT; uniform float uP; uniform float uMode; uniform float uN; uniform float uS;
uniform float uSeed; uniform float uAX; uniform vec3 uA; uniform vec3 uB; uniform sampler2D uLut;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float terrain(vec2 q){
  vec2 a = q - vec2(0.9, 0.15); vec2 b = q - vec2(-1.7, -0.25); vec2 c = q - vec2(3.2, 0.3);
  return 0.24 + 0.12 * sin(1.7 * q.x + 0.6) * cos(2.3 * q.y - 0.4) + 0.07 * sin(3.1 * q.x - 1.2 * q.y + 1.0)
    + 0.30 * exp(-dot(a, a) * 2.2) + 0.22 * exp(-dot(b, b) * 3.0) + 0.18 * exp(-dot(c, c) * 2.5);
}
float fcurve(float x){ return 0.30 + 0.17 * sin(1.1 * x + 0.4) + 0.08 * sin(2.6 * x + 1.3); }
float H0(vec2 q){
  if (uMode < 0.5) return max(terrain(q), 0.16);
  if (uMode < 1.5) {
    float w = 2.0 * uAX / uN;
    float u = (q.x + uAX) / w;
    float hb = fcurve(-uAX + floor(u) * w);
    float inBar = step(abs(q.y), 0.6) * step(0.07, fract(u));
    return mix(0.03, hb, inBar);
  }
  if (uMode < 2.5) {
    float s = 0.24;
    vec2 c = (floor(q / s) + 0.5) * s;
    float h = floor(terrain(c) * 9.0) / 9.0;
    float u = (c.x + uAX) / (2.0 * uAX);
    float rise = clamp((uP * 1.12 - u) * 7.0 + hash(c) * 0.4 - 0.2, 0.0, 1.0);
    return max(0.03, floor(h * rise * 9.0 + 0.5) / 9.0);
  }
  if (uMode < 3.5) {
    float x = q.x * 1.9 + 0.3;
    // tổng riêng Fourier tính sẵn trên CPU (1 chu kỳ 2π, 256 mẫu) — rẻ hơn 16 lần sin mỗi lần gọi H
    float s = texture2D(uLut, vec2(x / 6.2831853, 0.5)).r * 2.4 - 1.2;
    float band = smoothstep(0.78, 0.55, abs(q.y));
    return 0.05 + band * (0.27 + 0.16 * s);
  }
  float cell = 1.7;
  float ix = floor(q.x / cell + 0.5);
  vec2 l = vec2(q.x - ix * cell, q.y * 1.1);
  float r = length(l);
  float a = fract(atan(l.y, l.x) / 6.2831853 + 0.5 + uT * 0.04 + ix * 0.37);
  float st = floor(a * uN) / uN;
  return mix(0.04, 0.1 + 0.5 * st, step(0.3, r) * step(r, 0.74));
}
// phóng đại độ cao (kiểu sa bàn rayshader: núi nhô hẳn lên khỏi mặt bàn)
float H(vec2 q){ return H0(q) * 1.55; }
float shade(vec3 p, vec3 L){
  float res = 1.0; float t = 0.03;
  for (int i = 0; i < 12; i++) {
    vec3 q = p + L * t;
    if (q.z > 1.3) break;
    float d = q.z - H(q.xy);
    res = min(res, 10.0 * d / t);
    if (res < 0.0) return 0.0;
    t += 0.13;
  }
  return clamp(res, 0.0, 1.0);
}
void main(){
  vec2 s = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float k = 2.05; float e = 0.44;
  vec3 d = vec3(0.0, cos(e), -sin(e));
  vec3 up = vec3(0.0, sin(e), cos(e));
  vec3 ro = vec3(s.x * k, 0.0, 0.34) + up * (s.y * k) - d * 4.0;
  vec3 bmin = vec3(-uAX, -1.0, -0.3); vec3 bmax = vec3(uAX, 1.0, 1.3);
  vec3 inv = 1.0 / d;
  vec3 t0 = (bmin - ro) * inv; vec3 t1 = (bmax - ro) * inv;
  vec3 tmin = min(t0, t1); vec3 tmax = max(t0, t1);
  float tN = max(max(tmin.x, tmin.y), tmin.z);
  float tF = min(min(tmax.x, tmax.y), tmax.z);
  float u = gl_FragCoord.x / uRes.x;
  vec3 col = vec3(0.0); float alpha = 0.0;
  if (tN < tF) {
    vec3 p = ro + d * tN;
    vec3 n; bool side = false; bool hit = false;
    if (p.z < H(p.xy) + 0.0005 && tN != tmin.z) {
      side = true; hit = true;
      n = tN == tmin.y ? vec3(0.0, -1.0, 0.0) : tN == tmin.x ? vec3(-sign(d.x), 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
      if (abs(p.x) > uAX - 0.001) n = vec3(sign(p.x), 0.0, 0.0);
    } else {
      float dt = (tF - tN) / 44.0; float t = tN;
      for (int i = 0; i < 44; i++) {
        t += dt; p = ro + d * t;
        if (p.z < H(p.xy)) { hit = true; break; }
      }
      if (hit) {
        float a = t - dt; float b = t;
        for (int i = 0; i < 4; i++) { float m = 0.5 * (a + b); vec3 q = ro + d * m; if (q.z < H(q.xy)) b = m; else a = m; }
        p = ro + d * b;
        float ee = 0.014;
        n = normalize(vec3(H(p.xy - vec2(ee, 0.0)) - H(p.xy + vec2(ee, 0.0)), H(p.xy - vec2(0.0, ee)) - H(p.xy + vec2(0.0, ee)), 2.0 * ee));
      }
    }
    if (hit) {
      alpha = 1.0;
      float az = mix(2.5, 0.65, uP) + 0.12 * sin(uT * 0.35);
      vec3 L = normalize(vec3(cos(az) * 0.78, sin(az) * 0.78, 0.62));
      float h = p.z;
      vec3 alb;
      if (side) {
        float strata = 0.82 + 0.18 * step(0.5, fract(p.z * 9.0 + 0.3 * sin(p.x * 3.0)));
        alb = mix(uB * 0.3, uB * 0.62, smoothstep(-0.3, 0.3, p.z)) * strata;
      } else {
        alb = mix(uB * 0.7, uA, smoothstep(0.08, 0.9, h));
        alb = mix(alb, vec3(1.0), smoothstep(0.8, 1.1, h) * 0.6);
        if (uMode < 0.5) {
          if (terrain(p.xy) < 0.16) alb = mix(uB, vec3(0.55, 0.85, 1.0), 0.45);
          float c = abs(fract(h * 9.0) - 0.5);
          alb *= 1.0 - 0.28 * smoothstep(0.44, 0.5, c);
        } else if (uMode < 1.5 && h > 0.05) {
          float err = fcurve(p.x) * 1.55 - h;
          alb = mix(alb, err > 0.0 ? vec3(0.45, 0.95, 1.0) : vec3(1.0, 0.45, 0.55), clamp(abs(err) * 9.0, 0.0, 0.85));
        } else if (uMode < 3.5 && uMode > 2.5) {
          alb = mix(alb, vec3(1.0, 0.85, 0.95), smoothstep(0.65, 0.78, h) * 0.6);
        }
      }
      float dif = max(dot(n, L), 0.0) * (side ? 0.8 : shade(p + n * 0.004, L));
      float sky = 0.38 + 0.25 * n.z;
      col = alb * (dif * vec3(1.25, 1.12, 0.95) + sky * vec3(0.55, 0.62, 0.95));
      col += pow(max(dot(reflect(-L, n), -d), 0.0), 24.0) * 0.25 * dif;
    }
  }
  // dò tia hội tụ: bên trái mặt cắt N = uS mẫu, bên phải 1 mẫu (ô dựng chưa xong)
  float front = uP;
  float rendered = smoothstep(front + 0.004, front - 0.004, u);
  float amp = mix(1.0, uS, rendered);
  vec2 px = floor(gl_FragCoord.xy);
  vec3 rn = vec3(hash(px + uSeed), hash(px + uSeed + 17.3), hash(px + uSeed + 41.9)) - 0.5;
  float lum = dot(col, vec3(0.3, 0.59, 0.11));
  col = max(col * (1.0 + amp * 1.6 * (rn.x + 0.35 * rn)), 0.0);
  float fire = step(1.0 - 0.02 * amp, hash(px * 1.7 + uSeed * 3.1));
  col += fire * alpha * vec3(1.6, 1.4, 1.1);
  col = mix(vec3(lum) * vec3(0.7, 0.75, 1.0) * 0.6, col, 0.25 + 0.75 * rendered);
  // ô dựng (bucket) chưa xong + vạch mặt cắt phát sáng
  vec2 bk = abs(fract(gl_FragCoord.xy / 16.0) - 0.5);
  float grid = (1.0 - rendered) * step(0.44, max(bk.x, bk.y)) * 0.18;
  col += uA * grid;
  alpha = max(alpha, grid);
  float glow = exp(-abs(u - front) * uRes.x * 0.22) * step(uP, 0.999);
  col += uA * glow * 1.4;
  alpha = max(alpha, glow);
  col = col / (1.0 + col * 0.55);
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col * alpha, alpha);
}`;

const LUT_N = 256;
const lin = (h: string) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2) as [number, number, number];

export interface BarFeed {
  target: number;
  ready: boolean;
}

/**
 * feed(): mục tiêu thật hiện tại (đọc mỗi khung); onDisplay: báo giá trị đang HIỂN THỊ (để màn chờ chỉ tắt khi thanh đã đầy).
 */
export function ConvergeBar({ scene, lang, feed, onDisplay, reduced }: { scene: string; lang: Lang; feed: () => BarFeed; onDisplay?: (p: number) => void; reduced: boolean }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const nRef = useRef<HTMLSpanElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [gl1, setGl1] = useState(true);
  const mode: ConvergeMode = CONVERGE_MODE[scene] ?? "relief";
  const feedRef = useRef(feed);
  const dispRef = useRef(onDisplay);
  useEffect(() => {
    feedRef.current = feed;
    dispRef.current = onDisplay;
  });
  useEffect(() => {
    const c = cv.current;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = c?.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "low-power" }) ?? null;
    } catch {}
    const sh = (type: number, src: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (process.env.NODE_ENV !== "production" && !gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) console.warn("[ConvergeBar] shader:", gl!.getShaderInfoLog(s));
      return s;
    };
    let prog: WebGLProgram | null = null;
    let buf: WebGLBuffer | null = null;
    let lut: WebGLTexture | null = null;
    if (gl) {
      prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl.deleteProgram(prog);
        prog = null;
        gl = null;
      }
    }
    if (!gl || !prog || !c) setGl1(false);
    const U: Record<string, WebGLUniformLocation | null> = {};
    if (gl && prog && c) {
      gl.useProgram(prog);
      buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ["uRes", "uT", "uP", "uMode", "uN", "uS", "uSeed", "uAX", "uA", "uB"]) U[k] = gl.getUniformLocation(prog, k);
      const pal = REALM_PALETTE[scene] ?? REALM_PALETTE.hub;
      gl.uniform3fv(U.uA, lin(pal[0]));
      gl.uniform3fv(U.uB, lin(pal[1]));
      gl.uniform1f(U.uMode, MODE_INDEX[mode]);
      gl.clearColor(0, 0, 0, 0);
      // bảng tra 1D cho chế độ Fourier (lặp tuần hoàn 2π: kích thước luỹ thừa 2 + REPEAT)
      lut = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, lut);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, LUT_N, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(LUT_N).fill(128));
      gl.uniform1i(gl.getUniformLocation(prog, "uLut"), 0);
    }
    const fit = () => {
      if (!gl || !c) return;
      // độ phân giải thấp (~0,6×): nhiễu hạt là chủ ý, rẻ cho máy yếu
      const s = Math.min(1, window.devicePixelRatio || 1) * 0.6;
      c.width = Math.max(64, Math.round(c.clientWidth * s));
      c.height = Math.max(16, Math.round(c.clientHeight * s));
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(U.uRes, c.width, c.height);
      // nửa bề ngang sa bàn theo tỉ lệ khung (k = 1,9 đơn vị / chiều cao)
      gl.uniform1f(U.uAX, (c.width / c.height) * 0.5 * 1.9 * 0.94);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (c) ro.observe(c);
    let x = 0;
    let v = 0;
    let last = performance.now();
    let lastDraw = 0;
    let raf = 0;
    let lastPct = -1;
    let lastN = -1;
    let lutN = -1;
    const t0 = last;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const f = feedRef.current();
      [x, v] = approach(x, v, f.target, dt, reduced ? 12 : 6.5);
      if (f.ready && f.target >= 1 && x > 0.995) x = 1;
      dispRef.current?.(x);
      const pct = pctOf(x, f.ready);
      if (pct !== lastPct && pctRef.current) {
        pctRef.current.textContent = `${pct}%`;
        pctRef.current.setAttribute("aria-valuenow", String(pct));
      }
      lastPct = pct;
      if (railRef.current) railRef.current.style.transform = `scaleX(${x.toFixed(4)})`;
      const cnt = counterOf(mode, x);
      if (cnt.n !== lastN && nRef.current) nRef.current.textContent = `N = ${cnt.n.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} ${cnt.unit[lang]}`;
      lastN = cnt.n;
      if (!gl || document.hidden || now - lastDraw < 32) return;
      lastDraw = now;
      const modeN = mode === "riemann" ? riemannN(x) : mode === "fourier" ? harmonicsAt(x) : mode === "penrose" ? stepsAt(x) : 1;
      gl.uniform1f(U.uT, reduced ? 0 : (now - t0) / 1000);
      gl.uniform1f(U.uP, x);
      gl.uniform1f(U.uN, modeN);
      if (mode === "fourier" && modeN !== lutN) {
        lutN = modeN;
        const d = new Uint8Array(LUT_N);
        for (let i = 0; i < LUT_N; i++) d[i] = Math.round(Math.min(1, Math.max(0, (squareWavePartial(((i + 0.5) / LUT_N) * Math.PI * 2, modeN) + 1.2) / 2.4)) * 255);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LUT_N, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, d);
      }
      gl.uniform1f(U.uS, x >= 1 ? 0 : noiseOf(samplesAt(x)));
      // giảm chuyển động: nhiễu đứng yên (chỉ đổi khi N đổi), không nhấp nháy theo khung
      gl.uniform1f(U.uSeed, reduced ? samplesAt(x) % 97 : (now * 0.0137) % 97);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (gl) {
        if (prog) gl.deleteProgram(prog);
        if (buf) gl.deleteBuffer(buf);
        if (lut) gl.deleteTexture(lut);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dựng một lần cho mỗi thế giới
  }, [scene, mode, reduced]);
  return (
    <div className={`w-cvg${gl1 ? "" : " w-cvg--flat"}`}>
      <div className="w-cvg__plate">
        <canvas ref={cv} className="w-cvg__cv" aria-hidden />
        <i className="w-cvg__rail">
          <i ref={railRef} />
        </i>
      </div>
      <div className="w-cvg__meta">
        <span ref={nRef} className="w-cvg__n" />
        <span className="w-cvg__f">{FORMULA[mode]}</span>
        <span ref={pctRef} className="w-cvg__pct" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
          0%
        </span>
      </div>
    </div>
  );
}
