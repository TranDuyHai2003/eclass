"use client";
/**
 * Khe Young lượng tử trên tường sàn chính phòng Siêu khối (phương vị 60°, lib/world/doubleSlit.ts):
 * súng bắn TỪNG hạt một → qua tấm chắn hai khe → chấm lên màn (DataTexture tích luỹ 256 × 64). Vài trăm hạt đầu trông
 * ngẫu nhiên, rồi vân giao thoa hiện dần. Bệ trái: bật / tắt máy dò "đường nào" (vân biến mất); bệ phải: đổi khoảng cách khe d
 * (vân sít lại khi d lớn — Δy = λL/d). Mô hình Blender `props/double_slit.glb`; bệ dùng chung với bảng Galton.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { DS, fringeSpacing, sampleHit } from "@/lib/world/doubleSlit";
import { mulberry32 } from "@/lib/world/monty";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { useRoomProps } from "./roomProps";

const GLB = worldAsset("props/double_slit.glb");
const GALTON = worldAsset("props/galton_board.glb");
useGLTF.preload(GLB);
const TW = 256;
const TH = 64;
const RATE = 26; // hạt / giây
const FLY = 0.42; // s bay súng → màn
const SLIT_W = 0.07;
const PLATE_H = 0.5; // tấm chắn thấp (0,6 m) để nhìn qua thấy màn
const dVis = (d: number) => 0.22 + 0.42 * d; // khoảng cách khe vẽ ra (m)

const screenFrag = /* glsl */ `
uniform sampler2D uAcc; uniform float uGain; varying vec2 vUv;
void main(){
  float c = texture2D(uAcc, vUv).r * uGain;
  c = 1.0 - exp(-c * 3.0);
  vec3 bg = vec3(0.02, 0.025, 0.06) + vec3(0.03, 0.05, 0.1) * (1.0 - abs(vUv.y - 0.5) * 2.0);
  vec3 col = bg + vec3(0.25, 0.85, 1.0) * c + vec3(1.0) * c * c * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

const SL = { det: false, gi: 1, seed: 1 };

export function DoubleSlit() {
  const props = useRoomProps(GLB);
  const gal = useRoomProps(GALTON);
  const vi = useWorld((s) => s.lang === "vi");
  const [det, setDet] = useState(SL.det);
  const [gi, setGi] = useState(SL.gi);
  const [count, setCount] = useState(0);
  const parts = useMemo(
    () => ({
      gun: props.clone("ds_gun"),
      frame: props.clone("ds_barrier_frame"),
      screen: props.clone("ds_screen_frame"),
      sideL: props.clone("ds_side"),
      sideR: props.clone("ds_side"),
      mid: props.clone("ds_mid"),
      detL: props.clone("ds_detector"),
      detR: props.clone("ds_detector"),
      padA: gal.clone("gb_button"),
      padB: gal.clone("gb_tilt"),
    }),
    [props, gal],
  );
  const acc = useMemo(() => {
    const data = new Uint8Array(TW * TH * 4);
    const tex = new THREE.DataTexture(data, TW, TH, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return { data, tex, counts: new Float32Array(TW * TH) };
  }, []);
  const screenMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uAcc: { value: acc.tex }, uGain: { value: 1 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: screenFrag,
        toneMapped: false,
      }),
    [acc],
  );
  useEffect(() => () => (acc.tex.dispose(), screenMat.dispose()), [acc, screenMat]);

  // hạt đang bay (tối đa 16): vị trí đích trên màn + thời điểm bắn
  const flying = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.035, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#7fe8ff").multiplyScalar(2.4), toneMapped: false });
    const im = new THREE.InstancedMesh(geo, mat, 16);
    im.frustumCulled = false;
    im.count = 0;
    return { im, list: [] as { u: number; v: number; slit: number; t0: number }[] };
  }, []);
  useEffect(() => () => (flying.im.geometry.dispose(), (flying.im.material as THREE.Material).dispose(), flying.im.dispose()), [flying]);

  const st = useRef({ rand: mulberry32(SL.seed), last: performance.now(), carry: 0, n: 0, dirty: false, upAt: 0 });
  const reset = () => {
    acc.counts.fill(0);
    acc.data.fill(0);
    acc.tex.needsUpdate = true;
    st.current.n = 0;
    flying.list.length = 0;
    setCount(0);
  };
  useEffect(() => {
    const offA = registerAction("slit-detector", () => {
      SL.det = !SL.det;
      setDet(SL.det);
      reset();
      sfx.chime(SL.det ? 1 : 3);
    });
    const offB = registerAction("slit-gap", () => {
      SL.gi = (SL.gi + 1) % DS.gaps.length;
      setGi(SL.gi);
      reset();
      sfx.click();
    });
    return () => (offA(), offB());
    // reset chỉ đụng tới acc / flying (ổn định theo useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const o = useMemo(() => new THREE.Object3D(), []);
  const d = DS.gaps[gi];
  useFrame(() => {
    const now = performance.now();
    const s = st.current;
    const dt = Math.min(0.1, (now - s.last) / 1000);
    s.last = now;
    // phát hạt theo nhịp đều
    s.carry += dt * RATE;
    while (s.carry >= 1) {
      s.carry -= 1;
      const [u, v] = sampleHit(s.rand, DS.gaps[SL.gi], SL.det);
      if (flying.list.length < 16) flying.list.push({ u, v, slit: s.rand() < 0.5 ? -1 : 1, t0: now });
    }
    // cập nhật hạt bay; chạm màn thì chấm vào kết cấu
    let n = 0;
    const half = dVis(DS.gaps[SL.gi]) / 2;
    for (let i = flying.list.length - 1; i >= 0; i--) {
      const f = flying.list[i];
      const k = (now - f.t0) / 1000 / FLY;
      if (k >= 1) {
        const px = Math.round(((f.u + 1) / 2) * (TW - 1));
        const py = Math.round(((f.v + 1) / 2) * (TH - 1));
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const x = px + ox;
            const y = py + oy;
            if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
            const w = ox === 0 && oy === 0 ? 1 : 0.35;
            const j = y * TW + x;
            acc.counts[j] += w;
            acc.data[j * 4] = Math.min(255, Math.round(acc.counts[j] * 26));
          }
        s.n++;
        s.dirty = true;
        flying.list.splice(i, 1);
        continue;
      }
      // súng → khe (thẳng, 45 % thời gian) → màn
      const zGun = DS.rGun + 0.56;
      const k1 = 0.45;
      let x: number;
      let y: number;
      let z: number;
      if (k < k1) {
        const a = k / k1;
        x = f.slit * half * a;
        y = DS.beamY;
        z = zGun + (DS.rBarrier - zGun) * a;
      } else {
        const a = (k - k1) / (1 - k1);
        x = f.slit * half + (f.u * (DS.W / 2) - f.slit * half) * a;
        y = DS.beamY + (DS.screenY + f.v * (DS.H / 2) - DS.beamY) * a;
        z = DS.rBarrier + (DS.rScreen - 0.08 - DS.rBarrier) * a;
      }
      o.position.set(x, y, z);
      o.updateMatrix();
      flying.im.setMatrixAt(n++, o.matrix);
    }
    flying.im.count = n;
    flying.im.instanceMatrix.needsUpdate = true;
    if (s.dirty && now - s.upAt > 90) {
      acc.tex.needsUpdate = true;
      s.dirty = false;
      s.upAt = now;
      // tăng sáng vừa phải khi còn ít hạt, giảm dần khi đã dày
      screenMat.uniforms.uGain.value = 1.2 / Math.max(1, Math.sqrt(s.n / 600));
      if (s.n % 25 === 0) setCount(s.n);
    }
  });

  // tấm chắn: hai khối bên + khối giữa co theo d (khe rộng SLIT_W ở ±dVis/2)
  const inner = dVis(d) / 2 - SLIT_W / 2;
  const outer = 1.24;
  const sideW = outer - (inner + SLIT_W);
  const fmt = (x: number) => (vi ? x.toFixed(2).replace(".", ",") : x.toFixed(2));
  return (
    <group rotation-y={Math.PI - (DS.bearing * Math.PI) / 180}>
      <primitive object={parts.gun} position={[0, 0, DS.rGun]} />
      <group position={[0, DS.beamY, DS.rBarrier]}>
        <primitive object={parts.frame} />
        <primitive object={parts.mid} scale={[Math.max(0.02, inner * 2), PLATE_H, 1]} />
        <primitive object={parts.sideL} position={[-(inner + SLIT_W + sideW / 2), 0, 0]} scale={[sideW, PLATE_H, 1]} />
        <primitive object={parts.sideR} position={[inner + SLIT_W + sideW / 2, 0, 0]} scale={[sideW, PLATE_H, 1]} />
        {det && <primitive object={parts.detL} position={[-(inner + SLIT_W / 2), 0.45, -0.12]} />}
        {det && <primitive object={parts.detR} position={[inner + SLIT_W / 2, 0.45, -0.12]} />}
      </group>
      <group position={[0, DS.screenY, DS.rScreen]}>
        <primitive object={parts.screen} />
        <mesh material={screenMat} rotation-y={Math.PI} position={[0, 0, -0.01]}>
          <planeGeometry args={[DS.W, DS.H]} />
        </mesh>
      </group>
      <primitive object={flying.im} />
      <Label3D text={vi ? "Khe Young · từng hạt một → vân giao thoa · Δy = λL/d" : "Young's slits · one particle at a time → fringes · Δy = λL/d"} position={[0, 3.25, DS.rScreen - 0.2]} variant="small" maxDist={20} />
      <Label3D text={`${count} ${vi ? "hạt" : "particles"} · d = ${fmt(d)} · ${vi ? "khoảng vân" : "fringe spacing"} ≈ ${fmt(fringeSpacing(d) * DS.W * 0.5)} m${det ? (vi ? " · ĐANG DÒ đường đi" : " · WHICH-PATH ON") : ""}`} position={[0, 0.72, DS.rScreen - 0.25]} variant="small" maxDist={12} />
      <group position={[DS.stations.detector.x, 0, DS.stations.detector.z]} rotation-y={Math.PI}>
        <primitive object={parts.padA} />
        <Label3D text={vi ? `Máy dò đường đi: ${det ? "BẬT" : "TẮT"} (F)` : `Which-path detector: ${det ? "ON" : "OFF"} (F)`} position={[0, 1.45, 0]} variant="small" maxDist={8} />
      </group>
      <group position={[DS.stations.gap.x, 0, DS.stations.gap.z]} rotation-y={Math.PI}>
        <primitive object={parts.padB} />
        <Label3D text={vi ? `Khoảng cách khe d = ${fmt(d)} (F đổi)` : `Slit gap d = ${fmt(d)} (F to change)`} position={[0, 1.75, 0]} variant="small" maxDist={8} />
      </group>
    </group>
  );
}
