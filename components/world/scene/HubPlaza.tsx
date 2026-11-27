"use client";
/**
 * Quảng trường Khởi nguyên (làm lại kiểu HSR) — `props/hub_plaza.glb` (Blender, GI nướng) + shader:
 *  • HubSky: hoàng hôn anime — thiên đỉnh xanh biếc → chân trời cam đào, mặt trời thấp tây bắc, mây tích viền vàng, mây ti.
 *  • Sàn: một đĩa lưới; shader vẽ hoa văn theo đúng toán của lib/world/hubLayout (lối toả tia, vòng sân, viền vàng, sao 8 cánh
 *    quanh hồ, bồn cỏ hoa) + vân đá cẩm thạch + mạch lát; ánh sáng = GI nướng (lightmap) + phản xạ môi trường (IBL).
 *  • Cỏ instanced có gió + rạp quanh chân người chơi; cây đung đưa; mặt hồ phản chiếu; mặt cổng xoáy; dây đàn lia sóng dừng.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { AXES, FOUNTAINS, GARDEN, GATES, GATE_BY_ID, MUSEUM, PATH_HALF, PAVILION, POOL, PROPS, RING_IN, RING_OUT, YARD, isBed, type GateId } from "@/lib/world/hubLayout";
import { BLADE_STRIDE, grassBlades } from "@/lib/world/hubGrass";
import { canopyMaskMaterial, foliageMaskMaterial, foliageMaterial } from "../fx/foliage";
import { FOCUS } from "../fx/nearFade";
import { INK_MASK } from "../fx/InkMask";
import { DAY } from "../fx/dayState";
import { Campfire, HubDayCycle, LampGlow } from "./HubNight";
import { BEAST_LOOKS, BEAST_PATHS, CosmicBeast } from "../fx/CosmicBeast";

/** kính đèn đường (HubDayCycle sáng lên về đêm) */
const LAMP_MATS: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
import { BAKED_U, type BakedUniforms } from "../fx/baked";
import { bakedPBR } from "../fx/realify";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { VoidEnvironment } from "./VoidHybrid";
import { HubWater, LAYER_NO_REFLECT } from "./HubWater";
import { flowMaterial } from "../fx/water";
import { StudyDoor } from "./study/StudyDoor";
import { noiseTex, streakTex } from "../fx/proceduralTex";
import { WIND } from "../fx/water";

const GLB = worldAsset("props/hub_plaza.glb");
useGLTF.preload(GLB);

/** Mặt trời hoàng hôn (khớp đèn nướng trong Blender): thấp, phía tây bắc → tượng đài + cổng bắc viền sáng ngược khi vừa vào */
export const HUB_SUN = new THREE.Vector3(-0.45, 0.38, -0.82).normalize();
const U: BakedUniforms = { uExposure: { value: 1.08 }, uFloor: { value: 0.34 }, uTint: { value: new THREE.Color(1.03, 0.99, 0.95) }, uScale: { value: 1.45 } };
const T = { value: 0 };

