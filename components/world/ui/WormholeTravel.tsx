"use client";
/**
 * Wormhole travel between realms — a real-time fragment-shader tunnel (own tiny WebGL canvas, ~2 s):
 *  enter (the throat opens from the centre) → travel (log-polar tunnel: stars stretched into streaks by speed,
 *  an Einstein ring where light bends round the throat, slight chromatic split at the rim, palette shifts from the
 *  source realm to the destination) → exit (the white mouth swells and floods the screen, then reveals the new realm).
 * The realm swap happens mid-flight (onSwap), hidden inside the tunnel.
 */
import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float;
uniform vec2 uRes; uniform float uT; uniform float uK; uniform vec3 uA; uniform vec3 uB;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 tunnel(vec2 uv, float t, float k){
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  // Toạ độ log-cực: ống đi xa vô hạn vào tâm
  float z = 0.42 / max(r, 0.001) + t * (2.2 + 6.0 * k);
  float u = a / 6.2831853;
  // Vệt sao: mỗi ô (góc, độ sâu) một ngôi sao, bị kéo dài theo vận tốc
  vec2 cell = vec2(floor(u * 64.0), floor(z * 2.0));
  float h = hash(cell);
  float streak = step(0.86, h) * smoothstep(0.0, 0.5, fract(z * 2.0)) * (1.0 - smoothstep(0.5, 1.0, fract(z * 2.0)));
  streak *= smoothstep(0.02, 0.0, abs(fract(u * 64.0) - 0.5) / 64.0 * 8.0);
  // Thành ống: vằn xoắn + lưới toạ độ toán học mờ
  float swirl = 0.5 + 0.5 * sin(a * 6.0 + z * 3.0);
  float grid = smoothstep(0.96, 1.0, abs(sin(z * 6.2831853 * 0.5))) * 0.35;
  vec3 wall = mix(uA, uB, clamp(k * 1.2 - 0.1, 0.0, 1.0)) * (0.25 + 0.55 * swirl) + grid;
  // Vành Einstein: ánh sáng bị bẻ cong thành vòng sáng quanh họng
  float ring = exp(-pow((r - 0.22) * 22.0, 2.0)) * (0.8 + 0.4 * sin(a * 3.0 + t * 4.0));
  vec3 col = wall * smoothstep(0.0, 0.25, r) + vec3(1.0, 0.95, 0.9) * streak * 1.6 + vec3(0.85, 0.9, 1.0) * ring;
  // Cửa ra: lỗ trắng ở tâm lớn dần cuối hành trình
  float mouth = smoothstep(0.05 + k * 1.6, 0.0 + k * 1.4, r) * smoothstep(0.55, 1.0, k);
  return mix(col, vec3(1.0), mouth);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // Tách sắc nhẹ ở rìa (thấu kính hấp dẫn)
  vec2 off = uv * 0.012 * length(uv);
  vec3 c;
  c.r = tunnel(uv + off, uT, uK).r;
  c.g = tunnel(uv, uT, uK).g;
  c.b = tunnel(uv - off, uT, uK).b;
  float vig = 1.0 - smoothstep(0.6, 1.25, length(uv));
  gl_FragColor = vec4(c * (0.55 + 0.45 * vig), 1.0);
}`;

export type RealmPalette = [string, string];
export const REALM_PALETTE: Record<string, RealmPalette> = {
  hub: ["#7fb6ff", "#ffd27a"],
  study: ["#e9ad62", "#46576c"],
  expanse: ["#5fd07a", "#7fd8ff"],
  valley: ["#ff9ecb", "#9fe6ff"],
  impossible: ["#b48cff", "#4b4dff"],
  siren: ["#ff5fb0", "#6a3fd0"],
  babel: ["#e0a85a", "#6e2433"],
  paradox: ["#ffd27a", "#3a2a7a"],
};
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

export const TRAVEL_MS = 2000;

export function WormholeTravel({ from, to, onSwap, onDone }: { from: string; to: string; onSwap: () => void; onDone: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = cv.current;
    const gl = c?.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!c || !gl) {
      onSwap();
      onDone();
      return;
    }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uT = gl.getUniformLocation(prog, "uT");
    const uK = gl.getUniformLocation(prog, "uK");
    gl.uniform3fv(gl.getUniformLocation(prog, "uA"), hex((REALM_PALETTE[from] ?? REALM_PALETTE.hub)[0]));
    gl.uniform3fv(gl.getUniformLocation(prog, "uB"), hex((REALM_PALETTE[to] ?? REALM_PALETTE.hub)[1]));
    // Độ phân giải thấp hơn màn hình (nhẹ cho điện thoại; ống mờ chuyển động nên không thấy khác)
    const dpr = Math.min(1, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = Math.round(c.clientWidth * dpr * 0.75);
      c.height = Math.round(c.clientHeight * dpr * 0.75);
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uRes, c.width, c.height);
    };
    resize();
    const t0 = performance.now();
    let swapped = false;
    let raf = 0;
    const frame = () => {
      const ms = performance.now() - t0;
      const k = Math.min(1, ms / TRAVEL_MS);
      gl.uniform1f(uT, ms / 1000);
      gl.uniform1f(uK, k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Mở họng: mặt nạ tròn lớn dần từ tâm; cuối: tan dần lộ cảnh mới
      if (wrap.current) {
        const open = Math.min(1, ms / 350);
        wrap.current.style.clipPath = `circle(${(open * open * 75).toFixed(1)}% at 50% 50%)`;
        wrap.current.style.opacity = String(k > 0.88 ? Math.max(0, 1 - (k - 0.88) / 0.12) : 1);
      }
      if (!swapped && ms > TRAVEL_MS * 0.45) {
        swapped = true;
        onSwap();
      }
      if (k < 1) raf = requestAnimationFrame(frame);
      else onDone();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0 z-[60]" style={{ clipPath: "circle(0% at 50% 50%)" }}>
      <canvas ref={cv} className="h-full w-full" />
    </div>
  );
}
