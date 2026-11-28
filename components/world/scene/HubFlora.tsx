"use client";
/**
 * Quảng trường kiểu Genshin — sự sống nhỏ (docs/ai-reviews/hub-genshin/PLAN.md §7, §10):
 *  • HubFlowers: khóm hoa vẽ tay (atlas Codex 2×2: cúc trắng, cosmos hồng, mao lương vàng, chuông tím) mọc thành CỤM một màu dọc mép lối,
 *    quanh gốc cây / bồn đài phun (lib/world/hubFlora). Billboard trụ (luôn quay mặt về máy quay quanh trục đứng), gió + rạp khi người
 *    chơi đi qua, bóng tán + AO tiếp xúc như cỏ. 1 lệnh vẽ instanced; số khóm theo mức hiệu ứng.
 *  • HubMotes: cánh anh đào rơi dưới cây hoa, lá bạch quả / lá xanh bay, hạt bồ công anh lơ lửng trên bồn cỏ (ban ngày) +
 *    đom đóm (ban đêm). 1 lệnh vẽ instanced, toàn bộ chuyển động trong vertex shader (không cập nhật JS từng hạt, không sắp xếp).
 *    Trộn alpha "nhân sẵn": cánh hoa che phủ bình thường, đom đóm cộng sáng (alpha = 0) — cùng một vật liệu.
 */
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { TREES, flowerClumps } from "@/lib/world/hubFlora";
import { GARDEN, RING_IN, RING_OUT, isBed } from "@/lib/world/hubLayout";
import { useGfx } from "../gfx";
import { useWorld } from "../store";
import { DAY } from "../fx/dayState";
import { WIND } from "../fx/water";
import { noiseTex } from "../fx/proceduralTex";
import { HUB_SHADE_GLSL, hubShadeUniforms } from "../fx/hubShade";
import { LAYER_NO_REFLECT } from "./HubWater";

