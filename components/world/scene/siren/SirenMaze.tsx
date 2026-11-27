"use client";
/**
 * Mê cung Hoạ âm — phần hình (cắt dán siêu thực kiểu "mê cung phù thuỷ"): mọi mặt đi được, bậc thang, tường, ống đàn,
 * thanh phổ và cột mốc gộp thành MỘT lưới (1 lệnh vẽ) với vật liệu "giấy cắt dán" thủ tục:
 *  - mặt trên: nền giấy sáng, yên tĩnh + hoa văn theo khu (sóng sin · bàn cờ bồi âm · vân giao thoa · dải phổ · chấm bán sắc)
 *  - cạnh: môi sáng ở mép trên, viền mực, thân sẫm có nếp giấy + răng cưa trang trí; mặt dưới: tối, chấm bán sắc
 *  - đổ bóng toon 3 bậc (vùng tối mang sắc tím), hạt giấy, sương
 * Tấm cắt giấy (atlas tranh có sẵn) dựng như phông sân khấu với tỉ lệ phi lý: 1 lệnh vẽ (instancing).
 * Hoa hồng toán học r = cos(kθ) xếp lớp như giấy cắt trôi trên trời: 1 lệnh vẽ (instancing).
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { PILLARS, PIPES, RENDER_SINK, SURFS, WALLS, ZONES, renderLayers, type Zone } from "@/lib/world/sirenMaze";

/** Bảng màu theo khu: mặt sàn / thân / điểm nhấn */
export const PALETTE: Record<Zone, { deck: string; side: string; acc: string }> = {
  arena: { deck: "#f6e9ff", side: "#3a2a66", acc: "#ffd27a" },
  sine: { deck: "#ffe7c4", side: "#c83d64", acc: "#ff805d" },
  over: { deck: "#fff0b5", side: "#7632a7", acc: "#ffba35" },
  inter: { deck: "#d8eeff", side: "#263f97", acc: "#ff64b0" },
  spec: { deck: "#f8e8ff", side: "#48235f", acc: "#55d9f5" },
  void: { deck: "#c9f5d8", side: "#154e35", acc: "#a8ff54" },
  crown: { deck: "#fff6d6", side: "#b8862a", acc: "#ff64b0" },
  moon: { deck: "#eef0ff", side: "#3b3f8f", acc: "#b9c2ff" },
  cone: { deck: "#fff4e0", side: "#2b2540", acc: "#ffd23a" },
  escher: { deck: "#f3efe4", side: "#3d3a4a", acc: "#8a7bd8" },
};
const ZI: Record<Zone, number> = Object.fromEntries(ZONES.map((z, i) => [z, i])) as Record<Zone, number>;

// ───────────── Dựng lưới gộp ─────────────
class Builder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  acc: number[] = [];
  info: number[] = []; // zone, top y
  private c = new THREE.Color();
  private a = new THREE.Color();
  tri(p: THREE.Vector3[], n: THREE.Vector3, color: string, acc: string, zone: number, top: number) {
    this.c.set(color);
    this.a.set(acc);
    for (const v of p) {
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(n.x, n.y, n.z);
      this.col.push(this.c.r, this.c.g, this.c.b);
      this.acc.push(this.a.r, this.a.g, this.a.b);
      this.info.push(zone, top);
    }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, n: THREE.Vector3 | null, color: string, acc: string, zone: number, top: number) {
    const nn = n ?? new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
    this.tri([a, b, c], nn, color, acc, zone, top);
    this.tri([a, c, d], nn, color, acc, zone, top);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aAcc", new THREE.Float32BufferAttribute(this.acc, 3));
    g.setAttribute("aInfo", new THREE.Float32BufferAttribute(this.info, 2));
    g.computeBoundingSphere();
    return g;
  }
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const DOWN = V(0, -1, 0);

