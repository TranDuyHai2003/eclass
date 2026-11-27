"use client";
/**
 * Everything combat draws in 3D: math monsters (procedural, cel-shaded), their AI, the weapon familiar that floats
 * beside the player, slash arcs, ring waves, dash streaks and ballistic arrows.
 * All pools are fixed-size and updated in useFrame (no React state per frame).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { emitSpark } from "../fx/Sparks";
import { useGLTF } from "@react-three/drei";
import { useWorld } from "../store";
import { worldAsset } from "@/lib/world/avatars";
import { sfx } from "@/lib/world/sfx";
import { MAT_DEFS, RARITY_COLOR, WEAPON_DEFS, addMat, drops, grantWeapon, pushPickup, useBag, usePickups, type DropItem, type WeaponId } from "./items";
import { GRADIENT } from "../fx/shaders";
import { cloneWithOwnMaterials, toonize } from "../fx/glbToon";
import { useFxKit } from "../fx/FxKit";
import { createFxMat, ease, fxMask, rampRow } from "../fx/fxmat";
import { questEvent, unlockNote } from "../story/quest";
import { updateVortices, vortices } from "./spells";
import { addFx, hitRadius, wispPhase, guard, ENEMY, ENV, GRAVITY, orbiters, damageEnemy, enemies, enemyScale, fxs, motion, playerHurt, projectiles, respawn, spawnEnemy, useCombat, clearEnemies, type Enemy, type EnemyKind } from "./combat";

// ───────────── Hình học quái (dựng một lần) ─────────────

const GEO = typeof document !== "undefined"
  ? {
      bar: new THREE.PlaneGeometry(0.9, 0.08),
      ring: new THREE.RingGeometry(0.86, 1, 48),
      unit: new THREE.PlaneGeometry(1, 1),
    }
  : (null as never);

// ───────────── Quái + AI ─────────────

type Spawner = { kind: "fixed"; points: { kind: EnemyKind; at: [number, number, number] }[] } | { kind: "ring"; count: number; min: number; max: number; kinds: EnemyKind[]; extra?: { kind: EnemyKind; at: [number, number, number] }[] };

export function Enemies({ ground, spawner, clampR, aggro = 10 }: { ground: (x: number, z: number) => number; spawner: Spawner; clampR?: number; aggro?: number }) {
  const [list, setList] = useState<Enemy[]>([]);
  useEffect(() => {
    ENV.ground = ground;
    ENV.armed = true;
    clearEnemies();
    const p = useWorld.getState().player;
    if (spawner.kind === "fixed") for (const s of spawner.points) spawnEnemy(s.kind, new THREE.Vector3(s.at[0], ground(s.at[0], s.at[2]), s.at[2]));
    else {
      for (let i = 0; i < spawner.count; i++) spawnEnemy(spawner.kinds[i % spawner.kinds.length], ringPoint(p, spawner.min, spawner.max, ground));
      for (const s of spawner.extra ?? []) spawnEnemy(s.kind, new THREE.Vector3(s.at[0], ground(s.at[0], s.at[2]), s.at[2]));
    }
    setList([...enemies]);
    return () => {
      ENV.armed = false;
      ENV.ground = () => 0;
      clearEnemies();
      projectiles.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, rawDt) => {
    // Khúc xạ thời gian (sau né hoàn hảo): quái chậm lại — dời mọi mốc giờ của quái theo phần thời gian bị "nén"
    const sc = enemyScale();
    const dt = Math.min(0.05, rawDt) * sc;
    if (sc < 1) {
      const shift = Math.min(0.05, rawDt) * 1000 * (1 - sc);
      for (const e of enemies) {
        if (e.windup) e.windup += shift;
        e.atkAt += shift;
        e.hitAt += shift;
        if (e.hopAt) e.hopAt += shift;
      }
    }
    const now = performance.now();
    const w = useWorld.getState();
    const p = w.player;
    const c = useCombat.getState();
    // Hồi sinh người chơi sau khi gục
    if (c.hp <= 0 && now > c.downUntil) {
      useCombat.setState({ hp: c.maxHp, downUntil: 0 });
      guard.until = now + 2500;
      w.burst([p.x, p.y + 1, p.z], "#9fe6ff", 50);
    }
    for (const e of enemies) {
      const k = ENEMY[e.kind];
      if (e.kind === "siren" || e.kind === "node") continue; // boss do đấu trường điều khiển
      // Bị hất lên không: rơi theo trọng lực, chạm đất nảy nhẹ + bụi; trên không thì không vung đòn được
      if (e.air > 0 || e.airV > 0) {
        e.airV -= 24 * dt;
        e.air += e.airV * dt;
        e.windup = 0;
        if (e.air <= 0) {
          if (e.airV < -6) {
            addFx("ring", new THREE.Vector3(e.pos.x, e.pos.y + 0.05, e.pos.z), { color: "#fff6dc", size: 1.1 });
            e.airV = -e.airV * 0.25;
            e.air = 0.001;
          } else {
            e.air = 0;
            e.airV = 0;
          }
        }
      }
      if (e.deadAt) {
        if (now - e.deadAt > 9000) respawn(e, spawner.kind === "fixed" || e.kind === "twinA" || e.kind === "twinB" ? e.home : ringPoint(p, spawner.min, spawner.max, ground));
        continue;
      }
      // Quái ở quá xa (thế giới vô hạn) → dời lại gần người chơi
      const anchored = e.kind === "twinA" || e.kind === "twinB";
      if (spawner.kind === "ring" && !anchored && e.pos.distanceTo(p) > 48) respawn(e, ringPoint(p, spawner.min, spawner.max, ground));
      const dx = p.x - e.pos.x;
      const dz = p.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      const stunned = now - e.hitAt < 280;
      // Bị đánh thì truy đuổi xa hơn (trả đũa); không thì chỉ để ý khi lại gần
      const provoked = now - e.hitAt < 6000;
      const chasing = (d < aggro || (provoked && d < 18)) && c.hp > 0;
      let mvx = 0;
      let mvz = 0;
      if (e.windup) {
        // Đang vung đòn: đứng yên; hết 0,45 s mới gây sát thương nếu còn trong tầm
        if (now - e.windup > 450) {
          const crossHit = e.kind !== "mite" || Math.abs(dx) < 0.7 || Math.abs(dz) < 0.7;
          if (d < 1.9 && crossHit && Math.abs(p.y - e.pos.y) < 1.6) playerHurt(k.dmg, e.pos);
          e.windup = 0;
          e.atkAt = now;
        }
      } else if (!stunned && e.kind === "knight") {
        // Quỷ mã: cứ 0,9 s nhảy một nước mã (±1,±2)·1,2 m về phía người chơi; tiếp đất thì đánh 8 ô mã
        if (!e.hopAt && chasing && now - e.atkAt > 900) {
          let best: [number, number] = [1, 2];
          let bd = 1e9;
          for (const [a, b] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
            const tx = e.pos.x + a * 1.2;
            const tz = e.pos.z + b * 1.2;
            const dd = Math.hypot(p.x - tx, p.z - tz);
            if (dd < bd && dd > 0.8) {
              bd = dd;
              best = [a, b];
            }
          }
          e.from.copy(e.pos);
          e.to.set(e.pos.x + best[0] * 1.2, e.pos.y, e.pos.z + best[1] * 1.2);
          e.hopAt = now;
          e.yaw = Math.atan2(best[0], best[1]);
        }
      } else if (!stunned && (e.kind === "twinA" || e.kind === "twinB")) {
        // Song sinh: vân giao thoa trên mặt đất (vân sáng gây sát thương mỗi 1,6 s)
        if (e.kind === "twinA" && now - e.atkAt > 1600 && d < 14) {
          e.atkAt = now;
          const tb = enemies.find((o) => o.kind === "twinB" && !o.deadAt);
          if (tb) {
            const dr = Math.hypot(p.x - e.pos.x, p.z - e.pos.z) - Math.hypot(p.x - tb.pos.x, p.z - tb.pos.z);
            const I = Math.cos((Math.PI * dr) / 2.4) ** 2;
            if (I > 0.7) playerHurt(k.dmg, e.pos);
          }
        }
      } else if (!stunned && chasing && e.kind === "mite") {
        // Bọ taxicab: chỉ nhảy từng ô 1 m theo trục x HOẶC z (khoảng cách L1), đổi trục → đi zigzag.
        // Đòn chỉ đánh dọc hàng / cột của nó → đứng chéo là an toàn.
        const aligned = Math.abs(dx) < 0.7 || Math.abs(dz) < 0.7;
        if (aligned && d < 1.9 && now - e.atkAt > 1300 && !e.hopAt) e.windup = now;
        else if (!e.hopAt && now - e.atkAt > 380) {
          const useX = Math.abs(dx) > 0.5 && (e.axis === 0 || Math.abs(dz) < 0.5);
          e.axis = useX ? 1 : 0; // lần sau ưu tiên trục kia → zigzag
          e.from.copy(e.pos);
          e.to.copy(e.pos);
          if (useX) e.to.x += Math.sign(dx);
          else e.to.z += Math.sign(dz);
          e.hopAt = now;
          e.yaw = Math.atan2(e.to.x - e.from.x, e.to.z - e.from.z);
        }
      } else if (!stunned && chasing) {
        if (d > 1.15) {
          mvx = (dx / d) * k.speed;
          mvz = (dz / d) * k.speed;
        } else if (now - e.atkAt > 1300) e.windup = now;
        e.yaw = Math.atan2(dx, dz);
      } else if (!stunned) {
        // Lang thang quanh nhà
        const t = now / 1000 + e.seed;
        const hx = e.home.x + Math.cos(t * 0.3) * 2.5 - e.pos.x;
        const hz = e.home.z + Math.sin(t * 0.37) * 2.5 - e.pos.z;
        const hd = Math.hypot(hx, hz);
        if (hd > 0.3) {
          mvx = (hx / hd) * k.speed * 0.35;
          mvz = (hz / hd) * k.speed * 0.35;
          e.yaw = Math.atan2(hx, hz);
        }
      }
      // Nhảy ô của bọ taxicab: nội suy x/z, đường nảy parabol do EnemyView vẽ
      if (e.hopAt) {
        const h = Math.min(1, (now - e.hopAt) / (e.kind === "knight" ? 380 : 260));
        e.pos.x = e.from.x + (e.to.x - e.from.x) * h;
        e.pos.z = e.from.z + (e.to.z - e.from.z) * h;
        if (h >= 1) {
          e.hopAt = 0;
          e.atkAt = Math.max(e.atkAt, now - 1300 + 380);
          if (e.kind === "knight") {
            e.atkAt = now;
            const cx = Math.round((p.x - e.pos.x) / 1.2);
            const cz = Math.round((p.z - e.pos.z) / 1.2);
            const knightSq = (Math.abs(cx) === 1 && Math.abs(cz) === 2) || (Math.abs(cx) === 2 && Math.abs(cz) === 1);
            if (knightSq) playerHurt(k.dmg, e.pos);
            else if (Math.abs(cx) + Math.abs(cz) === 1) unlockNote("knight");
            addFx("ring", e.pos.clone().setY(e.pos.y + 0.05), { color: "#ff3d6e", size: 2.7 });
          }
        }
      }
      e.pos.x += (mvx + e.vel.x) * dt;
      e.pos.z += (mvz + e.vel.z) * dt;
      e.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      if (clampR) {
        const r = Math.hypot(e.pos.x, e.pos.z);
        if (r > clampR) e.pos.multiplyScalar(clampR / r);
      }
      const gy = ground(e.pos.x, e.pos.z);
      e.pos.y += (gy - e.pos.y) * Math.min(1, dt * 10);
    }
    // Quái không chồng lên nhau
    for (let i = 0; i < enemies.length; i++)
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i];
        const b = enemies[j];
        if (a.deadAt || b.deadAt) continue;
        const ox = b.pos.x - a.pos.x;
        const oz = b.pos.z - a.pos.z;
        const od = Math.hypot(ox, oz);
        if (od > 0 && od < 1.1) {
          const push = (1.1 - od) / 2 / od;
          a.pos.x -= ox * push;
          a.pos.z -= oz * push;
          b.pos.x += ox * push;
          b.pos.z += oz * push;
        }
      }
  });

  return (
    <>
      {list.map((e) => (
        <EnemyView key={e.id} e={e} />
      ))}
    </>
  );
}

function ringPoint(p: THREE.Vector3, min: number, max: number, ground: (x: number, z: number) => number) {
  const a = Math.random() * Math.PI * 2;
  const r = min + Math.random() * (max - min);
  const x = p.x + Math.cos(a) * r;
  const z = p.z + Math.sin(a) * r;
  return new THREE.Vector3(x, ground(x, z), z);
}

const MONSTERS_GLB = worldAsset("monsters/monsters.glb");
const MONSTERS2_GLB = worldAsset("monsters/monsters2.glb");
useGLTF.preload(MONSTERS2_GLB);
const IN_GLB2 = new Set<EnemyKind>(["knight", "zeno", "twinA", "twinB"]);
const monsterBase = new Map<EnemyKind, THREE.Object3D>();
function useMonsterModel(kind: EnemyKind) {
  const gltf1 = useGLTF(MONSTERS_GLB);
  const gltf2 = useGLTF(MONSTERS2_GLB);
  const gltf = IN_GLB2.has(kind) ? gltf2 : gltf1;
  return useMemo(() => {
    let base = monsterBase.get(kind);
    if (!base) {
      const src = gltf.scene.getObjectByName(kind === "knight" ? "m_knight" : kind === "zeno" ? "m_zeno" : `m_${kind}`);
      if (!src) return null;
      base = toonize(src);
      monsterBase.set(kind, base);
    }
    return cloneWithOwnMaterials(base);
  }, [gltf, kind]);
}
useGLTF.preload(MONSTERS_GLB);

function EnemyView({ e }: { e: Enemy }) {
  if (e.kind === "siren" || e.kind === "node") return null;
  return <EnemyBody e={e} />;
}

function EnemyBody({ e }: { e: Enemy }) {
  const root = useRef<THREE.Group>(null);
  const model = useMonsterModel(e.kind);
  useEffect(() => () => [...(model?.toon ?? []), ...(model?.glow ?? [])].forEach((m) => m.dispose()), [model]);
  const body = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Group>(null);
  const fill = useRef<THREE.Mesh>(null);
  const tele = useRef<THREE.Mesh>(null);
  const cross = useRef<THREE.Group>(null);
  const mats = useMemo(() => {
    const fillM = new THREE.MeshBasicMaterial({ color: "#ff5d7a", depthTest: false, transparent: true });
    const bg = new THREE.MeshBasicMaterial({ color: "#1a1430", depthTest: false, transparent: true, opacity: 0.75 });
    const teleM = new THREE.MeshBasicMaterial({ color: "#ff3d6e", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    return { fillM, bg, teleM };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame((state) => {
    const g = root.current;
    const b = body.current;
    if (!g || !b) return;
    const now = performance.now();
    const t = now / 1000 + e.seed;
    if (e.deadAt) {
      // Tan biến kiểu anime: 60 ms loé trắng → ăn mòn từ dưới lên với mép cháy sáng (mất ~0,6 s)
      const ms = now - e.deadAt;
      const k2 = Math.max(0, Math.min(1, (ms - 60) / 560));
      g.visible = k2 < 1;
      if (model) {
        for (const m of model.toon) {
          m.emissive.setScalar(ms < 60 ? 1 : 0);
          (m.userData.dissolve as { value: number }).value = Math.max(0.001, k2);
          (m.userData.edge as { value: THREE.Color }).value.set(ENEMY[e.kind].color);
        }
      }
      b.scale.set(1 + k2 * 0.08, 1 - k2 * 0.1, 1 + k2 * 0.08);
      if (bar.current) bar.current.visible = false;
      return;
    }
    if (model && (model.toon[0]?.userData.dissolve as { value: number } | undefined)?.value) for (const m of model.toon) (m.userData.dissolve as { value: number }).value = 0;
    g.visible = true;
    g.position.copy(e.pos);
    g.position.y += e.air;
    g.rotation.y = e.yaw;
    // trên không: lộn nhào nhẹ theo vận tốc đứng
    if (body.current) body.current.rotation.x = e.air > 0.05 ? Math.max(-0.9, Math.min(0.9, -e.airV * 0.08)) : 0;
    // Nhấp nháy trắng khi trúng đòn
    const flash = Math.max(0, 1 - (now - e.hitAt) / 140);
    if (model) for (const m of model.toon) m.emissive.setRGB(flash, flash, flash);
    // Vung đòn: phình to + vùng đỏ dưới chân (bọ taxicab: hình chữ thập theo hàng/cột)
    const wind = e.windup ? Math.min(1, (now - e.windup) / 450) : 0;
    mats.teleM.opacity = wind * 0.55;
    if (tele.current) tele.current.scale.setScalar(0.4 + wind * 1.4);
    if (cross.current) {
      cross.current.visible = wind > 0;
      cross.current.rotation.y = -e.yaw;
      cross.current.scale.setScalar(0.3 + wind * 0.7);
    }
    // Hồn Möbius: lệch pha thì mờ đi, vầng sáng tắt; cùng pha thì bừng sáng
    if (e.kind === "wisp" && model) {
      const ph = wispPhase(e, now);
      const on = ph > 0;
      for (const m of model.toon) {
        m.transparent = true;
        m.opacity = on ? 1 : 0.32;
      }
      for (const m of model.glow) m.color.copy(m.userData.base as THREE.Color).multiplyScalar(on ? 1 + ph * 0.8 : 0.25);
    }
    // Trúng đòn: nảy co giãn (lò xo tắt dần) cho cảm giác "đập"
    const ht = (now - e.hitAt) / 1000;
    const punch = ht < 0.5 ? Math.exp(-ht * 9) * Math.sin(ht * 38) * 0.22 : 0;
    if (e.kind === "slime") {
      // Nhún như thạch: co giãn quanh đáy (giữ thể tích ~ không đổi)
      const sq = Math.sin(t * 6) * 0.07 + wind * 0.25 + punch;
      b.scale.set(1 + sq, 1 - sq, 1 + sq);
      b.position.y = Math.max(0, Math.sin(t * 6 + 1.2)) * 0.06;
    } else if (e.kind === "zeno") {
      b.position.y = Math.abs(Math.sin(t * 3)) * 0.03;
      b.rotation.z = Math.sin(t * 3) * 0.04;
      b.scale.set(1 + punch, 1 - punch * 0.6, 1 + punch);
    } else if (e.kind === "twinA" || e.kind === "twinB") {
      // Chuông lơ lửng, đung đưa ngược pha nhau
      const ph = e.kind === "twinA" ? 0 : Math.PI;
      b.position.y = 0.6 + Math.sin(t * 2 + ph) * 0.15;
      b.rotation.z = Math.sin(t * 2.4 + ph) * 0.15;
      b.scale.setScalar(1 + punch);
    } else if (e.kind === "wisp") {
      b.position.y = Math.sin(t * 2.2) * 0.18;
      b.rotation.z = Math.sin(t) * 0.18;
      b.rotation.y = Math.sin(t * 0.7) * 0.3;
      b.scale.setScalar(1 + wind * 0.3 + punch);
    } else {
      // Bọ nhảy ô: cung parabol h(1−h) + bẹp khi chạm đất
      const hopMs = e.kind === "knight" ? 380 : 260;
      const h = e.hopAt ? Math.min(1, (now - e.hopAt) / hopMs) : 0;
      b.position.y = 4 * h * (1 - h) * (e.kind === "knight" ? 1.1 : 0.45);
      b.scale.set(1 + punch, 1 - punch * 0.8, 1 + punch);
      b.rotation.y = Math.sin(t * 4) * 0.08;
      if (wind) b.scale.setScalar(1 + wind * 0.25);
    }
    // Thanh máu quay về phía máy quay; chỉ hiện khi đã bị đánh
    if (bar.current && fill.current) {
      bar.current.visible = e.hp < e.maxHp;
      bar.current.quaternion.copy(state.camera.quaternion);
      g.updateMatrixWorld();
      bar.current.quaternion.premultiply(g.getWorldQuaternion(new THREE.Quaternion()).invert());
      const r = Math.max(0, e.hp / e.maxHp);
      fill.current.scale.x = r;
      fill.current.position.x = -0.45 * (1 - r);
    }
  });

  return (
    <group ref={root} scale={0.72}>
      {e.kind === "mite" ? (
        <group ref={cross} position-y={0.05} visible={false}>
          <mesh rotation-x={-Math.PI / 2} material={mats.teleM} scale={[5.2, 1.3, 1]} geometry={GEO.unit} />
          <mesh rotation-x={-Math.PI / 2} material={mats.teleM} scale={[1.3, 5.2, 1]} geometry={GEO.unit} />
        </group>
      ) : (
        <mesh ref={tele} rotation-x={-Math.PI / 2} position-y={0.04} geometry={GEO.ring} material={mats.teleM} />
      )}
      <group ref={body}>{model && <primitive object={model.obj} />}</group>
      <group ref={bar} position={[0, e.kind === "wisp" ? 1.85 : 1.45, 0]}>
        <mesh geometry={GEO.bar} material={mats.bg} renderOrder={20} scale={[1.06, 1.6, 1]} />
        <mesh ref={fill} geometry={GEO.bar} material={mats.fillM} renderOrder={21} />
      </group>
    </group>
  );
}

// ───────────── Mô hình vũ khí (GLB dựng trong Blender) ─────────────

const WEAPONS_GLB = worldAsset("weapons/weapons.glb");
const modelCache = new Map<WeaponId, THREE.Object3D>();
/** Bản sao mô hình vũ khí: vật liệu toon (cel 2 tông) + phần phát sáng HDR (loé bloom), kích thước chuẩn theo size */
export function useWeaponModel(id: WeaponId): THREE.Object3D | null {
  const gltf = useGLTF(WEAPONS_GLB);
  return useMemo(() => {
    let base = modelCache.get(id);
    if (!base) {
      const src = gltf.scene.getObjectByName(`w_${id}`);
      if (!src) return null;
      base = toonize(src);
      const box = new THREE.Box3().setFromObject(base);
      const dim = box.getSize(new THREE.Vector3());
      base.scale.setScalar(WEAPON_DEFS[id].size / Math.max(dim.x, dim.y, dim.z, 1e-3));
      modelCache.set(id, base);
    }
    return base.clone(true);
  }, [gltf, id]);
}
useGLTF.preload(WEAPONS_GLB);

