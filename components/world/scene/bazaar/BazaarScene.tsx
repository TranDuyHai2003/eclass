"use client";
/**
 * Chợ Xác Suất (Chance Bazaar) — chợ đêm hội trên đảo nổi; mỗi quầy là một ý tưởng xác suất, và HIỂU nó là cách thắng:
 *   Đèn Năm (bài toán ngày sinh) · Bãi Rương Mimic (Bayes, tần số tự nhiên) · Ruộng Slime (tổng xúc xắc → hình chuông)
 *   · Bánh Xe Chuỗi + Tháp Số Lớn (độc lập, ảo tưởng con bạc, luật số lớn). Cột chỉ đường dẫn sang Sân khấu Ba Cửa (Monty Hall).
 * Mỗi quầy: Đoán (chốt một con số) → Xem (quá trình thật, một lần chậm + nghìn lần nhanh) → Thương vụ (nhận / bỏ; chấm theo kì vọng).
 * Logic thuần + test: lib/world/bazaar.ts, lib/world/bazaarWorld.ts, tests/world/bazaar.test.ts. Kế hoạch: PLAN.md T19.
 * Hình hiện là khối TẠM (bazaarProps.tsx) — chờ mô hình Blender.
 */
import { useGLTF } from "@react-three/drei";
import { toonize } from "../../fx/glbToon";
import { BAZAAR_GLB } from "./bazaarProps";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { AVATAR_BY_ID } from "@/lib/world/avatars";
import { Player, type Nearby } from "../Hub";
import { RemotePlayers } from "../RemotePlayers";
import { MagicCircle } from "../../fx/Effects";
import { Label3D } from "../../ui/Labels";
import { registerAction } from "../../actions";
import {
  BAZAAR_R,
  BAZAAR_SPOTS,
  MONTY_SIGN,
  PORTAL,
  SLIME_TRACK,
  SPAWN,
  TOWER,
  WISP_TREE,
  bazaarBlocked,
  bazaarGround,
  tileAt,
  tileX,
} from "@/lib/world/bazaarWorld";
import { SLIME_MAX, SLIME_STAGES } from "@/lib/world/bazaar";
import { BAZAAR_FOG, BazaarSky, MOON_DIR } from "./BazaarSky";
import { WispTree } from "./WispTree";
import { MimicField } from "./MimicField";
import { SlimeTrack } from "./SlimeTrack";
import { StreakWheel } from "./StreakWheel";
import { SignPost, toon } from "./bazaarProps";
import {
  bazaarHint,
  closeStall,
  loadBazaar,
  openStall,
  toggleNet,
  useBazaar,
} from "./bazaarState";

const MOON_POS = MOON_DIR.clone().multiplyScalar(60).toArray() as [
  number,
  number,
  number,
];
const ground = () => bazaarGround();
const blocked = (x: number, z: number) => bazaarBlocked(x, z);
const GARLANDS = 8;
const BULBS = 16;

/** dây đèn kết từ đỉnh Tháp Số Lớn toả ra 8 cột ở mép sân */
function garlandMesh() {
  const geo = new THREE.SphereGeometry(0.11, 8, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    toneMapped: false,
  });
  const im = new THREE.InstancedMesh(geo, mat, GARLANDS * BULBS);
  const pal = [
    new THREE.Color(2.6, 1.5, 0.5),
    new THREE.Color(2.4, 0.8, 1.4),
    new THREE.Color(0.8, 1.9, 2.4),
    new THREE.Color(1.2, 2.4, 1.0),
  ];
  const m = new THREE.Matrix4();
  const lines: number[] = [];
  for (let g = 0; g < GARLANDS; g++) {
    const a = (g / GARLANDS) * Math.PI * 2 + Math.PI / 8;
    const x1 = Math.cos(a) * (BAZAAR_R - 0.6);
    const z1 = Math.sin(a) * (BAZAAR_R - 0.6);
    let prev = [0, TOWER.h - 0.3, 0];
    for (let b = 0; b <= BULBS; b++) {
      const t = b / BULBS;
      const y =
        TOWER.h -
        0.3 +
        (4.2 - (TOWER.h - 0.3)) * t -
        Math.sin(Math.PI * t) * 1.6;
      const p = [x1 * t, y, z1 * t];
      if (b > 0) lines.push(...prev, ...p);
      prev = p;
      if (b > 0 && b < BULBS + 1) {
        const k = g * BULBS + b - 1;
        im.setMatrixAt(k, m.makeTranslation(p[0], p[1] - 0.12, p[2]));
        im.setColorAt(k, pal[(g + b) % pal.length]);
      }
    }
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
  const lm = new THREE.LineBasicMaterial({ color: "#2a1d18" });
  return {
    im,
    geo,
    mat,
    lg,
    lm,
    posts: Array.from(
      { length: GARLANDS },
      (_, g) => (g / GARLANDS) * Math.PI * 2 + Math.PI / 8,
    ),
  };
}