/** Đĩa nổi: mặt trên + vành đứng + thân thuôn + đáy */
function addDisc(b: Builder, s: { x: number; z: number; y: number; r: number; thick: number }, zone: Zone, skipTop = false, deck?: string) {
  const P = deck ? { ...PALETTE[zone], deck } : PALETTE[zone];
  const zi = ZI[zone];
  const seg = Math.max(20, Math.min(72, Math.ceil(s.r * 5)));
  const y0 = s.y;
  const y1 = s.y - s.thick * 0.45;
  const y2 = s.y - s.thick;
  const r2 = s.r * 0.78;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    const p = (r: number, c: number, sn: number, y: number) => V(s.x + c * r, y, s.z + sn * r);
    if (!skipTop) b.tri([V(s.x, y0, s.z), p(s.r, c1, s1, y0), p(s.r, c0, s0, y0)], UP, P.deck, P.acc, zi, y0);
    const nm = V((c0 + c1) / 2, 0, (s0 + s1) / 2).normalize();
    b.quad(p(s.r, c0, s0, y0), p(s.r, c1, s1, y0), p(s.r, c1, s1, y1), p(s.r, c0, s0, y1), nm, P.side, P.acc, zi, y0);
    const nt = V(nm.x, -0.45, nm.z).normalize();
    b.quad(p(s.r, c0, s0, y1), p(s.r, c1, s1, y1), p(r2, c1, s1, y2), p(r2, c0, s0, y2), nt, P.side, P.acc, zi, y0);
    b.tri([V(s.x, y2, s.z), p(r2, c0, s0, y2), p(r2, c1, s1, y2)], DOWN, P.side, P.acc, zi, y0);
  }
}

/** Hộp xoay quanh y: tâm (x, z), nửa cạnh hx (trục x cục bộ), hz (trục z cục bộ), từ y0 lên y1 */
function addBox(b: Builder, x: number, z: number, hx: number, hz: number, yaw: number, y0: number, y1: number, zone: Zone, deckOverride?: string) {
  const P = PALETTE[zone];
  const zi = ZI[zone];
  const ax = V(Math.cos(yaw), 0, -Math.sin(yaw));
  const az = V(Math.sin(yaw), 0, Math.cos(yaw));
  const pt = (sx: number, sz: number, y: number) => V(x + ax.x * hx * sx + az.x * hz * sz, y, z + ax.z * hx * sx + az.z * hz * sz);
  const deck = deckOverride ?? P.deck;
  b.quad(pt(-1, -1, y1), pt(-1, 1, y1), pt(1, 1, y1), pt(1, -1, y1), UP, deck, P.acc, zi, y1);
  b.quad(pt(-1, -1, y0), pt(1, -1, y0), pt(1, 1, y0), pt(-1, 1, y0), DOWN, P.side, P.acc, zi, y1);
  const sides: [number, number, number, number, THREE.Vector3][] = [
    [1, -1, 1, 1, ax],
    [-1, 1, -1, -1, ax.clone().negate()],
    [1, 1, -1, 1, az],
    [-1, -1, 1, -1, az.clone().negate()],
  ];
  for (const [sx0, sz0, sx1, sz1, n] of sides) b.quad(pt(sx0, sz0, y1), pt(sx1, sz1, y1), pt(sx1, sz1, y0), pt(sx0, sz0, y0), n, P.side, P.acc, zi, y1);
}

/** Trụ tròn (ống đàn / thanh phổ) có nắp */
function addCylinder(b: Builder, x: number, z: number, r: number, y0: number, y1: number, color: string, acc: string, zone: Zone, seg = 14) {
  const zi = ZI[zone];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (a: number, y: number) => V(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
    const n = V(Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2));
    b.quad(p(a0, y1), p(a1, y1), p(a1, y0), p(a0, y0), n, color, acc, zi, y1);
    b.tri([V(x, y1, z), p(a1, y1), p(a0, y1)], UP, acc, color, zi, y1);
  }
}

/** Dải băng giấy hình sin dựng đứng (cột mốc khu Sóng sin): mặt trước + sau */
function addRibbon(b: Builder, x0: number, x1: number, z: number, yBase: number, amp: number, k: number, h: number, color: string, acc: string) {
  const zi = ZI.sine;
  const n = 64;
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n;
    const xb = x0 + ((x1 - x0) * (i + 1)) / n;
    const ya = yBase + amp * Math.sin(k * xa);
    const yb = yBase + amp * Math.sin(k * xb);
    b.quad(V(xa, ya + h, z), V(xb, yb + h, z), V(xb, yb, z), V(xa, ya, z), V(0, 0, -1), color, acc, zi, 999);
    b.quad(V(xb, yb + h, z + 0.05), V(xa, ya + h, z + 0.05), V(xa, ya, z + 0.05), V(xb, yb, z + 0.05), V(0, 0, 1), color, acc, zi, 999);
  }
}