// ───────────── Vũ khí bay cạnh nhân vật ─────────────

export function WeaponFamiliar() {
  const g = useRef<THREE.Group>(null);
  const weapon = useCombat((s) => s.weapon);
  const loadout = useBag((s) => s.loadout);
  const list = loadout.filter(Boolean) as WeaponId[];
  const id = list[weapon % Math.max(1, list.length)] ?? "blade";
  const model = useWeaponModel(id);
  const inHand = id === "blade" || id === "lever" || id === "staff" || id === "bow";
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    const now = performance.now();
    const t = now / 1000;
    const swing = Math.max(0, 1 - (now - useCombat.getState().swingAt) / 380);
    // Lơ lửng sau vai phải, nghiêng chéo; khi đánh thì lao ra trước
    grp.position.set(0.55 - swing * 0.35, 1.05 + Math.sin(t * 2) * 0.05, -0.35 + swing * 0.9);
    grp.rotation.set(-0.35 + swing * 1.5, Math.sin(t * 0.7) * 0.4 * (1 - swing), 0.5 * (1 - swing));
  });
  if (inHand) return null;
  return (
    <group ref={g} scale={0.6}>
      {model && <primitive object={model} />}
    </group>
  );
}

// ───────────── Đồ rơi: viên đá + cột sáng theo độ hiếm, tự hút về người chơi ─────────────

