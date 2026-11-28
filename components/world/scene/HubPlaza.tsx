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
import { mergeStatic } from "../fx/mergeStatic";
import { INK_MASK } from "../fx/InkMask";
import { DAY } from "../fx/dayState";
import { Campfire, HubDayCycle, LampGlow } from "./HubNight";
import { BEAST_LOOKS, BEAST_PATHS, CosmicBeast } from "../fx/CosmicBeast";

/** kính đèn đường (HubDayCycle sáng lên về đêm) — mỗi lần gắn Quảng trường tự gỡ phần của mình khi rời (useHubMats) */
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
import { HUB_SHADE_GLSL, hubShadeUniforms, lawnPaintTex, stonePaintTex, updateHubShadow } from "../fx/hubShade";
import { WIND } from "../fx/water";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HubFlowers, HubMotes } from "./HubFlora";
import { HubClouds } from "./HubClouds";

const GLB = worldAsset("props/hub_plaza.glb");
useGLTF.preload(GLB);
/** đạo cụ dựng riêng sau (Blender, blender-src/hub_props.blend): ghế công viên hx_bench2, đèn đường hx_lamp2 (+ kính sáng) */
const PROPS_GLB = worldAsset("props/hub_props2.glb");
useGLTF.preload(PROPS_GLB);

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
/**
 * hub = true (Quảng trường): thêm các lớp chân trời kiểu Genshin (docs/ai-reviews/hub-genshin/RESEARCH.md §3) — VẪN 1 lệnh vẽ:
 *  • đảo nổi xa 2 lớp (bóng phẳng, phối cảnh khí quyển: lớp xa nhạt / lam, lớp gần đậm hơn, viền nắng phía mặt trời, thác bạc);
 *  • biển mây dưới đảo gộp vào vòm (giao tia với mặt phẳng y = −40 → toạ độ thế giới, trôi chậm, sáng theo hướng nắng thật)
 *    thay tấm CloudSeaGold riêng (bớt 1 lệnh vẽ);
 *  • quầng mặt trời 2 thuỳ (Mie) rộng hơn khi nắng thấp.
 * hub = false (Expanse dùng chung): giữ như cũ.
 */