/** Vòng giấy đứng (vân giao thoa): hình khuyên trong mặt phẳng x-y tại z */
function addHoop(b: Builder, cx: number, cy: number, z: number, r0: number, r1: number, color: string, acc: string, zone: Zone) {
  const zi = ZI[zone];
  const seg = 48;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const p = (r: number, a: number, dz: number) => V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z + dz);
    b.quad(p(r1, a0, 0), p(r1, a1, 0), p(r0, a1, 0), p(r0, a0, 0), V(0, 0, 1), color, acc, zi, 999);
    b.quad(p(r1, a1, -0.08), p(r1, a0, -0.08), p(r0, a0, -0.08), p(r0, a1, -0.08), V(0, 0, -1), color, acc, zi, 999);
  }
}

/** Vương miện: gai giấy quanh mép đĩa nghiêng ra ngoài */
function addCrownSpikes(b: Builder, x: number, y: number, z: number, r: number) {
  const P = PALETTE.crown;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 0.55;
    const h = i % 2 ? 2.2 : 3.6;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const bl = V(x + Math.cos(a - w / r) * r, y, z + Math.sin(a - w / r) * r);
    const br = V(x + Math.cos(a + w / r) * r, y, z + Math.sin(a + w / r) * r);
    const tip = V(x + c * (r + h * 0.35), y + h, z + s * (r + h * 0.35));
    b.tri([bl, br, tip], V(c, 0.3, s).normalize(), i % 2 ? P.acc : P.side, P.deck, ZI.crown, 999);
    b.tri([br, bl, tip], V(-c, 0.3, -s).normalize(), i % 2 ? P.acc : P.side, P.deck, ZI.crown, 999);
  }
}

function buildMaze(): THREE.BufferGeometry {
  const b = new Builder();
  // mặt chồng nhau cùng cao độ → hạ mặt vẽ theo tầng (chống z-fighting; va chạm vẫn theo Surf.y)
  const layer = renderLayers();
  for (const s of SURFS) {
    // đấu trường + đài nổi đã có hình riêng (ArenaFloor / Platforms trong Siren.tsx)
    if (s.zone === "arena") continue;
    const y = s.y - RENDER_SINK * (layer.get(s.id) ?? 0);
    if (s.kind === "disc") addDisc(b, { x: s.x, z: s.z, y, r: s.r!, thick: s.thick }, s.zone);
    else addBox(b, s.x, s.z, s.hx!, s.hz!, s.yaw!, y - s.thick, y, s.zone, s.step ? PALETTE[s.zone].acc : undefined);
    // đệm nảy: đĩa màu riêng nổi hẳn 3 cm (trước đây 1 mm → nhấp nháy với mặt đài)
    if (s.bounce) addDisc(b, { x: s.x, z: s.z, y: y + 0.03, r: s.r! * 0.82, thick: 0.05 }, s.zone, false, s.bounce > 1 ? "#a8ff54" : "#ffba35");
  }
  for (const w of WALLS) addBox(b, w.x, w.z, w.hx, w.hz, w.yaw, w.y0, w.y1, w.zone, PALETTE[w.zone].acc);
  // ống đàn vàng (chiều cao 24/n) + thanh phổ bảy sắc
  PIPES.forEach((p) => addCylinder(b, p.x, p.z, p.r, p.y0, p.y1, "#ffcf5a", "#7632a7", "over"));
  const spectrum = ["#ff5a7a", "#ffb03a", "#f5ef5a", "#5ae08a", "#55b6f5"];
  PILLARS.filter((p) => p.zone === "spec").forEach((p, i) => addCylinder(b, p.x, p.z, p.r, p.y0, p.y1, spectrum[i % spectrum.length], "#48235f", "spec", 10));
  // cột mốc Sóng sin: dải băng khổng lồ + hoạ âm bậc 2 phía sau
  addRibbon(b, -20, 20, 60, 10, 4, (2 * Math.PI) / 20, 2.2, "#c83d64", "#ffe7c4");
  addRibbon(b, -16, 16, 63, 15, 2, (2 * Math.PI) / 10, 1.2, "#ff805d", "#ffe7c4");
  // cột mốc Giao thoa: hai bộ vòng đồng tâm lệch tâm (hai nguồn sóng)
  for (let i = 0; i < 4; i++) {
    addHoop(b, -5, 9, -58, 2 + i * 2.4, 2.5 + i * 2.4, i % 2 ? "#ff64b0" : "#263f97", "#d8eeff", "inter");
    addHoop(b, 5, 9, -59, 2 + i * 2.4, 2.5 + i * 2.4, i % 2 ? "#263f97" : "#ff64b0", "#d8eeff", "inter");
  }
  addCrownSpikes(b, 0, 26, 40, 6);
  return b.geometry();
}

