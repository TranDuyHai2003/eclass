"use client";
/**
 * TOTEM ĐỐI XỨNG (Expanse, VOXEL_WORLD W3): mọi khối đặt / phá trong bán kính 12 quanh totem được nhân theo QUỸ ĐẠO
 * của nhóm đang chọn (C₂ → C₄ → D₄ → Oₕ, F để đổi) — lib/world/symmetry.ts.
 * Học: số bản sao = |G| / |ổn định hoá| (khối trên trục / mặt gương ít bản sao hơn); quay khác soi gương (D₄ vs C₄).
 * Bản sao chỉ ở máy người đặt (thông điệp "transform" một gói qua mạng: việc sau — server đang được sửa ở nhánh khác).
 */
import { useEffect, useMemo, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { toonize } from "../fx/glbToon";
import { worldAsset } from "@/lib/world/avatars";
import * as THREE from "three";
import { MagicCircle } from "../fx/Effects";
import { Label3D } from "../ui/Labels";
import { floatText } from "../ui/Labels";
import { registerAction } from "../actions";
import { useWorld } from "../store";
import { blockTop } from "@/lib/world/terrain";
import { onLocalEdit, setBlock } from "@/lib/world/voxels";
import { GROUP_INFO, orbit, type GroupId } from "@/lib/world/symmetry";

export const TOTEM = { x: 16, z: 4, r: 12 };
const GLB = worldAsset("props/totem.glb");
const CYCLE: (GroupId | null)[] = [null, "C2", "C4", "D4", "Oh"];
const state = { g: null as GroupId | null, applying: false };

export function totemNearby(p: THREE.Vector3, lang: string) {
  if (Math.hypot(TOTEM.x + 0.5 - p.x, TOTEM.z + 0.5 - p.z) > 2.6) return null;
  return { kind: "action" as const, id: "symmetry-totem", label: lang === "vi" ? "Đổi nhóm đối xứng của Totem" : "Change the Totem's symmetry group" };
}

export function SymmetryTotem() {
  const lang = useWorld((s) => s.lang);
  const [g, setG] = useState<GroupId | null>(state.g);
  const base = blockTop(TOTEM.x, TOTEM.z);
  const gltf = useGLTF(GLB);
  const model = useMemo(() => {
    const root = toonize(gltf.scene);
    const glows: { m: THREE.MeshBasicMaterial; c: THREE.Color }[] = [];
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m?.isMeshBasicMaterial) glows.push({ m, c: m.color.clone() });
    });
    return { root, glows };
  }, [gltf]);
  // pha lê sáng rực khi totem bật, mờ khi tắt
  useEffect(() => model.glows.forEach((x) => x.m.color.copy(x.c).multiplyScalar(g ? 1.4 : 0.35)), [model, g]);
  useEffect(() => {
    const offAct = registerAction("symmetry-totem", () => {
      const next = CYCLE[(CYCLE.indexOf(state.g) + 1) % CYCLE.length];
      state.g = next;
      setG(next);
      const p = useWorld.getState().player;
      floatText(p.clone().setY(p.y + 2.2), next ? `${GROUP_INFO[next][lang === "vi" ? "vi" : "en"]} · |G| = ${({ C2: 2, C4: 4, D4: 8, Oh: 48 } as const)[next]}` : lang === "vi" ? "Totem tắt" : "Totem off", "info");
    });
    const offEdit = onLocalEdit((x, y, z, id) => {
      if (!state.g || state.applying) return;
      const v: [number, number, number] = [x - TOTEM.x, y - base, z - TOTEM.z];
      if (Math.hypot(v[0], v[2]) > TOTEM.r || Math.abs(v[1]) > TOTEM.r) return;
      state.applying = true;
      try {
        for (const w of orbit(v, state.g)) {
          if (w[0] === v[0] && w[1] === v[1] && w[2] === v[2]) continue;
          setBlock(TOTEM.x + w[0], base + w[1], TOTEM.z + w[2], id, true);
        }
      } finally {
        state.applying = false;
      }
    });
    return () => {
      offAct();
      offEdit();
    };
  }, [base, lang]);
  const info = g ? GROUP_INFO[g][lang === "vi" ? "vi" : "en"] : lang === "vi" ? "Totem Đối xứng · F để bật" : "Symmetry Totem · press F";
  return (
    <group>
      <MagicCircle radius={TOTEM.r} position={[TOTEM.x + 0.5, base + 0.05, TOTEM.z + 0.5]} color={g ? "#9fe6ff" : "#8a8fb0"} color2="#ffd27a" intensity={g ? 0.5 : 0.18} spin={0.08} />
      {/* model Blender (blender-src/hub_props.blend, totem_build.py): chính nó mang đối xứng D₄ — đế vuông, 4 vây, cuộn soi gương */}
      <primitive object={model.root} position={[TOTEM.x + 0.5, base, TOTEM.z + 0.5]} rotation-y={Math.PI / 4} />
      <Label3D text={info} position={[TOTEM.x + 0.5, base + 4.8, TOTEM.z + 0.5]} variant="math" maxDist={50} />
    </group>
  );
}
