"use client";
/**
 * Vật liệu dùng chung của các khu mở rộng Mê cung Hoạ âm (giai đoạn 2):
 *  - CutoutBatch: MỌI hình cắt giấy của một khu = 1 InstancedMesh (atlas public/world/siren/zones_cut.webp — Codex, xử lý
 *    scripts/siren-zones.py), alpha-test (không vẽ chồng alpha), mỗi instance: khung uv, màu nhân + mức "bóng" (cho bóng xa),
 *    quay về máy quay (tuỳ chọn, có lật), lắc rèm, "rung tay" 4 Hz kiểu cắt dán (theo HARMONIC.collageTime);
 *  - trời khu (shader thủ tục, không panorama) — CÙNG hàm cho vòm trời và lỗ cửa (lỗ cửa = cửa sổ nhìn trời khu đích);
 *  - màn che lúc qua cửa (vành vé phóng to / rèm tách / cửa chớp đồng) bám màn hình.
 * Không cấp phát trong các hàm cập nhật.
 */
import * as THREE from "three";
import { CHLADNI_GLSL } from "@/lib/world/harmonicState";
import { CUT, type CutName } from "@/lib/world/zones/cutAtlas";

export const ZONE_CODE = { hub: 0, keys: 1, wait: 2, desert: 3 } as const;

// ───────────── Hình cắt giấy (một lệnh vẽ / khu) ─────────────
const CUT_VERT = /* glsl */ `
attribute vec4 aUv;
attribute vec4 aTint;
attribute vec3 aAnim; // x: quay về máy quay (0 / 1 / −1 lật), y: biên độ lắc rèm, z: pha
uniform float uTime;
uniform float uBoil;
uniform float uCollage;
varying vec2 vUv;
varying vec4 vTint;
varying float vFogDepth;
float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
void main(){
  vUv = mix(aUv.xy, aUv.zw, uv);
  vTint = aTint;
  vec3 p = position;
  float id = float(gl_InstanceID);
  // rung tay 4 Hz: mỗi tấm nghiêng / xê dịch một chút mỗi lần "thay tranh"
  float fr = floor(uCollage * 4.0);
  float tilt = (h1(id * 7.1 + fr) - 0.5) * 0.035 * uBoil;
  p.xy = vec2(p.x * cos(tilt) - p.y * sin(tilt), p.x * sin(tilt) + p.y * cos(tilt));
  // lắc rèm: nếp gấp đi chậm, đỉnh ghim chặt
  p.x += sin(uTime * 0.9 + aAnim.z + p.y * 2.3) * aAnim.y * p.y;
  p.z += cos(uTime * 0.7 + aAnim.z + p.x * 3.0) * aAnim.y * 0.5 * p.y;
  vec4 w;
  if (abs(aAnim.x) > 0.5) {
    vec4 base = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sx = length(instanceMatrix[0].xyz);
    float sy = length(instanceMatrix[1].xyz);
    vec3 d = cameraPosition - base.xyz;
    d.y = 0.0;
    d = normalize(d + vec3(1e-4, 0.0, 0.0));
    vec3 right = vec3(d.z, 0.0, -d.x) * sign(aAnim.x);
    w = vec4(base.xyz + right * p.x * sx + vec3(0.0, 1.0, 0.0) * p.y * sy + d * p.z, 1.0);
  } else {
    w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  }
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const CUT_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
uniform vec3 uSil;
varying vec2 vUv;
varying vec4 vTint;
varying float vFogDepth;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb * vTint.rgb;
  c = mix(c, uSil, vTint.a);
  c = mix(c, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`;

export function createCutoutMat(tex: THREE.Texture, sil = "#3a2a4a"): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: CUT_VERT,
    fragmentShader: CUT_FRAG,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uTime: { value: 0 }, uBoil: { value: 1 }, uCollage: { value: 0 }, uSil: { value: new THREE.Color(sil) } }]),
  });
  // merge sao chép giá trị → gán texture sau
  m.uniforms.uMap.value = tex;
  return m;
}

/** một hình cắt: neo đáy giữa (x, y, z), rộng w mét (cao theo tỉ lệ ảnh), yaw (mặt nhìn về (sin, cos)) */
export interface CutItem {
  cut: CutName;
  at: [number, number, number];
  w: number;
  /** ghi đè chiều cao (mặc định theo tỉ lệ ảnh) */
  h?: number;
  yaw?: number;
  /** 1 = quay về máy quay, −1 = quay về máy quay + lật ngang */
  bill?: number;
  tint?: [number, number, number];
  /** 0…1: hoà về màu bóng (cảnh xa) */
  sil?: number;
  sway?: number;
  /** neo giữa thay vì đáy (dy = −h/2) */
  center?: boolean;
}

