"use client";
/**
 * Hào quang niệm phép (nghiên cứu Codex 2026-11): xuất hiện NGAY KHI BẮT ĐẦU VẼ, bám tiến độ nét vẽ:
 *  • vòng phép dưới chân Ø 2,5 m: vòng chính + vạch quay ~46°/s, ramp màu → trắng, dissolve theo nhiễu khi thả / huỷ;
 *  • cột sáng mềm cao 2,2 m (alpha 0,08–0,15, mờ dần lên trên);
 *  • tia sáng bay lên theo đường xoắn quanh người (12–20 hạt/s, nhân theo tiến độ);
 *  • phép thành công: chớp xác nhận + dấu niệm theo bậc chính xác — fx/SpellFx.tsx fxCast().
 * T24: hào quang GIỮ NHẸ (nghiên cứu: vòng phép khi vẽ nên dịu): tia bay lên tối đa 4 / 6 / 8 hạt sống cùng lúc theo mức hiệu ứng;
 * màu vòng theo CAST.color (nét vẽ "có vẻ là" phép nào → vòng đổi sang màu phép đó, trước cả khi thả tay).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../store";
import { noiseTex } from "./proceduralTex";
import { emitSpark, type SparkOpts } from "./Sparks";
import { fxLevel } from "./SpellFx";
import { AURA_SPARKS } from "@/lib/world/spellFx";
import { vfxRand } from "@/lib/world/vfxRng";
import { fxNow } from "./fxClock";

/** trạng thái niệm (SigilOverlay ghi) */
export const CAST = { on: false, born: -1e9, endAt: -1e9, progress: 0, color: "#ffe6a8" };

const O_RISE: SparkOpts = { size: 0.04, life: 1, stretch: 0.03, drag: 0.6, gravity: -0.4 };
const TINT_C = new THREE.Color();

const RING_FS = /* glsl */ `
  uniform sampler2D uNoise; uniform vec3 uTint; uniform float uTime; uniform float uDissolve; uniform float uOpacity;
  varying vec2 vUv;
  float band(float r, float radius, float width, float aa){ return 1.0 - smoothstep(width, width + aa, abs(r - radius)); }
  void main(){
    vec2 p = 2.0 * vUv - 1.0;
    float c = cos(0.8 * uTime), s = sin(0.8 * uTime);
    vec2 q = mat2(c, s, -s, c) * p;
    float r = length(p);
    float aa = max(fwidth(r), 0.002);
    float th = atan(q.y, abs(q.x) < 1e-5 ? 1e-5 : q.x);
    float ring = band(r, 0.76, 0.018, aa) + 0.6 * band(r, 0.6, 0.008, aa);
    float ticks = band(r, 0.86, 0.04, aa) * smoothstep(0.80, 0.96, cos(16.0 * th));
    // hình sao 6 cánh mảnh nối các đỉnh trên vòng trong (quay ngược)
    vec2 q2 = mat2(c, -s, s, c) * p;
    float star = 0.0;
    for (int k = 0; k < 6; k++) {
      float a = float(k) * 1.0471976;
      vec2 d = vec2(cos(a), sin(a));
      star = max(star, band(abs(dot(q2, vec2(-d.y, d.x))), 0.3, 0.006, aa) * step(r, 0.6));
    }
    float mark = max(max(ring, 0.72 * ticks), 0.6 * star);
    float n = texture2D(uNoise, 0.5 + q * 0.48).r;
    float cut = mix(-0.12, 1.12, uDissolve);
    float vis = smoothstep(cut - 0.08, cut + 0.08, n);
    vec3 rgb = mix(uTint, vec3(1.0, 0.97, 0.85), mark * mark * mark) * (0.8 + 2.5 * mark);
    float a = mark * vis * uOpacity + (1.0 - smoothstep(0.0, 0.8, r)) * 0.05 * uOpacity * vis;
    if (a < 0.003) discard;
    gl_FragColor = vec4(rgb * a, 1.0);
  }`;

