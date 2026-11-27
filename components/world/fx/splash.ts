/**
 * Khối nước văng lên khỏi mặt hồ (mesh động, toàn bộ chuyển động tính trong vertex shader theo thời gian — CPU chỉ ghi 1 instance):
 *  • Vương miện (crown) khi nhảy / rơi xuống nước: vành 32 × 4 ô, răng nước theo sin, mở rộng rồi xẹp.
 *  • Cột nước (cú đáp mạnh ≥ ~4 m/s): ống thon, đầu phình, nghiêng theo hướng lao, trễ 90 ms.
 *  • Màn nước chém (sheet): dải cong theo cung vung kiếm, chân xanh nhạt, mép trên trắng đứt đoạn.
 * Số liệu (Codex 2026-11 + Jeschke & Wojtan): s = clamp((v − 2) / 5, 0, 1), v = vận tốc chạm nước (m/s)
 *   crown: bán kính 0,22 → 0,48 + 0,52 s m, cao 0,32 + 0,66 s m, sống 0,36 + 0,24 s s;
 *   cột: cao 0,45 + 0,75 s m, đường kính 0,22–0,38 m; sheet: dài 0,6–1,5 m, cao 0,25–0,65 m, sống 0,34 s.
 */
import * as THREE from "three";
import { WIND } from "./water";

/** độ mạnh cú đáp từ vận tốc chạm nước */
export const splashStrength = (v: number) => Math.min(1, Math.max(0, (v - 2) / 5));