const M4 = new THREE.Matrix4();
const QY = new THREE.Quaternion();
const V3A = new THREE.Vector3();
const V3S = new THREE.Vector3();
const UPY = new THREE.Vector3(0, 1, 0);

/** InstancedMesh của các hình cắt (quad đáy-neo: x ∈ [−0,5; 0,5], y ∈ [0; 1]) */
export class CutoutBatch {
  mesh: THREE.InstancedMesh;
  items: CutItem[];
  private uv: THREE.InstancedBufferAttribute;
  private anim: THREE.InstancedBufferAttribute;
  constructor(items: CutItem[], mat: THREE.ShaderMaterial, extra = 0) {
    this.items = items;
    const n = items.length + extra;
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    const uv = new Float32Array(n * 4);
    const tint = new Float32Array(n * 4);
    const anim = new Float32Array(n * 3);
    this.uv = new THREE.InstancedBufferAttribute(uv, 4);
    this.anim = new THREE.InstancedBufferAttribute(anim, 3);
    g.setAttribute("aUv", this.uv);
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 4));
    g.setAttribute("aAnim", this.anim);
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.count = items.length;
    items.forEach((it, i) => {
      const r = CUT[it.cut].uv;
      uv.set(r, i * 4);
      tint.set([...(it.tint ?? [1, 1, 1]), it.sil ?? 0], i * 4);
      anim.set([it.bill ?? 0, it.sway ?? 0, i * 1.7], i * 3);
      this.place(i, it.at[0], it.at[1], it.at[2], it.yaw ?? 0, it.w, it.h ?? it.w / CUT[it.cut].aspect, it.center);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  /** đặt lại instance i (không cấp phát); gọi needs() sau một loạt cập nhật */
  place(i: number, x: number, y: number, z: number, yaw: number, w: number, h: number, center?: boolean) {
    QY.setFromAxisAngle(UPY, yaw);
    V3A.set(x, center ? y - h / 2 : y, z);
    V3S.set(w, h, 1);
    M4.compose(V3A, QY, V3S);
    this.mesh.setMatrixAt(i, M4);
  }
  /** đổi khung atlas (flipbook) */
  frame(i: number, cut: CutName) {
    this.uv.set(CUT[cut].uv, i * 4);
    this.uv.needsUpdate = true;
  }
  /** đổi màu nhân / mức bóng của instance i */
  tint(i: number, r: number, g: number, b: number, sil = 0) {
    const a = this.mesh.geometry.getAttribute("aTint") as THREE.InstancedBufferAttribute;
    a.setXYZW(i, r, g, b, sil);
    a.needsUpdate = true;
  }
  /** đổi hướng lật của hình quay về máy quay */
  flip(i: number, s: number) {
    if (this.anim.getX(i) === s) return;
    this.anim.setX(i, s);
    this.anim.needsUpdate = true;
  }
  needs() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

// ───────────── Trời khu (thủ tục) ─────────────
const SKY_FN = /* glsl */ `
uniform float uTime;
uniform float uZoneSky;
uniform vec2 uMode;
uniform float uCalm;
${CHLADNI_GLSL}
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float band(float x, float w){ float f = fwidth(x) + 1e-4; return 1.0 - smoothstep(w - f, w + f, abs(x)); }
vec3 zoneSky(vec3 d, float z){
  float y = d.y;
  float a = atan(d.z, d.x);
  vec3 col;
  if (z < 0.5) {
    // hub (xem trước qua lỗ cửa): giấy hồng tím + đồi răng cưa
    col = mix(vec3(0.95, 0.55, 0.62), vec3(0.32, 0.18, 0.48), smoothstep(-0.05, 0.7, y));
    float hill = 0.06 + 0.04 * abs(fract(a * 6.0 / 3.14159) - 0.5);
    col = mix(col, vec3(0.2, 0.1, 0.25), step(y, hill) * step(-0.2, y));
  } else if (z < 1.5) {
    // Biển Phím: đêm chàm, năm dòng kẻ khuông vắt ngang trời, sao = đầu nốt, trăng sứ nứt men
    col = mix(vec3(0.16, 0.08, 0.22), vec3(0.015, 0.012, 0.05), smoothstep(-0.05, 0.65, y));
    float s = y - 0.3 - 0.05 * sin(a * 3.0 + uTime * 0.05);
    float lines = 0.0;
    for (int i = 0; i < 5; i++) lines += band(s - float(i - 2) * 0.03, 0.0016);
    col += vec3(0.55, 0.6, 1.0) * 0.32 * lines * smoothstep(-0.02, 0.1, y);
    vec2 g = vec2(a * 22.0, y * 40.0);
    vec2 c = floor(g);
    float st = hsh(c);
    vec2 f = fract(g) - 0.5;
    float head = 1.0 - smoothstep(0.08, 0.13, length(f * vec2(1.0, 1.45)));
    col += vec3(0.85, 0.85, 1.0) * head * step(0.9, st) * (0.6 + 0.4 * sin(uTime * 2.0 + st * 40.0)) * step(0.05, y);
    vec3 md = normalize(vec3(0.55, 0.42, -0.72));
    float r = acos(clamp(dot(d, md), -1.0, 1.0));
    float moon = 1.0 - smoothstep(0.105, 0.11, r);
    vec2 mc = floor((d.xy - md.xy) * 160.0);
    float crack = step(0.93, hsh(mc)) * 0.25;
    col = mix(col, vec3(0.92, 0.93, 1.0) - crack - vec3(0.0, 0.05, 0.0) * smoothstep(0.0, 0.11, r), moon);
    col += vec3(0.4, 0.45, 0.9) * 0.25 * exp(-r * 9.0);
  } else if (z < 2.5) {
    // Phòng Chờ: hoàng hôn bạc hà – cam; trần đèn huỳnh quang treo lơ lửng trên cao; chấm bán sắc ở chân trời
    col = mix(vec3(1.0, 0.6, 0.42), vec3(0.5, 0.84, 0.74), smoothstep(-0.02, 0.55, y));
    col = mix(col, vec3(0.98, 0.8, 0.55), exp(-abs(y) * 18.0) * 0.6);
    if (y > 0.04) {
      vec2 q = d.xz / y * 3.2 + vec2(0.0, uTime * 0.02 * (1.0 - uCalm));
      vec2 cq = fract(q) - 0.5;
      float panel = (1.0 - smoothstep(0.3, 0.33, abs(cq.x))) * (1.0 - smoothstep(0.16, 0.19, abs(cq.y)));
      float flick = 0.85 + 0.15 * step(0.97, hsh(floor(q) + floor(uTime * 3.0)));
      col = mix(col, vec3(0.95, 1.0, 0.93) * flick, panel * smoothstep(0.04, 0.35, y) * 0.75);
    }
    vec2 hp = vec2(a * 60.0, y * 60.0);
    float dot = 1.0 - smoothstep(0.18, 0.24, length(fract(hp) - 0.5) - (0.3 - y * 2.0) * 0.3);
    col = mix(col, vec3(0.95, 0.5, 0.45), dot * smoothstep(0.18, 0.0, y) * step(0.0, y) * 0.35);
  } else {
    // Sa Mạc: trời trắng nóng, dải hơi nóng, mặt trời đồng khắc guilloche, đường nút Chladni mờ lặp lại mode của tấm
    col = mix(vec3(0.95, 0.66, 0.36), vec3(0.98, 0.93, 0.8), smoothstep(-0.02, 0.6, y));
    col -= vec3(0.03, 0.02, 0.0) * sin(y * 140.0 + uTime * 1.5 * (1.0 - uCalm)) * exp(-y * 12.0) * step(0.0, y);
    vec3 sd = normalize(vec3(-0.35, 0.16, -0.92));
    float r = acos(clamp(dot(d, sd), -1.0, 1.0));
    vec3 t1 = normalize(cross(sd, vec3(0.0, 1.0, 0.0)));
    vec3 t2 = cross(t1, sd);
    float th = atan(dot(d, t2), dot(d, t1));
    float rings = 0.5 + 0.5 * sin(r * 260.0 + 3.0 * sin(th * 9.0 + uTime * 0.2));
    float disc = 1.0 - smoothstep(0.16, 0.165, r);
    col = mix(col, mix(vec3(0.62, 0.38, 0.16), vec3(0.96, 0.78, 0.42), rings), disc);
    col += vec3(1.0, 0.75, 0.4) * exp(-r * 6.0) * 0.25;
    if (y > 0.08 && uMode.x > 0.0) {
      vec2 q = clamp(d.xz / (y + 0.15) * 0.5, -1.0, 1.0);
      float f = chladni(q, uMode.x, uMode.y);
      col = mix(col, vec3(0.55, 0.42, 0.25), (1.0 - smoothstep(0.0, 0.06, abs(f))) * smoothstep(0.08, 0.5, y) * 0.35);
    }
  }
  return col;
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
${SKY_FN}
varying vec3 vDir;
void main(){ gl_FragColor = vec4(zoneSky(normalize(vDir), uZoneSky), 1.0); }`;

export function skyUniforms(zone: number) {
  return { uTime: { value: 0 }, uZoneSky: { value: zone }, uMode: { value: new THREE.Vector2(0, 0) }, uCalm: { value: 0 } };
}
export function createZoneSkyMat(zone: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: skyUniforms(zone), side: THREE.BackSide, depthWrite: false, fog: false });
}