const NOISE = /* glsl */ `
  float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.103)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1.0,0.0)), f.x), mix(h2(i+vec2(0.0,1.0)), h2(i+vec2(1.0,1.0)), f.x), f.y); }
  float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

// ───────────── Bầu trời (theo giờ thật: màu 9 mốc giờ, mặt trời / trăng, sao — fx/dayState.ts) ─────────────
export function hubSky() {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSun: DAY.sun, uMoon: DAY.moon, uZen: DAY.zen, uHor: DAY.hor, uSunK: DAY.sunK, uNight: DAY.night },
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uZen; uniform vec3 uHor; uniform float uSunK; uniform float uNight; varying vec3 vD;
      ${NOISE}
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        float sd = max(dot(d, uSun), 0.0);
        float az = dot(normalize(vec2(d.x, d.z)), normalize(vec2(uSun.x, uSun.z) + 1e-4));
        float up = smoothstep(-0.12, 0.05, uSun.y);
        // thiên đỉnh → chân trời; phía mặt trời ấm cam đào khi mặt trời thấp (bình minh / hoàng hôn)
        vec3 zen = uZen;
        vec3 horSun = mix(uHor, vec3(1.0, 0.62, 0.36), 0.55 * up * (1.0 - smoothstep(0.25, 0.7, uSun.y)) + 0.25 * up);
        vec3 hor = mix(uHor, horSun, smoothstep(-0.4, 1.0, az));
        float hb = pow(1.0 - clamp(y, 0.0, 1.0), 4.0);
        vec3 c = mix(zen, hor, hb);
        // dưới chân trời: biển mây (tối dần về đêm)
        c = mix(c, mix(vec3(0.98, 0.82, 0.72), uHor * 0.6, uNight), smoothstep(0.02, -0.25, y));
        c += (vec3(1.0, 0.7, 0.4) * pow(sd, 6.0) * 0.55 + vec3(1.0, 0.85, 0.6) * pow(sd, 60.0) * 0.8) * up;
        // mặt trời
        c += vec3(1.0, 0.95, 0.85) * smoothstep(0.9994, 0.9997, sd) * 6.0 * up;
        // ban đêm: sao (lấp lánh) + mặt trăng có vết sẫm
        if (uNight > 0.01) {
          vec3 sp = d * 380.0;
          vec3 cell = floor(sp);
          float hs = fract(sin(dot(cell, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          float star = step(0.9965, hs) * smoothstep(0.42, 0.05, length(fract(sp) - 0.5));
          star *= 0.6 + 0.4 * sin(uT * (1.5 + hs * 4.0) + hs * 60.0);
          c += vec3(0.9, 0.95, 1.0) * star * 2.2 * uNight * smoothstep(0.02, 0.3, y);
          float md = dot(d, uMoon);
          float disc = smoothstep(0.99955, 0.99975, md);
          float mare = n2(d.xz * 900.0) * 0.35;
          c = mix(c, vec3(1.0, 0.97, 0.9) * (1.6 - mare), disc * uNight);
          c += vec3(0.55, 0.65, 1.0) * pow(max(md, 0.0), 80.0) * 0.25 * uNight;
        }
        // mây tích lớn gần chân trời — sáng ngày, xám lam về đêm
        float lit0 = mix(1.0, 0.16, uNight);
        if (y > -0.05 && y < 0.5) {
          float a = atan(d.z, d.x);
          vec2 q = vec2(a * 3.2, y * 9.0);
          float base = fbm2(q * vec2(1.0, 1.2) + vec2(uT * 0.004, 0.0));
          float tower = smoothstep(0.05, 0.42, 0.38 - y + base * 0.55 - 0.2) * smoothstep(-0.05, 0.05, y);
          float shade = fbm2(q * 2.2 + 3.0);
          vec3 lit = mix(vec3(1.0, 0.9, 0.86), vec3(1.0, 0.78, 0.6), smoothstep(-0.2, 1.0, az) * up);
          vec3 sh = mix(vec3(0.62, 0.6, 0.85), mix(vec3(0.85, 0.62, 0.7), uHor, 0.4), smoothstep(-0.2, 1.0, az));
          vec3 cc = mix(sh, lit, smoothstep(0.35, 0.65, shade + (y * 1.5))) * lit0;
          cc += vec3(1.0, 0.75, 0.4) * pow(sd, 4.0) * smoothstep(0.55, 0.75, shade) * 0.9 * up;
          c = mix(c, cc, tower * 0.95);
        }
        // mây ti mảnh trên cao
        if (y > 0.08) {
          vec2 p = d.xz / (y + 0.25) * 1.4 + vec2(uT * 0.006, uT * 0.002);
          float ci = fbm2(p * vec2(0.6, 2.4));
          float w = smoothstep(0.55, 0.85, ci) * smoothstep(0.08, 0.35, y) * (1.0 - smoothstep(0.7, 1.0, y));
          c = mix(c, mix(vec3(1.0, 0.92, 0.9), vec3(1.0, 0.75, 0.55), pow(sd, 2.0) * up) * lit0, w * 0.55);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
}
function HubSky() {
  const mat = useMemo(() => hubSky(), []);
  useEffect(() => () => mat.dispose(), [mat]);
  const g = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  useFrame(() => {
    mat.uniforms.uT.value = performance.now() / 1000;
    g.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={g} material={mat} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[480, 48, 24]} />
    </mesh>
  );
}

// ───────────── Sàn đá cẩm thạch (hoa văn theo toán bố cục) ─────────────
function floorMaterial(): THREE.Material {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.3, metalness: 0, envMapIntensity: 0.9 });
  const feats = [...GATES.map((g) => new THREE.Vector3(g.x, g.z, g.r)), new THREE.Vector3(MUSEUM.x, MUSEUM.z, MUSEUM.r), new THREE.Vector3(PAVILION.x, PAVILION.z, PAVILION.r), new THREE.Vector3(GARDEN.x, GARDEN.z, GARDEN.r), new THREE.Vector3(YARD.x, YARD.z, YARD.r)];
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uExposure: U.uExposure, uFloor: U.uFloor, uTint: U.uTint, uScale: U.uScale, uFeat: { value: feats }, uAxes: { value: AXES.map((a) => new THREE.Vector2(a[0], a[1])) }, uNoiseTex: { value: noiseTex() } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vW;
        uniform float uExposure; uniform float uFloor; uniform vec3 uTint; uniform float uScale;
        uniform vec3 uFeat[8]; uniform vec2 uAxes[8]; uniform sampler2D uNoiseTex;
        vec3 gBaked = vec3(1.0); float gRough = 0.3; float gMetal = 0.0;
        ${NOISE}
        float aaLine(float d, float w){ float fw = fwidth(d) + 1e-4; return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }`,
      )
      .replace(
        "#include <color_fragment>",
        `vec2 p = vW.xz;
        float r = length(p);
        // lối toả tia: khoảng cách ngang tới trục gần nhất + toạ độ dọc trục
        float pd = 1e9; float along = 0.0;
        for (int i = 0; i < 8; i++) { float al = dot(p, uAxes[i]); if (al < 0.0) continue; float dd = abs(p.x * uAxes[i].y - p.y * uAxes[i].x); if (dd < pd) { pd = dd; along = al; } }
        float feat = 1e9; float featD = 0.0;
        for (int i = 0; i < 8; i++) { float dd = length(p - uFeat[i].xy) - uFeat[i].z; if (dd < feat) { feat = dd; featD = length(p - uFeat[i].xy); } }
        float bed = (r > ${RING_IN.toFixed(1)} && r < ${RING_OUT.toFixed(1)} && pd > ${PATH_HALF.toFixed(1)} && feat > 0.6) ? 1.0 : 0.0;
        // vân đá cẩm thạch (uốn miền) + mạch lát
        vec4 nz = texture2D(uNoiseTex, p / 24.0);
        float v1 = nz.r;
        float vein = smoothstep(0.02, 0.0, abs(v1 - 0.52)) * 0.35 + smoothstep(0.012, 0.0, abs(texture2D(uNoiseTex, p / 12.0 + 0.37).g - 0.5)) * 0.2;
        vec3 marble = mix(vec3(0.96, 0.93, 0.88), vec3(0.9, 0.86, 0.8), texture2D(uNoiseTex, p / 6.0).b);
        marble -= vec3(0.12, 0.13, 0.12) * vein;
        float grout = 0.0; float groutAO = 0.0; vec2 tid;
        if (pd < ${PATH_HALF.toFixed(1)} && r > ${RING_IN.toFixed(1)} - 0.4) {
          vec2 q = vec2(along / 1.5 + 0.5, pd / 1.5);
          grout = max(aaLine(fract(q.x) - 0.5, 0.012), aaLine(fract(q.y) - 0.5, 0.012));
          groutAO = max(aaLine(fract(q.x) - 0.5, 0.045), aaLine(fract(q.y) - 0.5, 0.045));
          tid = floor(q);
        } else {
          float ang = atan(p.y, p.x);
          vec2 q = vec2(r / 1.2, ang / 0.1309 + 0.5);
          grout = max(aaLine(fract(q.x) - 0.5, 0.01 * 1.2), aaLine(fract(q.y) - 0.5, 0.012 * 7.0 / max(r, 1.0)));
          groutAO = max(aaLine(fract(q.x) - 0.5, 0.04), aaLine(fract(q.y) - 0.5, 0.05 * 7.0 / max(r, 1.0)));
          tid = floor(q) + 91.0;
        }
        // mỗi viên một sắc (ấm / lạnh / sẫm nhẹ) + vài viên "thay mới" sáng hơn — phá lưới lặp (Blue Protocol / Insomniac trim)
        float th = h2(tid + 17.0);
        marble *= 0.955 + 0.085 * th;
        marble = mix(marble, marble * vec3(1.035, 0.995, 0.93), step(0.72, th) * 0.75);
        marble = mix(marble, marble * vec3(0.95, 0.975, 1.03), step(th, 0.16) * 0.75);
        marble = mix(marble, vec3(0.99, 0.97, 0.93), step(0.965, h2(tid + 3.3)) * 0.6);
        // mảng màu lớn (vài chục mét) + mòn bóng giữa lối nơi chân bước nhiều
        marble *= 0.955 + 0.09 * texture2D(uNoiseTex, p / 46.0 + 0.21).g;
        vec3 col = marble * (1.0 - grout * 0.26 - groutAO * 0.07);
        gRough = 0.2 + texture2D(uNoiseTex, p / 3.0).a * 0.12; gMetal = 0.0;
        // dải đá xanh lam + sao 8 cánh quanh hồ
        float star = 0.0;
        { float ang = atan(p.y, p.x); float k = abs(fract(ang / 0.7854) - 0.5) * 2.0; float rr = mix(10.9, 8.9, k); star = step(r, rr) * step(${POOL.rim.toFixed(2)} + 0.5, r); }
        // sao 8 cánh: nền đá kem ấm (chỉ đường viền vàng nổi), không mảng xanh như vũng nước
        col = mix(col, vec3(0.93, 0.88, 0.8) * (0.95 + 0.1 * nz.b), star * 0.9);
        float slateRing = step(30.2, r) * step(r, 30.9);
        col = mix(col, vec3(0.24, 0.36, 0.48), slateRing);
        // viền vàng (khảm kim loại): mép lối toả tia, các vòng, mép sao
        float gold = 0.0;
        if (r > ${RING_IN.toFixed(1)} && r < ${RING_OUT.toFixed(1)}) gold = max(gold, aaLine(pd - ${PATH_HALF.toFixed(1)} + 0.18, 0.05));
        gold = max(gold, aaLine(r - 11.85, 0.05)); gold = max(gold, aaLine(r - 29.45, 0.05)); gold = max(gold, aaLine(r - 30.05, 0.04)); gold = max(gold, aaLine(r - 31.05, 0.04)); gold = max(gold, aaLine(r - 34.9, 0.05));
        gold = max(gold, aaLine(r - ${(POOL.rim + 0.25).toFixed(2)}, 0.04));
        { float ang = atan(p.y, p.x); float k = abs(fract(ang / 0.7854) - 0.5) * 2.0; float rr = mix(10.9, 8.9, k); gold = max(gold, aaLine(r - rr, 0.04) * step(${POOL.rim.toFixed(2)} + 0.5, r)); }
        // tia la bàn mảnh giữa lối
        if (pd < 0.05 && r > ${RING_IN.toFixed(1)}) gold = max(gold, aaLine(pd, 0.03));
        col = mix(col, vec3(0.95, 0.72, 0.36), gold);
        gMetal = mix(gMetal, 1.0, gold); gRough = mix(gRough, 0.25, gold);
        // bồn cỏ: nền cỏ biến sắc + hoa nhỏ; viền đá thấp quanh bồn
        if (bed > 0.5) {
          float g = texture2D(uNoiseTex, p / 20.0).b;
          vec3 grass = mix(vec3(0.24, 0.5, 0.18), vec3(0.46, 0.68, 0.26), g);
          grass = mix(grass, vec3(0.62, 0.72, 0.3), smoothstep(0.6, 0.8, texture2D(uNoiseTex, p / 55.0 + 0.5).b) * 0.5);
          vec2 cell = floor(p * 2.2); vec2 f = fract(p * 2.2) - 0.5; float hh = h2(cell);
          float flower = step(0.9, hh) * smoothstep(0.17, 0.08, length(f - (vec2(h2(cell + 3.1), h2(cell + 7.7)) - 0.5) * 0.5));
          vec3 fc = hh > 0.97 ? vec3(1.0, 0.95, 0.6) : hh > 0.935 ? vec3(1.0, 0.7, 0.82) : vec3(0.95, 0.95, 1.0);
          grass = mix(grass, fc, flower);
          float edge = min(pd - ${PATH_HALF.toFixed(1)}, min(r - ${RING_IN.toFixed(1)}, ${RING_OUT.toFixed(1)} - r));
          float curb = 1.0 - smoothstep(0.22, 0.26, edge);
          col = mix(grass, vec3(0.88, 0.84, 0.78), curb);
          gRough = mix(0.95, 0.4, curb); gMetal = 0.0;
        }
        // vườn sinh vật: cỏ; bãi tập: vòng đá xanh
        if (length(p - uFeat[6].xy) < uFeat[6].z) { col = mix(vec3(0.28, 0.55, 0.2), vec3(0.5, 0.72, 0.3), texture2D(uNoiseTex, p / 18.0).b); gRough = 0.95; }
        if (length(p - uFeat[7].xy) < uFeat[7].z) { float rr = length(p - uFeat[7].xy); col = mix(col, vec3(0.3, 0.42, 0.55), step(rr, 3.6) * (0.55 + 0.1 * step(0.5, fract(atan(p.y - uFeat[7].y, p.x - uFeat[7].x) / 0.3927)))); }
        diffuseColor.rgb = col;
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          vec3 irr = pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)) * uScale;
          float lum = dot(irr, vec3(0.3, 0.59, 0.11));
          vec3 tint = min((irr + 0.06) / (lum + 0.06), vec3(2.2));
          gBaked = tint * max(lum, uFloor) * uExposure * uTint;
          gBaked *= mix(vec3(0.82, 0.87, 1.12), vec3(1.035, 1.0, 0.95), smoothstep(0.22, 0.85, lum));
        #endif`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = gRough;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = gMetal;")
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        reflectedLight.directDiffuse = vec3(0.0);
        reflectedLight.indirectDiffuse = material.diffuseColor * gBaked;
        float specOcc = clamp(dot(gBaked, vec3(0.3, 0.59, 0.11)) * 1.1, 0.1, 1.0);
        reflectedLight.indirectSpecular *= specOcc;
        reflectedLight.directSpecular *= specOcc * 0.6;`,
      );
  };
  m.customProgramCacheKey = () => "hub-floor";
  return m;
}

// ───────────── Mô hình + vật liệu ─────────────
function useHubMats() {
  return useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    return (s: THREE.MeshStandardMaterial, flat: boolean) => {
      const key = `${s.name}|${flat}`;
      let m = cache.get(key);
      if (m) return m;
      if (s.name.startsWith("glow_")) {
        const gm = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(s.name === "glow_lamp" ? 3.2 : 2.4), toneMapped: false });
        if (s.name === "glow_lamp") LAMP_MATS.push({ mat: gm, base: s.color.clone() });
        m = gm;
      }
      else if (s.name === "hp_floor") m = floorMaterial();
      else if (s.name === "h_glass") m = new THREE.MeshPhysicalMaterial({ color: "#cfefff", metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
      else {
        // đáy hồ: gạch xanh ngọc nhạt (nước trong nhìn xuống thấy sáng như hồ anime, không xám)
        const base = new THREE.MeshBasicMaterial({ color: s.name === "hm_pool" ? new THREE.Color("#a6e2e0") : s.color.clone(), vertexColors: true });
        if (/^h_leaf/.test(s.name)) base.color.multiply(new THREE.Color(0.58, 0.66, 0.66));
        else if (/^h_blossom/.test(s.name)) base.color.multiply(new THREE.Color(0.7, 0.56, 0.72));
        base.name = s.name;
        BAKED_U.set(base, U);
        // vàng: kim loại thật; đá: bóng nhẹ; lá / vỏ cây: nhám
        m = bakedPBR(base, U, flat, s.name.startsWith("hg_") ? "gold" : s.name.startsWith("hm_") ? "marble" : s.name.startsWith("h_leaf") || s.name.startsWith("h_blossom") ? "leaf" : s.name === "h_wood" || s.name === "h_bark" ? "wood" : s.name.startsWith("h_rock") || s.name === "h_earth" ? "rock" : s.name === "hb_grass" ? "rug" : "plaster");
        base.dispose();
      }
      m.name = s.name;
      cache.set(key, m);
      return m;
    };
  }, []);
}

// thân cây làm lại (hub_props6: thân cong, rễ bạnh, cành vút) thay phần vỏ h_bark cũ trong hx_tree/hx_blossom; đài phun hx_fountain2 (bể 16 thùy, bát múi, vỏ sò)
const PROP_NODES = { tree: ["hx_tree", "hx_tree_leaves", "hx_tree_trunk"], blossom: ["hx_blossom", "hx_blossom_leaves", "hx_blossom_trunk"], lamp: ["hx_lamp", "hx_lamp_glow"], bench: ["hx_bench"], fountain: ["hx_fountain2", "hx_fountain_glow"] } as const;
const OLD_BARK = new Set(["hx_tree", "hx_blossom"]);
const ALL_PROPS = [...PROPS, ...FOUNTAINS.map((f) => ({ kind: "fountain" as const, x: f.x, z: f.z, yaw: Math.PI / 8, s: 1 }))];

function HubModel() {
  const gltf = useGLTF(GLB);
  const conv = useHubMats();
  const { root, rings, core, vox } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const propNames = new Set(Object.values(PROP_NODES).flat() as string[]);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const flat = !m.geometry.getAttribute("normal");
      m.material = Array.isArray(m.material) ? m.material.map((x) => conv(x as THREE.MeshStandardMaterial, flat)) : conv(m.material as THREE.MeshStandardMaterial, flat);
    });
    // đạo cụ instanced: ẩn bản gốc ở gốc toạ độ
    for (const n of propNames) {
      const o = root.getObjectByName(n);
      if (o) o.visible = false;
    }
    const rings = [0, 1, 2].flatMap((k) => [root.getObjectByName(`hx_ring${k}`), root.getObjectByName(`hx_ring${k}_glow`)]).filter(Boolean) as THREE.Object3D[];
    return { root, rings, core: root.getObjectByName("hx_core") ?? null, vox: root.getObjectByName("hx_gate_expanse_vox") ?? null };
  }, [gltf, conv]);
  const base = useMemo(() => rings.map((r) => r.quaternion.clone()), [rings]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const q = new THREE.Quaternion();
    rings.forEach((r, i) => {
      const k = Math.floor(i / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), t * (0.14 + k * 0.09) * (k % 2 ? -1 : 1));
      r.quaternion.copy(base[i]).multiply(q);
    });
    if (core) core.scale.setScalar(1 + 0.05 * Math.sin(t * 1.6));
    if (vox) vox.rotation.y = GATE_BY_ID.expanse.yaw + Math.sin(t * 0.4) * 0.15;
  });
  return <primitive object={root} name="perf:model" />;
}

/** Cây / cây hoa / đèn / ghế: nhân bản theo PROPS; tán cây đung đưa theo gió (đỉnh lay nhiều, gốc đứng yên) */
function HubProps() {
  const gltf = useGLTF(GLB);
  const conv = useHubMats();
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    const masks: THREE.InstancedMesh[] = [];
    for (const [kind, names] of Object.entries(PROP_NODES)) {
      const list = ALL_PROPS.filter((p) => p.kind === kind);
      if (!list.length) continue;
      for (const n of names) {
        const node = gltf.scene.getObjectByName(n);
        node?.updateWorldMatrix(true, true);
        node?.traverse((o) => {
          const src = o as THREE.Mesh;
          if (!src.isMesh) return;
          const flat = !src.geometry.getAttribute("normal");
          // thẻ lá kiểu Genshin (fx/foliage.ts): vật liệu riêng + bản sao trên layer mặt nạ (Ink bỏ viền trong tán)
          const srcName = (src.material as THREE.Material).name;
          if (srcName === "h_bark" && OLD_BARK.has(n)) return;
          if (srcName.startsWith("h_card")) {
            const fk = srcName === "h_card_blossom" ? "blossom" : "leaf";
            const local = src.matrixWorld.clone();
            const m4 = new THREE.Matrix4();
            const mk = (material: THREE.Material, layer: number) => {
              const im = new THREE.InstancedMesh(src.geometry, material, list.length);
              list.forEach((p, i) => {
                m4.makeRotationY(p.yaw).scale(new THREE.Vector3(p.s, p.s, p.s)).setPosition(p.x, 0, p.z);
                im.setMatrixAt(i, m4.multiply(local));
              });
              im.frustumCulled = false;
              im.layers.set(layer);
              return im;
            };
            const fm = foliageMaterial(fk, HUB_SUN);
            // hướng nắng + độ sáng theo giờ thật
            fm.uniforms.uSun = DAY.light;
            fm.uniforms.uLevel = DAY.level;
            out.push(mk(fm, LAYER_NO_REFLECT));
            // bản sao mặt nạ nằm trong scene riêng của InkMask (không làm lượt mặt nạ duyệt cả cảnh)
            masks.push(mk(foliageMaskMaterial(), 0));
            return;
          }
          const mat0 = conv(src.material as THREE.MeshStandardMaterial, flat);
          let mat = mat0;
          if (kind === "tree" || kind === "blossom") {
            // gió: bản sao vật liệu có dịch đỉnh theo độ cao (pha theo vị trí cây)
            mat = mat0.clone();
            const prev = mat0.onBeforeCompile;
            mat.onBeforeCompile = (sh, r) => {
              prev.call(mat0, sh, r);
              sh.uniforms.uWind = WIND.t;
              sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind;").replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
                #ifdef USE_INSTANCING
                  float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
                #else
                  float ph = 0.0;
                #endif
                float hk = max(0.0, position.y - 2.2) * 0.07;
                transformed.x += sin(uWind * 1.3 + ph) * hk + sin(uWind * 3.1 + ph * 2.0 + position.y) * hk * 0.25;
                transformed.z += cos(uWind * 1.1 + ph) * hk * 0.6;`,
              );
            };
            mat.customProgramCacheKey = () => `${mat0.customProgramCacheKey()}|wind`;
          }
          const im = new THREE.InstancedMesh(src.geometry, mat, list.length);
          const local = src.matrixWorld.clone();
          const m4 = new THREE.Matrix4();
          list.forEach((p, i) => {
            m4.makeRotationY(p.yaw).scale(new THREE.Vector3(p.s, p.s, p.s)).setPosition(p.x, 0, p.z);
            im.setMatrixAt(i, m4.multiply(local));
          });
          im.frustumCulled = false;
          // cây / đèn / ghế không cần trong ảnh phản chiếu mặt hồ (tiết kiệm nửa lượt vẽ)
          if (kind !== "fountain") im.layers.set(LAYER_NO_REFLECT);
          out.push(im);
          // khối tán: thêm vào mặt nạ Ink (không kẻ nét giữa các cục cầu)
          if (/^h_(leaf|blossom)/.test(srcName)) {
            const mk = new THREE.InstancedMesh(src.geometry, canopyMaskMaterial(), list.length);
            for (let i = 0; i < list.length; i++) {
              im.getMatrixAt(i, m4);
              mk.setMatrixAt(i, m4);
            }
            mk.frustumCulled = false;
            masks.push(mk);
          }
        });
      }
    }
    return { out, masks };
  }, [gltf, conv]);
  useEffect(() => {
    INK_MASK.scene.add(...meshes.masks);
    return () => {
      INK_MASK.scene.remove(...meshes.masks);
    };
  }, [meshes]);
  useFrame((state) => {
    T.value = state.clock.elapsedTime;
    // đầu nhân vật: tán / thân cây nằm giữa camera và nhân vật thì tan dither (fx/nearFade)
    const p = useWorld.getState().player;
    FOCUS.value.set(p.x, p.y + 1.3, p.z);
  });
  useEffect(
    () => () => {
      FOCUS.value.set(0, -1e4, 0);
    },
    [],
  );
  return (
    <>
      {meshes.out.map((m, i) => (
        <primitive key={i} object={m} name="perf:props" />
      ))}
    </>
  );
}

