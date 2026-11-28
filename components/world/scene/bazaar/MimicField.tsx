"use client";
/**
 * Bãi Rương Mimic (Bayes): 100 rương (InstancedMesh thân + nắp có bản lề) = TẦN SỐ TỰ NHIÊN dựng ngay trên sân.
 *  Soi: Đèn Soi quét từng hàng, rương báo đỏ hiện đèn đỏ (27 rương: 9 mimic + 18 báo nhầm).
 *  Mở: mọi rương đèn đỏ bật nắp — mimic hoá tím, nảy, hai mắt đỏ; rương thường toả vàng → thấy tận mắt "chỉ 1/3 là mimic".
 *  Quầy: 3 rương thương vụ (tỉ lệ nền ghi trên biển, đèn soi treo trên nắp) — chốt thì mở thật.
 */
import { useGLTF } from "@react-three/drei";
import { BAZAAR_INST_GLB, instGeometry } from "./bazaarProps";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CHEST_FIELD,
  FIELD_HALF,
  MIMIC_KEEPER,
  OFFER_CHESTS,
  chestPos,
} from "@/lib/world/bazaarWorld";
import { useWorld } from "../../store";
import { Label3D } from "../../ui/Labels";
import { Keeper, Stall, glow, toon } from "./bazaarProps";
import { chestFx, useBazaar } from "./bazaarState";

const N = 100;
const BODY = { w: 0.5, h: 0.34, d: 0.36 };
const WOOD = new THREE.Color("#9a6a3e");
const WOOD_DIM = new THREE.Color("#5e4632");
const MIMIC = new THREE.Color("#8d4fd6");
const SWEEP_ROW = 0.22;

function lidMatrix(
  m: THREE.Matrix4,
  x: number,
  y: number,
  z: number,
  open: number,
  tmp: THREE.Matrix4,
) {
  // bản lề ở mép sau trên thân: dời tới bản lề → xoay quanh x → dời nắp ra trước
  m.makeTranslation(x, y + BODY.h, z - BODY.d / 2);
  m.multiply(tmp.makeRotationX(-open * 1.9));
  m.multiply(tmp.makeTranslation(0, 0.05, BODY.d / 2));
  return m;
}