/** lỗ cửa: nhìn thấy trời của khu đích theo hướng nhìn thật (điều thấy qua lỗ = điều thấy sau khi bước qua) */
const HOLE_VERT = /* glsl */ `
varying vec3 vW;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const HOLE_FRAG = /* glsl */ `
${SKY_FN}
uniform float uOpen;
uniform float uLocked;
uniform float uCircle;
varying vec3 vW;
varying vec2 vUv;
void main(){
  vec3 d = normalize(vW - cameraPosition);
  vec3 c = zoneSky(d, uZoneSky);
  // mép lỗ: viền giấy cắt răng cưa nhẹ + gợn mở ra
  vec2 p = vUv - 0.5;
  float e = uCircle > 0.5 ? length(p) : max(abs(p.x), abs(p.y));
  // bóng giấy ở mép trong lỗ (đọc ra là một LỖ trên tấm giấy)
  c *= 0.72 + 0.28 * smoothstep(0.5, 0.36, e);
  c = mix(c, vec3(0.96, 0.9, 0.8), smoothstep(0.43, 0.5, e + 0.012 * sin(atan(p.y, p.x) * 24.0 + uTime * 2.0)) * 0.7);
  // khoá: hoa văn chéo mờ phủ lỗ
  float x = step(0.5, fract((vUv.x + vUv.y) * 9.0)) * 0.35 * uLocked;
  c = mix(c, vec3(0.3, 0.18, 0.32), x);
  gl_FragColor = vec4(c, 1.0);
}`;
export function createHoleMat(zone: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: HOLE_VERT, fragmentShader: HOLE_FRAG, uniforms: { ...skyUniforms(zone), uOpen: { value: 1 }, uLocked: { value: 0 }, uCircle: { value: 0 } }, side: THREE.FrontSide, fog: false });
}

// ───────────── Màn che qua cửa (bám màn hình) ─────────────
const VEIL_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`;
const VEIL_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uK;
uniform float uStyle;
uniform float uAspect;
uniform float uRM;
uniform vec4 uTicket;
uniform vec4 uCurtain;
uniform vec4 uDoor;
varying vec2 vUv;
vec3 paper(vec2 p){
  float l = 0.5 + 0.5 * sin(p.y * 220.0 + sin(p.x * 30.0) * 3.0);
  return mix(vec3(0.95, 0.89, 0.78), vec3(0.86, 0.78, 0.66), l * 0.25);
}
void main(){
  float k = clamp(uK, 0.0, 1.0);
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  if (uRM > 0.5) {
    gl_FragColor = vec4(paper(p), 1.0 - k);
    if (k >= 1.0) discard;
    return;
  }
  vec3 c;
  if (uStyle < 0.5) {
    // vành vé: tấm vé phóng to, lỗ bấm (giữa ảnh) nở ra lấp màn hình
    float H = 0.36 * exp(k * k * 3.6);
    vec2 t = p / vec2(H * 1.7775, H) + vec2(0.5, 0.486);
    if (t.x > 0.0 && t.x < 1.0 && t.y > 0.0 && t.y < 1.0) {
      vec4 s = texture2D(uMap, mix(uTicket.xy, uTicket.zw, t));
      if (s.a < 0.5) {
        if (length((t - vec2(0.5, 0.486)) * vec2(1.7775, 1.0)) < 0.3) discard;
        c = paper(p);
      } else c = s.rgb;
    } else c = paper(p);
  } else {
    // rèm (1) / cửa chớp đồng (2): hai tấm trượt ra hai bên
    float open = k * k * (3.0 - 2.0 * k) * (uAspect * 0.5 + 0.05);
    float x = abs(p.x) - open;
    if (x < 0.0) discard;
    vec4 r = uStyle < 1.5 ? uCurtain : uDoor;
    vec2 t = vec2(fract(x * 1.6), vUv.y);
    vec4 s = texture2D(uMap, mix(r.xy, r.zw, vec2(mix(0.12, 0.88, t.x), mix(0.04, 0.96, t.y))));
    c = s.a > 0.5 ? s.rgb : vec3(0.45, 0.08, 0.16);
    if (uStyle > 1.5) c = mix(c, vec3(0.75, 0.52, 0.22), 0.55);
    c *= 0.75 + 0.25 * smoothstep(0.0, 0.05, x);
  }
  gl_FragColor = vec4(c, 1.0);
}`;
export function createVeilMat(tex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VEIL_VERT,
    fragmentShader: VEIL_FRAG,
    uniforms: {
      uMap: { value: tex },
      uK: { value: 1 },
      uStyle: { value: 0 },
      uAspect: { value: 1.6 },
      uRM: { value: 0 },
      uTicket: { value: new THREE.Vector4(...CUT.ticket.uv) },
      uCurtain: { value: new THREE.Vector4(...CUT.curtain.uv) },
      uDoor: { value: new THREE.Vector4(...CUT.door.uv) },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}