// ───────────── Cỏ instanced: cụm lá cong, bóng tròn, nắng xuyên ngọn, sóng gió; chia 12 cụm để cắt khung nhìn ─────────────
/**
 * Cỏ kiểu Genshin / Ghost of Tsushima (nghiên cứu Codex 2026-11, docs/ai-reviews/game-3d/RENDER_RESEARCH.md):
 *  • lá = đường cong Bézier bậc 3 (gốc → ngọn), 9 đỉnh / 7 tam giác, ngọn nhọn; dáng / cụm gieo ở lib/world/hubGrass.ts;
 *  • màu gốc = ĐÚNG màu nền bồn tại chỗ mọc (cùng noise texture với sàn) → cỏ mọc ra từ đất, không phải lớp dán lên;
 *    ngọn sáng hơn 16–20%, ngả vàng nhẹ; sắc độ cụm ±10%;
 *  • pháp tuyến hoà 80% (gần) → 92% (xa) về pháp tuyến mặt đất → không nhấp nháy sáng / tối khi xoay camera;
 *  • gió 2 lớp: sóng 8 m + 2,2 m, ngọn lệch 6–18% chiều cao; rạp bán kính 1 m, ngọn hạ tối đa 45%;
 *  • AO gốc 0,82 → 1 ở 45% chiều cao; ánh xuyên lá 0,12 × nắng; không specular bóng nhựa;
 *  • xa 22–36 m: hoà về màu nền + thu thấp dần (không "bật / tắt").
 */