export function hubSky(hub = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSun: DAY.sun, uMoon: DAY.moon, uZen: DAY.zen, uHor: DAY.hor, uSunK: DAY.sunK, uNight: DAY.night, uLevel: DAY.level, uNoiseTex: { value: noiseTex() } },
    defines: hub ? { HUB: 1 } : {},
    vertexShader: "varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `uniform float uT; uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uZen; uniform vec3 uHor; uniform float uSunK; uniform float uNight; uniform float uLevel; uniform sampler2D uNoiseTex; varying vec3 vD;
      ${NOISE}
      // đảo nổi xa: bóng theo phương vị a (rad), cao độ y. Trả về (che phủ, viền sáng, thác)
      vec3 island(float a, float y, float ca, float w, float top, float tip, float seed, float aa){
        float da = a - ca;
        da -= 6.2832 * floor(da / 6.2832 + 0.5);
        float u = da / w;
        if (abs(u) > 1.0) return vec3(0.0);
        float uu = u * u;
        // mặt trên: phẳng hơi vồng + hàng cây (bướu nhỏ) ; mặt dưới: chóp ngược lởm chởm (đá rễ)
        float crown = 0.010 * w * 6.0 * smoothstep(1.0, 0.2, abs(u)) * (0.55 + 0.45 * n2(vec2(u * 9.0 + seed * 7.0, seed)));
        float t = top + 0.004 * (1.0 - uu) + crown;
        float b = mix(top - 0.004, tip, pow(max(0.0, 1.0 - uu), 0.7)) + 0.006 * (n2(vec2(u * 14.0, seed * 3.0)) - 0.5);
        float cov = smoothstep(-aa, aa, t - y) * smoothstep(-aa, aa, y - b) * smoothstep(1.0, 0.94, abs(u));
        float rim = smoothstep(0.012, 0.0, t - y) * cov;
        // thác: dải mảnh rơi từ mép đảo xuống
        float fx = abs(u - (fract(seed * 7.13) - 0.5) * 0.9);
        float fall = smoothstep(0.035, 0.0, fx) * step(y, b + 0.004) * smoothstep(b - 0.06, b, y);
        return vec3(cov, rim, fall);
      }
      void main(){
        vec3 d = normalize(vD);
        float y = d.y;
        float yaa = fwidth(y) * 1.5 + 1e-4;
        float sd = max(dot(d, uSun), 0.0);
        float az = dot(normalize(vec2(d.x, d.z)), normalize(vec2(uSun.x, uSun.z) + 1e-4));
        float up = smoothstep(-0.12, 0.05, uSun.y);
        float low = 1.0 - smoothstep(0.25, 0.7, uSun.y);
        // thiên đỉnh → chân trời; phía mặt trời ấm cam đào khi mặt trời thấp (bình minh / hoàng hôn)
        vec3 zen = uZen;
        vec3 horSun = mix(uHor, vec3(1.0, 0.62, 0.36), 0.55 * up * low + 0.25 * up);
        vec3 hor = mix(uHor, horSun, smoothstep(-0.4, 1.0, az));
        float hb = pow(1.0 - clamp(y, 0.0, 1.0), 4.0);
        vec3 c = mix(zen, hor, hb);
        vec3 haze = mix(hor, vec3(1.0, 0.86, 0.7), 0.25 * up);
        #ifdef HUB
          // biển mây (thế giới, y = −40 dưới mắt): mây cuộn trôi chậm, sáng phía mặt trời, xa hoà vào chân trời
          if (y < 0.0) {
            float tt = (cameraPosition.y + 40.0) / max(-y, 1e-3);
            vec2 hp = cameraPosition.xz + d.xz * tt;
            vec2 p = hp * 0.02 + vec2(uT * 0.008, uT * 0.004);
            float cl = texture2D(uNoiseTex, p * 0.35 + texture2D(uNoiseTex, p * 0.12 - uT * 0.002).b * 0.25).r;
            float puff = smoothstep(0.36, 0.68, cl);
            float lit = dot(normalize(hp + 1e-4), normalize(uSun.xz + 1e-4)) * 0.5 + 0.5;
            vec3 top = mix(vec3(1.0, 0.93, 0.9), vec3(1.0, 0.8, 0.6), lit * up * low);
            vec3 sh = mix(vec3(0.6, 0.62, 0.86), mix(vec3(0.86, 0.66, 0.74), uHor, 0.4), lit);
            vec3 sea = mix(sh, top, puff) + vec3(1.0, 0.75, 0.45) * smoothstep(0.66, 0.86, cl) * lit * 0.35 * up;
            sea *= mix(1.0, 0.22, uNight);
            sea = mix(sea, haze * mix(1.0, 0.4, uNight), smoothstep(150.0, 520.0, tt));
            c = mix(haze, sea, smoothstep(0.0, -0.035, y));
          }
        #else
          // dưới chân trời: biển mây (tối dần về đêm)
          c = mix(c, mix(vec3(0.98, 0.82, 0.72), uHor * 0.6, uNight), smoothstep(0.02, -0.25, y));
        #endif
        // quầng mặt trời 2 thuỳ (Mie): rộng + mềm khi nắng thấp
        c += (vec3(1.0, 0.7, 0.4) * pow(sd, 6.0) * (0.45 + 0.35 * low) + vec3(1.0, 0.85, 0.6) * pow(sd, 48.0) * 0.8) * up;
        #ifdef HUB
          // đảo nổi xa: lớp XA (nhạt, lam khói) rồi lớp GẦN (đậm hơn) — đọc được chiều sâu nhiều tầng
          if (y > -0.07 && y < 0.16) {
            float a = atan(d.z, d.x);
            vec3 sunRim = vec3(1.0, 0.78, 0.5) * up + vec3(0.6, 0.7, 1.0) * uNight * 0.3;
            vec3 farCol = mix(haze, uZen, 0.18) * 0.92;
            vec3 nearCol = mix(vec3(0.42, 0.44, 0.62), haze, 0.48);
            for (int i = 0; i < 9; i++) {
              float fi = float(i);
              float far = step(4.5, fi);
              float ca = fi * 2.399 + 0.7;
              // chừa khoảng trời sau tượng đài trên lối chính (nhìn từ điểm vào về phía bắc: a = −π/2)
              float dn = ca + 1.5708; dn -= 6.2832 * floor(dn / 6.2832 + 0.5);
              if (abs(dn) < 0.32) ca += 0.6 * sign(dn + 1e-3);
              float w = mix(0.07, 0.035, far) * (0.7 + 0.6 * fract(fi * 0.618));
              float top = mix(0.018, 0.006, far) + 0.02 * fract(fi * 0.371);
              float tip = top - mix(0.05, 0.026, far) * (0.8 + 0.5 * fract(fi * 0.53));
              vec3 isl = island(a, y, ca, w, top, tip, fi + 1.0, yaa);
              if (isl.x <= 0.0 && isl.z <= 0.0) continue;
              vec3 ic = mix(nearCol, farCol, far);
              // phía mặt trời: viền nắng ấm trên đỉnh; ngược phía: lam
              float sideSun = smoothstep(-0.2, 0.9, az);
              ic = mix(ic * vec3(0.92, 0.95, 1.05), ic * vec3(1.08, 1.0, 0.92), sideSun);
              ic += sunRim * isl.y * (0.35 + 0.65 * sideSun) * (1.0 - far * 0.5);
              ic *= mix(1.0, 0.3, uNight);
              c = mix(c, ic, isl.x * mix(0.95, 0.7, far));
              c = mix(c, mix(vec3(0.95, 0.97, 1.0), haze, 0.35) * mix(1.0, 0.35, uNight), isl.z * 0.55 * (1.0 - far * 0.4));
            }
          }
        #endif
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
        // mây tích lớn gần chân trời — sáng ngày, xám lam về đêm; viền bạc khi ngược nắng
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
          #ifdef HUB
            // viền bạc: mép mỏng của khối mây phía mặt trời
            cc += vec3(1.0, 0.85, 0.62) * smoothstep(0.25, 0.05, tower) * smoothstep(0.0, 0.12, tower) * pow(sd, 3.0) * 1.2 * up;
          #endif
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
const hubSkyHub = () => hubSky(true);
export function HubSky({ hub = false }: { hub?: boolean }) {
  const mat = useMemo(() => hubSky(hub), [hub]);
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

// ───────────── Sàn đá sa thạch vẽ tay (hoa văn theo toán bố cục) ─────────────
/**
 * Làm lại kiểu Genshin (docs/ai-reviews/hub-genshin/PLAN.md §2): đá kem ấm #DCCBB0 × vân vẽ tay (Codex), phiến 2,6 × 1,5 m XẾP SO LE
 * trên lối, ron nhẹ 6% (trước 26% → lưới "gạch nhà tắm"), mặt nhám 0,6 (hết bóng gương phản trời tím), viền lối bằng đá xám lam
 * (vàng chỉ còn quanh hồ / vòng sân / sao / ngã ba), bồn cỏ = thảm cỏ vẽ tay, AO tiếp xúc + bóng tán cây theo nắng thật (fx/hubShade).
 */
function floorMaterial(): THREE.Material {
  const m = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.6, metalness: 0, envMapIntensity: 0.35 });
  const feats = [...GATES.map((g) => new THREE.Vector3(g.x, g.z, g.r)), new THREE.Vector3(MUSEUM.x, MUSEUM.z, MUSEUM.r), new THREE.Vector3(PAVILION.x, PAVILION.z, PAVILION.r), new THREE.Vector3(GARDEN.x, GARDEN.z, GARDEN.r), new THREE.Vector3(YARD.x, YARD.z, YARD.r)];
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uExposure: U.uExposure, uFloor: U.uFloor, uTint: U.uTint, uScale: U.uScale, uFeat: { value: feats }, uAxes: { value: AXES.map((a) => new THREE.Vector2(a[0], a[1])) }, uNoiseTex: { value: noiseTex() }, uStone: { value: stonePaintTex() }, uLawn: { value: lawnPaintTex() }, ...hubShadeUniforms() });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vW;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vW;
        uniform float uExposure; uniform float uFloor; uniform vec3 uTint; uniform float uScale;
        uniform vec3 uFeat[8]; uniform vec2 uAxes[8]; uniform sampler2D uNoiseTex; uniform sampler2D uStone; uniform sampler2D uLawn;
        vec3 gBaked = vec3(1.0); float gRough = 0.6; float gMetal = 0.0; float gShade = 0.0; float gAO = 1.0;
        ${NOISE}
        ${HUB_SHADE_GLSL}
        float aaLine(float d, float w){ float fw = fwidth(d) + 1e-4; return 1.0 - smoothstep(w - fw, w + fw, abs(d)); }`,
      )
      .replace(
        "#include <color_fragment>",
        `vec2 p = vW.xz;
        float r = length(p);
        // lối toả tia: khoảng cách ngang tới trục gần nhất + toạ độ dọc trục
        float pd = 1e9; float along = 0.0;
        for (int i = 0; i < 8; i++) { float al = dot(p, uAxes[i]); if (al < 0.0) continue; float dd = abs(p.x * uAxes[i].y - p.y * uAxes[i].x); if (dd < pd) { pd = dd; along = al; } }
        float feat = 1e9;
        for (int i = 0; i < 8; i++) { float dd = length(p - uFeat[i].xy) - uFeat[i].z; feat = min(feat, dd); }
        float bed = (r > ${RING_IN.toFixed(1)} && r < ${RING_OUT.toFixed(1)} && pd > ${PATH_HALF.toFixed(1)} && feat > 0.6) ? 1.0 : 0.0;
        // đá sa thạch kem (tuyến tính) × vân vẽ tay (lưu 0,5 = 1) + mảng ấm / lạnh lớn vài chục mét
        vec3 det = texture2D(uStone, p / 5.5).rgb * 2.0;
        vec3 stone = vec3(0.86, 0.79, 0.66) * mix(vec3(1.0), det, 0.85);
        stone *= mix(vec3(1.03, 1.0, 0.95), vec3(0.96, 0.97, 1.02), texture2D(uNoiseTex, p / 46.0 + 0.21).g);
        float grout = 0.0; vec2 tid; vec2 tf;
        if (pd < ${PATH_HALF.toFixed(1)} && r > ${RING_IN.toFixed(1)} - 0.4) {
          // phiến chữ nhật 2,6 × 1,5 m xếp so le (running bond)
          float row = floor(pd / 1.5);
          vec2 q = vec2(along / 2.6 + 0.5 * mod(row, 2.0), pd / 1.5);
          tf = fract(q); tid = floor(q);
          grout = max(aaLine(fract(q.x + 0.5) - 0.5, 0.006), aaLine(fract(q.y + 0.5) - 0.5, 0.01));
        } else {
          // vòng sân: phiến cong, mỗi vòng lệch nửa phiến
          float ang = atan(p.y, p.x);
          float ring = floor(r / 1.6);
          float seg = max(6.0, floor(r * 6.2832 / 2.4));
          vec2 q = vec2(r / 1.6, ang / 6.2832 * seg + 0.5 * mod(ring, 2.0));
          tf = fract(q); tid = floor(q) + 91.0;
          grout = max(aaLine(fract(q.x + 0.5) - 0.5, 0.008), aaLine(fract(q.y + 0.5) - 0.5, 0.006 * seg / max(r, 1.0)));
        }
        // mỗi phiến một sắc nhẹ (ấm / lạnh / sẫm) — phá lưới lặp nhưng giữ mặt sân là MỘT khối lớn
        float th = h2(tid + 17.0);
        stone *= 0.965 + 0.06 * th;
        stone = mix(stone, stone * vec3(1.03, 1.0, 0.94), step(0.78, th) * 0.6);
        stone = mix(stone, stone * vec3(0.95, 0.98, 1.03), step(th, 0.14) * 0.6);
        // mép phiến vẽ tay: tối nhẹ sát ron (vát) — 3,5%
        float bevel = smoothstep(0.0, 0.07, tf.y) * (1.0 - smoothstep(0.93, 1.0, tf.y)) * smoothstep(0.0, 0.04, tf.x) * (1.0 - smoothstep(0.96, 1.0, tf.x));
        vec3 col = stone * (0.95 + 0.05 * bevel) * (1.0 - grout * 0.1);
        gRough = 0.55 + texture2D(uNoiseTex, p / 3.0).a * 0.15; gMetal = 0.0;
        // sao 8 cánh quanh hồ: đá ngà sáng hơn (đọc như thảm đá quanh đài)
        float star = 0.0;
        { float ang = atan(p.y, p.x); float k = abs(fract(ang / 0.7854) - 0.5) * 2.0; float rr = mix(10.9, 8.9, k); star = step(r, rr) * step(${POOL.rim.toFixed(2)} + 0.5, r); }
        col = mix(col, vec3(0.88, 0.8, 0.66) * mix(vec3(1.0), det, 0.6), star * 0.85);
        // vòng dạo: dải đá xám lam (trim) — thay vạch vàng chạy dài
        float slateRing = step(30.2, r) * step(r, 30.9);
        col = mix(col, vec3(0.3, 0.36, 0.42) * mix(vec3(1.0), det, 0.5), slateRing);
        // viền lối: đá xám lam 0,25 m (curb) thay vạch vàng dài
        float curb = (r > ${RING_IN.toFixed(1)} && r < ${RING_OUT.toFixed(1)}) ? aaLine(pd - ${PATH_HALF.toFixed(1)} + 0.14, 0.12) : 0.0;
        col = mix(col, vec3(0.36, 0.41, 0.46) * mix(vec3(1.0), det, 0.5), curb * 0.9);
        // đồng thau (kim loại thật) chỉ ở chỗ hội tụ: vành sân trong, quanh hồ, mép sao, vòng ngã ba
        float gold = 0.0;
        gold = max(gold, aaLine(r - 11.85, 0.05)); gold = max(gold, aaLine(r - 29.45, 0.04));
        gold = max(gold, aaLine(r - ${(POOL.rim + 0.25).toFixed(2)}, 0.04));
        { float ang = atan(p.y, p.x); float k = abs(fract(ang / 0.7854) - 0.5) * 2.0; float rr = mix(10.9, 8.9, k); gold = max(gold, aaLine(r - rr, 0.035) * step(${POOL.rim.toFixed(2)} + 0.5, r)); }
        col = mix(col, vec3(0.74, 0.47, 0.22), gold);
        gMetal = mix(gMetal, 1.0, gold); gRough = mix(gRough, 0.3, gold);
        // bồn cỏ: thảm cỏ vẽ tay (cùng texture với gốc lá cỏ instanced → cỏ mọc ra từ đất); viền đá thấp quanh bồn
        vec3 lawn = texture2D(uLawn, p / 6.0).rgb * vec3(1.0, 0.97, 0.9);
        if (bed > 0.5) {
          float edge = min(pd - ${PATH_HALF.toFixed(1)}, min(r - ${RING_IN.toFixed(1)}, ${RING_OUT.toFixed(1)} - r));
          float kerb = 1.0 - smoothstep(0.22, 0.26, edge);
          col = mix(lawn, vec3(0.62, 0.6, 0.56) * mix(vec3(1.0), det, 0.6), kerb);
          gRough = mix(0.95, 0.6, kerb); gMetal = 0.0;
        }
        // vườn sinh vật: cỏ; bãi tập: vòng đá xám lam
        if (length(p - uFeat[6].xy) < uFeat[6].z) { col = lawn; gRough = 0.95; }
        if (length(p - uFeat[7].xy) < uFeat[7].z) { float rr = length(p - uFeat[7].xy); col = mix(col, vec3(0.34, 0.42, 0.5) * mix(vec3(1.0), det, 0.5), step(rr, 3.6) * (0.55 + 0.1 * step(0.5, fract(atan(p.y - uFeat[7].y, p.x - uFeat[7].x) / 0.3927)))); }
        diffuseColor.rgb = col;
        gAO = hubContact(p);
        gShade = hubShadow(p, texture2D(uNoiseTex, p / 7.0).b);
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          vec3 irr = pow(max(vColor.rgb, vec3(0.0)), vec3(1.818)) * uScale;
          float lum = dot(irr, vec3(0.3, 0.59, 0.11));
          // sắc nướng (Blender, trời hoàng hôn hồng) + nhuộm giờ: giảm độ rực một nửa rồi ngả kem ấm — sân đá đọc là ĐÁ KEM dưới nắng,
          // không phải mặt hồng tím (ảnh trước)
          vec3 tint = mix(vec3(1.0), min((irr + 0.06) / (lum + 0.06), vec3(2.2)), 0.5);
          // (uTint đã bớt rực + ấm ở HubDayCycle warm)
          gBaked = tint * max(lum, uFloor) * uExposure * uTint;
          // bóng nướng: lam nhạt (ánh trời) — vùng nắng: kem ấm
          gBaked *= mix(vec3(0.86, 0.9, 1.08), vec3(1.06, 1.0, 0.92), smoothstep(0.22, 0.85, lum));
        #endif
        // bóng tán: mất phần nắng (còn ánh trời lam) — kiểu Genshin: bóng mát lạnh, rìa ấm
        // giờ vàng: phần nắng ngả vàng ấm + sáng hơn (sân không xỉn nâu), bóng tán giữ lam mát
        gBaked *= mix(vec3(1.0), vec3(1.32, 1.1, 0.84), hubGold() * (1.0 - gShade) * 0.85);
        gBaked *= mix(vec3(1.0), vec3(0.56, 0.62, 0.8), gShade) * mix(0.62, 1.0, gAO);`,
      )
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = gRough;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = gMetal;")
      .replace(
        "#include <aomap_fragment>",
        `#include <aomap_fragment>
        reflectedLight.directDiffuse = vec3(0.0);
        reflectedLight.indirectDiffuse = material.diffuseColor * gBaked;
        float specOcc = clamp(dot(gBaked, vec3(0.3, 0.59, 0.11)) * 1.1, 0.1, 1.0) * gAO;
        reflectedLight.indirectSpecular *= specOcc;
        reflectedLight.directSpecular *= specOcc * 0.6 * (1.0 - gShade);`,
      );
  };
  m.customProgramCacheKey = () => "hub-floor-g2";
  return m;
}

// ───────────── Mô hình + vật liệu ─────────────
function useHubMats() {
  const conv = useMemo(() => {
    const cache = new Map<string, THREE.Material>();
    const lamps: typeof LAMP_MATS = [];
    const fn = (s: THREE.MeshStandardMaterial, flat: boolean) => {
      const key = `${s.name}|${flat}`;
      let m = cache.get(key);
      if (m) return m;
      if (s.name.startsWith("glow_")) {
        const gm = new THREE.MeshBasicMaterial({ color: s.color.clone().multiplyScalar(s.name === "glow_lamp" ? 3.2 : 2.4), toneMapped: false });
        if (s.name === "glow_lamp") lamps.push({ mat: gm, base: s.color.clone() });
        m = gm;
      }
      else if (s.name === "hp_floor") m = floorMaterial();
      else if (s.name === "h_glass") m = new THREE.MeshPhysicalMaterial({ color: "#cfefff", metalness: 0, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.32, envMapIntensity: 1.6, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
      else {
        // đáy hồ: gạch xanh ngọc nhạt (nước trong nhìn xuống thấy sáng như hồ anime, không xám)
        const base = new THREE.MeshBasicMaterial({ color: s.name === "hm_pool" ? new THREE.Color("#a6e2e0") : s.color.clone(), vertexColors: true });
        if (/^h_leaf/.test(s.name)) base.color.multiply(new THREE.Color(0.6, 0.74, 0.62));
        else if (/^h_blossom/.test(s.name)) base.color.multiply(new THREE.Color(0.96, 0.7, 0.8));
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
    return Object.assign(fn, { cache, lamps });
  }, []);
  // kính đèn đăng ký khi gắn, gỡ khi rời + huỷ vật liệu tự tạo (trước đây đẩy thẳng vào danh sách module lúc render →
  // mỗi lần quay lại Hub danh sách dài thêm, HubDayCycle duyệt cả đèn của các lần trước)
  useEffect(() => {
    for (const l of conv.lamps) if (!LAMP_MATS.includes(l)) LAMP_MATS.push(l);
    return () => {
      for (const l of conv.lamps) {
        const i = LAMP_MATS.indexOf(l);
        if (i >= 0) LAMP_MATS.splice(i, 1);
      }
      for (const m of conv.cache.values()) m.dispose();
    };
  }, [conv]);
  return conv;
}

// thân cây làm lại (hub_props6: thân cong, rễ bạnh, cành vút) thay phần vỏ h_bark cũ trong hx_tree/hx_blossom; đài phun hx_fountain2 (bể 16 thùy, bát múi, vỏ sò)
const PROP_NODES = { tree: ["hx_tree", "hx_tree_leaves", "hx_tree_trunk"], blossom: ["hx_blossom", "hx_blossom_leaves", "hx_blossom_trunk"], lamp: ["hx_lamp2", "hx_lamp2_glow"], bench: ["hx_bench2"], fountain: ["hx_fountain2", "hx_fountain_glow"] } as const;
const OLD_BARK = new Set(["hx_tree", "hx_blossom"]);
/** bản cũ còn trong GLB sảnh (gốc toạ độ) — luôn ẩn */
const RETIRED = ["hx_bench", "hx_lamp", "hx_lamp_glow"];
const ALL_PROPS = [...PROPS, ...FOUNTAINS.map((f) => ({ kind: "fountain" as const, x: f.x, z: f.z, yaw: Math.PI / 8, s: 1 }))];

function HubModel() {
  const gltf = useGLTF(GLB);
  const conv = useHubMats();
  const { root, rings, core, vox } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const propNames = new Set([...(Object.values(PROP_NODES).flat() as string[]), ...RETIRED]);
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
    const core = root.getObjectByName("hx_core") ?? null;
    const vox = root.getObjectByName("hx_gate_expanse_vox") ?? null;
    // gộp mesh tĩnh cùng vật liệu theo góc phần tư (ô 60 m) (GLB sảnh ~86 lệnh vẽ riêng lẻ → CPU); vòng xoay / lõi / khối cổng giữ riêng
    mergeStatic(root, [...rings, ...(core ? [core] : []), ...(vox ? [vox] : [])], 60);
    return { root, rings, core, vox };
  }, [gltf, conv]);
  // lưới gộp là hình học MỚI (mergeStatic) — huỷ khi rời; hình học gốc của GLB (useGLTF, dùng chung) giữ nguyên
  useEffect(
    () => () =>
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.name.startsWith("merged:")) (o as THREE.Mesh).geometry.dispose();
      }),
    [root],
  );
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

/**
 * Khối bao thật của một lô instance (nới 1,5 m cho tán lay theo gió) thay cho frustumCulled = false: lô nằm hẳn ngoài khung
 * nhìn (nhìn lên trời, nhìn ra biển mây, máy quay phản chiếu / mặt nạ Ink) không còn bị gửi lệnh vẽ.
 */
function boundInstances(im: THREE.InstancedMesh) {
  im.computeBoundingSphere();
  if (im.boundingSphere) im.boundingSphere.radius += 1.5;
  im.frustumCulled = true;
}

/** Cây / cây hoa / đèn / ghế: nhân bản theo PROPS; tán cây đung đưa theo gió (đỉnh lay nhiều, gốc đứng yên) */
function HubProps() {
  const gltf = useGLTF(GLB);
  const extra = useGLTF(PROPS_GLB);
  const conv = useHubMats();
  const meshes = useMemo(() => {
    const out: THREE.InstancedMesh[] = [];
    const masks: THREE.InstancedMesh[] = [];
    for (const [kind, names] of Object.entries(PROP_NODES)) {
      const list = ALL_PROPS.filter((p) => p.kind === kind);
      if (!list.length) continue;
      for (const n of names) {
        const node = gltf.scene.getObjectByName(n) ?? extra.scene.getObjectByName(n);
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
              boundInstances(im);
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
          boundInstances(im);
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
            boundInstances(mk);
            masks.push(mk);
          }
        });
      }
    }
    return { out, masks };
  }, [gltf, extra, conv]);
  useEffect(() => {
    INK_MASK.scene.add(...meshes.masks);
    return () => {
      INK_MASK.scene.remove(...meshes.masks);
      // bộ đệm instance + vật liệu tự tạo (lá, mặt nạ, bản sao có gió); hình học nguồn của GLB dùng chung → không huỷ.
      // vật liệu từ useHubMats do hook đó tự huỷ.
      const shared = new Set(conv.cache.values());
      const own = new Set<THREE.Material>();
      for (const im of [...meshes.out, ...meshes.masks]) {
        im.dispose();
        const m = im.material as THREE.Material;
        if (!shared.has(m)) own.add(m);
      }
      own.forEach((m) => m.dispose());
    };
  }, [meshes, conv]);
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
  uniform float uT; uniform vec3 uP; uniform vec2 uWindDir; uniform float uGust; uniform sampler2D uNoiseTex; uniform sampler2D uLawn;
  varying float vY; varying vec3 vLeaf; varying vec3 vGround; varying float vShade; varying float vFade; varying float vSun; varying float vAO; varying float vGold;
  ${HUB_SHADE_GLSL}
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
    // màu gốc = ĐÚNG màu thảm cỏ vẽ tay của sàn tại chỗ mọc (cùng texture, mip mờ → màu theo mảng 2–5 m, không lốm đốm từng lá)
    vGround = textureLod(uLawn, base / 6.0, 3.5).rgb * vec3(1.0, 0.97, 0.9);
    // bóng tán + AO tiếp xúc tại gốc (cả lá cùng một giá trị — rẻ, không lấm tấm)
    vSun = 1.0 - hubShadow(base, texture2D(uNoiseTex, base / 7.0).b);
    vAO = mix(0.62, 1.0, hubContact(base));
    vGold = hubGold();
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }`;
const GRASS_FS = /* glsl */ `uniform vec3 uSun; uniform vec3 uAmb; uniform vec3 uSunCol;
  varying float vY; varying vec3 vLeaf; varying vec3 vGround; varying float vShade; varying float vFade; varying float vSun; varying float vAO; varying float vGold;
  void main(){
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 leaf = normalize(vLeaf) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 n = normalize(mix(leaf, up, mix(0.8, 0.92, vFade)));
    float top = smoothstep(0.05, 1.0, vY);
    // ngọn ngả ô-liu / rơm nhẹ (Genshin: cỏ sáng, ấm ở ngọn — không tối bẩn), biến sắc từng lá nhỏ
    vec3 albedo = vGround * mix(vec3(1.0), vec3(1.22, 1.18, 0.86), top) * (1.0 + vShade * (0.25 + 0.4 * top));
    float ao = mix(0.88, 1.0, smoothstep(0.0, 0.4, vY)) * vAO;
    float diffuse = smoothstep(-0.15, 0.85, dot(n, uSun));
    float trans = 0.22 * top * max(-dot(leaf, uSun), 0.0);
    // trong bóng tán: chỉ còn ánh trời (lam mát) — cùng công thức với sàn
    vec3 lit = albedo * (uAmb * ao * 1.12 + uSunCol * (diffuse + trans) * vSun * ao);
    vec3 ground = vGround * (uAmb * 1.12 * vAO + uSunCol * smoothstep(-0.15, 0.85, uSun.y) * vSun * vAO);
    // giờ vàng: chỗ có nắng ngả vàng ấm (cùng hệ số với sàn)
    vec3 gold = mix(vec3(1.0), vec3(1.22, 1.07, 0.84), vGold * 0.75 * vSun);
    lit *= gold; ground *= gold;
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
          uLawn: { value: lawnPaintTex() },
          ...hubShadeUniforms(),
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
  // 4 thác cùng hình + vật liệu → GỘP thành một hình học (1 lệnh vẽ thay 4; flowMaterial không hỗ trợ instancing)
  const { mat, geo } = useMemo(() => {
    const one = fallGeometry(3.2, 5.2, 30);
    const spots = [Math.PI * 0.62, Math.PI * 1.38, Math.PI * 1.85, Math.PI * 0.15];
    const m4 = new THREE.Matrix4();
    const parts = spots.map((a) => one.clone().applyMatrix4(m4.makeRotationY(Math.atan2(Math.cos(a), Math.sin(a))).setPosition(Math.cos(a) * 36.2, -0.6, Math.sin(a) * 36.2)));
    const geo = mergeGeometries(parts, false)!;
    parts.forEach((g) => g.dispose());
    one.dispose();
    return { mat: flowMaterial({ tex: streakTex(), speed: 7, width: 0.5, length: 3.5, alpha: 0.72 }), geo };
  }, []);
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  return <mesh ref={(o: THREE.Mesh | null) => void o?.layers.set(LAYER_NO_REFLECT)} geometry={geo} material={mat} />;
}

/** bóng tán theo nắng thật: vẽ lại canvas khi mặt trời dịch (fx/hubShade) — kiểm tra 1 lần / giây */
function HubShadeTicker() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    updateHubShadow();
  });
  return null;
}

export function HubPlaza() {
  const { camera } = useThree();
  useEffect(() => {
    camera.layers.enable(LAYER_NO_REFLECT);
    return () => camera.layers.disable(LAYER_NO_REFLECT);
  }, [camera]);
  return (
    <>
      {/* sương: hiệu ứng hậu kỳ HubAtmos (sương độ cao + phối cảnh khí quyển theo DAY) thay <fog> màu đào cố định cả đêm */}
      <HubSky hub />
      <HubClouds />
      <VoidEnvironment intensity={0.9} sky={hubSkyHub} />
      <HubModel />
      <HubProps />
      <HubGrass />
      <HubFlowers />
      <HubMotes />
      <HubShadeTicker />
      <HubWater sun={HUB_SUN} />
      {/* ngày ↔ đêm theo giờ thật + đèn đường + lửa trại */}
      <HubDayCycle U={U} lampMats={LAMP_MATS} warm />
      <LampGlow />
      <Campfire />
      {/* rồng ngọc bích bay xa trên biển mây */}
      <StudyDoor />
      <CosmicBeast path={BEAST_PATHS.hub} look={BEAST_LOOKS.jade} bodyLen={140} radius={4.4} speed={12} sun={HUB_SUN} phase0={2.1} />
      <GatePortals />
      <MuseumHolo />
      <MirrorSurface />
      {/* biển mây đã gộp vào vòm trời (HubSky hub) */}
      <group name="perf:falls">
        <Falls />
      </group>
    </>
  );
}
