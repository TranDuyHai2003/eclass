"use client";
/**
 * Hư Không Nghịch Lý — lớp hiệu ứng "choáng ngợp":
 *  - glowPulse(): vật liệu phát sáng của quần đảo sống động — năng lượng chạy dọc cầu từ đảo tâm ra ngoài, vòng rune lấp lánh xoay,
 *    pha lê "thở" sáng lệch pha theo vị trí
 *  - Aurora: ba dải cực quang uốn lượn quanh hư không (rèm nhiễu chảy theo thời gian)
 *  - ShootingStars: sao băng vạch ngang trời
 *  - GlyphMotes: các ký hiệu toán học (∞ π Σ ∫ ℵ φ ∂ √) trôi như đom đóm quanh quần đảo
 *  - StepRipples: gợn sáng loang ra dưới mỗi bước chân trên mặt đảo
 *  - ArrivalSweep: vừa tới nơi, máy quay bay vòng từ trên cao xuống (toàn cảnh quần đảo → sau lưng nhân vật)
 *  - EyeBurst: khi tam giác Penrose "khép lại" — sóng sáng toả ra, tam giác bừng vàng, chuông ngân
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sfx } from "@/lib/world/sfx";
import { CAM } from "../combat/combat";
import { useWorld } from "../store";
import { useGfx } from "../gfx";

const T = { value: 0 };
/** Cực quang rực lên (chòm sao ∞ hoàn thành) */
export const AURORA_BOOST = { value: 0 };

/** Gắn hiệu ứng thời gian vào vật liệu phát sáng (MeshBasicMaterial, lưới ở toạ độ thế giới) theo tên vật liệu Blender */
export function glowPulse(m: THREE.MeshBasicMaterial, name: string) {
  const kind = name === "glow_bridge" ? 0 : name === "glow_rune" ? 1 : name.startsWith("glow_c") ? 2 : -1;
  if (kind < 0) return;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = T;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xyz;");
    const f =
      kind === 0
        ? // xung năng lượng chạy từ tâm ra ngoài dọc mép cầu
          "float d = length(vWp.xz); float w = pow(0.5 + 0.5 * sin(d * 0.9 - uT * 3.2), 8.0); float k = 0.45 + 2.6 * w;"
        : kind === 1
          ? // vòng rune: các đốm sáng chạy vòng + nhịp thở
            "float a = atan(vWp.z, vWp.x); float k = 0.65 + 0.9 * pow(0.5 + 0.5 * sin(a * 6.0 + uT * 1.4 + length(vWp.xz) * 0.7), 4.0) + 0.15 * sin(uT * 2.0);"
          : // pha lê: thở sáng lệch pha theo vị trí + lấp lánh
            "float k = 0.7 + 0.45 * sin(uT * 1.3 + vWp.x * 0.7 + vWp.y * 1.3 + vWp.z * 0.5) + 0.5 * pow(max(0.0, sin(uT * 3.1 + vWp.x * 5.0 + vWp.z * 3.0)), 24.0);";
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp; uniform float uT;")
      .replace("#include <color_fragment>", `#include <color_fragment>\n${f}\ndiffuseColor.rgb *= k;`);
  };
  m.customProgramCacheKey = () => `pdx-glow-${kind}`;
}

/** Đồng hồ chung cho các shader của lớp hiệu ứng */
export function VfxClock() {
  useFrame(() => void (T.value = performance.now() / 1000));
  return null;
}