const GRASS_VS = /* glsl */ `attribute float aY; attribute float aX; attribute vec4 aOff; attribute vec4 aB;
  uniform float uT; uniform vec3 uP; uniform vec2 uWindDir; uniform float uGust; uniform sampler2D uNoiseTex;
  varying float vY; varying vec3 vLeaf; varying vec3 vGround; varying float vShade; varying float vFade;
  void main(){
    float t = aY, q = 1.0 - t, s = aX;
    float h = aB.x;
    vec2 lean = vec2(cos(aOff.w), sin(aOff.w));
    vec3 side = vec3(-lean.y, 0.0, lean.x);
    vec2 base = aOff.xy;
    float fade = smoothstep(22.0, 36.0, length(base - cameraPosition.xz));
    // gió 2 lớp chạy theo hướng gió (thấy đợt gió lướt qua cả bồn), lệch ngọn 6–18% chiều cao
    float x = dot(base, uWindDir);
    float gust = 0.06 + 0.05 * uGust + 0.045 * sin(0.78 * x - 1.7 * uT) + 0.02 * sin(2.85 * x - 2.6 * uT + aB.w * 30.0);
    vec2 wind = uWindDir * gust * (1.0 - 0.7 * fade);
    // rạp quanh người chơi: đẩy ra xa, hạ ngọn
    vec2 away = base - uP.xz; float d = length(away);
    float press = (1.0 - smoothstep(0.15, 1.0, d)) * step(abs(uP.y), 1.2);
    vec2 bend = wind + 0.75 * press * away / max(d, 0.15);
    vec2 mid = 0.35 * bend + lean * (0.25 * aB.z);
    vec2 tip = bend + lean * aB.z;
    vec3 p1 = h * vec3(0.0, 0.31, 0.0);
    vec3 p2 = h * vec3(mid.x, 0.72 - 0.2 * press, mid.y);
    vec3 p3 = h * vec3(tip.x, 1.0 - 0.45 * press - 0.25 * dot(tip, tip), tip.y);
    vec3 center = 3.0 * q * q * t * p1 + 3.0 * q * t * t * p2 + t * t * t * p3;
    vec3 tangent = q * q * p1 + 2.0 * q * t * (p2 - p1) + t * t * (p3 - p2);
    float shrink = 1.0 - 0.85 * fade;
    vec3 w = vec3(base.x, 0.0, base.y) + (center + side * (0.5 * aB.y * s * q * (1.0 + t))) * shrink;
    vLeaf = normalize(cross(side, normalize(tangent + vec3(0.0, 1e-4, 0.0))) + 0.35 * s * side);
    vY = t; vShade = aB.w; vFade = fade;
    // màu nền bồn tại gốc (khớp floorMaterial: bồn p/20 + mảng khô p/55; vườn p/18)
    vec3 g;
    if (aOff.z > 0.5) g = mix(vec3(0.28, 0.55, 0.2), vec3(0.5, 0.72, 0.3), texture2D(uNoiseTex, base / 18.0).b);
    else {
      g = mix(vec3(0.24, 0.5, 0.18), vec3(0.46, 0.68, 0.26), texture2D(uNoiseTex, base / 20.0).b);
      g = mix(g, vec3(0.62, 0.72, 0.3), smoothstep(0.6, 0.8, texture2D(uNoiseTex, base / 55.0 + 0.5).b) * 0.5);
    }
    vGround = g;
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const GRASS_FS = /* glsl */ `uniform vec3 uSun; uniform vec3 uAmb; uniform vec3 uSunCol;
  varying float vY; varying vec3 vLeaf; varying vec3 vGround; varying float vShade; varying float vFade;
  void main(){
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 leaf = normalize(vLeaf) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 n = normalize(mix(leaf, up, mix(0.8, 0.92, vFade)));
    float top = smoothstep(0.05, 1.0, vY);
    vec3 albedo = vGround * mix(vec3(1.0), vec3(1.16, 1.2, 1.01), top) * (1.0 + vShade * (0.4 + 0.6 * top));
    float ao = mix(0.82, 1.0, smoothstep(0.0, 0.45, vY));
    float diffuse = smoothstep(-0.15, 0.85, dot(n, uSun));
    float trans = 0.12 * top * max(-dot(leaf, uSun), 0.0);
    vec3 lit = albedo * (uAmb * ao + uSunCol * (diffuse + trans));
    vec3 ground = vGround * (uAmb + uSunCol * smoothstep(-0.15, 0.85, uSun.y));
    gl_FragColor = vec4(mix(lit, ground, vFade), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function HubGrass() {
  const vfx = useGfx((s) => s.vfx);
  const chunks = useMemo(() => {
    // lá Bézier: 4 đoạn, ngọn 1 đỉnh (9 đỉnh / 7 tam giác); aX = mép (−1 / +1, ngọn 0), aY = 0 gốc → 1 ngọn
    const X: number[] = [];
    const Y: number[] = [];
    for (let i = 0; i < 4; i++) X.push(-1, 1), Y.push(i / 4, i / 4);
    X.push(0);
    Y.push(1);
    const idx: number[] = [];
    for (let i = 0; i < 3; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    idx.push(6, 7, 8);
    const P = new Float32Array(X.length * 3);
    return grassBlades([12000, 32000, 60000][vfx]).map((list) => {
      const g = new THREE.InstancedBufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(P, 3));
      g.setAttribute("aY", new THREE.Float32BufferAttribute(Y, 1));
      g.setAttribute("aX", new THREE.Float32BufferAttribute(X, 1));
      g.setIndex(idx);
      const n = list.length / BLADE_STRIDE;
      const off = new Float32Array(n * 4);
      const bl = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        off.set(list.subarray(i * BLADE_STRIDE, i * BLADE_STRIDE + 4), i * 4);
        bl.set(list.subarray(i * BLADE_STRIDE + 4, i * BLADE_STRIDE + 8), i * 4);
      }
      g.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4));
      g.setAttribute("aB", new THREE.InstancedBufferAttribute(bl, 4));
      g.instanceCount = n;
      // khung bao thật của cụm (nới theo biên độ gió / rạp) → three cắt bỏ cụm ngoài khung nhìn
      let mx = 0;
      let mz = 0;
      for (let i = 0; i < n; i++) (mx += off[i * 4] / n), (mz += off[i * 4 + 1] / n);
      let rad = 0;
      for (let i = 0; i < n; i++) rad = Math.max(rad, Math.hypot(off[i * 4] - mx, off[i * 4 + 1] - mz));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(mx, 0.25, mz), rad + 0.8);
      return g;
    });
  }, [vfx]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: WIND.t,
          uP: { value: new THREE.Vector3() },
          // nắng / ánh trời theo giờ thật (HubDayCycle)
          uSun: DAY.light,
          uAmb: DAY.grassAmb,
          uSunCol: DAY.grassSun,
          uWindDir: WIND.dir,
          uGust: WIND.gust,
          uNoiseTex: { value: noiseTex() },
        },
        vertexShader: GRASS_VS,
        fragmentShader: GRASS_FS,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(
    () => () => {
      chunks.forEach((g) => g.dispose());
      mat.dispose();
    },
    [chunks, mat],
  );
  useFrame(() => {
    mat.uniforms.uP.value.copy(useWorld.getState().player);
  });
  return (
    <>
      {chunks.map((g, i) => (
        <mesh key={i} name="perf:grass" geometry={g} material={mat} ref={(o: THREE.Mesh | null) => void o?.layers.set(LAYER_NO_REFLECT)} />
      ))}
    </>
  );
}

