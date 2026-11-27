"use client";
/**
 * Thung lũng Hàm số: địa hình là đồ thị y = f(x) (bậc ba). Nhân vật trượt theo đường cong, nghiêng theo độ dốc;
 * mũi tên tiếp tuyến + số độ dốc; đồ thị f′ mờ phía dưới; neo; năng lực Cảm Biến Leo (tô màu dấu f′) và Kính Đổi Dấu.
 */
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, Outlines, Sparkles, Float } from "@react-three/drei";
import { Label3D } from "../ui/Labels";
import * as THREE from "three";
import { useWorld, timeScale, useT } from "../store";
import { Avatar } from "../player/Avatar";
import { MagicCircle } from "../fx/Effects";
import { toonMaterial } from "../fx/shaders";
import { criticalPoints, f, fp, type Cubic } from "@/lib/world/cubic";
import { AVATAR_BY_ID, worldAsset } from "@/lib/world/avatars";

export const X_MIN = -5;
export const X_MAX = 5;
const SX = 2.2;

/** Ánh xạ toạ độ toán → thế giới (co giãn theo chiều cao để đường ray luôn vừa khung) */
export function useMapping(k: Cubic) {
  return useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 200; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 200;
      const y = f(k, x);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    const range = Math.max(1, hi - lo);
    const SY = Math.min(1.6, 9 / range);
    const mid = (lo + hi) / 2;
    return {
      SY,
      wx: (x: number) => x * SX,
      wy: (y: number) => (y - mid) * SY + 5,
      lo,
      hi,
    };
  }, [k]);
}

export function Valley({ showDeriv = true }: { showDeriv?: boolean }) {
  const valleyCubic = useWorld((s) => s.valleyCubic);
  const challengeCubic = useWorld((s) => s.challengeCubic);
  const k = challengeCubic ?? valleyCubic;
  const abilities = useWorld((s) => s.state.abilities);
  const map = useMapping(k);
  const sense = abilities.includes("sense");
  const lens = abilities.includes("lens");
  const anchorAbility = abilities.includes("anchor");
  const t = useT();

  const track = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 240;
      pts.push(new THREE.Vector3(map.wx(x), map.wy(f(k, x)), 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 480, 0.14, 10, false);
    // Màu theo dấu f′ (khi có Cảm Biến Leo)
    const colors = new Float32Array(geo.attributes.position.count * 3);
    const pos = geo.attributes.position;
    const up = new THREE.Color("#3ee08f");
    const down = new THREE.Color("#ff5d7a");
    const gold = new THREE.Color("#ffd27a");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / SX;
      const c = sense ? (fp(k, x) >= 0 ? up : down) : gold;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [k, map, sense]);

  const derivPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    let maxD = 0;
    for (let i = 0; i <= 160; i++) maxD = Math.max(maxD, Math.abs(fp(k, X_MIN + ((X_MAX - X_MIN) * i) / 160)));
    const s = 2.2 / Math.max(1, maxD);
    for (let i = 0; i <= 160; i++) {
      const x = X_MIN + ((X_MAX - X_MIN) * i) / 160;
      pts.push([map.wx(x), -1.2 + fp(k, x) * s, -1.5]);
    }
    return pts;
  }, [k, map]);

  const cp = criticalPoints(k);
  const stationary = cp.kind === "two" ? [cp.x1, cp.x2] : cp.kind === "double" ? [cp.x0] : [];
  const signChanges = cp.kind === "two" ? [cp.x1, cp.x2] : [];

  return (
    <group>
      <ValleyGround />
      <mesh geometry={track}>
        <meshToonMaterial vertexColors emissive="#3a2a00" emissiveIntensity={0.25} />
        <Outlines thickness={0.03} color="#2b2d42" />
      </mesh>
      {/* Trục hoành phụ + vạch số nguyên */}
      <Line points={[[map.wx(X_MIN), -1.2, -1.5], [map.wx(X_MAX), -1.2, -1.5]]} color="#ffffff" lineWidth={1} transparent opacity={0.5} />
      {showDeriv && <Line points={derivPts} color="#8be0ff" lineWidth={2.5} dashed dashSize={0.25} gapSize={0.15} transparent opacity={0.9} />}
      {showDeriv && (
        <Label3D text={t("derivGraph")} position={[map.wx(X_MAX) + 0.4, -1.2, -1.5]} variant="small" />
      )}
      {Array.from({ length: X_MAX - X_MIN + 1 }, (_, i) => X_MIN + i).map((x) => (
        <Label3D key={x} text={String(x)} position={[map.wx(x), -1.6, -1.5]} variant="small" scale={0.7} />
      ))}
      {/* Neo đã đặt */}
      <AnchorPins map={map} k={k} />
      {/* Điểm dừng lấp lánh khi có Neo Móc (chỉ ở sandbox, không lộ khi làm bài xác nhận) */}
      {anchorAbility &&
        !challengeCubic &&
        stationary.map((x) => (
          <Float key={`s${x}`} speed={3} floatIntensity={0.3}>
            <mesh position={[map.wx(x), map.wy(f(k, x)) + 0.35, 0]}>
              <octahedronGeometry args={[0.16, 0]} />
              <meshBasicMaterial color="#fff3b0" />
            </mesh>
          </Float>
        ))}
      {lens &&
        !challengeCubic &&
        signChanges.map((x) => (
          <mesh key={`l${x}`} position={[map.wx(x), map.wy(f(k, x)), 0]}>
            <cylinderGeometry args={[0.03, 0.03, 4, 8]} />
            <meshBasicMaterial color="#c9a2ff" transparent opacity={0.7} />
          </mesh>
        ))}
      <Rider k={k} map={map} />
    </group>
  );
}