let flowerAtlas: THREE.Texture | null = null;
let petalAtlas: THREE.Texture | null = null;
function atlas(name: string) {
  const t = new THREE.TextureLoader().load(worldAsset(`fx/tex/hub/${name}`));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const FLOWER_VS = /* glsl */ `
  attribute vec4 aP; attribute float aSeed;
  uniform float uT; uniform vec3 uP; uniform vec2 uWindDir; uniform float uGust; uniform sampler2D uNoiseTex;
  varying vec2 vUv; varying float vSun; varying float vAO; varying float vTop; varying float vFade;
  ${HUB_SHADE_GLSL}
  void main(){
    vec2 base = aP.xy;
    float h = 0.62 * aP.z;
    vec3 toCam = cameraPosition - vec3(base.x, 0.0, base.y);
    float dist = length(toCam.xz);
    vFade = smoothstep(30.0, 44.0, dist);
    vec2 right = normalize(vec2(toCam.z, -toCam.x) + 1e-4);
    float t = uv.y;
    vTop = t;
    // gió (cùng sóng với cỏ) + rạp quanh người chơi; gốc đứng yên
    float x = dot(base, uWindDir);
    float sway = (0.05 + 0.04 * uGust) * sin(0.78 * x - 1.7 * uT + aSeed * 6.0) + 0.025 * sin(2.6 * uT + aSeed * 30.0);
    vec2 away = base - uP.xz; float d = length(away);
    float press = (1.0 - smoothstep(0.2, 0.9, d)) * step(abs(uP.y), 1.2);
    vec2 bend = uWindDir * sway + 0.5 * press * away / max(d, 0.2);
    float k = t * t;
    float shrink = 1.0 - vFade;
    vec3 w = vec3(base.x, 0.0, base.y);
    w.xz += right * (position.x * h) * shrink + bend * h * k;
    w.y += t * h * (1.0 - 0.4 * press * k) * shrink;
    vUv = vec2((uv.x + mod(aP.w, 2.0)) * 0.5, (uv.y + 1.0 - floor(aP.w / 2.0)) * 0.5);
    vSun = 1.0 - hubShadow(base, texture2D(uNoiseTex, base / 7.0).b);
    vAO = mix(0.7, 1.0, hubContact(base));
    gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
  }
`;
const FLOWER_FS = /* glsl */ `
  uniform sampler2D uAtlas; uniform vec3 uAmb; uniform vec3 uSunCol;
  varying vec2 vUv; varying float vSun; varying float vAO; varying float vTop; varying float vFade;
  void main(){
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.5 || vFade > 0.98) discard;
    // thân lá dưới thấp tối hơn (AO trong khóm), hoa ở ngọn đón nắng
    float ao = mix(0.72, 1.0, smoothstep(0.05, 0.6, vTop)) * vAO;
    vec3 lit = c.rgb * (uAmb * 1.35 * ao + uSunCol * 1.05 * vSun * ao);
    gl_FragColor = vec4(lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function HubFlowers() {
  const vfx = useGfx((s) => s.vfx);
  const geo = useMemo(() => {
    const list = flowerClumps([380, 820, 1600][vfx]);
    const q = new THREE.PlaneGeometry(1, 1);
    q.translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(q.index);
    g.setAttribute("position", q.attributes.position);
    g.setAttribute("uv", q.attributes.uv);
    const P = new Float32Array(list.length * 4);
    const S = new Float32Array(list.length);
    list.forEach((c, i) => {
      P.set([c.x, c.z, c.s, c.kind], i * 4);
      S[i] = c.yaw;
    });
    g.setAttribute("aP", new THREE.InstancedBufferAttribute(P, 4));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(S, 1));
    g.instanceCount = list.length;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 38);
    q.dispose();
    return g;
  }, [vfx]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: (flowerAtlas ??= atlas("flower_atlas.png")) },
          uT: WIND.t,
          uP: { value: new THREE.Vector3() },
          uWindDir: WIND.dir,
          uGust: WIND.gust,
          uAmb: DAY.grassAmb,
          uSunCol: DAY.grassSun,
          uNoiseTex: { value: noiseTex() },
          ...hubShadeUniforms(),
        },
        vertexShader: FLOWER_VS,
        fragmentShader: FLOWER_FS,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    mat.uniforms.uP.value.copy(useWorld.getState().player);
  });
  return <mesh name="perf:flowers" geometry={geo} material={mat} ref={(o: THREE.Mesh | null) => void o?.layers.set(LAYER_NO_REFLECT)} />;
}

// ───────────── Hạt môi trường: cánh hoa / lá / hạt bồ công anh (ngày) + đom đóm (đêm) ─────────────
const MOTE_VS = /* glsl */ `
  attribute vec4 aO; attribute vec4 aS;
  uniform float uT; uniform vec2 uWindDir; uniform float uNight;
  varying vec2 vUv; varying float vA; varying float vKind; varying vec2 vQ;
  void main(){
    float kind = aO.w;
    float seed = aS.x, size = aS.y, life = aS.z, spd = aS.w;
    float age = fract(uT / life + seed);
    vec3 c = aO.xyz;
    float spin = 0.0; float flip = 1.0;
    if (kind < 0.5 || (kind > 1.5 && kind < 3.5)) {
      // cánh hoa / lá: rơi từ tán xuống đất, lắc ngang, xoay + lật (giả lật 3D bằng co chiều ngang)
      c.y = mix(c.y, 0.05, age);
      c.xz += uWindDir * age * life * 0.45 + vec2(sin(6.2832 * (age * 2.2 + seed)), cos(6.2832 * (age * 1.7 + seed * 3.0))) * 0.6 * spd;
      spin = uT * (1.2 + seed * 2.0) + seed * 20.0;
      flip = 0.35 + 0.65 * abs(cos(uT * (2.0 + seed * 2.5) + seed * 9.0));
    } else if (kind < 1.5) {
      // hạt bồ công anh: trôi theo gió, bồng bềnh lên xuống
      c.xz += uWindDir * age * life * 0.9;
      c.y += 0.6 * sin(6.2832 * (age + seed)) + age * 1.2;
      spin = 0.3 * sin(uT + seed * 10.0);
    } else {
      // đom đóm: vòng lượn nhỏ quanh gốc, nhấp nháy
      c.xz += vec2(sin(uT * (0.4 + spd) + seed * 30.0), cos(uT * (0.33 + spd * 0.8) + seed * 17.0)) * 1.4;
      c.y += 0.5 * sin(uT * 0.7 + seed * 11.0);
    }
    float fade = smoothstep(0.0, 0.1, age) * (1.0 - smoothstep(0.85, 1.0, age));
    float day = 1.0 - uNight;
    vA = (kind > 3.5 ? uNight * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (1.3 + spd) + seed * 40.0), 3.0)) : fade * day);
    vKind = kind;
    vec4 mv = viewMatrix * vec4(c, 1.0);
    // kẹp gần máy quay: hạt quá gần mờ đi (không che mặt nhân vật)
    vA *= smoothstep(1.2, 3.0, -mv.z);
    float cs = cos(spin), sn = sin(spin);
    vec2 q = position.xy * size;
    q.x *= flip;
    q = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);
    mv.xy += q;
    vQ = position.xy * 2.0;
    float cell = mod(kind, 4.0);
    vUv = vec2((uv.x + mod(cell, 2.0)) * 0.5, (uv.y + 1.0 - floor(cell / 2.0)) * 0.5);
    gl_Position = projectionMatrix * mv;
    if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
  }