// ───────────── Mặt cổng: xoáy mang màu thế giới đích ─────────────
const GATE_LOOK: Record<GateId, { a: string; b: string; shape: number; y: number; r: number }> = {
  impossible: { a: "#b58bff", b: "#ff9ec0", shape: 1, y: 3.2, r: 2.35 },
  valley: { a: "#7dff9a", b: "#ffe27a", shape: 0, y: 2.75, r: 2.4 },
  expanse: { a: "#7fc8ff", b: "#9dffb0", shape: 0, y: 3.15, r: 2.35 },
  siren: { a: "#ff9ec0", b: "#7fe3ff", shape: 0, y: 3.6, r: 2.0 },
};
function gateMaterial(a: string, b: string, shape: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: T, uA: { value: new THREE.Color(a) }, uB: { value: new THREE.Color(b) }, uShape: { value: shape }, uNear: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uA; uniform vec3 uB; uniform float uShape; uniform float uNear; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 p = vUv;
        // mặt nạ: tròn (0) hoặc tam giác đều (1)
        float d = uShape < 0.5 ? length(p) - 0.98 : max(-p.y - 0.5, max(dot(p, vec2(0.866, 0.5)), dot(p, vec2(-0.866, 0.5))) - 0.5) * 1.6;
        if (d > 0.0) discard;
        float r = length(p); float a = atan(p.y, p.x);
        float sw = fbm2(vec2(a * 1.6 + uT * 0.6 - r * 3.5, r * 2.5 - uT * 0.8));
        vec3 c = mix(uA, uB, sw);
        c *= 0.55 + 1.2 * pow(sw, 2.0);
        c += vec3(1.0) * smoothstep(0.35, 0.0, r) * (0.6 + 0.4 * uNear);
        float rim = smoothstep(-0.12, 0.0, d);
        c += mix(uA, vec3(1.0), 0.5) * rim * 2.0;
        gl_FragColor = vec4(c * (1.4 + uNear * 0.8), 0.78 + rim * 0.2);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
function GatePortals() {
  const mats = useMemo(() => Object.fromEntries(GATES.map((g) => [g.id, gateMaterial(GATE_LOOK[g.id].a, GATE_LOOK[g.id].b, GATE_LOOK[g.id].shape)])) as Record<GateId, THREE.ShaderMaterial>, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame(() => {
    const p = useWorld.getState().player;
    for (const g of GATES) {
      const near = Math.hypot(p.x - g.x, p.z - g.z) < g.r + 2 ? 1 : 0;
      mats[g.id].uniforms.uNear.value += (near - mats[g.id].uniforms.uNear.value) * 0.08;
    }
  });
  return (
    <>
      {GATES.map((g) => {
        const L = GATE_LOOK[g.id];
        return (
          <group key={g.id} position={[g.gx, 0.45, g.gz]} rotation-y={g.yaw}>
            <mesh position={[0, L.y, 0]} material={mats[g.id]}>
              <planeGeometry args={[L.r * 2, L.r * 2]} />
            </mesh>
            {g.id === "siren" && <LyreStrings />}
          </group>
        );
      })}
    </>
  );
}
/** Dây đàn lia: 7 dây dao động sóng dừng (mode n = 1…7), nhấp nháy sáng ở bụng sóng */
function LyreStrings() {
  const { geo, mat } = useMemo(() => {
    const N = 7;
    const SEG = 40;
    const P: number[] = [];
    const A: number[] = [];
    for (let s = 0; s < N; s++)
      for (let i = 0; i < SEG; i++) {
        for (const t of [i / SEG, (i + 1) / SEG]) {
          P.push(-1.5 + (s * 3) / (N - 1), 1.0 + t * 5.0, 0.05);
          A.push(s + 1, t);
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(A, 2));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: T },
      vertexShader: "attribute vec2 aS; uniform float uT; varying float vB; void main(){ float w = sin(aS.y * 3.14159 * aS.x) * sin(uT * (2.0 + aS.x * 0.9)); vB = abs(w); vec3 p = position; p.x += w * 0.09; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }",
      fragmentShader: "varying float vB; void main(){ gl_FragColor = vec4(mix(vec3(1.0, 0.85, 0.95), vec3(0.6, 0.95, 1.0), vB) * (1.6 + vB * 1.6), 0.9); }",
      transparent: true,
      toneMapped: false,
    });
    return { geo: g, mat };
  }, []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <lineSegments geometry={geo} material={mat} />;
}

// ───────────── Hologram bảo tàng + mặt gương ─────────────
function MuseumHolo() {
  const g = useRef<THREE.Group>(null);
  const mats = useMemo(() => ({ a: new THREE.MeshBasicMaterial({ color: new THREE.Color("#7fe3ff").multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.85, toneMapped: false }), b: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.2), wireframe: true, toneMapped: false }) }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.children[0].rotation.y += dt * 0.5;
    g.current.children[0].rotation.x += dt * 0.2;
    g.current.children[1].rotation.y -= dt * 0.8;
  });
  return (
    <group ref={g} position={[MUSEUM.x, MUSEUM.h + 2.25, MUSEUM.z]}>
      <mesh material={mats.a}>
        <icosahedronGeometry args={[0.85, 0]} />
      </mesh>
      <mesh material={mats.b}>
        <dodecahedronGeometry args={[0.5, 0]} />
      </mesh>
    </group>
  );
}
function MirrorSurface() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: T },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: /* glsl */ `uniform float uT; varying vec2 vUv;
          void main(){
            vec2 p = (vUv - 0.5) * vec2(2.0, 2.0);
            if (length(p * vec2(1.0, 0.7)) > 0.98) discard;
            float s = sin(p.y * 6.0 + uT * 0.8 + sin(p.x * 3.0 + uT)) * 0.5 + 0.5;
            vec3 c = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.82, 0.95), s);
            c += vec3(1.0) * smoothstep(0.08, 0.0, abs(p.x + p.y * 0.6 - fract(uT * 0.15) * 4.0 + 2.0)) * 0.8;
            gl_FragColor = vec4(c * 1.1, 0.92);
          }`,
        transparent: true,
        toneMapped: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh position={[PAVILION.x + 0.56, PAVILION.h + 1.95, PAVILION.z]} rotation-y={-Math.PI / 2} material={mat}>
      <planeGeometry args={[2.1, 3.0]} />
    </mesh>
  );
}