// ── Cực quang ────────────────────────────────────────────────────────────────
function auroraMaterial(hue: number) {
  return new THREE.ShaderMaterial({
    uniforms: { uT: T, uHue: { value: hue }, uBoost: AURORA_BOOST },
    vertexShader: `uniform float uT; varying vec2 vUv; varying float vX;
      void main(){ vUv = uv; vec3 p = position;
        // lượn sóng: bán kính thay đổi theo góc và thời gian
        float a = atan(p.z, p.x);
        float r = length(p.xz) + sin(a * 3.0 + uT * 0.12) * 9.0 + sin(a * 7.0 - uT * 0.2) * 3.0;
        p.x = cos(a) * r; p.z = sin(a) * r; p.y += sin(a * 2.0 + uT * 0.1) * 6.0;
        vX = a; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uT; uniform float uHue; uniform float uBoost; varying vec2 vUv; varying float vX;
      float h(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); return mix(h(i), h(i + 1.0), f); }
      void main(){
        float x = vX * 40.0;
        // rèm: sợi sáng dọc, cường độ chảy ngang theo thời gian
        float rays = n1(x * 1.7 + uT * 0.6) * 0.6 + n1(x * 4.3 - uT * 1.1) * 0.4;
        rays = pow(rays, 2.2);
        float fold = 0.35 + 0.65 * n1(x * 0.35 - uT * 0.25);
        float y = vUv.y;
        float body = smoothstep(0.0, 0.12, y) * pow(1.0 - y, 1.6);
        vec3 lo = mix(vec3(0.15, 1.0, 0.7), vec3(0.35, 0.8, 1.0), uHue);
        vec3 hi = mix(vec3(0.85, 0.3, 1.0), vec3(1.0, 0.45, 0.7), uHue);
        vec3 c = mix(lo, hi, smoothstep(0.15, 0.85, y));
        float a = body * rays * fold * 1.4 * (1.0 + uBoost);
        gl_FragColor = vec4(c * a * 1.6, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
}
export function Aurora() {
  const items = useMemo(
    () =>
      [
        { r: 110, y: 18, h: 34, rot: 0, hue: 0 },
        { r: 150, y: 32, h: 46, rot: 2.1, hue: 0.6 },
        { r: 85, y: -26, h: 26, rot: 4.0, hue: 1 },
      ].map((d) => {
        const geo = new THREE.CylinderGeometry(d.r, d.r, d.h, 220, 1, true, 0, Math.PI * 1.25);
        geo.translate(0, d.h / 2, 0);
        return { ...d, geo, mat: auroraMaterial(d.hue) };
      }),
    [],
  );
  useEffect(() => () => items.forEach((i) => (i.geo.dispose(), i.mat.dispose())), [items]);
  return (
    <group>
      {items.map((i, k) => (
        <mesh key={k} geometry={i.geo} material={i.mat} position={[0, i.y, 0]} rotation={[0.08 * (k - 1), i.rot, 0]} frustumCulled={false} />
      ))}
    </group>
  );
}

// ── Sao băng ─────────────────────────────────────────────────────────────────
export function ShootingStars() {
  const N = 5;
  const res = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(-0.5, 0, 0); // đầu sao ở x = 0, đuôi kéo về −x
    const mats = Array.from(
      { length: N },
      () =>
        new THREE.ShaderMaterial({
          uniforms: { uA: { value: 0 } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: `uniform float uA; varying vec2 vUv;
            void main(){ float tail = pow(vUv.x, 3.0); float w = 1.0 - abs(vUv.y - 0.5) * 2.0;
              vec3 c = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 0.95, 0.85), vUv.x);
              float a = tail * pow(w, 2.0) * uA; gl_FragColor = vec4(c * a * 4.0, a); }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
          fog: false,
        }),
    );
    return { geo, mats };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mats.forEach((m) => m.dispose())), [res]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const st = useRef(Array.from({ length: N }, (_, i) => ({ t0: -100, dur: 1, from: new THREE.Vector3(), dir: new THREE.Vector3(), next: 1.5 + i * 2.3 })));
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    st.current.forEach((o, i) => {
      const m = refs.current[i];
      if (!m) return;
      if (t > o.next) {
        // xuất phát trên vòm trời phía xa, bay chéo xuống
        const a = Math.random() * Math.PI * 2;
        o.from.set(Math.cos(a) * 180, 60 + Math.random() * 70, Math.sin(a) * 180);
        o.dir.set(-Math.sin(a) + (Math.random() - 0.5) * 0.6, -0.35 - Math.random() * 0.3, Math.cos(a) + (Math.random() - 0.5) * 0.6).normalize();
        o.t0 = t;
        o.dur = 0.9 + Math.random() * 0.8;
        o.next = t + 2.5 + Math.random() * 5;
      }
      const k = (t - o.t0) / o.dur;
      const live = k >= 0 && k <= 1;
      m.visible = live;
      if (!live) return;
      m.position.copy(o.from).addScaledVector(o.dir, k * 140);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), o.dir);
      m.scale.set(26 + 20 * Math.sin(k * Math.PI), 0.55, 1);
      // quay mặt phẳng quanh trục bay cho dễ thấy (không cần chính xác)
      m.rotateX(Math.PI / 2);
      (m.material as THREE.ShaderMaterial).uniforms.uA.value = Math.sin(k * Math.PI);
    });
  });
  return (
    <group>
      {res.mats.map((m, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} geometry={res.geo} material={m} visible={false} frustumCulled={false} />
      ))}
    </group>
  );
}