const beamShader = {
  uniforms: { uColor: { value: new THREE.Color() }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
    void main(){
      float fade = 1.0 - smoothstep(0.05, 1.0, vUv.y);
      float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
      float stripes = 0.75 + 0.25 * sin(vUv.y * 30.0 - uTime * 6.0);
      gl_FragColor = vec4(uColor * 1.8, fade * edge * edge * stripes * 0.65);
    }`,
};
const DROP_POOL = 24;

function DropsView() {
  const kitD = useFxKit();
  const gems = useRef<(THREE.Mesh | null)[]>([]);
  const beams = useRef<(THREE.Mesh | null)[]>([]);
  const gemMats = useMemo(() => Array.from({ length: DROP_POOL }, () => new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: GRADIENT, emissive: "#000000" })), []);
  const beamMats = useMemo(() => Array.from({ length: DROP_POOL }, () => new THREE.ShaderMaterial({ ...beamShader, uniforms: THREE.UniformsUtils.clone(beamShader.uniforms), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })), []);
  useEffect(() => () => [...gemMats, ...beamMats].forEach((m) => m.dispose()), [gemMats, beamMats]);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const p = useWorld.getState().player;
    let i = 0;
    for (const d of drops) {
      if (d.taken) continue;
      const age = now - d.born;
      const gy = ENV.ground(d.pos.x, d.pos.z) + 0.35;
      const dx = p.x - d.pos.x;
      const dz = p.z - d.pos.z;
      const dist = Math.hypot(dx, dz, p.y + 0.8 - d.pos.y);
      if (age > 700 && dist < 4.5) {
        // Hút về người chơi (nhanh dần khi lại gần)
        const k = Math.min(1, dt * (5 + 18 / Math.max(0.4, dist)));
        d.pos.x += dx * k;
        d.pos.z += dz * k;
        d.pos.y += (p.y + 0.8 - d.pos.y) * k;
        if (dist < 0.7) {
          d.taken = true;
          collect(d.item);
          continue;
        }
      } else {
        // Văng ra rồi nảy trên mặt đất
        d.vel.y -= 14 * dt;
        d.pos.addScaledVector(d.vel, dt);
        if (d.pos.y < gy) {
          d.pos.y = gy;
          d.vel.y = Math.abs(d.vel.y) * 0.35;
          d.vel.x *= 0.6;
          d.vel.z *= 0.6;
        }
      }
      if (i >= DROP_POOL) continue;
      const gem = gems.current[i];
      const beam = beams.current[i];
      const color = d.item.kind === "weapon" ? RARITY_COLOR[d.rarity] : MAT_DEFS[d.item.id].color;
      if (gem) {
        gem.visible = true;
        gem.position.set(d.pos.x, d.pos.y + Math.sin(now / 300 + d.id) * 0.06, d.pos.z);
        gem.rotation.y = now / 500 + d.id;
        gem.scale.setScalar(d.item.kind === "weapon" ? 0.24 : 0.15);
        gemMats[i].color.set(color);
        gemMats[i].emissive.set(color).multiplyScalar(0.35);
      }
      if (beam) {
        beam.visible = d.rarity >= 4 || d.item.kind === "weapon";
        beam.position.set(d.pos.x, d.pos.y + 1.6, d.pos.z);
        (beamMats[i].uniforms.uColor.value as THREE.Color).set(RARITY_COLOR[d.rarity]);
        beamMats[i].uniforms.uTime.value = now / 1000;
      }
      i++;
    }
    for (let k = i; k < DROP_POOL; k++) {
      if (gems.current[k]) gems.current[k]!.visible = false;
      if (beams.current[k]) beams.current[k]!.visible = false;
    }
  });
  return (
    <group>
      {gemMats.map((m, i) => (
        <mesh key={`g${i}`} ref={(el) => void (gems.current[i] = el)} geometry={kitD.geo.fx_gem} material={m} visible={false}>
        </mesh>
      ))}
      {beamMats.map((m, i) => (
        <mesh key={`b${i}`} ref={(el) => void (beams.current[i] = el)} material={m} visible={false} renderOrder={9}>
          <cylinderGeometry args={[0.22, 0.32, 3.2, 12, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}

function collect(item: DropItem) {
  questEvent({ type: "collect", n: item.kind === "mat" ? item.n : 1 });
  if (item.kind === "mat") addMat(item.id, item.n);
  else if (grantWeapon(item.id)) usePickups.setState({ reveal: item.id });
  pushPickup(item);
  sfx.chime(item.kind === "weapon" ? 3 : 1);
}

// ───────────── Vân giao thoa của Song Sinh (vẽ lên mặt đất) ─────────────

/** I = cos²(π·Δr/λ): vân sáng (đỏ, nguy hiểm) / vân tối (an toàn) — các đường cong là hyperbol (Δr không đổi) */
function InterferenceField() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uLam: { value: 2.4 }, uT: { value: 0 } },
        vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
        fragmentShader: `uniform vec2 uA; uniform vec2 uB; uniform float uLam; uniform float uT; varying vec3 vW;
          void main(){
            float dr = distance(vW.xz, uA) - distance(vW.xz, uB);
            float I = pow(cos(3.14159265 * dr / uLam), 2.0);
            float ra = distance(vW.xz, (uA + uB) * 0.5);
            float fade = 1.0 - smoothstep(9.0, 14.0, ra);
            float bright = step(0.7, I);
            float pulse = 0.55 + 0.45 * sin(uT * 3.9);
            vec3 col = mix(vec3(0.35, 0.9, 1.0), vec3(1.0, 0.25, 0.3), bright);
            float a = (bright * 0.32 * pulse + (1.0 - bright) * 0.07 * step(I, 0.12)) * fade;
            if (a < 0.01) discard;
            gl_FragColor = vec4(col * 1.4, a);
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const a = enemies.find((e) => e.kind === "twinA" && !e.deadAt);
    const b = enemies.find((e) => e.kind === "twinB" && !e.deadAt);
    m.visible = !!a && !!b;
    if (!a || !b) return;
    (mat.uniforms.uA.value as THREE.Vector2).set(a.pos.x, a.pos.z);
    (mat.uniforms.uB.value as THREE.Vector2).set(b.pos.x, b.pos.z);
    mat.uniforms.uT.value = performance.now() / 1000;
    m.position.set((a.pos.x + b.pos.x) / 2, Math.max(a.pos.y, b.pos.y) + 0.08, (a.pos.z + b.pos.z) / 2);
  });
  return (
    <mesh ref={mesh} material={mat} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
      <planeGeometry args={[30, 30, 1, 1]} />
    </mesh>
  );
}