// ───────────── Thác + biển mây ─────────────
/** thác: dải loe xuống (rộng 3,2 → 5 m, dài 30 m) — aFlow = (ngang m, dọc m), aFall 0 → 1 */
function fallGeometry(w0: number, w1: number, h: number, seg = 6, vseg = 16) {
  const P: number[] = [];
  const N: number[] = [];
  const F: number[] = [];
  const A: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= vseg; i++) {
    const t = i / vseg;
    const w = w0 + (w1 - w0) * t;
    for (let k = 0; k <= seg; k++) {
      const u = k / seg - 0.5;
      // cong ra ngoài vách (nước rời mép đá) + gợn ngang
      P.push(u * w, -t * h, 0.4 + t * t * 3.5 + Math.sin(u * 9 + t * 4) * 0.08);
      N.push(0, 0.2, 1);
      F.push(u * w, t * h);
      A.push(t);
    }
  }
  for (let i = 0; i < vseg; i++)
    for (let k = 0; k < seg; k++) {
      const a = i * (seg + 1) + k;
      idx.push(a, a + seg + 1, a + 1, a + 1, a + seg + 1, a + seg + 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("aFlow", new THREE.Float32BufferAttribute(F, 2));
  g.setAttribute("aFall", new THREE.Float32BufferAttribute(A, 1));
  g.setIndex(idx);
  return g;
}
function Falls() {
  const { mat, geo } = useMemo(() => ({ mat: flowMaterial({ tex: streakTex(), speed: 7, width: 0.5, length: 3.5, alpha: 0.72 }), geo: fallGeometry(3.2, 5.2, 30) }), []);
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  const spots = [Math.PI * 0.62, Math.PI * 1.38, Math.PI * 1.85, Math.PI * 0.15];
  return (
    <>
      {spots.map((a) => (
        <mesh key={a} ref={(o: THREE.Mesh | null) => void o?.layers.set(LAYER_NO_REFLECT)} geometry={geo} material={mat} position={[Math.cos(a) * 36.2, -0.6, Math.sin(a) * 36.2]} rotation-y={Math.atan2(Math.cos(a), Math.sin(a))} />
      ))}
    </>
  );
}
function CloudSeaGold() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uT: T, uSun: { value: HUB_SUN.clone() }, uNoiseTex: { value: noiseTex() } },
        vertexShader: "varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uSun; uniform sampler2D uNoiseTex; varying vec2 vP;
          ${NOISE}
          void main(){
            vec2 p = vP * 0.02 + vec2(uT * 0.008, uT * 0.004);
            float c = texture2D(uNoiseTex, p * 0.35 + texture2D(uNoiseTex, p * 0.12 - uT * 0.002).b * 0.25).r;
            float puff = smoothstep(0.38, 0.66, c);
            float lit = dot(normalize(vP + 1e-4), normalize(uSun.xz)) * 0.5 + 0.5;
            vec3 top = mix(vec3(1.0, 0.92, 0.9), vec3(1.0, 0.8, 0.62), lit);
            vec3 sh = mix(vec3(0.66, 0.64, 0.88), vec3(0.88, 0.66, 0.72), lit);
            vec3 col = mix(sh, top, puff) + vec3(1.0, 0.75, 0.45) * smoothstep(0.66, 0.85, c) * lit * 0.35;
            float far = smoothstep(120.0, 420.0, length(vP));
            col = mix(col, vec3(0.98, 0.82, 0.72), far);
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
        fog: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -40, 0]} material={mat}>
      <circleGeometry args={[620, 64]} />
    </mesh>
  );
}

export function HubPlaza() {
  const { camera } = useThree();
  useEffect(() => {
    camera.layers.enable(LAYER_NO_REFLECT);
    return () => camera.layers.disable(LAYER_NO_REFLECT);
  }, [camera]);
  return (
    <>
      <fog attach="fog" args={["#f2d2bd", 90, 460]} />
      <HubSky />
      <VoidEnvironment intensity={0.9} sky={hubSky} />
      <HubModel />
      <HubProps />
      <HubGrass />
      <HubWater sun={HUB_SUN} />
      {/* ngày ↔ đêm theo giờ thật + đèn đường + lửa trại */}
      <HubDayCycle U={U} lampMats={LAMP_MATS} />
      <LampGlow />
      <Campfire />
      {/* rồng ngọc bích bay xa trên biển mây */}
      <StudyDoor />
      <CosmicBeast path={BEAST_PATHS.hub} look={BEAST_LOOKS.jade} bodyLen={140} radius={4.4} speed={12} sun={HUB_SUN} phase0={2.1} />
      <GatePortals />
      <MuseumHolo />
      <MirrorSurface />
      <group name="perf:falls">
        <Falls />
        <CloudSeaGold />
      </group>
    </>
  );
}
