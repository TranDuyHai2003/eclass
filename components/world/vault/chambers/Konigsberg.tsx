"use client";
/**
 * Phòng I — Cầu Königsberg: thành phố đảo nổi trên biển sương "chưa được chứng minh", Đài quan sát cao 9 m ở giữa.
 * Đảo / ván cầu = model Blender (vault_props.glb: vp_island, vp_plank) vẽ bằng InstancedMesh (màu ván đổi sang màu ghế khi cầu đã đi),
 * lan can = 1 lưới gộp, sợi chỉ Ariadne = ống phát sáng màu ghế trên mỗi cầu đã đi. Không vẽ chi tiết bằng code.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MagicCircle } from "../../fx/Effects";
import { toonMaterial } from "../../fx/shaders";
import { Label3D } from "../../ui/Labels";
import { useWorld } from "../../store";
import { SEAT_COLORS } from "@/lib/world/vault/run";
import { LOOK_R, LOOK_Y, bridgeGeos, deckY, graphById, kStuck, oddVertices, type Graph, type KState } from "@/lib/world/vault/konigsberg";
import { useVault } from "../vaultClient";
import { FogSea } from "../vaultFx";
import { useVaultInstanced, useVaultPropClone } from "../vaultProps";

const WOOD = new THREE.Color("#c9965f");

const PLANK_TINT = { mesh: "plank_wood", color: WOOD };

/** Ván cầu dọc đường cong: mỗi ~0,5 m một tấm, xoay theo hướng cầu, cao theo vòm */
function plankMatrices(g: Graph): { mats: THREE.Matrix4[]; owner: number[] } {
  const out: THREE.Matrix4[] = [];
  const owner: number[] = [];
  const o = new THREE.Object3D();
  bridgeGeos(g).forEach((geo, e) => {
    const n = geo.pts.length / 2 - 1;
    const count = Math.max(4, Math.round(((geo.t1 - geo.t0) * geo.len) / 0.5));
    for (let k = 0; k <= count; k++) {
      const t = geo.t0 + ((geo.t1 - geo.t0) * k) / count;
      const f = t * n;
      const i = Math.min(n - 1, Math.floor(f));
      const u = f - i;
      const x = geo.pts[i * 2] + (geo.pts[i * 2 + 2] - geo.pts[i * 2]) * u;
      const z = geo.pts[i * 2 + 1] + (geo.pts[i * 2 + 3] - geo.pts[i * 2 + 1]) * u;
      const dx = geo.pts[i * 2 + 2] - geo.pts[i * 2];
      const dz = geo.pts[i * 2 + 3] - geo.pts[i * 2 + 1];
      o.position.set(x, deckY(geo, t) - 0.06, z);
      o.rotation.set(0, Math.atan2(dx, dz), 0);
      o.updateMatrix();
      out.push(o.matrix.clone());
      owner.push(e);
    }
  });
  return { mats: out, owner };
}

function railGeometry(g: Graph): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  bridgeGeos(g).forEach((geo) => {
    const n = geo.pts.length / 2 - 1;
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = geo.t0 + ((geo.t1 - geo.t0) * k) / 12;
        const f = t * n;
        const i = Math.min(n - 1, Math.floor(f));
        const u = f - i;
        const x = geo.pts[i * 2] + (geo.pts[i * 2 + 2] - geo.pts[i * 2]) * u;
        const z = geo.pts[i * 2 + 1] + (geo.pts[i * 2 + 3] - geo.pts[i * 2 + 1]) * u;
        const dx = geo.pts[i * 2 + 2] - geo.pts[i * 2];
        const dz = geo.pts[i * 2 + 3] - geo.pts[i * 2 + 1];
        const L = Math.hypot(dx, dz) || 1;
        pts.push(new THREE.Vector3(x + (-dz / L) * 0.8 * side, deckY(geo, t) + 0.55, z + (dx / L) * 0.8 * side));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 5, false));
    }
  });
  return parts.length ? mergeGeometries(parts) : null;
}

function threadGeometry(g: Graph, e: number): THREE.BufferGeometry {
  const geo = bridgeGeos(g)[e];
  const n = geo.pts.length / 2 - 1;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push(new THREE.Vector3(geo.pts[k * 2], Math.max(0, deckY(geo, t)) + 0.1, geo.pts[k * 2 + 1]));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.07, 6, false);
}