const PAPER_VERT = /* glsl */ `
attribute vec3 aAcc;
attribute vec2 aInfo;
varying vec3 vCol;
varying vec3 vAcc;
varying vec3 vN;
varying vec3 vW;
varying float vZone;
varying float vTop;
varying float vFogDepth;
void main(){
  vCol = color;
  vAcc = aAcc;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vZone = aInfo.x;
  vTop = aInfo.y;
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const PAPER_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uInk;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec3 vCol;
varying vec3 vAcc;
varying vec3 vN;
varying vec3 vW;
varying float vZone;
varying float vTop;
varying float vFogDepth;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// ngưỡng mềm theo kích thước điểm ảnh (khử răng cưa hoa văn)
float aa(float x, float e){ float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(e - w, e + w, x); }
// dải mảnh quanh 0 của hàm tuần hoàn (độ rộng d)
float line(float x, float d){ float f = abs(fract(x) - 0.5); return 1.0 - aa(f, d); }

vec3 spectral(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }

void main(){
  vec3 N = normalize(vN);
  vec3 base = vCol;
  vec3 acc = vAcc;
  int z = int(vZone + 0.5);
  float dist = vFogDepth;
  // hoa văn mờ dần về màu trung bình khi ô nhỏ hơn điểm ảnh
  float far = smoothstep(35.0, 90.0, dist);
  if (z == 9) {
    // Lồng Escher: mọi mặt là sàn — cùng một hoa văn bậc thang trên cả 6 mặt, mỗi mặt một sắc
    vec3 an = abs(N);
    vec2 q = (an.x > 0.5 ? vW.zy : an.y > 0.5 ? vW.xz : vW.xy) / 1.5;
    vec2 f = fract(q);
    base = vec3(0.95, 0.92, 0.86);
    float chk = mod(floor(q.x) + floor(q.y), 2.0);
    float stair = aa(f.x, f.y);
    base = mix(base, acc, 0.25 * chk + 0.3 * stair);
    base = mix(base, uInk, line(f.x - f.y + 0.5, 0.03) * 0.8);
    base *= an.x > 0.5 ? vec3(1.0, 0.92, 0.95) : an.z > 0.5 ? vec3(0.92, 0.97, 1.0) : vec3(1.0);
    float ndl0 = abs(dot(N, uSun));
    vec3 col0 = base * (ndl0 > 0.3 ? 1.1 : 0.9);
    col0 = mix(col0, fogColor, smoothstep(fogNear, fogFar, dist));
    gl_FragColor = vec4(col0, 1.0);
    return;
  }
  if (N.y > 0.6) {
    vec2 p = vW.xz;
    float m = 0.0;
    if (z == 1) { // Sóng sin: băng sóng
      float t = p.y * 0.42 + 0.9 * sin(p.x * 0.45);
      m = line(t, 0.06) + 0.45 * line(t * 2.0 + 0.5, 0.04);
    } else if (z == 2) { // Bồi âm: bàn cờ + chỉ vàng
      vec2 q = floor(p / 2.0);
      m = 0.35 * mod(q.x + q.y, 2.0) + line(p.x / 2.0, 0.025) * 0.6 + line(p.y / 2.0, 0.025) * 0.6;
    } else if (z == 3) { // Giao thoa: hai nguồn sóng
      float w = cos(2.3 * length(p - vec2(-6.0, -44.0))) + cos(2.3 * length(p - vec2(6.0, -44.0)));
      m = aa(w, 1.35) + 0.35 * (1.0 - aa(abs(w), 0.18));
    } else if (z == 4) { // Phổ: dải bảy sắc
      float h = floor(p.x / 2.5) / 7.0;
      base = mix(base, spectral(fract(h)) * 0.9 + 0.1, 0.32);
      m = line(p.x / 2.5, 0.03) * 0.7;
    } else if (z == 5) { // Đáy: chấm bán sắc xanh axit
      vec2 c = fract(p / 1.2) - 0.5;
      m = 1.0 - aa(length(c), 0.18 + 0.12 * sin(p.x * 0.2 + p.y * 0.15));
    } else if (z == 7) { // Đảo Trăng: hố va chạm bán sắc
      vec2 c = fract(p / 3.0) - 0.5;
      float h = hash(floor(p / 3.0));
      float rr = length(c + (h - 0.5) * 0.3);
      m = (1.0 - aa(rr, 0.12 + 0.2 * h)) * 0.6 + line(rr * 6.0, 0.04) * 0.3 * step(rr, 0.35);
    } else if (z == 8) { // Nón sáng: lưới 45° (c = 1) + mũi tên chỉ chiều "thời gian"
      m = line((p.x + p.y) / 1.5, 0.03) + line((p.x - p.y) / 1.5, 0.03);
      vec2 t = p.y < -46.0 ? p : p.yx;
      float chev = abs(fract(t.x / 2.0 - abs(fract(t.y / 6.0) - 0.5) * 0.8) - 0.5);
      m += (1.0 - aa(chev, 0.06)) * 0.7;
    } else if (z == 6) { // Vương miện: tia nắng
      float a = atan(p.y - 40.0, p.x);
      m = aa(sin(a * 12.0), 0.6) * 0.5 + line(length(p - vec2(0.0, 40.0)) / 1.5, 0.05);
    }
    base = mix(base, acc, clamp(m, 0.0, 1.0) * mix(0.55, 0.25, far));
  } else if (N.y > -0.6) {
    // cạnh: môi sáng → viền mực → thân có nếp giấy + răng cưa
    float d = vTop - vW.y;
    float u = (vW.x + vW.z) * 1.3;
    if (vTop < 900.0) {
      if (d < 0.1) base = mix(base, vec3(1.0, 0.97, 0.9), 0.85);
      else if (d < 0.18) base = uInk;
      else {
        base *= 0.92 + 0.08 * aa(fract(u), 0.5);
        float tooth = abs(fract(u * 0.5) - 0.5) * 0.6;
        base = mix(base, acc, (1.0 - aa(d - 0.3, tooth)) * 0.85);
      }
    } else {
      // cột mốc / dải băng: sọc trang trí
      base = mix(base, acc, line(vW.y * 0.8 + 0.2 * sin(u), 0.05) * 0.6);
    }
  } else {
    // mặt dưới: tối + chấm bán sắc
    base *= 0.55;
    vec2 c = fract(vW.xz / 0.9) - 0.5;
    base = mix(base, acc * 0.6, (1.0 - aa(length(c), 0.2)) * 0.5);
  }
  // hạt giấy
  base *= 0.975 + 0.05 * hash(floor(vW.xz * 18.0 + vW.y * 7.0));
  // toon 3 bậc, vùng tối ngả tím
  float ndl = dot(N, uSun);
  float band = ndl > 0.35 ? 1.0 : ndl > -0.05 ? 0.82 : 0.66;
  vec3 shade = mix(vec3(0.5, 0.44, 0.78), vec3(1.0), band) * (N.y > 0.6 ? 1.05 : 1.0);
  vec3 col = base * shade * 1.12;
  // sương
  float fogF = smoothstep(fogNear, fogFar, dist);
  col = mix(col, fogColor, fogF);
  gl_FragColor = vec4(col, 1.0);
}`;

