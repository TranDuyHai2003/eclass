"use client";
/**
 * Labyrinth of Harmonics — co-op boss dungeon with the Fourier Siren (lib/world/boss.ts).
 * Solo: the boss is simulated locally. Online in the "siren" room: the realtime server is the authority
 * (snapshots carry the boss state; hits are sent as claims), and every client draws the same telegraphs.
 * Witch-labyrinth look: paper-cut collage sky, piano-key ring floor, floating cut-out props.
 * Mê cung bao quanh đấu trường (lib/world/sirenMaze.ts + ./siren/*): nhiều tầng, cổng dịch chuyển kiểu Portal
 * (cổng tường / sàn / trần, giữ đà qua cổng), lỗ hổng vòng lặp (rơi qua đáy ra từ trời, màn sân khấu dán đối tâm), bay lượn.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { Label3D } from "../ui/Labels";
import { ARENA_PLATFORMS, MAZE_UPDRAFTS, ZONE_LABEL, mazeBlocked, mazeCamFloor, mazeGround } from "@/lib/world/sirenMaze";
import { CollageFlats, MathRoses, MazeGeometry } from "./siren/SirenMaze";
import { LoopVortices, SirenFog, SirenSky, StageCurtain } from "./siren/SirenSky";
import { PortalSurfaces, usePortalDriver } from "./siren/SirenPortals";
import { GravityZones, gravityCamClamp, sirenField } from "./siren/SirenGravity";
import { MazeMonsters, mazeMonsterHit } from "./siren/SirenMonsters";
import { SirenPlay, playNearby } from "./siren/SirenPlay";
import * as THREE from "three";
import { create } from "zustand";
import { useWorld } from "../store";
import { worldAsset, AVATAR_BY_ID } from "@/lib/world/avatars";
import { toonize, cloneWithOwnMaterials } from "../fx/glbToon";
import { createFxMat, rampRow } from "../fx/fxmat";
import { Player } from "./Hub";
import { MagicCircle } from "../fx/Effects";
import { Updrafts } from "./Props";
import { RemotePlayers } from "./RemotePlayers";
import { CombatFx, Enemies } from "../combat/CombatScene";
import { ENV, addFx, enemies, playerHurt, motion, setBossHandler, type Enemy } from "../combat/combat";
import { floatText } from "../ui/Labels";
import { ARENA_R, ATK, BOSS_DMG, LAMBDA, NODE_POS, beatRadius, hitBoss, hitNode, inPhase, lissajous, newBoss, standingDanger, tickBoss, unpackBoss, type BossSim } from "@/lib/world/boss";
import { netBoss, netBossHit, netPeers, netStatus } from "../net";
import { sfx } from "@/lib/world/sfx";
import { questEvent } from "../story/quest";
import { rollDrops } from "../combat/items";

/** Trạng thái boss cho HUD (cập nhật ~10 lần/giây) */
export const useBossUi = create<{ on: boolean; hp: number; maxHp: number; coh: number; cohMax: number; broken: boolean; phase: number; shield: boolean; atk: string | null; dead: boolean; nodes: [number, number] }>(() => ({
  on: false, hp: 1, maxHp: 1, coh: 1, cohMax: 1, broken: false, phase: 1, shield: false, atk: null, dead: false, nodes: [0, 0],
}));

const SIREN_GLB = worldAsset("boss/siren.glb");
useGLTF.preload(SIREN_GLB);
const UP = new THREE.Vector3(0, 2.2, 0);

/** Dịch chuyển / vòng lặp / bay: đặt SAU Player (chạy sau khi Player di chuyển trong khung) */
function PortalDriver() {
  usePortalDriver();
  return null;
}
function camClamp(pos: THREE.Vector3, target: THREE.Vector3) {
  // trong vùng trọng lực kỳ dị: máy quay theo hệ "lên" riêng (Lồng Escher: giữ trong lòng lồng)
  if (gravityCamClamp(pos, target)) return;
  const f = mazeCamFloor(pos.x, pos.z, pos.y, target.y);
  if (f !== null) pos.y = f;
}