function AnchorPins({ map, k }: { map: ReturnType<typeof useMapping>; k: Cubic }) {
  const anchors = useWorld((s) => s.anchors);
  return (
    <>
      {anchors.map((x, i) => (
        <group key={i} position={[map.wx(x), map.wy(f(k, x)), 0]}>
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.16, 0.5, 4]} />
            <meshToonMaterial color="#ffd27a" emissive="#ff9d00" emissiveIntensity={0.6} />
          </mesh>
          <MagicCircle radius={0.5} position={[0, 0.02, 0]} intensity={0.9} />
        </group>
      ))}
    </>
  );
}

function Rider({ k, map }: { k: Cubic; map: ReturnType<typeof useMapping> }) {
  const g = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const label = useRef<HTMLDivElement>(null);
  const { camera } = useThree();
  const avatar = useWorld((s) => s.avatar);
  const cam = useRef(new THREE.Vector3(0, 6, 14));
  const lastDir = useRef(1);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt) * timeScale();
    const s = useWorld.getState();
    let x = s.valleyX;
    const dx = s.input.x * (s.input.run ? 3.2 : 1.8) * dt;
    if (Math.abs(dx) > 1e-4) lastDir.current = Math.sign(dx);
    x = Math.max(X_MIN + 0.05, Math.min(X_MAX - 0.05, x + dx));
    if (x !== s.valleyX) useWorld.setState({ valleyX: x });
    const y = f(k, x);
    const slope = fp(k, x);
    const wx = map.wx(x);
    const wy = map.wy(y);
    const worldSlope = (slope * map.SY) / SX;
    const ang = Math.atan(worldSlope);
    if (g.current) {
      g.current.position.set(wx, wy + 0.12, 0);
      g.current.rotation.set(0, lastDir.current > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      // Nghiêng người theo dốc
      g.current.rotateX(-ang * lastDir.current * 0.6);
    }
    if (arrow.current) {
      arrow.current.position.set(wx, wy, 0.35);
      arrow.current.rotation.set(0, 0, ang);
    }
    if (label.current) {
      const flat = Math.abs(slope) < 0.08;
      const vi = s.lang === "vi";
      const fx = (n: number) => (vi ? n.toFixed(2).replace(".", ",") : n.toFixed(2));
      label.current.textContent = `f′(${fx(x)}) = ${fx(slope)}`;
      label.current.style.background = flat ? "rgba(255,210,90,.95)" : slope > 0 ? "rgba(62,224,143,.9)" : "rgba(255,93,122,.9)";
    }
    // Máy quay ngang theo người lướt
    cam.current.lerp(new THREE.Vector3(wx, wy + 2.2, 13), Math.min(1, rawDt * 3));
    camera.position.copy(cam.current);
    camera.lookAt(wx, wy + 0.8, 0);
  });

  const moving = useWorld((s) => Math.abs(s.input.x) > 0.05);
  return (
    <>
      <group ref={g}>
        <Avatar url={AVATAR_BY_ID[avatar] ? worldAsset(AVATAR_BY_ID[avatar].file) : undefined} pose={moving ? "walk" : "idle"} speed={1} />
        {/* Ván lướt ánh sáng */}
        <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.5, 0.05, 1.2]} />
          <meshToonMaterial color="#9fe6ff" emissive="#2a9fd6" emissiveIntensity={0.8} />
        </mesh>
      </group>
      <group ref={arrow}>
        {/* Tiếp tuyến */}
        <mesh>
          <boxGeometry args={[3.2, 0.06, 0.06]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
        <mesh position={[1.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.14, 0.3, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Label3D position={[0, 1.9, 0]} variant="math" onEl={(el) => (label.current = el)} />
      </group>
    </>
  );
}

function ValleyGround() {
  const mats = useMemo(
    () => ({
      far: toonMaterial("#7fb7e6", { rim: "#e6f6ff" }),
      mid: toonMaterial("#5aa86a", { rim: "#d9ffb0" }),
      ground: toonMaterial("#78c46e", { rim: "#e3ffc4" }),
    }),
    [],
  );
  const hills = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: -26 + i * 4 + ((i * 13) % 5),
        z: -18 - (i % 3) * 6,
        h: 6 + ((i * 7) % 6) * 1.6,
        far: i % 2 === 0,
      })),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, -6]} material={mats.ground} receiveShadow>
        <planeGeometry args={[120, 40]} />
      </mesh>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, -3 + h.h / 2, h.z]} material={h.far ? mats.far : mats.mid}>
          <coneGeometry args={[h.h * 0.7, h.h, 7]} />
        </mesh>
      ))}
      <MagicCircle radius={9} position={[0, 12, -25]} vertical intensity={0.35} spin={0.3} />
      <Sparkles count={150} scale={[30, 12, 8]} position={[0, 5, -2]} size={3} color="#fff6c8" speed={0.3} />
    </group>
  );
}