export function makePaperMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: PAPER_VERT,
    fragmentShader: PAPER_FRAG,
    vertexColors: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: new THREE.Vector3(12, 20, 8).normalize() }, uInk: { value: new THREE.Color("#20172c") } }]),
  });
}

export function MazeGeometry() {
  const geo = useMemo(() => buildMaze(), []);
  const mat = useMemo(() => makePaperMaterial(), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh name="perf:maze" geometry={geo} material={mat} frustumCulled={false} />;
}

// ───────────── Phông cắt giấy (atlas 2×2 có sẵn) ─────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLAT_VERT = /* glsl */ `
attribute float aCell;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying float vFogDepth;
void main(){
  vec2 cell = vec2(mod(aCell, 2.0), 1.0 - floor(aCell / 2.0));
  vUv = (uv + cell) * 0.5;
  vec3 p = position;
  // lay nhẹ như phông treo
  p.x += sin(uTime * 0.5 + aSeed * 6.0 + position.y * 1.5) * 0.03;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
  w.y += sin(uTime * 0.4 + aSeed * 11.0) * 0.6;
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FLAT_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vUv;
varying float vFogDepth;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  vec3 c = t.rgb;
  c = mix(c, fogColor, smoothstep(fogNear, fogFar * 1.6, vFogDepth) * 0.85);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Phông giấy: to phi lý ở rìa (quay về đấu trường), nhỏ như đạo cụ trên sân khu */
export function CollageFlats() {
  const tex = useTexture(worldAsset("dungeon/lab_cutouts.webp"));
  const { mesh, mat } = useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const r = rng(7);
    const items: { pos: THREE.Vector3; size: number; yaw: number; tilt: number; cell: number }[] = [];
    // vành xa: 26 tấm khổng lồ ở bán kính 58–76, cao −30…40
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2;
      const rad = 58 + r() * 18;
      const size = 10 + r() * 26;
      items.push({ pos: new THREE.Vector3(Math.cos(a) * rad, -28 + r() * 66, Math.sin(a) * rad), size, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) + (r() - 0.5) * 0.5, tilt: (r() - 0.5) * 0.5, cell: i % 4 });
    }
    // đạo cụ nhỏ dựng quanh mép các sân khu
    const courts: [number, number][] = [
      [0, 44],
      [44, 0],
      [0, -44],
      [-44, 0],
    ];
    courts.forEach(([cx, cz], k) => {
      for (let j = 0; j < 3; j++) {
        const a = Math.atan2(cz, cx) + (j - 1) * 0.55 + Math.PI * 0.18;
        items.push({ pos: new THREE.Vector3(cx + Math.cos(a) * 9.2, 1.4, cz + Math.sin(a) * 9.2), size: 2.6 + r() * 1.4, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), tilt: 0, cell: (k + j) % 4 });
      }
    });
    const geo = new THREE.PlaneGeometry(1, 1);
    const cells = new Float32Array(items.length);
    const seeds = new Float32Array(items.length);
    const m = new THREE.ShaderMaterial({
      vertexShader: FLAT_VERT,
      fragmentShader: FLAT_FRAG,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uTime: { value: 0 } }]),
    });
    m.uniforms.uMap.value = tex;
    const im = new THREE.InstancedMesh(geo, m, items.length);
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.copy(it.pos);
      o.rotation.set(0, it.yaw, it.tilt);
      o.scale.setScalar(it.size);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      cells[i] = it.cell;
      seeds[i] = r();
    });
    geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 1));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    im.frustumCulled = false;
    im.name = "perf:flats";
    return { mesh: im, mat: m };
  }, [tex]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
    [mesh, mat],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return <primitive object={mesh} />;
}