// ── Ký hiệu toán trôi như đom đóm ─────────────────────────────────────────────
const GLYPHS = ["∞", "π", "Σ", "∫", "ℵ", "φ", "∂", "√"];
export function GlyphMotes() {
  const vfx = useGfx((s) => s.vfx);
  const res = useMemo(() => {
    // atlas 8 ô × 128 px, chữ trắng có quầng mờ
    const cv = document.createElement("canvas");
    cv.width = 128 * GLYPHS.length;
    cv.height = 128;
    const g = cv.getContext("2d")!;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "600 92px 'Times New Roman', serif";
    GLYPHS.forEach((ch, i) => {
      g.shadowColor = "rgba(255,255,255,0.9)";
      g.shadowBlur = 16;
      g.fillStyle = "#ffffff";
      g.fillText(ch, 64 + i * 128, 70);
      g.shadowBlur = 0;
      g.fillText(ch, 64 + i * 128, 70);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const n = Math.round(170 * [0.3, 0.6, 1][vfx]);
    const pos = new Float32Array(n * 3);
    const gi = new Float32Array(n);
    const rr = new Float32Array(n);
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = 4 + Math.sqrt(r()) * 34;
      pos.set([Math.cos(a) * d, -2 + r() * 11, Math.sin(a) * d], i * 3);
      gi[i] = Math.floor(r() * GLYPHS.length);
      rr[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aG", new THREE.BufferAttribute(gi, 1));
    geo.setAttribute("aR", new THREE.BufferAttribute(rr, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: T, uTex: { value: tex }, uN: { value: GLYPHS.length } },
      vertexShader: `uniform float uT; attribute float aG; attribute float aR; varying float vG; varying float vA; varying float vR;
        void main(){
          vec3 p = position;
          float ang = uT * (0.02 + aR * 0.04) * (aR > 0.5 ? 1.0 : -1.0);
          p.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * p.xz;
          p.y += sin(uT * (0.4 + aR * 0.6) + aR * 20.0) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (26.0 + aR * 22.0) * 10.0 / -mv.z;
          vG = aG; vR = aR;
          vA = (0.35 + 0.65 * pow(0.5 + 0.5 * sin(uT * (0.8 + aR * 1.6) + aR * 50.0), 2.0)) * smoothstep(60.0, 20.0, -mv.z) * smoothstep(1.0, 4.0, -mv.z);
        }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uN; varying float vG; varying float vA; varying float vR;
        void main(){
          vec2 uv = vec2((vG + gl_PointCoord.x) / uN, 1.0 - gl_PointCoord.y);
          float a = texture2D(uTex, uv).a * vA;
          vec3 c = mix(vec3(1.0, 0.82, 0.45), vec3(0.55, 0.9, 1.0), step(0.5, vR));
          gl_FragColor = vec4(c * 2.2 * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { tex, geo, mat };
  }, [vfx]);
  useEffect(() => () => [res.tex, res.geo, res.mat].forEach((o) => o.dispose()), [res]);
  return <points geometry={res.geo} material={res.mat} frustumCulled={false} />;
}

// ── Gợn sáng dưới bước chân ──────────────────────────────────────────────────
export function StepRipples() {
  const N = 10;
  const res = useMemo(() => {
    const geo = new THREE.RingGeometry(0.42, 0.5, 48);
    geo.rotateX(-Math.PI / 2);
    const mats = Array.from({ length: N }, () => new THREE.MeshBasicMaterial({ color: new THREE.Color("#9fe6ff").multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    return { geo, mats };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mats.forEach((m) => m.dispose())), [res]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const st = useRef({ last: new THREE.Vector3(1e9, 0, 0), acc: 0, k: 0, t0: Array<number>(N).fill(-10) });
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    const p = useWorld.getState().player;
    const S = st.current;
    const moved = Math.hypot(p.x - S.last.x, p.z - S.last.z);
    S.last.copy(p);
    if (moved > 0.002 && moved < 1) S.acc += moved;
    if (S.acc > 0.9) {
      S.acc = 0;
      const i = S.k++ % N;
      S.t0[i] = t;
      refs.current[i]?.position.set(p.x, p.y + 0.03, p.z);
    }
    for (let i = 0; i < N; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const k = (t - S.t0[i]) / 1.1;
      m.visible = k >= 0 && k < 1;
      if (!m.visible) continue;
      m.scale.setScalar(0.6 + k * 3.2);
      res.mats[i].opacity = (1 - k) * (1 - k) * 0.9;
    }
    void dt;
  });
  return (
    <group>
      {res.mats.map((m, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} geometry={res.geo} material={m} visible={false} />
      ))}
    </group>
  );
}

// ── Máy quay bay vào lúc mới tới ─────────────────────────────────────────────
export function ArrivalSweep() {
  const t0 = useRef(-1);
  const base = useRef({ yaw: 0, pitch: 0.16, dist: 3.2 });
  useEffect(() => {
    const s = useWorld.getState();
    base.current = { yaw: s.camYaw, pitch: 0.16, dist: 3.2 };
    t0.current = performance.now();
    return () => {
      CAM.fovKick = 0;
    };
  }, []);
  useFrame(() => {
    if (t0.current < 0) return;
    const k = Math.min(1, (performance.now() - t0.current) / 5200);
    const e = 1 - Math.pow(1 - k, 3); // ease-out
    const b = base.current;
    // góc ngẩng hạ theo √(1−e): máy quay ở trên cao lâu hơn, không xuyên cột tháp cổng ra
    useWorld.setState({ camDist: b.dist + (62 - b.dist) * (1 - e), camPitch: b.pitch + (0.95 - b.pitch) * Math.sqrt(1 - e), camYaw: b.yaw + 2.4 * (1 - e) });
    CAM.fovKick = 14 * (1 - e);
    if (k >= 1) {
      CAM.fovKick = 0;
      t0.current = -1;
    }
  });
  return null;
}

// ── Bùng sáng khi tam giác Penrose khép lại ──────────────────────────────────
const EYE_FX = { t0: -1 };
export function triggerEyeBurst() {
  EYE_FX.t0 = performance.now();
  sfx.chime(3);
  setTimeout(() => sfx.chime(5), 260);
  setTimeout(() => sfx.chime(7), 520);
}
export function EyeBurst({ at, tribar }: { at: THREE.Vector3; tribar: THREE.Object3D }) {
  const res = useMemo(() => {
    const geo = new THREE.TorusGeometry(1, 0.06, 8, 96);
    const mats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe3a0").multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    return { geo, mats };
  }, []);
  useEffect(() => () => (res.geo.dispose(), res.mats.forEach((m) => m.dispose())), [res]);
  const toon = useMemo(() => {
    const out: THREE.MeshToonMaterial[] = [];
    tribar.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
      if (m && "emissive" in m) out.push(m);
    });
    return out;
  }, [tribar]);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ camera }) => {
    const k = EYE_FX.t0 < 0 ? 2 : (performance.now() - EYE_FX.t0) / 2600;
    res.mats.forEach((m, i) => {
      const kk = k - i * 0.12;
      const r = refs.current[i];
      if (!r) return;
      r.visible = kk >= 0 && kk < 1;
      if (!r.visible) return;
      r.lookAt(camera.position);
      r.scale.setScalar(2 + kk * 22);
      m.opacity = (1 - kk) * (1 - kk);
    });
    // tam giác bừng vàng rồi dịu lại
    const glow = k < 1 ? Math.sin(Math.min(1, k * 2.5) * Math.PI * 0.5) * (1 - k) * 1.6 : 0;
    toon.forEach((m) => {
      m.emissive.set("#ffcf6a");
      m.emissiveIntensity = glow;
    });
  });
  return (
    <group position={at}>
      {res.mats.map((m, i) => (
        <mesh key={i} ref={(el) => void (refs.current[i] = el)} geometry={res.geo} material={m} visible={false} frustumCulled={false} />
      ))}
    </group>
  );
}
