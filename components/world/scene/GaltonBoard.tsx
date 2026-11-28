"use client";
/**
 * Bảng Galton trên tường sàn chính phòng Siêu khối (phương vị 30°): 240 viên sáng rơi qua 10 hàng đinh, chồng thành hình chuông.
 * Nút thả (F, bệ trái) và cần nghiêng (F, bệ phải: p = ½ → 0,7 → 0,3) — p ≠ ½ làm chuông lệch; đường lam = kỳ vọng
 * n·C(10, k)·pᵏ(1 − p)¹⁰⁻ᵏ, đường vàng khắc trên bảng = chuông của p = ½. Tự thả lại mỗi ~20 s khi không ai bấm.
 * Đường bay giải tích (lib/world/galtonBoard.ts) — không có vật lý, 1 InstancedMesh cho cả 240 viên.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { worldAsset } from "@/lib/world/avatars";
import { dirOf } from "@/lib/world/tessRoom";
import { BINS, GB, GB_STATIONS, ballAt, binX, expected, galtonRun, nextTilt, runDuration, stackPos } from "@/lib/world/galtonBoard";
import { sfx } from "@/lib/world/sfx";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { Label3D } from "../ui/Labels";
import { useRoomProps } from "./roomProps";
import { useGLTF } from "@react-three/drei";

const GLB = worldAsset("props/galton_board.glb");
useGLTF.preload(GLB);
const RAD = Math.PI / 180;
const GS = { seed: 1, p: 0.5, t0: 0, pull: -1 };
const AUTO_GAP = 7; // s nghỉ sau khi viên cuối đậu rồi tự thả lại

export function GaltonBoard() {
  const props = useRoomProps(GLB);
  const vi = useWorld((s) => s.lang === "vi");
  const [p, setP] = useState(GS.p);
  const parts = useMemo(
    () => ({ board: props.clone("gb_board"), button: props.clone("gb_button"), tilt: props.clone("gb_tilt"), arm: props.clone("gb_tilt_arm"), ball: props.meshesOf("gb_ball") }),
    [props],
  );
  const balls = useMemo(() => {
    const list = parts.ball.map(({ geo, mat }) => {
      const im = new THREE.InstancedMesh(geo, mat, GB.balls);
      im.frustumCulled = false;
      return im;
    });
    return list;
  }, [parts]);
  useEffect(() => () => balls.forEach((im) => (im.geometry.dispose(), im.dispose())), [balls]);
  const run = useRef(galtonRun(GS.seed, GS.p));

  // đường kỳ vọng (chuẩn xấp xỉ, nối các cột kỳ vọng) — đổi theo p
  const curve = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts: number[] = [];
    const layerH = GB.ballR * 1.85;
    for (let s = 0; s <= 80; s++) {
      const kf = (s / 80) * GB.rows;
      const lo = Math.floor(kf);
      const hi = Math.min(GB.rows, lo + 1);
      const f = kf - lo;
      // nội suy cosin giữa hai cột kỳ vọng (mượt, đi qua đúng đỉnh cột)
      const e = expected(lo, p) * (0.5 + 0.5 * Math.cos(f * Math.PI)) + expected(hi, p) * (0.5 - 0.5 * Math.cos(f * Math.PI));
      pts.push(binX(0) + kf * GB.dx, GB.binY + (e / GB.perLayer) * layerH + GB.ballR, 0.05);
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color("#6fe6ff").multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.85 }));
    l.frustumCulled = false;
    return l;
  }, [p]);
  useEffect(() => () => (curve.geometry.dispose(), (curve.material as THREE.Material).dispose()), [curve]);

  useEffect(() => {
    const drop = (np: number) => {
      GS.seed += 1;
      GS.p = np;
      GS.t0 = performance.now();
      run.current = galtonRun(GS.seed, GS.p);
      setP(np);
    };
    GS.t0 = performance.now();
    run.current = galtonRun(GS.seed, GS.p);
    const offA = registerAction("galton-drop", () => {
      drop(GS.p);
      sfx.click();
    });
    const offB = registerAction("galton-tilt", () => {
      GS.pull = performance.now();
      drop(nextTilt(GS.p));
      sfx.chime(2);
    });
    // tự thả lại khi rảnh
    const iv = window.setInterval(() => {
      if ((performance.now() - GS.t0) / 1000 > runDuration() + AUTO_GAP) drop(GS.p);
    }, 1000);
    return () => {
      offA();
      offB();
      window.clearInterval(iv);
    };
  }, []);

  const o = useMemo(() => new THREE.Object3D(), []);
  const armRef = useRef<THREE.Group>(null);
  const settled = useRef(-1);
  useFrame(() => {
    const t = (performance.now() - GS.t0) / 1000;
    const r = run.current;
    const done = t > runDuration();
    // đã đậu hết thì không cần cập nhật nữa (chỉ một lần cuối)
    if (done && settled.current === GS.seed) return;
    settled.current = done ? GS.seed : -1;
    let n = 0;
    for (let i = 0; i < GB.balls; i++) {
      const q = done ? stackPos(r.bin[i], r.slot[i]) : ballAt(r, i, t);
      if (!q) break; // viên sau còn chưa thả
      o.position.set(q[0], q[1], 0);
      o.updateMatrix();
      balls.forEach((im) => im.setMatrixAt(n, o.matrix));
      n++;
    }
    balls.forEach((im) => {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
    });
    if (armRef.current) {
      const a = GS.pull < 0 ? 1 : (performance.now() - GS.pull) / 600;
      const target = GS.p === 0.7 ? -0.5 : GS.p === 0.3 ? 0.5 : 0;
      armRef.current.rotation.z = a < 1 ? target * Math.min(1, a * 1.6) + Math.sin(a * Math.PI * 3) * 0.08 * (1 - a) : target;
    }
  });

  const [bx, bz] = dirOf(GB.bearing);
  const mu = GB.rows * p;
  const sigma = Math.sqrt(GB.rows * p * (1 - p));
  const fmt = (x: number) => (vi ? x.toFixed(2).replace(".", ",") : x.toFixed(2));
  const st = (id: "drop" | "tilt") => {
    const s = GB_STATIONS[id];
    const [dx, dz] = dirOf(s.b);
    return [dx * s.r, 0, dz * s.r] as [number, number, number];
  };
  return (
    <group>
      <group position={[bx * GB.r, 0, bz * GB.r]} rotation-y={-GB.bearing * RAD}>
        <primitive object={parts.board} />
        {balls.map((im) => (
          <primitive key={im.uuid} object={im} />
        ))}
        <primitive object={curve} />
        <Label3D text={vi ? "Bảng Galton · Nhị thức → Chuẩn" : "Galton board · Binomial → Normal"} position={[0, 4.45, 0.2]} variant="small" maxDist={24} />
        <Label3D text={`p = ${fmt(p)} · μ = np = ${fmt(mu)} · σ = √(np(1−p)) ≈ ${fmt(sigma)} · ${BINS} ${vi ? "máng" : "bins"}`} position={[0, 2.25, 0.25]} variant="small" maxDist={14} />
      </group>
      <group position={st("drop")} rotation-y={-GB_STATIONS.drop.b * RAD}>
        <primitive object={parts.button} />
        <Label3D text={vi ? "Thả 240 viên (F)" : "Drop 240 balls (F)"} position={[0, 1.45, 0]} variant="small" maxDist={8} />
      </group>
      <group position={st("tilt")} rotation-y={-GB_STATIONS.tilt.b * RAD}>
        <primitive object={parts.tilt} />
        <group ref={armRef} position={[0, 0.95, 0]}>
          <primitive object={parts.arm} position={[0, -0.95, 0]} />
        </group>
        <Label3D text={vi ? `Nghiêng bảng: p = ${fmt(p)} (F)` : `Tilt: p = ${fmt(p)} (F)`} position={[0, 1.75, 0]} variant="small" maxDist={8} />
      </group>
    </group>
  );
}
