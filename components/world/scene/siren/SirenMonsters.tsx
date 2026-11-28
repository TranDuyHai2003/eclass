"use client";
/**
 * Quái hoạ âm của Mê cung (luật thuần: lib/world/sirenMusic.ts) — dùng lại hạ tầng chiến đấu có sẵn:
 * quái là Enemy loại "node" (combat.ts đã coi là "phần của boss": đòn đánh của người chơi đi qua setBossHandler,
 * CombatScene không tự lái / tự vẽ), nên mọi vũ khí, khoá mục tiêu, phép… trúng được mà không sửa combat/*.
 * Siren.tsx chuyển đòn trúng quái mê cung sang mazeMonsterHit; boss + hai nút giao thoa giữ nguyên.
 *  - Nốt lạc điệu: phát vòng xung theo nhịp riêng (nhảy qua!); chỉ đau khi trúng ĐÚNG NHỊP (lúc nó loé), đánh lạc nhịp nó hồi máu.
 *  - Sóng nhiễu: đổi pha liên tục (đỏ = cùng pha, xanh = ngược pha); chỉ đau ở pha ngược — giao thoa triệt tiêu.
 *  - Cặp bất hoà: hai quả cầu kêu quãng hai thứ chói tai; mỗi đòn nâng nửa cung; tới quãng thuận thì tan thành hợp âm.
 * Quái chạy cục bộ trên từng máy (không đồng bộ mạng), hồi sinh sau 30 s.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWorld } from "../../store";
import { enemies, playerHurt, spawnEnemy, type Enemy } from "../../combat/combat";
import { rollDrops } from "../../combat/items";
import { emitBurst, emitHit } from "../../fx/Sparks";
import { floatText } from "../../ui/Labels";
import { MONSTER_DEFS, MONSTER_SPAWNS, OFFKEY_PERIOD, DISSONANCE_START, ROOT, monsterDamage, nameInterval, noisePhase, onBeat, tuneUp, type MonsterKind } from "@/lib/world/sirenMusic";
import { synth } from "./sirenSynth";
import { offHub } from "./zones/zoneRuntime";

interface MState {
  kind: MonsterKind;
  e: Enemy;
  seed: number;
  hp: number;
  max: number;
  semis: number;
  deadAt: number;
  hurtAt: number;
  pulseAt: number;
  voiceAt: number;
  home: THREE.Vector3;
}
const MS = new Map<number, MState>();
const RESPAWN_MS = 30000;
const tNow = () => performance.now() / 1000;
const L = (vi: string, en: string) => (useWorld.getState().lang === "vi" ? vi : en);
const UP = new THREE.Vector3(0, 1.6, 0);

/** Đòn của người chơi trúng quái mê cung? (true = đã xử lý) */
export function mazeMonsterHit(e: Enemy, amount: number): boolean {
  const m = MS.get(e.id);
  if (!m) return false;
  if (m.deadAt) return true;
  const at = e.pos.clone().add(UP);
  if (m.kind === "dissonance") {
    const r = tuneUp(m.semis);
    m.semis = r.semis;
    const f = ROOT * 0.75;
    const iv = nameInterval(Math.pow(2, m.semis / 12));
    synth.interval(f, f * Math.pow(2, m.semis / 12), 0.5);
    floatText(at, `${m.semis} ${L("nửa cung", "semitones")} · ${iv ? L(iv.vi, iv.en) : ""}`, r.resolved ? "crit" : "info");
    if (r.resolved) kill(m);
    return true;
  }
  const d = monsterDamage(m.kind, amount, tNow(), m.seed);
  if (d > 0) {
    m.hp = Math.max(0, m.hp - d);
    floatText(at, String(d), m.kind === "offkey" ? "crit" : "dmg");
    emitHit(at.x, at.y, at.z, m.kind === "offkey" ? "#ffd27a" : "#55d9f5");
    synth.impact("glass", 4 + d / 10);
    if (m.hp <= 0) kill(m);
  } else if (d < 0) {
    m.hp = Math.min(m.max, m.hp - d);
    floatText(at, m.kind === "offkey" ? L("lạc nhịp! +", "off beat! +") + -d : L("cùng pha! +", "in phase! +") + -d, "hurt");
    synth.dissonant(180, 0.3, 0.3);
  } else floatText(at, L("chưa đúng pha", "wrong phase"), "info");
  return true;
}