export function Siren() {
  const avatar = useWorld((s) => s.avatar);
  const portals = useRef<THREE.Group>(null);
  // Mốc thời gian 0: tickBoss đặt nextAt theo đồng hồ thật ở khung đầu tiên
  const boss = useRef<BossSim>(newBoss(1, 0));
  const hurtAt = useRef<Record<string, number>>({});
  const lastUi = useRef(0);
  const wasDead = useRef(false);
  // Đòn đánh của người chơi vào boss / nút giao thoa đi qua đây
  useEffect(() => {
    setBossHandler((e: Enemy, amount: number) => {
      // quái hoạ âm trong mê cung (cũng là Enemy loại "node") có luật riêng
      if (mazeMonsterHit(e, amount)) return;
      const now = Date.now();
      const online = !!netBoss.data && netStatus() === "online";
      const node = e.kind === "node" ? ((e.pos.x < 0 ? 0 : 1) as 0 | 1) : undefined;
      if (online) netBossHit(amount, node);
      const b = boss.current;
      if (node !== undefined) {
        hitNode(b, node, amount, now);
        floatText(e.pos.clone().add(UP), String(amount), "dmg");
        return;
      }
      if (b.shield) {
        floatText(e.pos.clone().add(UP), "shield", "info");
        sfx.miss();
        return;
      }
      const r = hitBoss(b, amount, now);
      floatText(e.pos.clone().add(UP).setY(e.pos.y + 3), String(r.dealt), inPhase(now) ? "crit" : "dmg");
      if (r.broke) {
        floatText(e.pos.clone().setY(4.5), "BREAK", "crit");
        useWorld.getState().addShake(0.5);
        sfx.shatter();
      }
    });
    useBossUi.setState({ on: true });
    return () => {
      setBossHandler(null);
      useBossUi.setState({ on: false });
    };
  }, []);

  useFrame(() => {
    const now = Date.now();
    const b = boss.current;
    if (b.nextAt < 1e6) b.nextAt = now + 2500;
    // Trực tuyến: lấy trạng thái từ server (quy đổi đồng hồ); một mình: tự mô phỏng
    if (netBoss.data && netStatus() === "online" && performance.now() - netBoss.at < 2000) {
      unpackBoss(netBoss.data, b);
      b.atkAt -= netBoss.offset;
      b.brokenUntil -= netBoss.offset;
    } else tickBoss(b, now);
    // Đồng bộ các "mục tiêu" chiến đấu (boss + 2 nút) với hệ combat
    for (const e of enemies) {
      if (e.kind === "siren") {
        e.deadAt = b.deadAt ? 1 : 0;
        e.pos.set(0, 0, 0);
      } else if (e.kind === "node" && Math.hypot(e.home.x, e.home.z) < ARENA_R) {
        const i = e.pos.x < 0 ? 0 : 1;
        e.deadAt = b.atk === "twin" && b.nodes[i] > 0 ? 0 : 1;
      }
    }
    // Đòn của boss lên chính người chơi này
    const p = useWorld.getState().player;
    const r = Math.hypot(p.x, p.z);
    const since = now - b.atkAt;
    // chỉ người đang ở tầng đấu trường mới trúng đòn (tầng Đáy nằm ngay bên dưới)
    if (b.atk && !b.deadAt && p.y > -1.5) {
      const tele = ATK[b.atk].tele;
      const key = `${b.atk}@${b.atkAt}`;
      if (b.atk === "standing" && since >= tele && since < tele + 120 && !hurtAt.current[key]) {
        hurtAt.current[key] = 1;
        if (standingDanger(r) && p.y < 1.2) playerHurt(BOSS_DMG.standing);
        useWorld.getState().addShake(0.3);
      } else if (b.atk === "beat") {
        for (let i = 0; i < 3; i++) {
          const br = beatRadius(since - tele, i);
          const k = `${key}#${i}`;
          if (br !== null && Math.abs(br - r) < 0.6 && motion.grounded && p.y < 1.2 && !hurtAt.current[k]) {
            hurtAt.current[k] = 1;
            playerHurt(BOSS_DMG.beat);
          }
        }
      } else if (b.atk === "lissajous" && since >= tele) {
        for (const k of [0, 1] as const) {
          const c = lissajous(k, since - tele);
          const id = `${key}#c${k}`;
          const cy = k === 1 ? 5.4 : 1.0;
          if (Math.hypot(c.x - p.x, c.z - p.z) < 1.1 && Math.abs(p.y + 0.9 - cy) < 1.4 && now - (hurtAt.current[id] ?? 0) > 800) {
            hurtAt.current[id] = now;
            playerHurt(BOSS_DMG.lissajous);
          }
        }
      }
    }
    if (b.deadAt && !wasDead.current) {
      wasDead.current = true;
      questEvent({ type: "kill", kind: "siren" });
      // Thưởng: mưa đồ quanh tâm đấu trường (nguyên liệu hiếm + vũ khí chưa có)
      for (let i = 0; i < 3; i++) rollDrops("mite", new THREE.Vector3(Math.cos(i * 2.1) * 2, 1.5, Math.sin(i * 2.1) * 2));
      useWorld.getState().burst([0, 3, 0], "#ffd27a", 120);
      useWorld.getState().addShake(0.6);
    }
    if (!b.deadAt) wasDead.current = false;
    if (now - lastUi.current > 100) {
      lastUi.current = now;
      useBossUi.setState({ hp: b.hp, maxHp: b.maxHp, coh: b.coh, cohMax: b.cohMax, broken: now < b.brokenUntil, phase: b.phase, shield: b.shield, atk: b.atk, dead: !!b.deadAt, nodes: [...b.nodes] as [number, number] });
    }
  });

  const lang = useWorld((st) => (st.lang === "vi" ? "vi" : "en"));
  return (
    <group>
      <SirenSky />
      <SirenFog />
      <LoopVortices />
      <StageCurtain />
      <MazeGeometry />
      <CollageFlats />
      <MathRoses />
      <PortalSurfaces group={portals} />
      <GravityZones />
      <Updrafts list={MAZE_UPDRAFTS} />
      {ZONE_LABEL.map((z) => (
        <Label3D key={z.zone} text={z[lang]} position={z.at} maxDist={60} />
      ))}
      <ArenaFloor />
      <BossModel boss={boss} />
      <Telegraphs boss={boss} />
      <MagicCircle radius={3.2} position={[0, 0.04, 0]} color="#ff9ecb" color2="#9fe6ff" intensity={0.8} spin={0.4} />
      <Enemies
        ground={() => 0}
        clampR={ARENA_R}
        aggro={0}
        spawner={{ kind: "fixed", points: [{ kind: "siren", at: [0, 0, 0] }, { kind: "node", at: [NODE_POS[0][0], 0, NODE_POS[0][1]] }, { kind: "node", at: [NODE_POS[1][0], 0, NODE_POS[1][1]] }] }}
      />
      {/* sau <Enemies> (nó xoá danh sách quái khi gắn): quái hoạ âm + câu đố toán – nhạc */}
      <MazeMonsters />
      <SirenPlay />
      <CombatFx />
      <RemotePlayers />
      <Platforms />
      <Updrafts list={UPDRAFTS} />
      <Player armed avatarFile={AVATAR_BY_ID[avatar]?.file} ground={mazeGround} blocked={mazeBlocked} camClamp={camClamp} field={sirenField} findNearby={sirenNearby} />
      <PortalDriver />
    </group>
  );
}