export function Bazaar() {
  const plazaGlb = useGLTF(BAZAAR_GLB);
  const plaza = useMemo(() => {
    const src = plazaGlb.scene.getObjectByName("bz_plaza");
    return src ? toonize(src) : null;
  }, [plazaGlb]);
  const avatar = useWorld((s) => s.avatar);
  const vi = useWorld((s) => s.lang === "vi");
  const slimeStage = useBazaar((s) => s.slimeStage);

  useEffect(() => {
    loadBazaar();
    if (useWorld.getState().camDist > 7) useWorld.setState({ camDist: 4.6 });
    const offs = [
      registerAction("bazaar:wisp", () => openStall("wisp")),
      registerAction("bazaar:mimic", () => openStall("mimic")),
      registerAction("bazaar:slime", () => openStall("slime")),
      registerAction("bazaar:wheel", () => openStall("wheel")),
      registerAction("bazaar:net", () => {
        const p = useWorld.getState().player;
        const t = tileAt(p.x, p.z);
        if (t > 0) toggleNet(t);
      }),
    ];
    const t = window.setTimeout(() => {
      const s = useBazaar.getState();
      if (!Object.values(s.stamps).some(Boolean))
        bazaarHint(
          "Chợ Xác Suất: mỗi quầy bày một trò may rủi — nhưng người hiểu xác suất luôn biết vụ nào nên nhận. Đến quầy nào cũng được, bấm F.",
          "The Chance Bazaar: every stall offers a game of luck — but whoever understands probability knows which deals to take. Visit any stall and press F.",
        );
    }, 3500);
    return () => {
      offs.forEach((f) => f());
      window.clearTimeout(t);
      useBazaar.setState({ hint: null, panel: null });
    };
  }, []);

  const garland = useMemo(() => garlandMesh(), []);
  useEffect(
    () => () => {
      garland.im.dispose();
      garland.geo.dispose();
      garland.mat.dispose();
      garland.lg.dispose();
      garland.lm.dispose();
    },
    [garland],
  );

  // quầy đang mở: đi xa thì tự đóng (Ruộng Slime: được đi dọc đường ray)
  useFrame(() => {
    const s = useBazaar.getState();
    if (!s.panel) return;
    const p = useWorld.getState().player;
    const spot = BAZAAR_SPOTS[s.panel];
    let far = Math.hypot(p.x - spot.x, p.z - spot.z) > 7;
    if (s.panel === "slime" && far)
      far = !(
        p.x > tileX(0) - 2 &&
        p.x < tileX(SLIME_MAX) + 2 &&
        Math.abs(p.z - SLIME_TRACK.z) < 6
      );
    if (far) closeStall();
  });

  return (
    <group>
      <color attach="background" args={[BAZAAR_FOG]} />
      <fog attach="fog" args={[BAZAAR_FOG, 40, 140]} />
      <hemisphereLight args={["#8f86d8", "#5a3a3a", 1.1]} />
      <directionalLight position={MOON_POS} intensity={1.2} color="#cfd6ff" />
      <directionalLight
        position={[10, 14, 18]}
        intensity={0.9}
        color="#ffb86a"
      />
      <BazaarSky />
      {/* sân đá lát vòng + vòng khảm vàng + bó vỉa + thân đảo: Blender (bz_plaza); thiếu node → hình tạm */}
      {plaza ? (
        <primitive object={plaza} />
      ) : (
        <>
      <mesh
        material={toon("#6b5470")}
        rotation-x={-Math.PI / 2}
        position={[0, -0.01, 0]}
      >
        <circleGeometry args={[BAZAAR_R, 72]} />
      </mesh>
      {[6, 12.5, 19].map((r) => (
        <mesh
          key={r}
          material={toon("#836a86")}
          rotation-x={-Math.PI / 2}
          position={[0, 0.0, 0]}
        >
          <ringGeometry args={[r - 0.18, r + 0.18, 72]} />
        </mesh>
      ))}
      <mesh material={toon("#4c3a52")} position={[0, -2.6, 0]}>
        <cylinderGeometry args={[BAZAAR_R, BAZAAR_R - 6, 5.2, 48, 1, true]} />
      </mesh>
      <mesh
        material={toon("#8a6f86")}
        rotation-x={Math.PI / 2}
        position={[0, 0.3, 0]}
      >
        <torusGeometry args={[BAZAAR_R - 0.2, 0.28, 6, 72]} />
      </mesh>
        </>
      )}
      <primitive object={garland.im} />
      <lineSegments geometry={garland.lg} material={garland.lm} />
      {garland.posts.map((a) => (
        <mesh
          key={a}
          material={toon("#5a3a2a")}
          position={[
            Math.cos(a) * (BAZAAR_R - 0.6),
            2.2,
            Math.sin(a) * (BAZAAR_R - 0.6),
          ]}
        >
          <cylinderGeometry args={[0.08, 0.1, 4.4, 6]} />
        </mesh>
      ))}

      <WispTree />
      <MimicField />
      <SlimeTrack />
      <StreakWheel />

      {/* cổng về + cột chỉ đường Sân khấu Ba Cửa */}
      <MagicCircle
        radius={1.5}
        position={[PORTAL.x, 0.06, PORTAL.z]}
        color="#ffd27a"
        color2="#ff8ad8"
        intensity={0.8}
        spin={0.6}
      />
      <SignPost position={[MONTY_SIGN.x, 0, MONTY_SIGN.z]} yaw={-0.5} />

      <RemotePlayers />
      <Player
        avatarFile={AVATAR_BY_ID[avatar]?.file}
        ground={ground}
        blocked={blocked}
        findNearby={bazaarNearby}
      />

      <Label3D
        text={vi ? "Về Quảng trường" : "Back to the Plaza"}
        position={[PORTAL.x, 3.2, PORTAL.z]}
        maxDist={26}
      />
      <Label3D
        text={vi ? "Đèn Năm · 365 đèn lồng" : "Year Lanterns · 365 lamps"}
        position={[WISP_TREE.x, WISP_TREE.top + 1.3, WISP_TREE.z]}
        maxDist={45}
      />
      <Label3D
        text={vi ? "Ruộng Slime" : "Slime Ranch"}
        position={[tileX(9), 2.6, SLIME_TRACK.z]}
        maxDist={40}
      />
      {slimeStage < SLIME_STAGES.length && (
        <Label3D
          variant="small"
          text={
            vi
              ? `Màn ${slimeStage + 1}/3 · slime ${SLIME_STAGES[slimeStage].dice} xúc xắc`
              : `Stage ${slimeStage + 1}/3 · ${SLIME_STAGES[slimeStage].dice}-dice slimes`
          }
          position={[tileX(9), 2.05, SLIME_TRACK.z]}
          maxDist={30}
        />
      )}
      <Label3D
        variant="small"
        text={
          vi
            ? "→ Sân khấu Ba Cửa (Monty Hall)"
            : "→ The Three-Door Stage (Monty Hall)"
        }
        position={[MONTY_SIGN.x, 2.75, MONTY_SIGN.z]}
        maxDist={18}
      />
    </group>
  );
}