export function KonigsbergRoom() {
  const gid = useVault((s) => (s.run?.st as KState | null)?.g ?? "k0n2");
  const g = useMemo(() => graphById(gid), [gid]);
  const lit = useVault((s) => ((s.run?.st as KState | null)?.lit ?? []).join(","));
  const seat = useVault((s) => s.seat);
  const myStart = useVault((s) => (s.run?.st as KState | null)?.tr?.[s.seat]?.s ?? -1);
  const myAt = useVault((s) => (s.run?.st as KState | null)?.tr?.[s.seat]?.a ?? -1);
  const stuck = useVault((s) => (s.run?.st ? kStuck(s.run.st as KState, s.seat) : false));
  const hint = useVault((s) => s.run?.hint.lv ?? 0);
  const vi = useWorld((s) => s.lang === "vi");
  const quality = useWorld((s) => s.quality);

  const mats = useMemo(
    () => ({
      rail: toonMaterial("#8a6a48"),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  const islandMats = useMemo(() => {
    const o = new THREE.Object3D();
    return g.islands.map((I) => {
      o.position.set(I.x, 0, I.z);
      o.scale.set(I.r, 1 + I.r * 0.12, I.r);
      o.updateMatrix();
      return o.matrix.clone();
    });
  }, [g]);
  const islands = useVaultInstanced("vp_island", islandMats);
  const plankData = useMemo(() => plankMatrices(g), [g]);
  const planksAll = useVaultInstanced("vp_plank", plankData.mats, PLANK_TINT);
  const planks = planksAll.find((m) => m.name === "plank_wood");
  const rails = useMemo(() => railGeometry(g), [g]);
  // Đài quan sát (Blender vp_overlook: mâm bán kính LOOK_R ở y = LOOK_Y, dải xoắn phát sáng quanh thân)
  const overlook = useVaultPropClone("vp_overlook");
  useEffect(() => () => rails?.dispose(), [rails]);
  // màu ván theo người đã đi
  const litArr = useMemo(() => (lit ? lit.split(",").map(Number) : []), [lit]);
  useEffect(() => {
    if (!planks) return;
    const c = new THREE.Color();
    plankData.owner.forEach((e, i) => {
      const s = litArr[e] ?? -1;
      planks.setColorAt(i, s >= 0 ? c.set(SEAT_COLORS[s]).lerp(WOOD, 0.35) : WOOD);
    });
    if (planks.instanceColor) planks.instanceColor.needsUpdate = true;
  }, [planks, plankData, litArr]);

  const threads = useMemo(() => litArr.map((s, e) => (s >= 0 ? { e, s, geo: threadGeometry(g, e) } : null)).filter((x): x is { e: number; s: number; geo: THREE.BufferGeometry } => !!x), [g, litArr]);
  useEffect(() => () => threads.forEach((t) => t.geo.dispose()), [threads]);
  const threadMats = useMemo(() => SEAT_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), toneMapped: false })), []);
  useEffect(() => () => threadMats.forEach((m) => m.dispose()), [threadMats]);
  const odd = useMemo(() => new Set(oddVertices(g)), [g]);

  return (
    <group>
      <FogSea y={-2.4} a="#0c2a44" b="#2f7f9a" sky="#14304f" />
      {islands.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      {planksAll.map((m) => (
        <primitive key={m.uuid} object={m} />
      ))}
      {rails && <mesh geometry={rails} material={mats.rail} />}
      {threads.map((t) => (
        <mesh key={`${gid}:${t.e}`} geometry={t.geo} material={threadMats[t.s]} />
      ))}
      {/* Đài quan sát: lượn xuống từ đây */}
      <group position={[g.look.x, 0, g.look.z]}>
        {overlook && <primitive object={overlook} />}
        <MagicCircle radius={LOOK_R - 0.2} position={[0, LOOK_Y + 0.03, 0]} color="#7fe0ff" color2="#ffd27a" intensity={0.25} spin={0.3} />
        <Label3D text={vi ? "Đài quan sát · nhảy + bấm nhảy lần nữa để lượn" : "Overlook · jump, then jump again to glide"} position={[0, LOOK_Y + 2.6, 0]} variant="small" maxDist={18} />
      </group>
      {/* gợi ý bậc 3: đảo lẻ sáng lên */}
      {hint >= 3 &&
        g.islands.map((I, i) =>
          odd.has(i) ? <MagicCircle key={`o${i}`} radius={I.r * 0.92} position={[I.x, 0.04, I.z]} color="#ffd27a" color2="#ff9ad5" intensity={1.3} spin={1.2} /> : null,
        )}
      {myStart >= 0 && <MagicCircle radius={Math.min(1.4, g.islands[myStart].r * 0.5)} position={[g.islands[myStart].x, 0.05, g.islands[myStart].z]} color={SEAT_COLORS[seat]} color2="#ffffff" intensity={1} spin={0.8} />}
      {stuck && myAt >= 0 && (
        <mesh position={[g.islands[myAt].x, 1.1, g.islands[myAt].z]} material={threadMats[seat]}>
          <torusKnotGeometry args={[0.35, 0.07, 64, 8, 2, 3]} />
        </mesh>
      )}
      <hemisphereLight args={["#9ab8ff", "#1b2a44", 0.9]} />
      <directionalLight position={[-20, 30, 12]} intensity={1.5} color="#cfe0ff" />
      {quality !== "low" && <pointLight position={[g.look.x, LOOK_Y + 3, g.look.z]} intensity={22} distance={30} color="#9fdcff" decay={1.2} />}
    </group>
  );
}
