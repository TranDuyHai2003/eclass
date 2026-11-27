"use client";
/**
 * Nước "như thật" giá rẻ cho quảng trường:
 *  • WIND — gió dùng chung (hướng xoay chậm + cơn gió giật) cho cỏ, cây, mặt nước, tia phun.
 *  • RippleSim — mô phỏng sóng trên GPU: trường độ cao giải phương trình sóng (ping-pong 2 render target half-float),
 *    giọt nước / tia phun rơi xuống = "đánh" một chỗ lõm → gợn lan ra, phản xạ thành hồ, giao thoa. ~0,1 ms / bước.
 *  • waterShader — mặt nước: pháp tuyến = gradient trường sóng + sóng lăn tăn theo gió (3 tầng), fresnel Schlick,
 *    khúc xạ: đáy hồ xanh ngọc + ánh sóng (caustics) lệch theo pháp tuyến + đậm dần theo độ sâu,
 *    phản chiếu: mặt phẳng thật (Reflector, khi bật "phản chiếu") hoặc bầu trời giải tích, đốm nắng lấp lánh, bọt ở chỗ sóng mạnh.
 */
import * as THREE from "three";

export const WIND = {
  dir: { value: new THREE.Vector2(0.85, 0.52) },
  t: { value: 0 },
  gust: { value: 0.5 },
};
/** cập nhật gió mỗi khung hình (gọi 1 lần ở cảnh) */
export function tickWind(t: number) {
  WIND.t.value = t;
  const a = 0.55 + Math.sin(t * 0.05) * 0.35;
  WIND.dir.value.set(Math.cos(a), Math.sin(a));
  WIND.gust.value = 0.45 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1.3) + 0.15 * Math.sin(t * 1.7);
}