// ───────────── Vật bay vòng (con lắc, đĩa xoắn ốc vàng) ─────────────

const PHI = (1 + Math.sqrt(5)) / 2;
function OrbitersView() {
  const bob = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Group>(null);
  const discModel = useWeaponModel("spiral");
  const kitO = useFxKit();
  const bobMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#c8a6ff").multiplyScalar(2), toneMapped: false }), []);
  useEffect(() => () => bobMat.dispose(), [bobMat]);
  useFrame(() => {
    const now = performance.now();
    const p = useWorld.getState().player;
    let showBob = false;
    let showDisc = false;
    for (let i = orbiters.length - 1; i >= 0; i--) {
      const o = orbiters[i];
      const t = (now - o.born) / 1000;
      if (now - o.born > o.dur) {
        orbiters.splice(i, 1);
        continue;
      }
      if (o.kind === "pendulum") {
        // Con lắc tròn: góc tăng đều theo thời gian (ω = 2π/T), bán kính 2,2 m
        const a = o.yaw + t * Math.PI * 2 * 1.1;
        o.pos.set(p.x + Math.sin(a) * 2.2, p.y + 0.9 + Math.sin(t * 6) * 0.15, p.z + Math.cos(a) * 2.2);
        showBob = true;
        if (bob.current) {
          bob.current.position.copy(o.pos);
          bob.current.rotation.set(t * 3, t * 5, 0);
        }
      } else {
        // Xoắn ốc vàng: r = a·φ^(2θ/π) bay ra rồi thu về (nhân sin để quay lại tay)
        const k = (now - o.born) / o.dur;
        const th = k * Math.PI * 2.5;
        const r = Math.min(7, 0.45 * Math.pow(PHI, (2 * th) / Math.PI)) * Math.sin(Math.PI * k);
        o.pos.set(p.x + Math.sin(o.yaw + th) * r, p.y + 1.0, p.z + Math.cos(o.yaw + th) * r);
        showDisc = true;
        if (disc.current) {
          disc.current.position.copy(o.pos);
          disc.current.rotation.set(Math.PI / 2, 0, now / 60);
        }
      }
      for (const e of enemies) {
        if (e.deadAt) continue;
        if (Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 1.0 && now - (o.hits.get(e.id) ?? -1e9) > 320) {
          o.hits.set(e.id, now);
          damageEnemy(e, o.dmg, o.pos, 3);
        }
      }
    }
    if (bob.current) bob.current.visible = showBob;
    if (disc.current) disc.current.visible = showDisc;
  });
  return (
    <>
      <mesh ref={bob} geometry={kitO.geo.fx_orbital} material={bobMat} visible={false} scale={0.42} />
      <group ref={disc} visible={false} scale={0.95}>
        {discModel && <primitive object={discModel} />}
      </group>
    </>
  );
}