function kill(m: MState) {
  m.deadAt = performance.now();
  m.e.deadAt = 1;
  const p = m.e.pos;
  synth.resolve(ROOT * (m.kind === "offkey" ? 1 : m.kind === "noise" ? 1.5 : 1.25));
  emitBurst(p.x, p.y + 1.2, p.z, "#a8ff54", 36, 6);
  if (Math.random() < 0.6) rollDrops("mite", p.clone().setY(p.y + 1.2));
  floatText(p.clone().setY(p.y + 2.4), L("tan thành hợp âm thuận", "resolved into consonance"), "crit");
}

const COL: Record<MonsterKind, string> = { offkey: "#ffba35", noise: "#ff4a6a", dissonance: "#b48cff" };

export function MazeMonsters() {
  const views = useRef<(THREE.Group | null)[]>([]);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const list = useMemo(() => MONSTER_SPAWNS.map((s, i) => ({ ...s, i })), []);
  // sinh quái SAU <Enemies> (nó xoá sạch danh sách khi gắn) — component này đặt sau trong cây
  useEffect(() => {
    MS.clear();
    for (const s of MONSTER_SPAWNS) {
      const e = spawnEnemy("node", new THREE.Vector3(s.x, s.y, s.z));
      MS.set(e.id, { kind: s.kind, e, seed: Math.random() * 10, hp: MONSTER_DEFS[s.kind].hp, max: MONSTER_DEFS[s.kind].hp, semis: DISSONANCE_START, deadAt: 0, hurtAt: 0, pulseAt: 0, voiceAt: 0, home: new THREE.Vector3(s.x, s.y, s.z) });
    }
    return () => {
      for (const m of MS.values()) {
        const k = enemies.indexOf(m.e);
        if (k >= 0) enemies.splice(k, 1);
      }
      MS.clear();
    };
  }, []);
  useFrame((_, rawDt) => {
    if (offHub()) return; // đang ở khu khác của đồ thị khu
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const t = now / 1000;
    const p = useWorld.getState().player;
    let i = 0;
    for (const m of MS.values()) {
      const g = views.current[i];
      const ring = rings.current[i];
      i++;
      if (m.deadAt) {
        if (now - m.deadAt > RESPAWN_MS) {
          m.deadAt = 0;
          m.e.deadAt = 0;
          m.hp = m.max;
          m.semis = DISSONANCE_START;
          m.e.pos.copy(m.home);
        }
        if (g) g.visible = false;
        if (ring) ring.visible = false;
        continue;
      }
      m.e.deadAt = 0;
      // trôi chậm về phía người chơi khi ở gần, không xa nhà quá 6 m
      const d = Math.hypot(p.x - m.e.pos.x, p.z - m.e.pos.z);
      if (d < 12 && d > 1.6 && Math.abs(p.y - m.home.y) < 3) {
        const k = (1.4 * dt) / d;
        m.e.pos.x += (p.x - m.e.pos.x) * k;
        m.e.pos.z += (p.z - m.e.pos.z) * k;
      } else m.e.pos.lerp(m.home, dt * 0.3);
      if (m.e.pos.distanceTo(m.home) > 6) m.e.pos.sub(m.home).setLength(6).add(m.home);
      // tiếng kêu nghịch tai khi lại gần (thưa)
      if (d < 9 && now - m.voiceAt > 3500) {
        m.voiceAt = now + Math.random() * 1500;
        synth.dissonant(m.kind === "noise" ? 150 : m.kind === "offkey" ? 247 : 196, 0.5, 0.25);
      }
      // đòn: Nốt lạc điệu phát vòng xung đúng nhịp (nhảy qua); Sóng nhiễu chạm khi cùng pha; Bất hoà nổ chói mỗi 3,5 s
      if (m.kind === "offkey") {
        const beat = onBeat(t, m.seed, OFFKEY_PERIOD, 0.04);
        if (beat && now - m.pulseAt > OFFKEY_PERIOD * 700) {
          m.pulseAt = now;
          if (d < 3.4 && d > 1.2 && p.y - m.e.pos.y < 0.6 && now - m.hurtAt > 900) {
            m.hurtAt = now;
            playerHurt(7, m.e.pos);
          }
        }
      } else if (m.kind === "noise") {
        if (d < 1.8 && noisePhase(t, m.seed) > 0.3 && now - m.hurtAt > 1000) {
          m.hurtAt = now;
          playerHurt(6, m.e.pos);
        }
      } else if (now - m.pulseAt > 3500) {
        m.pulseAt = now;
        if (d < 3.2 && now - m.hurtAt > 900) {
          m.hurtAt = now;
          playerHurt(8, m.e.pos);
        }
      }
      // hình
      if (g) {
        g.visible = true;
        g.position.set(m.e.pos.x, m.e.pos.y + 1.2 + Math.sin(t * 2 + m.seed) * 0.2, m.e.pos.z);
        g.rotation.y = t * 0.8 + m.seed;
        const head = g.children[0] as THREE.Mesh;
        const mat = head.material as THREE.MeshToonMaterial;
        if (m.kind === "offkey") {
          // loé đúng nhịp (cửa sổ đánh)
          const on = onBeat(t, m.seed);
          mat.emissive.set(on ? "#ffd27a" : "#000000");
          g.scale.setScalar(on ? 1.18 : 1);
        } else if (m.kind === "noise") {
          const ph = noisePhase(t, m.seed);
          mat.color.set(ph < -0.3 ? "#55d9f5" : ph > 0.3 ? "#ff4a6a" : "#b8a8d8");
          g.scale.set(1 + 0.25 * ph, 1 - 0.15 * ph, 1 + 0.25 * ph);
        } else {
          // hai quả cầu quay quanh nhau, tần số theo quãng hiện tại → phách nhìn thấy
          const k = Math.pow(2, m.semis / 12);
          const a = t * 2.2;
          (g.children[0] as THREE.Mesh).position.set(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6);
          (g.children[1] as THREE.Mesh).position.set(Math.cos(a * k + Math.PI) * 0.6, Math.sin(t * 8 * (k - 1 + 0.05)) * 0.25, Math.sin(a * k + Math.PI) * 0.6);
        }
        // thanh máu (tỉ lệ)
        const bar = g.children[g.children.length - 1] as THREE.Mesh;
        bar.scale.x = m.kind === "dissonance" ? 1 - (m.semis - 1) / 4 : m.hp / m.max;
        bar.rotation.y = -g.rotation.y;
      }
      if (ring) {
        // vòng xung lan ra (Nốt lạc điệu) — báo nhịp để nhảy qua
        const age = m.kind === "offkey" ? (now - m.pulseAt) / 500 : m.kind === "dissonance" ? (now - m.pulseAt) / 600 : 2;
        ring.visible = age < 1;
        if (ring.visible) {
          ring.position.set(m.e.pos.x, m.e.pos.y + 0.15, m.e.pos.z);
          ring.scale.setScalar(0.5 + age * 3);
        }
      }
    }
  });
  return (
    <group name="perf:monsters">
      {list.map((s, i) => (
        <group key={i}>
          <group ref={(el) => void (views.current[i] = el)}>
            {s.kind === "offkey" ? (
              <>
                {/* nốt nhạc: đầu nốt elip + thân + cờ */}
                <mesh scale={[0.55, 0.42, 0.42]} rotation-z={-0.4}>
                  <sphereGeometry args={[1, 20, 14]} />
                  <meshToonMaterial color={COL.offkey} />
                </mesh>
                <mesh position={[0.45, 0.9, 0]}>
                  <boxGeometry args={[0.08, 1.8, 0.08]} />
                  <meshToonMaterial color="#20172c" />
                </mesh>
              </>
            ) : s.kind === "noise" ? (
              <>
                <mesh>
                  <torusKnotGeometry args={[0.5, 0.16, 64, 8, 2, 5]} />
                  <meshToonMaterial color={COL.noise} />
                </mesh>
                <mesh visible={false}>
                  <boxGeometry args={[0.01, 0.01, 0.01]} />
                </mesh>
              </>
            ) : (
              <>
                <mesh>
                  <icosahedronGeometry args={[0.4, 1]} />
                  <meshToonMaterial color="#ff64b0" />
                </mesh>
                <mesh>
                  <icosahedronGeometry args={[0.4, 1]} />
                  <meshToonMaterial color="#55d9f5" />
                </mesh>
              </>
            )}
            <mesh position={[0, 1.5, 0]}>
              <planeGeometry args={[1, 0.09]} />
              <meshBasicMaterial color={COL[s.kind]} toneMapped={false} />
            </mesh>
          </group>
          <mesh ref={(el) => void (rings.current[i] = el)} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[0.9, 1, 48]} />
            <meshBasicMaterial color={COL[s.kind]} transparent opacity={0.8} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