const QUAD_VS = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const STEP_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex; uniform vec2 uDelta; uniform vec4 uDrops[8]; uniform int uN; uniform float uDamp;
  varying vec2 vUv;
  void main(){
    vec4 info = texture2D(uTex, vUv);
    float avg = (texture2D(uTex, vUv - vec2(uDelta.x, 0.0)).r + texture2D(uTex, vUv + vec2(uDelta.x, 0.0)).r +
                 texture2D(uTex, vUv - vec2(0.0, uDelta.y)).r + texture2D(uTex, vUv + vec2(0.0, uDelta.y)).r) * 0.25;
    info.g += (avg - info.r) * 2.0;
    info.g *= uDamp;
    info.r += info.g;
    for (int i = 0; i < 8; i++) {
      if (i >= uN) break;
      float d = max(0.0, 1.0 - length(uDrops[i].xy - vUv) / uDrops[i].z);
      d = 0.5 - cos(d * 3.14159265) * 0.5;
      info.r += d * uDrops[i].w;
    }
    // thành hồ tròn: ngoài đĩa = 0 (sóng dội lại)
    float edge = smoothstep(0.5, 0.48, length(vUv - 0.5));
    info.r *= edge; info.g *= edge;
    gl_FragColor = info;
  }`;

export class RippleSim {
  readonly size: number;
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private drops: THREE.Vector4[] = [];
  private acc = 0;
  constructor(size = 128) {
    this.size = size;
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(size, size, opt);
    this.b = new THREE.WebGLRenderTarget(size, size, opt);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null }, uDelta: { value: new THREE.Vector2(1 / size, 1 / size) }, uDrops: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uN: { value: 0 }, uDamp: { value: 0.986 } },
      vertexShader: QUAD_VS,
      fragmentShader: STEP_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }
  get texture() {
    return this.a.texture;
  }
  /** giọt rơi tại (u, v) ∈ [0,1]², bán kính r (đơn vị uv), độ mạnh s (âm = lõm xuống) */
  drop(u: number, v: number, r: number, s: number) {
    if (this.drops.length < 8) this.drops.push(new THREE.Vector4(u, v, r, s));
  }
  /** bước cố định 60 Hz (tối đa 2 bước / khung để không "đuổi" khi tụt FPS) */
  step(gl: THREE.WebGLRenderer, dt: number) {
    this.acc = Math.min(this.acc + dt, 2 / 60);
    const prev = gl.getRenderTarget();
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      const d = this.mat.uniforms.uDrops.value as THREE.Vector4[];
      this.drops.forEach((x, i) => d[i].copy(x));
      this.mat.uniforms.uN.value = this.drops.length;
      this.drops = [];
      this.mat.uniforms.uTex.value = this.a.texture;
      gl.setRenderTarget(this.b);
      gl.render(this.scene, this.cam);
      [this.a, this.b] = [this.b, this.a];
    }
    gl.setRenderTarget(prev);
  }
  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.mat.dispose();
  }
}

/**
 * Bộ đệm BỌT trên GPU (cùng lưới với trường sóng): mỗi bước 60 Hz
 *   bọt cũ bị sóng đẩy trôi (advection theo độ dốc trường sóng) → khuếch tán nhẹ → tan dần (nửa đời ~1,1 s) → cộng "dấu" mới
 *   (vệt sau lưng khi lội, vòng sóng khi nhảy xuống, chỗ tia phun rơi, nhát chém xuống nước).
 * Kết quả: bọt LAN RA và trôi theo sóng như Genshin / Wuthering Waves, chứ không chỉ loé tại chỗ.
 */
const FOAM_FS = /* glsl */ `
  precision highp float;
  uniform sampler2D uPrev; uniform sampler2D uWave; uniform vec2 uDelta; uniform vec4 uStamps[16]; uniform int uN; uniform float uDecay; uniform float uDt;
  varying vec2 vUv;
  void main(){
    float hL = texture2D(uWave, vUv - vec2(uDelta.x, 0.0)).r, hR = texture2D(uWave, vUv + vec2(uDelta.x, 0.0)).r;
    float hD = texture2D(uWave, vUv - vec2(0.0, uDelta.y)).r, hU = texture2D(uWave, vUv + vec2(0.0, uDelta.y)).r;
    // sóng đẩy bọt xuống dốc (bọt dồn về chân sóng lan ra)
    vec2 vel = -vec2(hR - hL, hU - hD) * 3.0;
    // dòng xoáy chậm quanh hồ (8 tia phun đẩy nước vòng quanh tượng) → bọt trôi thành dải cong, không đứng yên
    vel += vec2(-(vUv.y - 0.5), vUv.x - 0.5) * 0.035;
    vec2 src = vUv - vel * uDt;
    float f = texture2D(uPrev, src).r;
    float avg = (texture2D(uPrev, src + vec2(uDelta.x, 0.0)).r + texture2D(uPrev, src - vec2(uDelta.x, 0.0)).r +
                 texture2D(uPrev, src + vec2(0.0, uDelta.y)).r + texture2D(uPrev, src - vec2(0.0, uDelta.y)).r) * 0.25;
    f = mix(f, avg, 0.12) * uDecay;
    for (int i = 0; i < 16; i++) {
      if (i >= uN) break;
      vec4 s = uStamps[i];
      float d = length(vUv - s.xy) / abs(s.z);
      // z > 0: đĩa đặc; z < 0: vành (vòng sóng trắng)
      float m = s.z > 0.0 ? smoothstep(1.0, 0.35, d) : exp(-pow((d - 1.0) * 6.0, 2.0));
      f += s.w * m;
    }
    f *= smoothstep(0.5, 0.485, length(vUv - 0.5));
    gl_FragColor = vec4(clamp(f, 0.0, 1.6), 0.0, 0.0, 1.0);
  }`;

export class FoamSim {
  private a: THREE.WebGLRenderTarget;
  private b: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private stamps: THREE.Vector4[] = [];
  private acc = 0;
  constructor(size = 128) {
    const opt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false } as const;
    this.a = new THREE.WebGLRenderTarget(size, size, opt);
    this.b = new THREE.WebGLRenderTarget(size, size, opt);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uPrev: { value: null }, uWave: { value: null }, uDelta: { value: new THREE.Vector2(1 / size, 1 / size) }, uStamps: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, uN: { value: 0 }, uDecay: { value: 0.9896 }, uDt: { value: 1 / 60 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: FOAM_FS,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }
  get texture() {
    return this.a.texture;
  }
  /** đĩa bọt tại (u, v), bán kính r (uv), lượng k; r < 0 = vành bán kính |r| */
  stamp(u: number, v: number, r: number, k: number) {
    if (this.stamps.length < 16) this.stamps.push(new THREE.Vector4(u, v, r, k));
  }
  step(gl: THREE.WebGLRenderer, dt: number, wave: THREE.Texture) {
    this.acc = Math.min(this.acc + dt, 2 / 60);
    const prev = gl.getRenderTarget();
    while (this.acc >= 1 / 60) {
      this.acc -= 1 / 60;
      const d = this.mat.uniforms.uStamps.value as THREE.Vector4[];
      this.stamps.forEach((x, i) => d[i].copy(x));
      this.mat.uniforms.uN.value = this.stamps.length;
      this.stamps = [];
      this.mat.uniforms.uPrev.value = this.a.texture;
      this.mat.uniforms.uWave.value = wave;
      gl.setRenderTarget(this.b);
      gl.render(this.scene, this.cam);
      [this.a, this.b] = [this.b, this.a];
    }
    gl.setRenderTarget(prev);
  }
  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.mat.dispose();
  }
}

/**
 * Shader mặt nước anime theo công thức "layered" (nghiên cứu: reverse-engineering nước Genshin, Uber Stylized Water,
 * Valve Water Flow; brainstorm cùng ChatGPT — xem docs/ai-reviews/game-3d/WATER.md):
 *  • pháp tuyến 4 lớp: macro 5 m / medium 1,4 m / micro 0,32 m (normal map lặp, trôi chậm) + trường sóng mô phỏng ×0,65;
 *    phản xạ chỉ dùng macro+medium+sóng, lấp lánh dùng cả micro (micro tắt dần theo khoảng cách → không nhiễu).
 *  • màu: LUT 5 nấc theo quãng đường ánh sáng trong nước (#D5F8EF → #218BAE), độ truyền qua theo từng kênh exp(−σ·d),
 *    σ = (1,25; 0,38; 0,16) → đỏ tắt nhanh, nước trong xanh ngọc.
 *  • Fresnel F0 0,025, mũ 4, phản xạ ×0,75 (mặt phẳng thật hoặc trời), độ bão hoà phản xạ 0,9.
 *  • specular 3 tầng: ánh rộng (48 · 0,12) + điểm gắt cắt ngưỡng (384 → 0,35) + lấp lánh thưa (mặt nạ nhiễu 0,72–0,84, ~2% mặt).
 *  • bọt: vạch mảnh liền ở mép (analytic SDF) + dải đứt đoạn ngoài + bọt ở chỗ sóng mạnh (tia rơi, người lội).
 */
export function waterShader(opts: { radius: number; inner?: number; sun: THREE.Vector3; depth: number; center?: THREE.Vector2 }) {
  return {
    name: "PlazaWater",
    uniforms: {
      color: { value: new THREE.Color(1, 1, 1) },
      tDiffuse: { value: null as THREE.Texture | null },
      textureMatrix: { value: new THREE.Matrix4() },
      tHeight: { value: null as THREE.Texture | null },
      uNormal: { value: null as THREE.Texture | null },
      uNoise: { value: null as THREE.Texture | null },
      uLUT: { value: null as THREE.Texture | null },
      uFoamTex: { value: null as THREE.Texture | null },
      uLace: { value: null as THREE.Texture | null },
      uRings: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)) },
      uLevel: { value: 1 },
      uPlanar: { value: 0 },
      uSun: { value: opts.sun.clone() },
      uSunCol: { value: new THREE.Color("#FFF8E5") },
      uR: { value: opts.radius },
      uInner: { value: opts.inner ?? 0 },
      uC: { value: opts.center ?? new THREE.Vector2() },
      uDepth: { value: opts.depth },
      uWindDir: WIND.dir,
      uT: WIND.t,
      uGust: WIND.gust,
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vRefl; varying vec3 vW; varying vec2 vUv;
      void main(){
        vUv = uv;
        vRefl = textureMatrix * vec4(position, 1.0);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform sampler2D tHeight; uniform sampler2D uNormal; uniform sampler2D uNoise; uniform sampler2D uLUT;
      uniform sampler2D uFoamTex; uniform sampler2D uLace; uniform vec4 uRings[8]; uniform float uLevel;
      uniform float uPlanar; uniform vec3 uSun; uniform vec3 uSunCol;
      uniform float uR; uniform float uInner; uniform vec2 uC; uniform float uDepth;
      uniform vec2 uWindDir; uniform float uT; uniform float uGust;
      varying vec4 vRefl; varying vec3 vW; varying vec2 vUv;
      vec2 slope(vec2 p, float scale, vec2 spd){ return texture2D(uNormal, p / scale + spd * uT).rg * 2.0 - 1.0; }
      void main(){
        vec2 p = vW.xz;
        float dist = length(cameraPosition - vW);
        float g = 0.7 + uGust * 0.6;
        vec2 sMacro = slope(p, 5.0, vec2(0.013, 0.009) + uWindDir * 0.004) * 0.07 * g;
        vec2 sMed = slope(p, 1.4, vec2(-0.026, 0.018)) * 0.12 * g;
        vec2 sMicro = slope(p, 0.32, vec2(0.045, -0.031)) * 0.045 * smoothstep(18.0, 6.0, dist);
        float e = 1.0 / 128.0;
        vec4 info = texture2D(tHeight, vUv);
        vec2 sSim = vec2(texture2D(tHeight, vUv + vec2(e, 0.0)).r - texture2D(tHeight, vUv - vec2(e, 0.0)).r,
                         -(texture2D(tHeight, vUv + vec2(0.0, e)).r - texture2D(tHeight, vUv - vec2(0.0, e)).r)) * 4.5 * 0.65;
        // vòng gợn giải tích (bước chân / cú đáp / nhát chém) — Codex/Jeschke: r0 0,2 m, lan 2 m/s, dải 10–16 cm, sống ~1,2 s;
        // vòng thứ hai trễ 0,12 s, sáng ~50%; vành bị nhiễu cắt thành đoạn (không thành vòng tròn trắng đều)
        float ringFoam = 0.0;
        vec2 sRing = vec2(0.0);
        for (int i = 0; i < 8; i++) {
          vec4 R0 = uRings[i];
          float age = uT - R0.z;
          float life = 1.0 + 0.25 * R0.w;
          if (age < 0.0 || age > life) continue;
          vec2 dv = p - R0.xy; float rr = length(dv);
          vec2 dir = dv / max(rr, 1e-3);
          float k = (1.0 - smoothstep(0.25 * life, life, age)) * smoothstep(0.0, 0.03, age) * R0.w;
          float w = 0.065 + age * 0.04;
          float x1 = (rr - (0.2 + age * 2.0)) / w;
          float g1 = exp(-x1 * x1);
          float a2 = max(age - 0.12, 0.0);
          float x2 = (rr - (0.12 + a2 * 1.55)) / (w * 0.85);
          float g2 = exp(-x2 * x2) * step(0.12, age);
          sRing += dir * (-2.0 * x1 * g1 - 1.2 * x2 * g2) * k * 0.05;
          float seg = smoothstep(0.3, 0.62, texture2D(uNoise, dir * 0.42 + R0.z * 0.37 + rr * 0.08).a);
          ringFoam = max(ringFoam, (g1 + g2 * 0.5) * k * mix(0.35, 1.0, seg));
        }
        float fRT = texture2D(uFoamTex, vUv).r;
        float disturbed = clamp(fRT + ringFoam, 0.0, 1.0);
        vec2 sR = (sMacro + sMed) * (1.0 - 0.4 * disturbed) + sSim + sRing;
        vec3 N = normalize(vec3(-sR.x, 1.0, -sR.y));
        vec3 Ns = normalize(vec3(-(sR.x + sMicro.x), 1.0, -(sR.y + sMicro.y)));
        vec3 V = normalize(cameraPosition - vW);
        float NoV = max(dot(N, V), 0.0);
        float F = 0.025 + 0.975 * pow(1.0 - NoV, 4.0);
        // thân nước: quãng đường quang học → LUT + độ truyền qua từng kênh
        float optical = uDepth / max(V.y, 0.15);
        // màu theo ĐỘ SÂU thật (LUT), nghiêng nhẹ theo góc nhìn; độ đục theo quãng đường quang học
        // hồ cạn sáng kiểu anime: tra LUT ở vùng nông → sâu dần theo góc nhìn (xanh ngọc #65D5D5 → #37B4CC)
        vec3 tint = texture2D(uLUT, vec2(clamp((uDepth * 0.45 + (optical - uDepth) * 0.12) / 1.6, 0.0, 1.0), 0.5)).rgb;
        // độ đục theo quãng đường (đỏ bị hấp thụ nhanh nhất → tính trên kênh lục), thân nước = màu LUT (giữ sắc xanh ngọc tươi)
        float a = clamp(1.0 - exp(-0.38 * optical * 1.6), 0.5, 0.9);
        // tăng bão hoà thân nước (nước anime trong & tươi, không xám)
        vec3 body = tint * 1.06;
        body = mix(vec3(dot(body, vec3(0.299, 0.587, 0.114))), body, 1.3);
        // dải nước nông sáng ven thành (đọc như bờ nông kiểu tranh anime)
        float r = length(p - uC);
        float edgeD = min(uR - r, uInner > 0.0 ? r - uInner : 1e3);
        body = mix(body, texture2D(uLUT, vec2(0.02, 0.5)).rgb, smoothstep(0.6, 0.0, edgeD) * 0.45);
        // ngày ↔ đêm: thân nước tự "phát sáng" theo LUT → nhân mức sáng môi trường
        body *= uLevel;
        // phản xạ
        vec3 R = reflect(-V, N);
        float y = max(R.y, 0.0);
        vec3 refl = (mix(vec3(1.0, 0.82, 0.68), vec3(0.45, 0.62, 0.92), pow(y, 0.55)) + vec3(1.0, 0.75, 0.45) * pow(max(dot(R, uSun), 0.0), 12.0) * 0.4) * uLevel;
        if (uPlanar > 0.5) {
          vec4 ru = vRefl; ru.xy += sR * 0.08 * ru.w;
          refl = mix(refl, texture2DProj(tDiffuse, ru).rgb, 0.85);
        }
        float lum = dot(refl, vec3(0.299, 0.587, 0.114));
        refl = mix(vec3(lum), refl, 0.9);
        float Fr = clamp(F * 0.75, 0.0, 1.0);
        vec3 col = mix(body, refl, Fr);
        float alpha = mix(a, 1.0, Fr);
        // specular anime 3 tầng
        vec3 H = normalize(uSun + V);
        float NoH = max(dot(Ns, H), 0.0);
        float sheen = pow(max(dot(N, H), 0.0), 48.0) * 0.12;
        float s = pow(NoH, 384.0);
        float aa = max(fwidth(s), 0.008);
        float sharp = smoothstep(0.55 - aa, 0.55 + aa, s);
        float mask = texture2D(uNoise, p / 0.07 + vec2(0.01, 0.0) * uT).a;
        float sparkle = sharp * smoothstep(0.84, 0.92, mask) * smoothstep(30.0, 8.0, dist);
        vec3 spec = uSunCol * (sheen + sharp * 0.45 + sparkle * 1.8) * uLevel;
        // bọt: vạch mép liền + dải đứt đoạn + chỗ sóng mạnh
        float fnz = texture2D(uNoise, p / 0.12 + vec2(0.018, 0.007) * uT).a;
        float fw = fwidth(edgeD);
        float rim = 1.0 - smoothstep(0.03, 0.03 + fw * 1.5 + 0.02, edgeD);
        float band = smoothstep(0.06, 0.09, edgeD) * (1.0 - smoothstep(0.16, 0.26, edgeD));
        float broken = band * smoothstep(0.58, 0.72, fnz);
        float act = abs(info.g) * 9.0 + abs(info.r) * 4.0;
        float wfoam = smoothstep(0.45, 0.75, act * (0.5 + fnz));
        float lace = texture2D(uLace, p / 0.55 + vec2(uT * 0.02, -uT * 0.015)).r;
        float lace2 = texture2D(uLace, p / 0.31 - vec2(uT * 0.017, uT * 0.02)).r;
        float lc = max(lace, lace2);
        // bọt mỏng = ren mảnh; bọt dày = mảng trắng đặc; mép vỡ theo nhiễu
        float rtFoam = smoothstep(0.08, 0.3, fRT) * mix(smoothstep(0.25, 0.6, lc), 1.0, smoothstep(0.45, 0.9, fRT + (fnz - 0.5) * 0.3));
        float ringW = smoothstep(0.3, 0.6, ringFoam * (0.75 + lc * 0.5));
        float foam = max(max(rim * 0.9, broken * 0.65), max(max(wfoam * 0.85, rtFoam), ringW));
        col = mix(col + spec * (1.0 - 0.7 * foam), vec3(0.918, 0.984, 1.0) * max(uLevel, 0.22), foam);
        alpha = max(alpha, foam);
        gl_FragColor = vec4(col, clamp(alpha + (sharp + sparkle) * 0.3, 0.0, 1.0));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
}

/** Ánh sóng chiếu xuống đáy theo tia nắng khúc xạ: 2 lớp texture (1,3 m / 0,9 m) trôi ngược nhau, lấy min, mũ 1,3, tắt theo độ sâu */
export function causticMaterial(opts: { radius: number; inner?: number; center?: THREE.Vector2; depth: number; sun: THREE.Vector3; tex: THREE.Texture; strength?: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: WIND.t, uR: { value: opts.radius }, uInner: { value: opts.inner ?? 0 }, uC: { value: opts.center ?? new THREE.Vector2() }, uK: { value: opts.strength ?? 0.35 }, uD: { value: opts.depth }, uSun: { value: opts.sun.clone() }, uTex: { value: opts.tex }, uLevel: { value: 1 } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: /* glsl */ `uniform float uT; uniform float uR; uniform float uInner; uniform vec2 uC; uniform float uK; uniform float uD; uniform vec3 uSun; uniform sampler2D uTex; uniform float uLevel; varying vec3 vW;
      void main(){
        vec2 p = vW.xz;
        float r = length(p - uC);
        if (r > uR || r < uInner) discard;
        vec3 ray = refract(-uSun, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);
        vec2 q = p - ray.xz * uD / max(-ray.y, 0.1);
        float a = texture2D(uTex, q / 1.3 + vec2(0.025, 0.012) * uT).r;
        float b = texture2D(uTex, q.yx / 0.9 + vec2(-0.018, 0.029) * uT).r;
        // texture là mạng đường MẢNH → min(a,b) chỉ còn chỗ giao; dùng trung bình (2 lớp trôi ngược → lưới "nhảy múa")
        float c = pow((a + b) * 0.5, 1.3) * exp(-0.9 * uD);
        float edge = smoothstep(uR, uR - 0.4, r) * smoothstep(uInner, uInner + 0.3, r);
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * c * uK * 2.2 * edge * uLevel, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/**
 * Nước chảy (tia phun / màn tràn / thác): mesh + vệt trôi theo dòng (Valve Water Flow / thác Genshin).
 * aFlow = (ngang dòng m, dọc dòng m), aFall01 = 0 nguồn → 1 cuối. Lõi xanh nhạt trong, dải trắng dài, cuối dòng trắng đục + rã.
 */
/** strands: màn nước rơi thành n dòng từ các mũi mép bát lượn sóng (n dòng quanh vòng bán kính r, lệch pha phase) thay vì một tấm liền như váy kính */
export function flowMaterial(opts: { tex: THREE.Texture; speed: number; core?: string; white?: string; width?: number; length?: number; wobble?: number; alpha?: number; strands?: { n: number; r: number; phase?: number } }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: WIND.t,
      uTex: { value: opts.tex },
      uSpeed: { value: opts.speed },
      uCore: { value: new THREE.Color(opts.core ?? "#9DDFEA") },
      uWhite: { value: new THREE.Color(opts.white ?? "#F0FCFF") },
      uScale: { value: new THREE.Vector2(opts.width ?? 0.16, opts.length ?? 1.2) },
      uWob: { value: opts.wobble ?? 0 },
      uA: { value: opts.alpha ?? 0.78 },
      uLevel: { value: 1 },
      uStrand: { value: new THREE.Vector3(opts.strands?.n ?? 0, opts.strands?.r ?? 1, opts.strands?.phase ?? 0) },
    },
    vertexShader: /* glsl */ `attribute vec2 aFlow; attribute float aFall; uniform float uT; uniform float uWob; uniform float uSpeed;
      varying vec2 vFlow; varying float vFall; varying vec3 vN; varying vec3 vV; varying float vCam;
      void main(){
        vFlow = aFlow; vFall = aFall;
        vec3 p = position;
        // dao động bán kính ±10% chạy theo dòng (tia nước "thở")
        p += normal * uWob * sin(aFlow.y * 9.0 - uT * uSpeed * 6.0);
        vec4 w = modelMatrix * vec4(p, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        vCam = length(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `uniform float uT; uniform sampler2D uTex; uniform float uSpeed; uniform vec3 uCore; uniform vec3 uWhite; uniform vec2 uScale; uniform float uA; uniform float uLevel; uniform vec3 uStrand;
      varying vec2 vFlow; varying float vFall; varying vec3 vN; varying vec3 vV; varying float vCam;
      void main(){
        vec2 uv = vFlow / uScale;
        uv.y -= uT * uSpeed / uScale.y;
        float streak = texture2D(uTex, uv).r;
        float detail = texture2D(uTex, uv * vec2(1.8, 0.65) + vec2(0.0, -uT * 1.3)).g;
        float mask = streak * 0.7 + detail * 0.3;
        float white = smoothstep(0.58, 0.80, mask);
        float bottom = smoothstep(0.72, 1.0, vFall);
        white = max(white, bottom * 0.65);
        float ndv = abs(dot(normalize(vN), vV));
        float rim = pow(1.0 - ndv, 2.0);
        vec3 col = mix(uCore, uWhite, white);
        // ống nước: rìa sẫm (khúc xạ nền) + lõi sáng → đọc rõ trên nền đá trắng
        col *= mix(0.78, 1.08, smoothstep(0.0, 0.6, ndv));
        col += vec3(1.0, 0.97, 0.9) * pow(ndv, 24.0) * 0.6;
        float breakup = smoothstep(0.35, 0.55, detail);
        float alpha = mix(uA, 0.96, white);
        alpha *= mix(1.0, breakup, bottom * 0.65);
        alpha *= smoothstep(0.0, 0.04, vFall);
        if (uStrand.x > 0.0) {
          // dòng chảy từ mũi mép: hẹp ở trên, toả + mỏng dần khi rơi; giữa các dòng trống hẳn
          float c = cos(vFlow.x / uStrand.y * uStrand.x + uStrand.z);
          float w = mix(0.8, 0.35, vFall);
          float sm = smoothstep(w, w + 0.14, c + (detail - 0.5) * 0.25);
          alpha *= sm * mix(1.0, 0.75, vFall);
          col = mix(col, uWhite, (1.0 - smoothstep(0.0, 0.25, vFall)) * 0.5);
        }
        // sát ống kính: mờ dần (tia đi ngang camera không thành mảng che màn hình)
        alpha *= smoothstep(0.5, 2.2, vCam);
        if (alpha < 0.02) discard;
        gl_FragColor = vec4(col * max(uLevel, 0.2), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
