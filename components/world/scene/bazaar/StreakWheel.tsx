"use client";
/**
 * Bánh Xe Chuỗi (ảo tưởng con bạc) + Tháp Số Lớn (luật số lớn).
 *  - Bánh xe đứng 37 ô (0 xanh, lẻ Đỏ, chẵn Đen), kim ở đỉnh; quay từng kết quả trong hàng đợi wheelFx.queue (ease-out, 2 vòng).
 *  - Bảng chuỗi: 10 đèn = 10 lần quay gần nhất (thấy rõ "5 Đỏ liền").
 *  - Tháp Số Lớn (tâm sân): kim TỈ LỆ ĐỎ lệch khỏi vạch 18/37 theo sai số (phóng đại ×12) → co dần về giữa khi n lớn;
 *    con trượt CHÊNH LỆCH Đỏ − Đen chạy dọc thanh ngang → càng quay càng lang thang xa, KHÔNG quay về 0.
 */
import { useGLTF } from "@react-three/drei";
import { toonize } from "../../fx/glbToon";
import { BAZAAR_GLB } from "./bazaarProps";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { P_RED, WHEEL_SLOTS, slotColor } from "@/lib/world/bazaar";
import { SEER, TOWER, WHEEL, WHEEL_YAW } from "@/lib/world/bazaarWorld";
import { useWorld } from "../../store";
import { Label3D } from "../../ui/Labels";
import { sfx } from "@/lib/world/sfx";
import { Keeper, glow, toon } from "./bazaarProps";
import { WHEEL_SPIN, useBazaar, wheelFx } from "./bazaarState";

const COL = {
  r: new THREE.Color("#d6304a"),
  b: new THREE.Color("#1d1a2c"),
  g: new THREE.Color("#22a05a"),
};
const SEG = (Math.PI * 2) / WHEEL_SLOTS;

