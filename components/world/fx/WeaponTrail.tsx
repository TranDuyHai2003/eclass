"use client";
/**
 * Vệt chém (weapon trail) kiểu Genshin / Honkai: mỗi khung hình lấy mép vũ khí (gốc → mũi), giữ ~0,2 s lịch sử,
 * nội suy Catmull-Rom cho cung mượt kể cả khi tụt khung, dựng dải ruy băng phát sáng: lõi trắng sát mũi → màu vũ khí →
 * tắt dần theo tuổi; vân năng lượng chảy dọc vệt. Chỉ "ghi" khi đang ra đòn (active) — hết đòn thì vệt tự tàn.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const N = 28; // mẫu lịch sử
const SUB = 3; // điểm nội suy giữa hai mẫu
const LIFE = 0.26; // giây
const M = (N - 1) * SUB + 1;

/** Mũi vũ khí gần nhất (thế giới) — combat dùng để đặt tín hiệu "loé" của Nhịp */
export const TRAIL_TIP = { pos: new THREE.Vector3(), at: 0, live: false, n: 0 };

type Sample = { b: THREE.Vector3; t: THREE.Vector3; time: number; on: number };

function cr(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, s: number, out: THREE.Vector3) {
  const s2 = s * s;
  const s3 = s2 * s;
  return out.set(
    0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
    0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
    0.5 * (2 * p1.z + (-p0.z + p2.z) * s + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * s2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * s3),
  );
}

export function WeaponTrail({ edge, active, color, gold }: { edge: (base: THREE.Vector3, tip: THREE.Vector3) => boolean; active: () => boolean; color: string; gold: () => boolean }) {
  const samples = useRef<Sample[]>([]);
  const res = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(M * 2 * 3);
    const uv = new Float32Array(M * 2 * 2);
    const al = new Float32Array(M * 2);
    const idx: number[] = [];
    for (let i = 0; i < M - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aOn", new THREE.BufferAttribute(al, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uGold: { value: 0 }, uT: { value: 0 } },
      vertexShader: `attribute float aOn; varying vec2 vUv; varying float vOn;
        void main(){ vUv = uv; vOn = aOn; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uGold; uniform float uT; varying vec2 vUv; varying float vOn;
        void main(){
          float age = vUv.x;            // 0 = mới nhất (sát vũ khí), 1 = cũ nhất
          float v = vUv.y;              // 0 = gốc, 1 = mũi
          // thân vệt: dày ở phía mũi, mỏng dần về gốc; đuôi tắt theo tuổi
          float body = smoothstep(0.0, 0.3, v) * (1.0 - smoothstep(0.94, 1.0, v));
          float tail = pow(max(1e-4, 1.0 - age), 1.25);
          // vân năng lượng chảy ngược chiều chém
          float streak = 0.65 + 0.35 * sin(age * 34.0 - uT * 26.0 + v * 7.0);
          vec3 base = mix(uColor, vec3(1.0, 0.86, 0.45), uGold);
          vec3 c = mix(base * 1.6, vec3(1.0) * 2.6, smoothstep(0.72, 0.97, v) * (1.0 - age * 0.8));
          float a = body * tail * streak * vOn;
          gl_FragColor = vec4(c * a * 2.0, min(1.0, a * 1.3));
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { geo, mat };
  }, [color]);
  useEffect(() => () => (res.geo.dispose(), res.mat.dispose()), [res]);
  const mesh = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => ({ b: new THREE.Vector3(), t: new THREE.Vector3(), o: new THREE.Vector3() }), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    const S = samples.current;
    const on = active() ? 1 : 0;
    if (edge(tmp.b, tmp.t)) {
      const last = S[0];
      // bỏ mẫu trùng (đứng yên) để vệt không "đặc" lại
      if (!last || last.t.distanceToSquared(tmp.t) > 1e-5 || on !== last.on) S.unshift({ b: tmp.b.clone(), t: tmp.t.clone(), time: now, on });
      if (on) {
        TRAIL_TIP.pos.copy(tmp.t);
        TRAIL_TIP.at = performance.now();
      }
    }
    while (S.length > N) S.pop();
    while (S.length && now - S[S.length - 1].time > LIFE) S.pop();
    const m = mesh.current;
    const live = S.length >= 3 && S.some((s) => s.on);
    if (m) m.visible = live;
    TRAIL_TIP.live = live;
    TRAIL_TIP.n = S.length;
    if (!live) return;
    res.mat.uniforms.uT.value = now;
    res.mat.uniforms.uGold.value += ((gold() ? 1 : 0) - res.mat.uniforms.uGold.value) * 0.2;
    const pos = res.geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = res.geo.getAttribute("uv") as THREE.BufferAttribute;
    const al = res.geo.getAttribute("aOn") as THREE.BufferAttribute;
    let k = 0;
    const n = S.length;
    for (let i = 0; i < n - 1 && k < M; i++) {
      const p0 = S[Math.max(0, i - 1)];
      const p1 = S[i];
      const p2 = S[i + 1];
      const p3 = S[Math.min(n - 1, i + 2)];
      for (let j = 0; j < SUB && k < M; j++) {
        const s = j / SUB;
        const age = Math.min(1, (now - (p1.time + (p2.time - p1.time) * s)) / LIFE);
        cr(p0.b, p1.b, p2.b, p3.b, s, tmp.o);
        pos.setXYZ(k * 2, tmp.o.x, tmp.o.y, tmp.o.z);
        cr(p0.t, p1.t, p2.t, p3.t, s, tmp.o);
        pos.setXYZ(k * 2 + 1, tmp.o.x, tmp.o.y, tmp.o.z);
        uv.setXY(k * 2, age, 0);
        uv.setXY(k * 2 + 1, age, 1);
        const o = p1.on * (1 - s) + p2.on * s;
        al.setX(k * 2, o);
        al.setX(k * 2 + 1, o);
        k++;
      }
    }
    // dồn phần dư về điểm cuối (tam giác suy biến, không vẽ)
    const lastB = S[n - 1].b;
    const lastT = S[n - 1].t;
    for (; k < M; k++) {
      pos.setXYZ(k * 2, lastB.x, lastB.y, lastB.z);
      pos.setXYZ(k * 2 + 1, lastT.x, lastT.y, lastT.z);
      uv.setXY(k * 2, 1, 0);
      uv.setXY(k * 2 + 1, 1, 1);
      al.setX(k * 2, 0);
      al.setX(k * 2 + 1, 0);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    al.needsUpdate = true;
  });
  return <mesh ref={mesh} geometry={res.geo} material={res.mat} frustumCulled={false} renderOrder={5} />;
}