/** Đài nổi nhiều tầng: tránh sóng dưới đất, nhưng sao chổi thứ hai bay ở tầm cao (va chạm ở lib/world/sirenMaze) */
const PLATFORMS = ARENA_PLATFORMS;
const UPDRAFTS = [0, 1, 2, 3].map((i) => {
  const a = (i / 4) * Math.PI * 2;
  return { x: Math.cos(a) * 11.5, z: Math.sin(a) * 11.5, r: 1.3, top: 9 };
});

function Platforms() {
  const tex = useTexture(worldAsset("dungeon/lab_floor.webp"));
  return (
    <>
      {PLATFORMS.map((p, i) => (
        <group key={i} position={[p.x, p.top, p.z]}>
          <mesh rotation-x={-Math.PI / 2}>
            <circleGeometry args={[p.r, 40]} />
            <meshToonMaterial map={tex} />
          </mesh>
          <mesh position-y={-0.45}>
            <cylinderGeometry args={[p.r, p.r * 0.35, 0.9, 32, 1, true]} />
            <meshToonMaterial color="#3a2a66" side={THREE.DoubleSide} />
          </mesh>
          <MagicCircle radius={p.r * 0.9} position={[0, 0.03, 0]} color="#ffd27a" color2="#ff9ecb" intensity={0.5} spin={0.3} />
        </group>
      ))}
    </>
  );
}