const COL_FS = /* glsl */ `uniform vec3 uTint; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
  void main(){
    float y = vUv.y;
    float a = (1.0 - y) * smoothstep(0.0, 0.08, y) * uOpacity * (0.85 + 0.15 * sin(vUv.x * 25.0 + uTime * 3.0 - y * 6.0));
    if (a < 0.002) discard;
    gl_FragColor = vec4(uTint * a, 1.0);
  }`;

export function CastAura() {
  const tex = useMemo(() => noiseTex(), []);
  const { ring, col } = useMemo(() => {
    const tint = { value: new THREE.Color("#ffd48a") };
    const ring = new THREE.ShaderMaterial({
      uniforms: { uNoise: { value: tex }, uTint: tint, uTime: { value: 0 }, uDissolve: { value: 1 }, uOpacity: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: RING_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const col = new THREE.ShaderMaterial({
      uniforms: { uTint: tint, uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: COL_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    return { ring, col };
  }, [tex]);
  useEffect(
    () => () => {
      ring.dispose();
      col.dispose();
    },
    [ring, col],
  );
  const g = useRef<THREE.Group>(null);
  const acc = useRef(0);
  const lastCol = useRef("");
  const warm = useRef(0);
  useFrame((state, dt) => {
    // 2 khung đầu: hiện trong suốt để biên dịch shader sẵn
    if (warm.current < 2) {
      warm.current++;
      if (g.current) g.current.visible = true;
      ring.uniforms.uOpacity.value = 0;
      col.uniforms.uOpacity.value = 0;
      return;
    }
    const now = fxNow();
    const t = state.clock.elapsedTime;
    const on = CAST.on;
    const sinceEnd = (now - CAST.endAt) / 1000;
    const vis = on || sinceEnd < 0.28;
    if (g.current) g.current.visible = vis;
    if (!vis) return;
    const p = useWorld.getState().player;
    g.current?.position.set(p.x, p.y, p.z);
    const age = (now - CAST.born) / 1000;
    // lên dần 120 ms theo lúc bắt đầu vẽ, mạnh thêm theo tiến độ nét vẽ
    const k = on ? Math.min(1, age / 0.12) * (0.55 + 0.45 * CAST.progress) : 1;
    if (CAST.color !== lastCol.current) {
      lastCol.current = CAST.color;
      (ring.uniforms.uTint.value as THREE.Color).set(CAST.color);
      TINT_C.set(CAST.color);
    }
    ring.uniforms.uTime.value = t;
    ring.uniforms.uOpacity.value = k * 0.8;
    ring.uniforms.uDissolve.value = on ? Math.max(0, 1 - age / 0.15) : Math.min(1, sinceEnd / 0.25);
    col.uniforms.uTime.value = t;
    col.uniforms.uOpacity.value = on ? 0.1 * k : 0.1 * Math.max(0, 1 - sinceEnd / 0.2);
    // tia xoắn bay lên: số hạt sống ≈ tốc độ × đời (1 s) ≤ ngân sách hào quang
    if (on) {
      acc.current += dt * AURA_SPARKS[fxLevel()] * (0.6 + 0.4 * CAST.progress);
      while (acc.current > 1) {
        acc.current--;
        const a = vfxRand() * Math.PI * 2;
        const r = 0.45 + vfxRand() * 0.55;
        const up = 0.7 + vfxRand() * 0.7;
        // vận tốc tiếp tuyến → đường xoắn quanh người
        emitSpark(p.x + Math.cos(a) * r, p.y + 0.05, p.z + Math.sin(a) * r, -Math.sin(a) * 0.9, up, Math.cos(a) * 0.9, vfxRand() < 0.3 ? "#fff4d4" : TINT_C, O_RISE);
      }
    }
  });
  return (
    <group ref={g} visible={false} name="perf:castaura">
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={ring} renderOrder={12}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      <mesh position={[0, 1.1, 0]} material={col} renderOrder={12}>
        <cylinderGeometry args={[0.75, 0.95, 2.2, 32, 1, true]} />
      </mesh>
    </group>
  );
}