// ───────────── Hoa hồng toán học cắt giấy (r = cos kθ) trôi trên trời ─────────────
const ROSE_VERT = /* glsl */ `
attribute vec4 aRose; // k, tốc độ quay, pha, bậc lớp
attribute vec3 aCa;
attribute vec3 aCb;
varying vec2 vP;
varying vec4 vRose;
varying vec3 vCa;
varying vec3 vCb;
varying float vFogDepth;
void main(){
  vP = position.xy * 2.0;
  vRose = aRose; vCa = aCa; vCb = aCb;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * w;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const ROSE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uInk;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
varying vec2 vP;
varying vec4 vRose;
varying vec3 vCa;
varying vec3 vCb;
varying float vFogDepth;
// bán kính đường hoa hồng có "độ dày giấy": r(θ) = base + amp·|cos(kθ/2)|^p
float rose(float a, float k, float base, float amp){ return base + amp * pow(abs(cos(a * k * 0.5)), 0.7); }
void main(){
  float k = vRose.x;
  float ang = atan(vP.y, vP.x) + uTime * vRose.y + vRose.z;
  float r = length(vP);
  // ba lớp giấy chồng nhau (ngoài → trong), mỗi lớp xoay lệch, có bóng đổ lệch xuống
  float r1 = rose(ang, k, 0.35, 0.6);
  float r2 = rose(ang + 0.6, k * 2.0, 0.22, 0.32);
  float r3 = 0.16 + 0.03 * sin(ang * k * 3.0);
  float sh = rose(atan(vP.y + 0.06, vP.x) + uTime * vRose.y + vRose.z, k, 0.35, 0.6);
  float w = fwidth(r) * 1.2;
  if (r > max(r1, sh) + w) discard;
  vec3 col = vec3(0.12, 0.08, 0.2) * 0.6; // bóng giấy
  float in1 = 1.0 - smoothstep(r1 - w, r1 + w, r);
  col = mix(col, vCa, in1);
  col = mix(col, uInk, in1 * (1.0 - smoothstep(0.0, w * 2.5, abs(r - r1 + w * 2.0))));
  float in2 = 1.0 - smoothstep(r2 - w, r2 + w, r);
  col = mix(col, vCb, in2);
  col = mix(col, uInk, in2 * (1.0 - smoothstep(0.0, w * 2.0, abs(r - r2 + w * 1.5))));
  float in3 = 1.0 - smoothstep(r3 - w, r3 + w, r);
  col = mix(col, vec3(1.0, 0.95, 0.82), in3);
  // chấm bán sắc trên lớp ngoài
  vec2 c = fract(vP * 9.0) - 0.5;
  col *= 1.0 - 0.18 * in1 * (1.0 - in2) * (1.0 - smoothstep(0.15, 0.2, length(c)));
  col = mix(col, fogColor, smoothstep(fogNear, fogFar * 1.8, vFogDepth) * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

export function MathRoses() {
  const { mesh, mat } = useMemo(() => {
    const r = rng(31);
    const n = 30;
    const geo = new THREE.PlaneGeometry(1, 1);
    const rose = new Float32Array(n * 4);
    const ca = new Float32Array(n * 3);
    const cb = new Float32Array(n * 3);
    const pal = ["#ff64b0", "#ffba35", "#55d9f5", "#a8ff54", "#c83d64", "#7632a7", "#ff805d", "#fff27a"];
    const col = new THREE.Color();
    const im = new THREE.InstancedMesh(geo, undefined as unknown as THREE.Material, n);
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const rad = 20 + r() * 52;
      const low = i % 3 === 0;
      o.position.set(Math.cos(a) * rad, low ? -26 + r() * 14 : 14 + r() * 34, Math.sin(a) * rad);
      // hoa nằm ngửa (nhìn từ dưới / trên) hoặc dựng nghiêng
      o.rotation.set(low ? -Math.PI / 2 : (r() - 0.5) * 1.2, r() * Math.PI * 2, 0);
      if (!low) o.lookAt(0, o.position.y * 0.6, 0);
      o.scale.setScalar(4 + r() * 12);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      rose.set([[3, 4, 5, 6, 7, 8][i % 6], (r() - 0.5) * 0.3, r() * 6, 0], i * 4);
      col.set(pal[i % pal.length]);
      ca.set([col.r, col.g, col.b], i * 3);
      col.set(pal[(i * 3 + 2) % pal.length]);
      cb.set([col.r, col.g, col.b], i * 3);
    }
    geo.setAttribute("aRose", new THREE.InstancedBufferAttribute(rose, 4));
    geo.setAttribute("aCa", new THREE.InstancedBufferAttribute(ca, 3));
    geo.setAttribute("aCb", new THREE.InstancedBufferAttribute(cb, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: ROSE_VERT,
      fragmentShader: ROSE_FRAG,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uInk: { value: new THREE.Color("#20172c") } }]),
    });
    im.material = m;
    im.frustumCulled = false;
    im.name = "perf:roses";
    return { mesh: im, mat: m };
  }, []);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mat.dispose();
    },
    [mesh, mat],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return <primitive object={mesh} />;
}