`;
const MOTE_FS = /* glsl */ `
  uniform sampler2D uAtlas; uniform float uLevel; uniform vec3 uSunCol;
  varying vec2 vUv; varying float vA; varying float vKind; varying vec2 vQ;
  void main(){
    if (vKind > 3.5) {
      // đom đóm: lõi vàng lục HDR + quầng mềm, cộng sáng (alpha 0 trong trộn nhân sẵn)
      float r = dot(vQ, vQ);
      float g = exp(-r * 9.0) * 4.0 + exp(-r * 2.2) * 0.5;
      gl_FragColor = vec4(vec3(1.0, 0.92, 0.45) * g * vA, 0.0);
      return;
    }
    vec4 c = texture2D(uAtlas, vUv);
    float a = c.a * vA;
    if (a < 0.02) discard;
    vec3 lit = c.rgb * (0.55 + 0.6 * uLevel) * mix(vec3(1.0), uSunCol, 0.25);
    gl_FragColor = vec4(lit * a, a);
    #include <colorspace_fragment>
  }
`;

export function HubMotes() {
  const vfx = useGfx((s) => s.vfx);
  const geo = useMemo(() => {
    const n = [40, 90, 150][vfx];
    let seed = 91;
    const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const O = new Float32Array(n * 4);
    const S = new Float32Array(n * 4);
    const blossoms = TREES.filter((t) => t.kind === "blossom");
    const bedPoint = () => {
      for (let k = 0; k < 40; k++) {
        const a = R() * Math.PI * 2;
        const r = RING_IN + R() * (RING_OUT - RING_IN);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (isBed(x, z) || Math.hypot(x - GARDEN.x, z - GARDEN.z) < GARDEN.r) return [x, z];
      }
      return [GARDEN.x, GARDEN.z];
    };
    for (let i = 0; i < n; i++) {
      const f = i / n;
      let kind: number;
      let x: number;
      let z: number;
      let y: number;
      if (f < 0.34) {
        // cánh anh đào dưới cây hoa
        const t = blossoms[i % blossoms.length] ?? TREES[0];
        kind = 0;
        x = t.x + (R() - 0.5) * 4 * t.s;
        z = t.z + (R() - 0.5) * 4 * t.s;
        y = 3 + R() * 3 * t.s;
      } else if (f < 0.47) {
        // lá vàng / lá xanh dưới cây thường
        const t = TREES[i % TREES.length];
        kind = R() < 0.5 ? 2 : 3;
        x = t.x + (R() - 0.5) * 4 * t.s;
        z = t.z + (R() - 0.5) * 4 * t.s;
        y = 3 + R() * 3 * t.s;
      } else if (f < 0.6) {
        [x, z] = bedPoint();
        kind = 1;
        y = 0.6 + R() * 1.2;
      } else {
        [x, z] = bedPoint();
        kind = 4;
        y = 0.5 + R() * 1.6;
      }
      O.set([x, y, z, kind], i * 4);
      const size = kind === 4 ? 0.14 : kind === 1 ? 0.2 : 0.16 + R() * 0.06;
      S.set([R(), size, kind === 4 ? 9 : 5 + R() * 5, 0.4 + R() * 0.8], i * 4);
    }
    const q = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex(q.index);
    g.setAttribute("position", q.attributes.position);
    g.setAttribute("uv", q.attributes.uv);
    g.setAttribute("aO", new THREE.InstancedBufferAttribute(O, 4));
    g.setAttribute("aS", new THREE.InstancedBufferAttribute(S, 4));
    g.instanceCount = n;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4, 0), 44);
    q.dispose();
    return g;
  }, [vfx]);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: (petalAtlas ??= atlas("petal_atlas.png")) },
          uT: WIND.t,
          uWindDir: WIND.dir,
          uNight: DAY.night,
          uLevel: DAY.level,
          uSunCol: DAY.lightCol,
        },
        vertexShader: MOTE_VS,
        fragmentShader: MOTE_FS,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  return <mesh name="perf:motes" geometry={geo} material={mat} renderOrder={3} ref={(o: THREE.Mesh | null) => void o?.layers.set(LAYER_NO_REFLECT)} />;
}