// ───────────── Hiệu ứng đòn đánh ─────────────

const POOL = 8;
const BOLTS = 8;
const HITS = 8;
const CRATERS = 4;
const BX = new THREE.Vector3();
const BY = new THREE.Vector3();
const BZ = new THREE.Vector3();
const BM4 = new THREE.Matrix4();
const UPV = new THREE.Vector3(0, 1, 0);
const ARROWS = 12;
const TRAIL = 6;

export function CombatFx() {
  const kit = useFxKit();
  const fxCam = useThree((st) => st.camera);
  const slashGeo = kit.geo.fx_slash;
  const meteorRef = useRef<THREE.Group>(null);
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const hitMats = useMemo(() => Array.from({ length: HITS }, () => {
    const m = createFxMat(2, fxMask("impact_burst"));
    m.depthTest = false;
    return m;
  }), []);
  const arcMats = useMemo(() => Array.from({ length: BOLTS }, () => createFxMat(2, fxMask("arc_strip"))), []);
  const craterMats = useMemo(() => Array.from({ length: CRATERS }, () => createFxMat(2, fxMask("crater_decal"))), []);
  const arcs = useRef<(THREE.Mesh | null)[]>([]);
  const craters = useRef<(THREE.Mesh | null)[]>([]);
  useEffect(() => () => [...hitMats, ...arcMats, ...craterMats].forEach((m) => m.dispose()), [hitMats, arcMats, craterMats]);
  // FxMat dùng chung: mặt nạ + nhiễu xói mòn + ramp màu + alpha bậc (VFX_PIPELINE.md)
  const slashMats = useMemo(() => Array.from({ length: POOL }, () => createFxMat(0)), []);
  const ringMats = useMemo(() => Array.from({ length: POOL }, () => createFxMat(1)), []);
  const dashMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), []);
  const arrowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(2.5), toneMapped: false }), []);
  const trailMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd27a").multiplyScalar(1.6), transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => [...slashMats, ...ringMats, dashMat, arrowMat, trailMat].forEach((m) => m.dispose()), [slashMats, ringMats, dashMat, arrowMat, trailMat]);

  const slashes = useRef<(THREE.Mesh | null)[]>([]);
  const bolts = useRef<(THREE.Mesh | null)[]>([]);
  const holeCore = useMemo(() => new THREE.MeshBasicMaterial({ color: "#05020c" }), []);
  const holeRing = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd9a8").multiplyScalar(2.8), toneMapped: false }), []);
  const holeDisk = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#a070ff").multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  useEffect(() => () => holeDisk.dispose(), [holeDisk]);
  useEffect(() => () => [holeCore, holeRing].forEach((m) => m.dispose()), [holeCore, holeRing]);
  const boltMats = useMemo(() => Array.from({ length: BOLTS }, () => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), []);
  useEffect(() => () => boltMats.forEach((m) => m.dispose()), [boltMats]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const dash = useRef<THREE.Mesh>(null);
  const arrows = useRef<(THREE.Mesh | null)[]>([]);
  const trails = useRef<THREE.InstancedMesh>(null);
  const M = useMemo(() => new THREE.Matrix4(), []);
  const Q = useMemo(() => new THREE.Quaternion(), []);
  const S = useMemo(() => new THREE.Vector3(), []);

  const hole = useRef<THREE.Group>(null);
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    updateVortices(dt);
    const v = vortices.find((x) => !x.done);
    if (hole.current) {
      hole.current.visible = !!v;
      if (v) {
        const k = Math.min(1, (now - v.born) / 250);
        hole.current.position.set(v.pos.x, v.pos.y + 1.1, v.pos.z);
        hole.current.scale.setScalar(0.3 + k * 0.9 + Math.sin(now / 60) * 0.03);
        hole.current.rotation.set(0.35, now / 260, 0.15);
      }
    }
    let si = 0;
    let ri = 0;
    let bi = 0;
    let hi = 0;
    let ai2 = 0;
    let ci = 0;
    let dashOn = false;
    for (const f of fxs) {
      const age = now - f.born;
      if (f.kind === "slash" && age < (f.size > 1.2 ? 340 : 280) && si < POOL) {
        const dur = f.size > 1.2 ? 340 : 280;
        const m = slashes.current[si];
        const mat = slashMats[si++];
        if (!m) continue;
        m.visible = true;
        m.position.copy(f.pos);
        m.rotation.set(f.flip ? -0.5 : 0.45, f.yaw, f.flip ? 0.35 : -0.3);
        m.scale.set(f.flip ? -f.size : f.size, 1, f.size);
        // Quét 0–70 ms (outExpo) → giữ lõi trắng tới 120 ms → xói mòn (inQuad)
        const u = mat.uniforms;
        u.uProg.value = ease.outExpo(Math.min(1, age / 70));
        u.uAge.value = age < 120 ? 0 : ease.inQuad((age - 120) / (dur - 120));
        u.uRow.value = rampRow(f.color);
        u.uTime.value = now / 1000;
        u.uIntensity.value = age < 110 ? 2.2 : 1.6;
      } else if ((f.kind === "ring" || f.kind === "nova" || f.kind === "vring") && ri < POOL) {
        const dur = f.kind === "nova" ? 900 : f.kind === "vring" ? 420 : 520;
        if (age > dur) continue;
        const m = rings.current[ri];
        const mat = ringMats[ri++];
        if (!m) continue;
        m.visible = true;
        m.position.copy(f.pos);
        m.scale.setScalar(f.size * 2);
        if (f.kind === "vring") m.rotation.set(0, f.yaw, age / 300);
        else m.rotation.set(-Math.PI / 2, 0, 0);
        // Bung nhanh tới 40% bán kính (outExpo) rồi lan đều (outCubic); xói mòn từ 55% đời
        const t = age / dur;
        const u = mat.uniforms;
        u.uProg.value = t < 0.12 ? 0.4 * ease.outExpo(t / 0.12) : 0.4 + 0.58 * ease.outCubic((t - 0.12) / 0.88);
        u.uAge.value = t < 0.55 ? 0 : ease.inQuad((t - 0.55) / 0.45);
        u.uRow.value = rampRow(f.color);
        u.uTime.value = now / 1000;
      } else if ((f.kind === "bolt" || f.kind === "beam") && f.to && bi < BOLTS) {
        const dur = f.kind === "bolt" ? 260 : 340;
        if (age > dur) continue;
        const m = bolts.current[bi];
        const mat = boltMats[bi++];
        if (!m) continue;
        m.visible = true;
        // Sét: rung giật ngẫu nhiên mỗi khung hình; chùm sáng: thẳng, mảnh dần
        m.position.copy(f.pos);
        m.lookAt(f.to);
        const k = 1 - age / dur;
        const len = f.pos.distanceTo(f.to);
        if (f.kind === "bolt") {
          m.visible = false;
          const a = arcs.current[ai2];
          const am = arcMats[ai2++];
          if (a && am) {
            a.visible = true;
            // Trục X dọc tia, pháp tuyến hướng về camera (ribbon kiểu anime)
            BX.subVectors(f.to, f.pos).normalize();
            BZ.subVectors(fxCam.position, S.lerpVectors(f.pos, f.to, 0.5)).normalize();
            BZ.addScaledVector(BX, -BZ.dot(BX)).normalize();
            BY.crossVectors(BZ, BX);
            a.quaternion.setFromRotationMatrix(BM4.makeBasis(BX, BY, BZ));
            a.position.copy(S);
            const frame = Math.floor(age / 50) + f.id;
            a.scale.set(len, (frame % 2 ? -1 : 1) * 0.9, 1);
            const u = am.uniforms;
            (u.uMaskRect.value as THREE.Vector4).set(0, (frame % 4) * 0.25, 1, 0.25);
            u.uAge.value = age < 40 ? 0 : ease.inQuad((age - 40) / (dur - 40));
            u.uRow.value = rampRow(f.color);
            u.uTime.value = now / 1000;
            u.uAdd.value = 0.55;
          }
        } else {
          m.geometry = kit.geo.fx_shard;
          m.scale.set(0.25 * k + 0.05, 0.25 * k + 0.05, len * 0.72);
          m.position.addScaledVector(S.subVectors(f.to, f.pos).normalize(), len * 0.32);
        }
        mat.color.set(f.color).multiplyScalar(2.6);
        mat.opacity = k;
      } else if (f.kind === "hit" && age < 180 && hi < HITS) {
        // Tia trúng đòn: nảy to (outBack) trong 30 ms, giữ lõi trắng, rồi xói mòn
        const m = hits.current[hi];
        const mat = hitMats[hi++];
        if (!m) continue;
        m.visible = true;
        m.position.copy(f.pos);
        m.quaternion.copy(fxCam.quaternion);
        m.rotateZ(f.yaw);
        const s = f.size * 1.3 * (age < 30 ? ease.outBack(age / 30) : 1 + (age - 30) / 600);
        m.scale.set(s, s, s);
        const u = mat.uniforms;
        u.uAge.value = age < 45 ? 0 : ease.inQuad((age - 45) / 135);
        u.uRow.value = f.color === "#ffd27a" ? 9 : 8;
        u.uIntensity.value = age < 45 ? 2.4 : 1.6;
        u.uAdd.value = 0.6;
        u.uTime.value = now / 1000;
      } else if (f.kind === "crater" && age < 1500 && ci < CRATERS) {
        const m = craters.current[ci];
        const mat = craterMats[ci++];
        if (!m) continue;
        m.visible = true;
        m.position.copy(f.pos);
        m.rotation.set(-Math.PI / 2, 0, f.yaw);
        m.scale.setScalar(f.size * 2);
        const u = mat.uniforms;
        u.uAge.value = age < 300 ? 0 : ease.inQuad((age - 300) / 1200);
        u.uRow.value = rampRow(f.color);
        u.uAdd.value = 0;
        u.uIntensity.value = 1.1;
      } else if (f.kind === "dash" && age < 360 && f.to && dash.current) {
        dashOn = true;
        const d = dash.current;
        d.position.lerpVectors(f.pos, f.to, 0.5);
        d.lookAt(f.to);
        d.scale.set(0.5 * (1 - age / 360), 1, f.pos.distanceTo(f.to));
        dashMat.opacity = 0.8 * (1 - age / 360);
        dashMat.color.set(f.color).multiplyScalar(2);
      }
    }
    for (let i = si; i < POOL; i++) if (slashes.current[i]) slashes.current[i]!.visible = false;
    for (let i = bi; i < BOLTS; i++) if (bolts.current[i]) bolts.current[i]!.visible = false;
    for (let i = hi; i < HITS; i++) if (hits.current[i]) hits.current[i]!.visible = false;
    for (let i = ai2; i < BOLTS; i++) if (arcs.current[i]) arcs.current[i]!.visible = false;
    for (let i = ci; i < CRATERS; i++) if (craters.current[i]) craters.current[i]!.visible = false;
    for (let i = ri; i < POOL; i++) if (rings.current[i]) rings.current[i]!.visible = false;
    if (dash.current) dash.current.visible = dashOn;

    // Mũi tên bay theo parabol (trọng lực thật) — chạm quái hoặc mặt đất thì vỡ
    let ai = 0;
    let ti = 0;
    let meteorOn = false;
    for (const pr of projectiles) {
      if (!pr.alive) continue;
      pr.vel.y -= GRAVITY * dt;
      pr.pos.addScaledVector(pr.vel, dt);
      pr.trail.unshift(pr.pos.clone());
      if (pr.trail.length > TRAIL) pr.trail.pop();
      for (const e of enemies) {
        if (e.deadAt) continue;
        const cy = e.pos.y + (e.kind === "wisp" ? 1 : 0.5);
        if (Math.hypot(e.pos.x - pr.pos.x, cy - pr.pos.y, e.pos.z - pr.pos.z) < 0.75) {
          if (!pr.big) damageEnemy(e, pr.dmg, pr.pos, 3);
          if (pr.pierce) {
            pr.pierce = false; // xuyên 1 lần rồi bay tiếp
            useWorld.getState().burst([pr.pos.x, pr.pos.y, pr.pos.z], pr.color, 12);
            continue;
          }
          pr.alive = false;
          useWorld.getState().burst([pr.pos.x, pr.pos.y, pr.pos.z], pr.color, 16);
          if (pr.big) meteorImpact(pr);
          break;
        }
      }
      if (pr.alive && (pr.pos.y < ENV.ground(pr.pos.x, pr.pos.z) || now - pr.born > 3000)) {
        pr.alive = false;
        useWorld.getState().burst([pr.pos.x, pr.pos.y + 0.1, pr.pos.z], pr.color, 8);
        if (pr.big) meteorImpact(pr);
      }
      if (!pr.alive) continue;
      if (pr.big) {
        // Thiên thạch pha lê (mô hình Blender), xoay lộn khi rơi
        meteorOn = true;
        if (meteorRef.current) {
          meteorRef.current.position.copy(pr.pos);
          meteorRef.current.rotation.x += dt * 6;
          meteorRef.current.rotation.z += dt * 4;
        }
      } else {
        const m = arrows.current[ai++];
        if (m) {
          m.visible = true;
          m.position.copy(pr.pos);
          m.lookAt(S.copy(pr.pos).add(pr.vel));
          m.rotateZ(now / 90);
        }
      }
      if (trails.current)
        pr.trail.forEach((tp, j) => {
          if (ti >= ARROWS * TRAIL) return;
          // Vệt sao lấp lánh: mỗi hạt một góc xoay cố định, nhỏ dần
          const s = (pr.big ? 0.4 : 0.14) * (1 - j / TRAIL);
          Q.setFromAxisAngle(UPV, j * 1.3 + now / 200);
          M.compose(tp, Q, S.set(s, s, s));
          trails.current!.setMatrixAt(ti++, M);
        });
      if (ai >= ARROWS) break;
    }
    for (let i = ai; i < ARROWS; i++) if (arrows.current[i]) arrows.current[i]!.visible = false;
    if (meteorRef.current) meteorRef.current.visible = meteorOn;
    if (trails.current) {
      trails.current.count = ti;
      trails.current.instanceMatrix.needsUpdate = true;
    }
    // Dọn đạn đã vỡ
    for (let i = projectiles.length - 1; i >= 0; i--) if (!projectiles[i].alive) projectiles.splice(i, 1);
  });

  return (
    <group>
      {slashMats.map((m, i) => (
        <mesh key={`s${i}`} ref={(el) => void (slashes.current[i] = el)} geometry={slashGeo} material={m} visible={false} renderOrder={10} />
      ))}
      {ringMats.map((m, i) => (
        <mesh key={`r${i}`} ref={(el) => void (rings.current[i] = el)} material={m} visible={false} rotation-x={-Math.PI / 2} renderOrder={10}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      <mesh ref={dash} material={dashMat} visible={false} renderOrder={10}>
        <boxGeometry args={[1, 0.08, 1]} />
      </mesh>
      {Array.from({ length: ARROWS }, (_, i) => (
        <mesh key={`a${i}`} ref={(el) => void (arrows.current[i] = el)} geometry={kit.geo.fx_arrow} material={arrowMat} visible={false} scale={1.1} />
      ))}
      <group ref={meteorRef} visible={false} scale={1.1}>
        {kit.meteor && <primitive object={kit.meteor} />}
      </group>
      {boltMats.map((m, i) => (
        <mesh key={`bo${i}`} ref={(el) => void (bolts.current[i] = el)} geometry={kit.geo.fx_bolt} material={m} visible={false} renderOrder={10} />
      ))}
      {hitMats.map((m, i) => (
        <mesh key={`h${i}`} ref={(el) => void (hits.current[i] = el)} material={m} visible={false} renderOrder={12}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {arcMats.map((m, i) => (
        <mesh key={`arc${i}`} ref={(el) => void (arcs.current[i] = el)} material={m} visible={false} renderOrder={11}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {craterMats.map((m, i) => (
        <mesh key={`cr${i}`} ref={(el) => void (craters.current[i] = el)} material={m} visible={false} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      {/* Lỗ đen: chân trời sự kiện (đen tuyền) + đĩa bồi tụ xoắn 5 nhánh + vòng photon */}
      <group ref={hole} visible={false}>
        <mesh material={holeCore}>
          <sphereGeometry args={[0.5, 24, 16]} />
        </mesh>
        <mesh geometry={kit.geo.fx_disk} material={holeDisk} rotation-x={-Math.PI / 2} />
        <mesh geometry={kit.geo.fx_photon} material={holeRing} rotation-x={Math.PI / 2} scale={0.95} />
        <mesh geometry={kit.geo.fx_photon} material={holeRing} scale={1.05} />
      </group>
      <DropsView />
      <OrbitersView />
      <InterferenceField />
      <instancedMesh ref={trails} args={[kit.geo.fx_star, trailMat, ARROWS * TRAIL]} frustumCulled={false} />
    </group>
  );
}

function meteorImpact(pr: { pos: THREE.Vector3; dmg: number; color: string }) {
  const at = pr.pos.clone().setY(ENV.ground(pr.pos.x, pr.pos.z) + 0.06);
  hitRadius(at, 3.2, pr.dmg, 8);
  addFx("nova", at, { color: pr.color, size: 3.4 });
  addFx("crater", at.clone().setY(at.y + 0.03), { color: "#8b5cff", size: 2.2, yaw: Math.random() * 6 });
  addFx("ring", at, { color: "#fff6dc", size: 3.8 });
  const w = useWorld.getState();
  w.addShake(0.6);
  w.hitstop(80);
  w.burst([at.x, at.y + 0.5, at.z], pr.color, 70);
  // lõi loé 25–40 ms + tia lửa văng thấp theo mặt đất
  emitSpark(at.x, at.y + 0.6, at.z, 0, 0, 0, "#FFF0BC", { kind: 1, size: 2.2, life: 0.09, bright: 3.5 });
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 6 + Math.random() * 6;
    emitSpark(at.x, at.y + 0.2, at.z, Math.cos(a) * s, 1 + Math.random() * 3, Math.sin(a) * s, i % 3 ? "#FF8138" : "#FFF0BC", { size: 0.06, life: 0.5, stretch: 0.05, drag: 3, gravity: 9 });
  }
  sfx.shatter();
}

/** Vận tốc lướt / nhảy dùng bởi Player */
export { motion };