export function MimicField() {
  const vi = useWorld((s) => s.lang === "vi");
  const offers = useBazaar((s) =>
    s.panel === "mimic" && s.step.mimic === "deal" ? s.offers : null,
  );
  const shown = useBazaar((s) => s.fieldShown);
  // rương Blender (thân ván + đai sắt + khoá, nắp vòm) — màu đỉnh × màu từng bản; thiếu → hộp tạm
  const inst = useGLTF(BAZAAR_INST_GLB);
  const geo = useMemo(
    () => ({
      body:
        instGeometry(inst.scene, "bz_chest_body") ??
        new THREE.BoxGeometry(BODY.w, BODY.h, BODY.d).translate(
        0,
        BODY.h / 2,
        0,
      ),
      lid: instGeometry(inst.scene, "bz_chest_lid") ?? new THREE.BoxGeometry(BODY.w + 0.03, 0.1, BODY.d + 0.02),
      lamp: new THREE.SphereGeometry(0.07, 8, 6),
      eye: new THREE.SphereGeometry(0.045, 6, 5),
      gold: new THREE.OctahedronGeometry(0.13, 0),
    }),
    [inst],
  );
  const mats = useMemo(
    () => ({
      body: new THREE.MeshToonMaterial({ color: "#ffffff", vertexColors: !!geo.body.getAttribute("color") }),
      lid: new THREE.MeshToonMaterial({ color: "#c9934f", vertexColors: !!geo.lid.getAttribute("color") }),
      lamp: new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.2, 0.35, 0.3),
        toneMapped: false,
      }),
      eye: new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.5, 0.6, 0.3),
        toneMapped: false,
      }),
      gold: new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.6, 1.9, 0.5),
        toneMapped: false,
      }),
    }),
    [geo],
  );
  const im = useMemo(() => {
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, n: number) => {
      const x = new THREE.InstancedMesh(g, m, n);
      x.frustumCulled = false;
      return x;
    };
    const body = mk(geo.body, mats.body, N);
    for (let i = 0; i < N; i++) body.setColorAt(i, WOOD);
    return {
      body,
      lid: mk(geo.lid, mats.lid, N),
      lamp: mk(geo.lamp, mats.lamp, N),
      eye: mk(geo.eye, mats.eye, N * 2),
      gold: mk(geo.gold, mats.gold, N),
    };
  }, [geo, mats]);
  useEffect(
    () => () => {
      Object.values(im).forEach((m) => m.dispose());
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [im, geo, mats],
  );

  const offerRefs = useRef<(THREE.Group | null)[]>([]);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const T = useMemo(() => new THREE.Matrix4(), []);
  const C = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const now = performance.now() / 1000;
    const f = chestFx.field;
    // mốc −1e9 = chưa soi / chưa mở
    const sweep = chestFx.sweepAt > 0 ? now - chestFx.sweepAt : -1;
    const rev = chestFx.revealAt > 0 ? now - chestFx.revealAt : -1;
    let nl = 0;
    let ne = 0;
    let ng = 0;
    for (let i = 0; i < N; i++) {
      const [x, z] = chestPos(i);
      const row = Math.floor(i / CHEST_FIELD.n);
      const c = f[i];
      const seen = sweep >= 0 && sweep > row * SWEEP_ROW;
      const red = c.red && seen;
      const open =
        rev > 0 && c.red
          ? Math.min(1, Math.max(0, (rev - i * 0.012) / 0.35))
          : 0;
      const mim = open > 0.5 && c.mimic;
      const hop = mim ? Math.abs(Math.sin((rev - i * 0.012) * 7)) * 0.18 : 0;
      im.body.setMatrixAt(i, M.makeTranslation(x, hop, z));
      im.body.setColorAt(
        i,
        mim ? MIMIC : rev > 0 && !c.red ? C.copy(WOOD_DIM) : WOOD,
      );
      im.lid.setMatrixAt(i, lidMatrix(M, x, hop, z, open, T));
      if (red && rev < 0)
        im.lamp.setMatrixAt(
          nl++,
          M.makeTranslation(x, 0.72 + Math.sin(now * 5 + i) * 0.04, z),
        );
      if (mim) {
        im.eye.setMatrixAt(
          ne++,
          M.makeTranslation(
            x - 0.1,
            hop + BODY.h + 0.02,
            z + BODY.d / 2 - 0.02,
          ),
        );
        im.eye.setMatrixAt(
          ne++,
          M.makeTranslation(
            x + 0.1,
            hop + BODY.h + 0.02,
            z + BODY.d / 2 - 0.02,
          ),
        );
      }
      if (open > 0.5 && !c.mimic)
        im.gold.setMatrixAt(
          ng++,
          M.makeTranslation(
            x,
            BODY.h + 0.15 + open * 0.15 + Math.sin(now * 3 + i) * 0.03,
            z,
          ),
        );
    }
    im.lamp.count = nl;
    im.eye.count = ne;
    im.gold.count = ng;
    for (const k of ["body", "lid", "lamp", "eye", "gold"] as const)
      im[k].instanceMatrix.needsUpdate = true;
    im.body.instanceColor!.needsUpdate = true;
    // rương thương vụ trên quầy
    offerRefs.current.forEach((g, i) => {
      if (!g) return;
      const t =
        chestFx.offerOpen[i] > 0 ? now - chestFx.offerOpen[i] / 1000 : -1;
      const lid = g.children[1] as THREE.Object3D;
      const body = g.children[0] as THREE.Mesh;
      const o = t > 0 ? Math.min(1, t / 0.35) : 0;
      lid.rotation.x = -o * 1.9;
      const mim = o > 0.5 && chestFx.offerMimic[i];
      g.position.y = 1.05 + (mim ? Math.abs(Math.sin(t * 8)) * 0.25 : 0);
      (body.material as THREE.MeshToonMaterial).color.set(
        mim ? "#8d4fd6" : "#9a6a3e",
      );
      const goldM = g.children[2] as THREE.Object3D;
      goldM.visible = o > 0.5 && !chestFx.offerMimic[i];
    });
  });

  const offerMats = useMemo(
    () => [0, 1, 2].map(() => new THREE.MeshToonMaterial({ color: "#9a6a3e" })),
    [],
  );
  useEffect(() => () => offerMats.forEach((m) => m.dispose()), [offerMats]);
  const F = CHEST_FIELD;
  return (
    <group>
      <primitive object={im.body} />
      <primitive object={im.lid} />
      <primitive object={im.lamp} />
      <primitive object={im.eye} />
      <primitive object={im.gold} />
      {/* hàng rào thấp quanh bãi */}
      {[
        [0, -FIELD_HALF, FIELD_HALF * 2, 0.08],
        [0, FIELD_HALF, FIELD_HALF * 2, 0.08],
        [-FIELD_HALF, 0, 0.08, FIELD_HALF * 2],
        [FIELD_HALF, 0, 0.08, FIELD_HALF * 2],
      ].map(([dx, dz, w, d], i) => (
        <mesh
          key={i}
          material={toon("#7a5236")}
          position={[F.x + dx, 0.45, F.z + dz]}
        >
          <boxGeometry args={[w, 0.08, d]} />
        </mesh>
      ))}
      <Stall
        position={[MIMIC_KEEPER.x, 0, MIMIC_KEEPER.z + 0.5]}
        node="bz_stall_mimic"
        cloth="#1f8a7a"
        cloth2="#f6e7c8"
        width={4.2}
        roof={false}
      />
      <Keeper
        position={[MIMIC_KEEPER.x - 1.6, 0, MIMIC_KEEPER.z - 0.85]}
        body="#26786c"
        hat="#e9d9a8"
        hatKind="brim"
        vrm="avatars/elf.vrm"
      />
      {/* Đèn Soi trong tay người bán */}
      <mesh
        material={glow("#ff5a4a", 2.0)}
        position={[MIMIC_KEEPER.x - 1.25, 1.2, MIMIC_KEEPER.z - 0.6]}
      >
        <sphereGeometry args={[0.12, 10, 8]} />
      </mesh>
      {OFFER_CHESTS.map(([x, z], i) => (
        <group
          key={i}
          ref={(g) => void (offerRefs.current[i] = g)}
          position={[x, 1.05, z]}
        >
          <mesh material={offerMats[i]} position={[0, BODY.h / 2, 0]}>
            <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
          </mesh>
          <group position={[0, BODY.h, -BODY.d / 2]}>
            <mesh material={mats.lid} position={[0, 0.05, BODY.d / 2]}>
              <boxGeometry args={[BODY.w + 0.03, 0.1, BODY.d + 0.02]} />
            </mesh>
          </group>
          <mesh
            material={mats.gold}
            position={[0, BODY.h + 0.3, 0]}
            visible={false}
          >
            <octahedronGeometry args={[0.13, 0]} />
          </mesh>
          {offers?.[i]?.readings?.map((r, k, arr) => (
            <mesh
              key={k}
              material={r ? mats.lamp : glow("#5dff9a", 1.8)}
              position={[(k - (arr.length - 1) / 2) * 0.2, BODY.h + 0.75, 0]}
            >
              <sphereGeometry args={[0.07, 8, 6]} />
            </mesh>
          ))}
        </group>
      ))}
      {offers?.map((o, i) => (
        <Label3D
          key={o.id + i}
          variant="small"
          text={`${i + 1} · ${vi ? "xe" : "cart"} ${Math.round((o.base ?? 0) * 100)}% mimic`}
          position={[OFFER_CHESTS[i][0], 2.25, OFFER_CHESTS[i][1]]}
          maxDist={14}
        />
      ))}
      <Label3D
        text={vi ? "Bãi 100 rương · 10 mimic" : "100 chests · 10 mimics"}
        position={[F.x, 2.2, F.z + FIELD_HALF]}
        maxDist={30}
      />
      {shown === "reveal" && (
        <Label3D
          variant="warn"
          text={vi ? "9 mimic / 27 đèn đỏ" : "9 mimics / 27 red lamps"}
          position={[F.x, 2.9, F.z]}
          maxDist={40}
        />
      )}
    </group>
  );
}