function wheelGeometry(r: number) {
  const pos: number[] = [];
  const col: number[] = [];
  for (let s = 0; s < WHEEL_SLOTS; s++) {
    // ô s ở góc −s·SEG (theo chiều kim đồng hồ khi nhìn từ trước), ô 0 ở đỉnh
    const a0 = Math.PI / 2 - (s - 0.5) * SEG;
    const a1 = Math.PI / 2 - (s + 0.5) * SEG;
    const c = COL[slotColor(s)];
    for (const [ra, rb] of [[0.25, r]]) {
      const p = [
        [Math.cos(a0) * ra, Math.sin(a0) * ra],
        [Math.cos(a0) * rb, Math.sin(a0) * rb],
        [Math.cos(a1) * rb, Math.sin(a1) * rb],
        [Math.cos(a1) * ra, Math.sin(a1) * ra],
      ];
      for (const i of [0, 2, 1, 0, 3, 2]) {
        pos.push(p[i][0], p[i][1], 0);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function StreakWheel() {
  const glb = useGLTF(BAZAAR_GLB);
  const { stand, tower } = useMemo(() => {
    const get = (n: string) => {
      const src = glb.scene.getObjectByName(n);
      return src ? toonize(src) : null;
    };
    return { stand: get("bz_wheel_stand"), tower: get("bz_tower") };
  }, [glb]);
  const vi = useWorld((s) => s.lang === "vi");
  const stats = useBazaar((s) => s.wheelStats);
  const geo = useMemo(
    () => ({
      face: wheelGeometry(WHEEL.r),
      lamp: new THREE.SphereGeometry(0.16, 10, 8),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      face: new THREE.MeshToonMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      }),
      lamp: new THREE.MeshBasicMaterial({
        color: "#ffffff",
        toneMapped: false,
      }),
    }),
    [],
  );
  const board = useMemo(() => {
    const im = new THREE.InstancedMesh(geo.lamp, mats.lamp, 10);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 10; i++) {
      im.setMatrixAt(i, m.makeTranslation((i - 4.5) * 0.42, 0, 0));
      im.setColorAt(i, new THREE.Color(0.15, 0.15, 0.2));
    }
    return im;
  }, [geo, mats]);
  useEffect(
    () => () => {
      board.dispose();
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [board, geo, mats],
  );
  const disc = useRef<THREE.Group>(null);
  const needles = useRef<(THREE.Group | null)[]>([]);
  const sliders = useRef<(THREE.Mesh | null)[]>([]);
  const spin = useRef({
    t0: -1,
    idx: -1,
    landed: -1,
    from: 0,
    to: 0,
    angle: 0,
  });
  const C = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    const now = performance.now() / 1000;
    const s = spin.current;
    if (wheelFx.t0 !== s.t0) {
      s.t0 = wheelFx.t0;
      s.idx = -1;
      s.landed = -1;
    }
    const q = wheelFx.queue;
    const el = now - wheelFx.t0;
    const i = Math.floor(el / WHEEL_SPIN);
    if (el >= 0 && q.length && i < q.length) {
      if (i !== s.idx) {
        // bắt đầu lượt quay i: đích = ô q[i] dưới kim (đỉnh) + 2 vòng
        s.idx = i;
        s.from = s.angle;
        const base = q[i] * SEG;
        let to = base;
        while (to < s.from + Math.PI * 4) to += Math.PI * 2;
        s.to = to;
        sfx.whiff();
      }
      const u = Math.min(1, (el - i * WHEEL_SPIN) / (WHEEL_SPIN * 0.85));
      s.angle = s.from + (s.to - s.from) * (1 - Math.pow(1 - u, 3));
      if (u >= 1 && s.landed !== i) {
        // đáp: ghi lên bảng chuỗi (một lần mỗi lượt)
        s.landed = i;
        wheelFx.board.push(q[i]);
        if (wheelFx.board.length > 10) wheelFx.board.shift();
        sfx.knock();
      }
    } else if (el < 0 || i >= q.length) s.angle += dt * 0.05;
    if (disc.current) disc.current.rotation.z = s.angle;
    for (let k = 0; k < 10; k++) {
      const v = wheelFx.board[wheelFx.board.length - 10 + k];
      if (v === undefined) C.setRGB(0.15, 0.15, 0.2);
      else
        C.copy(COL[slotColor(v)]).multiplyScalar(
          slotColor(v) === "b" ? 4 : 2.6,
        );
      board.setColorAt(k, C);
    }
    board.instanceColor!.needsUpdate = true;
    // Tháp Số Lớn: chạy dọc các mốc của lần mô phỏng gần nhất trong 4 s
    const st = useBazaar.getState().wheelStats;
    if (st) {
      const tt = Math.min(1, (now - wheelFx.fast) / 4);
      const tr = st.trace;
      const f = tt * (tr.length - 1);
      const a = tr[Math.floor(f)];
      const b = tr[Math.min(tr.length - 1, Math.floor(f) + 1)];
      const w = f - Math.floor(f);
      const ratio = a.ratio + (b.ratio - a.ratio) * w;
      const gap = a.gap + (b.gap - a.gap) * w;
      for (const n of needles.current)
        if (n)
          n.rotation.z = THREE.MathUtils.clamp((ratio - P_RED) * 12, -1.2, 1.2);
      for (const m of sliders.current)
        if (m) m.position.x = THREE.MathUtils.clamp(gap / 100, -1.6, 1.6);
    }
  });

  const T = TOWER;
  const last = stats?.trace[stats.trace.length - 1];
  return (
    <group>
      <group position={[WHEEL.x, 0, WHEEL.z]} rotation-y={WHEEL_YAW}>
        {/* chân đế (Blender bz_wheel_stand: giá chữ A + khung bảng chuỗi + đèn lồng; thiếu → hình tạm) */}
        {stand ? <primitive object={stand} /> : null}
        {!stand && [-1, 1].map((sd) => (
          <mesh
            key={sd}
            material={toon("#5a3a2a")}
            position={[sd * 1.2, WHEEL.hub / 2, -0.15]}
            rotation-z={sd * 0.32}
          >
            <boxGeometry args={[0.16, WHEEL.hub + 0.4, 0.16]} />
          </mesh>
        ))}
        <group ref={disc} position={[0, WHEEL.hub, 0]}>
          <mesh geometry={geo.face} material={mats.face} />
          <mesh material={glow("#ffd27a", 1.5)}>
            <torusGeometry args={[WHEEL.r, 0.07, 8, 64]} />
          </mesh>
          <mesh material={toon("#ffd27a")} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.28, 0.28, 0.12, 16]} />
          </mesh>
        </group>
        {/* kim ở đỉnh */}
        <mesh
          material={glow("#ffffff", 2)}
          position={[0, WHEEL.hub + WHEEL.r + 0.12, 0.08]}
          rotation-z={Math.PI}
        >
          <coneGeometry args={[0.13, 0.36, 8]} />
        </mesh>
        {/* bảng chuỗi */}
        <group position={[0, WHEEL.hub + WHEEL.r + 0.75, -0.05]}>
          <mesh material={toon("#2a2140")} position={[0, 0, -0.12]}>
            <boxGeometry args={[4.5, 0.55, 0.08]} />
          </mesh>
          <primitive object={board} />
        </group>
      </group>
      <Keeper
        position={[SEER.x, 0, SEER.z]}
        yaw={WHEEL_YAW}
        body="#6a2a5a"
        hat="#9a6aff"
        vrm="avatars/rougan.vrm"
      />
      <mesh material={glow("#b48cff", 2.0)} position={[SEER.x, 1.15, SEER.z]}>
        <sphereGeometry args={[0.16, 12, 10]} />
      </mesh>
      <Label3D
        text={vi ? "Bánh Xe Chuỗi" : "Streak Wheel"}
        position={[WHEEL.x, WHEEL.hub + WHEEL.r + 1.5, WHEEL.z]}
        maxDist={40}
      />
      <Label3D
        variant="name"
        text={vi ? "Thầy Chuỗi" : "Streak Seer"}
        position={[SEER.x, 2.2, SEER.z]}
        maxDist={14}
      />

      {/* Tháp Số Lớn */}
      <group position={[T.x, 0, T.z]}>
        {tower ? (
          <primitive object={tower} />
        ) : (
          <mesh material={toon("#3b2d6a")} position={[0, T.h / 2, 0]}>
            <cylinderGeometry args={[0.7, T.r, T.h, 8]} />
          </mesh>
        )}
        <mesh material={glow("#ffd27a", 2)} position={[0, T.h + 0.4, 0]}>
          <octahedronGeometry args={[0.45, 0]} />
        </mesh>
        {/* hai mặt đồng hồ quay ra 2 phía (nam, bắc) */}
        {[0, Math.PI].map((ry) => (
          <group key={ry} rotation-y={ry}>
            {/* mặt kim tỉ lệ */}
            <group position={[0, 4.3, 1.02]}>
              <mesh material={toon("#f3e6c8")}>
                <circleGeometry args={[0.85, 32]} />
              </mesh>
              <mesh material={glow("#ffd27a", 1.8)} position={[0, 0.42, 0.01]}>
                <boxGeometry args={[0.03, 0.85, 0.005]} />
              </mesh>
              <group
                ref={(g) => void (needles.current[ry ? 1 : 0] = g)}
                position={[0, -0.6, 0.02]}
              >
                <mesh material={toon("#d6304a")} position={[0, 0.65, 0]}>
                  <boxGeometry args={[0.06, 1.3, 0.01]} />
                </mesh>
              </group>
            </group>
            {/* thanh chênh lệch Đỏ − Đen */}
            <group position={[0, 2.5, 1.12]}>
              <mesh material={toon("#2a2140")}>
                <boxGeometry args={[3.4, 0.22, 0.06]} />
              </mesh>
              <mesh material={glow("#ffffff", 1.5)} position={[0, 0, 0.04]}>
                <boxGeometry args={[0.03, 0.3, 0.01]} />
              </mesh>
              <mesh
                ref={(m) => void (sliders.current[ry ? 1 : 0] = m)}
                material={glow("#ff5a7a", 2.2)}
                position={[0, 0, 0.06]}
              >
                <boxGeometry args={[0.16, 0.34, 0.04]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      <Label3D
        text={vi ? "Tháp Số Lớn" : "Tower of Large Numbers"}
        position={[T.x, T.h + 1.3, T.z]}
        maxDist={45}
      />
      {last && (
        <Label3D
          variant="small"
          text={
            vi
              ? `n = ${last.n.toLocaleString("vi-VN")} · Đỏ ${(last.ratio * 100).toFixed(1).replace(".", ",")}% · Đỏ − Đen = ${last.gap > 0 ? "+" : ""}${last.gap}`
              : `n = ${last.n.toLocaleString("en-US")} · red ${(last.ratio * 100).toFixed(1)}% · red − black = ${last.gap > 0 ? "+" : ""}${last.gap}`
          }
          position={[T.x, 1.6, T.z + 1.6]}
          maxDist={20}
        />
      )}
    </group>
  );
}