function bazaarNearby(p: THREE.Vector3): Nearby | null {
  const vi = useWorld.getState().lang === "vi";
  const d = (q: { x: number; z: number }) => Math.hypot(p.x - q.x, p.z - q.z);
  if (d(PORTAL) < 2.3)
    return {
      kind: "portal",
      id: "hub",
      label: vi ? "Về Quảng trường" : "Back to the Plaza",
    };
  if (d(BAZAAR_SPOTS.monty) < 1.8)
    return {
      kind: "portal",
      id: "impossible",
      label: vi
        ? "Tới Sân khấu Ba Cửa (Sảnh Bất Khả)"
        : "Go to the Three-Door Stage (Impossible Halls)",
    };
  const t = tileAt(p.x, p.z);
  if (t > 0) {
    const on = useBazaar.getState().nets.includes(t);
    return {
      kind: "action",
      id: "bazaar:net",
      label: vi
        ? on
          ? `Nhổ lưới ở ô ${t}`
          : `Cắm lưới ở ô ${t}`
        : on
          ? `Pull the net from tile ${t}`
          : `Plant a net on tile ${t}`,
    };
  }
  if (d(BAZAAR_SPOTS.wisp) < 2.4)
    return {
      kind: "action",
      id: "bazaar:wisp",
      label: vi
        ? "Quầy Đèn Năm (đom đóm sinh nhật)"
        : "Year Lanterns stall (birthday wisps)",
    };
  if (d(BAZAAR_SPOTS.mimic) < 2.4)
    return {
      kind: "action",
      id: "bazaar:mimic",
      label: vi
        ? "Quầy Rương Mimic (Đèn Soi)"
        : "Mimic Chest stall (the Lantern)",
    };
  if (d(BAZAAR_SPOTS.slime) < 2.4)
    return {
      kind: "action",
      id: "bazaar:slime",
      label: vi ? "Ruộng Slime (thả đàn)" : "Slime Ranch (release the herd)",
    };
  if (d(BAZAAR_SPOTS.wheel) < 2.4)
    return {
      kind: "action",
      id: "bazaar:wheel",
      label: vi
        ? "Bánh Xe Chuỗi (Thầy Chuỗi)"
        : "Streak Wheel (the Streak Seer)",
    };
  return null;
}

export const BAZAAR_SPAWN = SPAWN;