const FRAG = /* glsl */ `
  uniform sampler2D uNoise; uniform vec3 uCore; uniform vec3 uWhite;
  varying vec3 vB; varying float vA; varying vec3 vW; varying vec3 vN;
  void main(){
    if (vA <= 0.0) discard;
    float h = vB.x, t = vB.y;
    // vệt chảy dọc + rách ở đỉnh (giọt tách khỏi mép)
    float n = texture2D(uNoise, vec2(vB.z * 3.0, h * 0.7 - t * 0.9)).a;
    float n2 = texture2D(uNoise, vec2(vB.z * 7.0 + 0.3, h * 1.6 - t * 1.4)).b;
    float tear = smoothstep(0.36, 0.46, n + (1.0 - h) * 0.5 - t * 0.3);
    // mép trên trắng đặc (dải cel 2 bậc), thân xanh ngọc đậm để nổi trên nền đá / nước sáng
    float rim = smoothstep(0.55, 0.68, h + (n2 - 0.5) * 0.25);
    vec3 V = normalize(cameraPosition - vW);
    float ndv = abs(dot(normalize(vN), V));
    float streak = smoothstep(0.58, 0.66, n2);
    float white = max(rim, max(smoothstep(0.55, 0.7, 1.0 - ndv) * 0.8, streak * 0.85));
    vec3 col = mix(uCore, uWhite, white);
    col *= mix(0.74, 1.04, smoothstep(0.1, 0.7, ndv));
    float a = vA * tear * mix(0.72, 1.0, white) * smoothstep(0.0, 0.08, h + 0.02);
    a *= smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.55, 1.0, t));
    if (a < 0.02) discard;
    gl_FragColor = vec4(col, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const CROWN_VS = /* glsl */ `
  attribute vec4 aC; uniform float uT; uniform float uY;
  varying vec3 vB; varying float vA; varying vec3 vW; varying vec3 vN;
  void main(){
    float s = aC.w;
    float life = 0.36 + 0.24 * s;
    float t = (uT - aC.z) / life;
    vA = step(0.0, t) * step(t, 1.0);
    t = clamp(t, 0.0, 1.0);
    float h = uv.y, a = 6.2831853 * uv.x;
    float env = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(0.42, 1.0, t));
    float teeth = 0.8 + 0.12 * sin(7.0 * a + aC.z * 13.0) + 0.08 * sin(13.0 * a + aC.z * 7.0);
    float r = mix(0.22, 0.48 + 0.52 * s, t * (2.0 - t)) * (0.78 + 0.32 * h);
    float y = (0.32 + 0.66 * s) * env * h * mix(1.0, teeth, h * h);
    vec3 w = vec3(aC.x + r * cos(a), uY + y - 0.02, aC.y + r * sin(a));
    vB = vec3(h, t, uv.x);
    vN = normalize(vec3(cos(a), 0.45 - h * 0.6, sin(a)));
    vW = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const COLUMN_VS = /* glsl */ `
  attribute vec4 aC; attribute vec4 aD; uniform float uT; uniform float uY;
  varying vec3 vB; varying float vA; varying vec3 vW; varying vec3 vN;
  void main(){
    float s = aC.w;
    float life = 0.62 + 0.2 * s;
    float t = (uT - aC.z - 0.09) / life;
    vA = step(0.0, t) * step(t, 1.0) * step(0.3, s);
    t = clamp(t, 0.0, 1.0);
    float h = uv.y, a = 6.2831853 * uv.x;
    // vọt nhanh (35% đầu) rồi sụp chậm
    float H = (0.45 + 0.75 * s) * (t < 0.35 ? sin(1.5708 * t / 0.35) : 1.0 - pow((t - 0.35) / 0.65, 1.6));
    float rad = (0.11 + 0.08 * s) * (1.0 - 0.5 * h) * (1.0 + 0.7 * smoothstep(0.78, 1.0, h)) * (1.0 + 0.5 * t);
    vec2 lean = aD.xy * h * H * 0.22;
    vec3 w = vec3(aC.x + rad * cos(a) + lean.x, uY + h * H - 0.03, aC.y + rad * sin(a) + lean.y);
    vB = vec3(h, t, uv.x);
    vN = normalize(vec3(cos(a), 0.2, sin(a)));
    vW = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

/** aC = (x, z, lúc, hướng mặt), aD = (độ dài cung m, chiều cao m, chiều vung ±1, 0) */
const SHEET_VS = /* glsl */ `
  attribute vec4 aC; attribute vec4 aD; uniform float uT; uniform float uY;
  varying vec3 vB; varying float vA; varying vec3 vW; varying vec3 vN;
  void main(){
    float t = (uT - aC.z) / 0.36;
    vA = step(0.0, t) * step(t, 1.0);
    t = clamp(t, 0.0, 1.0);
    float u = uv.x - 0.5, h = uv.y;
    // cung trước mặt; phần cuối cung (theo chiều vung) bốc lên sau → sóng chạy dọc lưỡi
    float lag = clamp(t * 1.6 - (u * aD.z + 0.5) * 0.6, 0.0, 1.0);
    float env = smoothstep(0.0, 0.35, lag) * (1.0 - smoothstep(0.5, 1.0, t));
    float ang = aC.w + u * aD.x / 0.95;
    float R = 0.95 + h * (0.25 + 0.35 * t) + t * 0.3;
    float prof = sqrt(max(0.0, 1.0 - 4.0 * u * u));
    float y = aD.y * env * h * prof * (0.85 + 0.15 * sin(u * 23.0 + aC.z * 5.0));
    vec3 w = vec3(aC.x + sin(ang) * R, uY + y - 0.02, aC.y + cos(ang) * R);
    vB = vec3(h, t, uv.x * aD.x);
    vN = normalize(vec3(sin(ang), 0.35, cos(ang)));
    vW = w;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;

const N_CROWN = 4;
const N_SHEET = 4;
export class SplashFX {
  readonly group = new THREE.Group();
  private crown: THREE.InstancedMesh;
  private column: THREE.InstancedMesh;
  private sheet: THREE.InstancedMesh;
  private mats: THREE.ShaderMaterial[] = [];
  private kc = 0;
  private ks = 0;
  constructor(noise: THREE.Texture, waterY: number) {
    const mk = (vs: string) => {
      const m = new THREE.ShaderMaterial({
        uniforms: { uT: WIND.t, uY: { value: waterY }, uNoise: { value: noise }, uCore: { value: new THREE.Color("#4fb8d4") }, uWhite: { value: new THREE.Color("#f4fdff") } },
        vertexShader: vs,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        forceSinglePass: true,
      });
      this.mats.push(m);
      return m;
    };
    const inst = (g: THREE.BufferGeometry, n: number, vs: string) => {
      g.setAttribute("aC", new THREE.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1e4), 4).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute("aD", new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
      const im = new THREE.InstancedMesh(g, mk(vs), n);
      im.frustumCulled = false;
      im.renderOrder = 4;
      this.group.add(im);
      return im;
    };
    this.crown = inst(new THREE.PlaneGeometry(1, 1, 32, 4), N_CROWN, CROWN_VS);
    this.column = inst(new THREE.CylinderGeometry(1, 1, 1, 10, 6, true), N_CROWN, COLUMN_VS);
    this.sheet = inst(new THREE.PlaneGeometry(1, 1, 14, 3), N_SHEET, SHEET_VS);
  }
  private set(im: THREE.InstancedMesh, i: number, c: [number, number, number, number], d: [number, number, number, number] = [0, 0, 0, 0]) {
    const A = im.geometry.attributes.aC as THREE.InstancedBufferAttribute;
    const D = im.geometry.attributes.aD as THREE.InstancedBufferAttribute;
    A.setXYZW(i, ...c);
    D.setXYZW(i, ...d);
    A.needsUpdate = true;
    D.needsUpdate = true;
  }
  /** cú đáp tại (x, z), độ mạnh s ∈ [0,1], hướng lao (dx, dz) */
  land(x: number, z: number, s: number, dx = 0, dz = 0) {
    const i = this.kc++ % N_CROWN;
    const t = WIND.t.value;
    this.set(this.crown, i, [x, z, t, s]);
    this.set(this.column, i, [x, z, t, s], [dx, dz, 0, 0]);
  }
  /** nhát chém xuống nước: tâm (x, z) = người chơi, yaw = hướng mặt (atan2(dx, dz)), chiều vung ±1, mạnh k ∈ [0,1] */
  slash(x: number, z: number, yaw: number, dir: number, k: number) {
    const i = this.ks++ % N_SHEET;
    this.set(this.sheet, i, [x, z, WIND.t.value, yaw], [0.8 + 0.7 * k, 0.28 + 0.37 * k, dir, 0]);
  }
  dispose() {
    for (const im of [this.crown, this.column, this.sheet]) im.geometry.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}