function sirenNearby(p: THREE.Vector3) {
  // Cổng về sảnh ở rìa phía nam đấu trường
  if (Math.hypot(p.x, p.z - 13) < 2.2) return { kind: "portal" as const, id: "hub", label: useWorld.getState().lang === "vi" ? "Rời Mê cung" : "Leave the Labyrinth" };
  // đàn một dây, ống Fourier, con lắc, rương (registerAction → WorldClient gọi runAction)
  return playNearby(p);
}

function BossModel({ boss }: { boss: React.RefObject<BossSim> }) {
  const gltf = useGLTF(SIREN_GLB);
  const model = useMemo(() => {
    const src = gltf.scene.getObjectByName("b_siren");
    return src ? cloneWithOwnMaterials(toonize(src)) : null;
  }, [gltf]);
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const b = boss.current;
    if (!g.current || !model || !b) return;
    const now = Date.now();
    const t = now / 1000;
    const broken = now < b.brokenUntil;
    // Lơ lửng + xoay chậm; bị phá thế thì rũ xuống; chết thì tan biến
    g.current.position.y = broken ? 0.1 : 0.6 + Math.sin(t * 1.3) * 0.25;
    g.current.rotation.y = Math.sin(t * 0.25) * 0.6;
    g.current.rotation.z = broken ? 0.25 : 0;
    const phaseOn = inPhase(now);
    for (const m of model.glow) m.color.copy(m.userData.base as THREE.Color).multiplyScalar(phaseOn ? 1.6 : 0.6);
    const k = b.deadAt ? Math.min(1, (now - b.deadAt) / 1500) : 0;
    for (const m of model.toon) {
      (m.userData.dissolve as { value: number }).value = k > 0 ? k : 0;
      m.emissive.setScalar(b.shield ? 0.25 : 0);
    }
    g.current.visible = k < 1;
  });
  if (!model) return null;
  return (
    <group ref={g} scale={1.6}>
      <primitive object={model.obj} />
    </group>
  );
}

/** Báo trước đòn: dải sóng dừng, vòng nhịp, quỹ đạo Lissajous, nút giao thoa */
function Telegraphs({ boss }: { boss: React.RefObject<BossSim> }) {
  const bands = useRef<THREE.Mesh>(null);
  const beats = useRef<(THREE.Mesh | null)[]>([]);
  const comets = useRef<(THREE.Mesh | null)[]>([]);
  const path = useRef<THREE.Line>(null);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const bandMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uK: { value: 0 }, uLam: { value: LAMBDA }, uR: { value: ARENA_R } },
        vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: `uniform float uK; uniform float uLam; uniform float uR; varying vec2 vP;
          void main(){
            float r = length(vP);
            if (r < 2.0 || r > uR - 0.5) discard;
            float s = abs(sin(6.2831853 * r / uLam));
            float danger = step(0.5, s);
            // Bụng sóng: đỏ đậm dần theo thời gian báo trước; nút sóng: vệt xanh an toàn
            vec3 col = mix(vec3(0.4, 1.0, 0.85), vec3(1.0, 0.23, 0.19), danger);
            float a = danger * (0.18 + 0.5 * uK) + (1.0 - danger) * 0.22 * step(s, 0.12);
            gl_FragColor = vec4(col * (1.0 + uK), a);
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  const beatMats = useMemo(() => [0, 1, 2].map(() => createFxMat(1)), []);
  const cometMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff9ecb").multiplyScalar(2.6), toneMapped: false }), []);
  const lineMat = useMemo(() => new THREE.LineDashedMaterial({ color: "#ffb3d6", dashSize: 0.4, gapSize: 0.3, transparent: true, opacity: 0.8 }), []);
  const lineGeo = useMemo(() => new THREE.BufferGeometry(), []);
  useEffect(() => () => [bandMat, ...beatMats, cometMat, lineMat].forEach((m) => m.dispose()), [bandMat, beatMats, cometMat, lineMat]);
  useFrame(() => {
    const b = boss.current;
    if (!b) return;
    const now = Date.now();
    const since = now - b.atkAt;
    const tele = b.atk ? ATK[b.atk].tele : 0;
    if (bands.current) {
      bands.current.visible = b.atk === "standing" && since < tele + 300;
      bandMat.uniforms.uK.value = Math.min(1, since / tele);
    }
    beatMats.forEach((m, i) => {
      const mesh = beats.current[i];
      if (!mesh) return;
      const br = b.atk === "beat" ? beatRadius(since - tele, i) : null;
      // Báo trước: vòng mờ quanh boss; khi phát: vòng lan ra (ramp đỏ nguy hiểm)
      mesh.visible = b.atk === "beat" && (since < tele || br !== null);
      const radius = br ?? 1.6;
      mesh.scale.setScalar(radius * 2.4);
      m.uniforms.uProg.value = 0.84;
      m.uniforms.uRow.value = 10;
      m.uniforms.uAge.value = br === null ? 0.5 : 0;
      m.uniforms.uTime.value = now / 1000;
    });
    const onLiss = b.atk === "lissajous";
    if (path.current) {
      path.current.visible = onLiss && since < tele + 600;
      if (onLiss && since < 60) {
        const pts: THREE.Vector3[] = [];
        for (const k of [0, 1] as const) for (let i = 0; i <= 160; i++) {
          const c = lissajous(k, (i / 160) * ATK.lissajous.dur);
          pts.push(new THREE.Vector3(c.x, 0.15, c.z));
        }
        lineGeo.setFromPoints(pts);
        path.current.computeLineDistances();
      }
    }
    comets.current.forEach((m, k) => {
      if (!m) return;
      m.visible = onLiss && since >= tele;
      if (m.visible) {
        const c = lissajous(k as 0 | 1, since - tele);
        m.position.set(c.x, (k === 1 ? 5.4 : 1.0) + Math.sin(now / 150 + k) * 0.15, c.z);
        m.rotation.y = now / 200;
      }
    });
    nodes.current.forEach((n, i) => {
      if (!n) return;
      n.visible = b.atk === "twin" && b.nodes[i] > 0;
      n.rotation.y = now / 400;
      n.position.y = 1.4 + Math.sin(now / 300 + i * 2) * 0.2;
    });
  });
  return (
    <group>
      <mesh ref={bands} rotation-x={-Math.PI / 2} position-y={0.06} material={bandMat} visible={false}>
        <circleGeometry args={[ARENA_R, 96]} />
      </mesh>
      {beatMats.map((m, i) => (
        <mesh key={i} ref={(el) => void (beats.current[i] = el)} rotation-x={-Math.PI / 2} position-y={0.08} material={m} visible={false}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
      <lineSegments ref={path as never} geometry={lineGeo} material={lineMat} visible={false} />
      {[0, 1].map((k) => (
        <mesh key={k} ref={(el) => void (comets.current[k] = el)} material={cometMat} visible={false} scale={0.45}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
      {NODE_POS.map(([x, z], i) => (
        <group key={i} ref={(el) => void (nodes.current[i] = el)} position={[x, 1.4, z]} visible={false}>
          <mesh scale={[0.5, 0.9, 0.5]}>
            <octahedronGeometry args={[1, 0]} />
            <meshToonMaterial color={i ? "#9fe6ff" : "#ff9ecb"} emissive={i ? "#2a7fa0" : "#a0306a"} />
          </mesh>
          <MagicCircle radius={1.4} position={[0, -1.35, 0]} color={i ? "#9fe6ff" : "#ff9ecb"} intensity={0.9} spin={1.5} />
        </group>
      ))}
    </group>
  );
}

function ArenaFloor() {
  const tex = useTexture(worldAsset("dungeon/lab_floor.webp"));
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0}>
        <circleGeometry args={[ARENA_R + 0.6, 96]} />
        <meshToonMaterial map={tex} />
      </mesh>
      {/* Vành đá trôi nổi + cổng về sảnh */}
      <mesh position-y={-0.6}>
        <cylinderGeometry args={[ARENA_R + 0.6, ARENA_R - 2, 1.2, 64, 1, true]} />
        <meshToonMaterial color="#3a2a66" side={THREE.DoubleSide} />
      </mesh>
      <MagicCircle vertical radius={1.8} position={[0, 2.2, 13.6]} intensity={1} color="#ffd27a" color2="#8be0ff" />
    </group>
  );
}

void rampRow;
void ENV;
void addFx;
void netPeers;
