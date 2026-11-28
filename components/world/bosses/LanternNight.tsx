"use client";
/**
 * Đêm Đèn lồng — sự kiện (logic thuần ở lib/world/lanternNight.ts).
 * Vẽ: 40 đèn lồng bay lên (MỘT InstancedBufferGeometry, chuyển động hoàn toàn trong vertex shader) + ≤ 8 Bướm Chu kỳ
 * (thân / cánh / đèn / vòng sà = 4 InstancedMesh; model Blender `monsters/moth.glb` nạp nền — cánh cong có gân + vân cos,
 * cánh trái = cánh phải lật gương). Bướm là Enemy (vũ khí đánh trúng bình thường) với móc ext.mul:
 * chỉ trúng khi đòn tới đúng độ cao (sà thấp → cận chiến với tới; tên bay ngang tầm → trúng).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GRADIENT } from "../fx/shaders";
import { ENV, enemies, playerHurt, spawnEnemy, type Enemy } from "../combat/combat";
import { useWorld } from "../store";
import { sfx } from "@/lib/world/sfx";
import { bumpCombat } from "../audio/combatLayer";
import { emitBurst } from "../fx/Sparks";
import { floatText } from "../ui/Labels";
import { t as tt } from "@/lib/world/i18n";
import { DAY } from "../fx/dayState";
import { spawnDrop } from "../craft/invStore";
import { LN, lcmPeriods, mothHeight, mothPeriod, newEvent, startEvent, tickEvent, waveSize } from "@/lib/world/lanternNight";
import { toast, useEventUi } from "./bossStore";
import { applyLantern, mothSlot, packLantern, type LnPack } from "@/lib/world/bossNet";
import { encEnd, encHit, encRole, encSend, encSlot, encTakeHits, shiftNow } from "./encounterNet";
import { enableVertexColors, useBossGlb } from "./bossGlb";
import { worldAsset } from "@/lib/world/avatars";

const MOTH_GLB = worldAsset("monsters/moth.glb");

const MAXM = 8;
const COL_T = { 2: new THREE.Color("#7dffc8"), 3: new THREE.Color("#ffc46b"), other: new THREE.Color("#ffd98a") } as const;
const DUMMY = new THREE.Object3D();
const TMPC = new THREE.Color();
const V1 = new THREE.Vector3();

interface Moth {
  /** chỉ số trong đợt (ổn định — đòn của khách gửi "m<idx>") */
  idx: number;
  e: Enemy;
  th0: number;
  r: number;
  T: number;
  /** số lần sà đã xử lý (k của đáy gần nhất) */
  k: number;
  goneAt: number;
}

const periodColor = (T: number) => (T === 2 ? COL_T[2] : T === 3 ? COL_T[3] : COL_T.other);

export function LanternNight({ cx, cz, y: baseY, seed, onEnd }: { cx: number; cz: number; y: number; seed: number; onEnd: () => void }) {
  const S = useMemo(
    () => ({
      ev: newEvent(),
      moths: [] as Moth[],
      ox: cx,
      oz: cz,
      started: false,
      hudAt: 0,
      infoAt: 0,
      bumpAt: 0,
      doneAt: 0,
      ended: false,
      boost: 0,
      /** nhiều người: gói đã áp / lần gửi (chủ) / số bướm của đợt / đợt + gốc pha đã dựng bướm (khách) */
      ver: -1,
      sentAt: 0,
      waveN: 0,
      builtWaveAt: -1,
      seenState: "intro" as string,
    }),
    [cx, cz],
  );
  useEffect(() => {
    startEvent(S.ev, performance.now(), cx, cz);
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __lantern: S });
    toast(tt(useWorld.getState().lang, "evIntro"), "info");
    sfx.chime(4);
    return () => {
      for (const m of S.moths) {
        const i = enemies.indexOf(m.e);
        if (i >= 0) enemies.splice(i, 1);
      }
      S.moths.length = 0;
      useEventUi.setState({ on: false });
    };
  }, [S, cx, cz]);

  const R = useMemo(() => {
    const toon = (c: string, em = "#000000", k = 0) => new THREE.MeshToonMaterial({ color: c, gradientMap: GRADIENT, emissive: em, emissiveIntensity: k });
    const bodyGeo = new THREE.SphereGeometry(0.28, 12, 8);
    bodyGeo.scale(0.8, 0.8, 1.5);
    const bodyMat = toon("#ffffff", "#2a1b3d", 0.2);
    const wingGeo = new THREE.PlaneGeometry(0.95, 0.62);
    wingGeo.translate(0.5, 0, 0);
    wingGeo.rotateX(-Math.PI / 2);
    const wingMat = new THREE.MeshToonMaterial({ color: "#ffffff", gradientMap: GRADIENT, side: THREE.DoubleSide, emissive: "#3b2a66", emissiveIntensity: 0.3 });
    const lampGeo = new THREE.SphereGeometry(0.16, 10, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const ringGeo = new THREE.RingGeometry(0.88, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    // đèn lồng trời: hộp nhỏ, vị trí từ (aOff: góc, bán kính, pha) + thời gian
    const skyGeo = new THREE.InstancedBufferGeometry();
    const box = new THREE.BoxGeometry(0.34, 0.46, 0.34);
    skyGeo.index = box.index;
    skyGeo.setAttribute("position", box.getAttribute("position"));
    skyGeo.setAttribute("normal", box.getAttribute("normal"));
    const off = new Float32Array(LN.SKY_LANTERNS * 3);
    for (let i = 0; i < LN.SKY_LANTERNS; i++) off.set([Math.random() * Math.PI * 2, 3 + Math.random() * 16, Math.random()], i * 3);
    skyGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 3));
    skyGeo.instanceCount = LN.SKY_LANTERNS;
    const SU = { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3(cx, baseY, cz) }, uFade: { value: 0 }, uBoost: { value: 0 } };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: SU,
      vertexShader: /* glsl */ `
        attribute vec3 aOff;
        uniform float uTime, uBoost;
        uniform vec3 uCenter;
        varying float vGlow; varying vec3 vN;
        void main() {
          // bay lên chậm, lắc ngang theo chu kỳ 4 s (nhìn thấy được "nhịp")
          float rise = mod(uTime * (0.7 + aOff.z * 0.5) * (1.0 + 2.0 * uBoost) + aOff.z * 34.0, 34.0);
          float sway = 0.5 * sin(6.28318 * (uTime / 4.0 + aOff.z));
          float a = aOff.x + uTime * 0.03;
          vec3 c = uCenter + vec3(cos(a) * (aOff.y + sway), 1.0 + rise, sin(a) * (aOff.y + sway));
          vGlow = (0.65 + 0.35 * sin(6.28318 * (uTime / 2.0 + aOff.z))) * (1.0 - smoothstep(26.0, 34.0, rise)) * smoothstep(0.0, 2.0, rise);
          vN = normal;
          gl_Position = projectionMatrix * viewMatrix * vec4(c + position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        varying float vGlow; varying vec3 vN;
        void main() {
          float rim = 0.75 + 0.25 * abs(vN.y);
          vec3 c = mix(vec3(1.0, 0.45, 0.22), vec3(1.0, 0.85, 0.5), rim) * (1.2 + 1.6 * vGlow);
          gl_FragColor = vec4(c, uFade * vGlow);
        }`,
      transparent: true,
      depthWrite: false,
    });
    return { bodyGeo, bodyMat, wingGeo, wingMat, lampGeo, lampMat, ringGeo, ringMat, skyGeo, skyMat, box, SU };
  }, [cx, cz, baseY]);
  useEffect(
    () => () => {
      for (const v of Object.values(R)) if (v && typeof (v as { dispose?: () => void }).dispose === "function") (v as { dispose: () => void }).dispose();
    },
    [R],
  );

  const bodies = useRef<THREE.InstancedMesh>(null);
  const wings = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  // model Blender (màu ở màu đỉnh × màu theo chu kỳ của từng con)
  const glb = useBossGlb(MOTH_GLB);
  useEffect(() => {
    if (!glb) return;
    enableVertexColors(R.bodyMat, R.wingMat, R.lampMat);
    if (bodies.current && glb.mo_body) bodies.current.geometry = glb.mo_body;
    if (wings.current && glb.mo_wing) wings.current.geometry = glb.mo_wing;
    if (lamps.current && glb.mo_lantern) lamps.current.geometry = glb.mo_lantern;
  }, [glb, R]);
  useEffect(() => {
    for (const r of [bodies, lamps, rings]) if (r.current) for (let i = 0; i < MAXM; i++) r.current.setColorAt(i, COL_T.other);
    if (wings.current) for (let i = 0; i < MAXM * 2; i++) wings.current.setColorAt(i, COL_T.other);
  }, []);

  useFrame((st, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const now = performance.now();
    const time = st.clock.elapsedTime;
    const w = useWorld.getState();
    const p = w.player;
    const ev = S.ev;
    // đếm bướm sống + dọn xác (sau 1 s)
    let alive = 0;
    for (let i = S.moths.length - 1; i >= 0; i--) {
      const m = S.moths[i];
      if (m.e.deadAt) {
        if (!m.goneAt) {
          m.goneAt = now;
          emitBurst(m.e.pos.x, m.e.pos.y, m.e.pos.z, "#ffd98a", 16, 4);
        }
        if (now - m.goneAt > 900) {
          const k = enemies.indexOf(m.e);
          if (k >= 0) enemies.splice(k, 1);
          S.moths.splice(i, 1);
        }
      } else alive++;
    }
    const role = encRole(seed);
    let r: string | null = null;
    if (!S.ended && role === "guest") {
      // khách: áp gói của chủ; dựng lại bướm khi sang đợt mới; bướm chủ đã hạ thì tắt; suy sự kiện để thưởng riêng
      const sl = encSlot(seed);
      if (sl && sl.state && sl.ver !== S.ver) {
        S.ver = sl.ver;
        const pk = sl.state as LnPack;
        applyLantern(ev, pk, shiftNow());
        S.ox += (pk.ox - S.ox) * 0.5;
        S.oz += (pk.oz - S.oz) * 0.5;
        if (ev.state === "wave" && Math.abs(ev.waveAt - S.builtWaveAt) > 40) {
          S.builtWaveAt = ev.waveAt;
          for (const m of S.moths) {
            const k = enemies.indexOf(m.e);
            if (k >= 0) enemies.splice(k, 1);
          }
          S.moths.length = 0;
          for (let i = 0; i < pk.n && i < MAXM; i++) spawnMoth(i, pk.n, ev.wave, true);
        }
        for (const m of S.moths) if (!m.e.deadAt && !(pk.al & (1 << m.idx))) m.e.deadAt = now;
      }
      const st = ev.state;
      if (st !== S.seenState) {
        if (st === "wave") r = "spawn-fx";
        else if (st === "gap" && S.seenState === "wave") r = "cleared";
        else if (st === "done") r = "done";
        else if (st === "failed") r = "failed";
        S.seenState = st;
      }
    } else if (!S.ended) {
      r = tickEvent(ev, now, dt * 1000, alive, Math.hypot(p.x - ev.cx, p.z - ev.cz), DAY.night.value >= 0.35);
      if (role === "host") {
        const hits = encTakeHits(seed);
        if (hits)
          for (const h of hits) {
            const m = S.moths.find((q) => `m${q.idx}` === h.k && !q.e.deadAt);
            if (!m) continue;
            m.e.hp -= h.d;
            if (m.e.hp <= 0) m.e.deadAt = now;
          }
        if (now - S.sentAt > 125) {
          S.sentAt = now;
          let mask = 0;
          for (const m of S.moths) if (!m.e.deadAt) mask |= 1 << m.idx;
          encSend(seed, packLantern(ev, S.ox, S.oz, S.waveN, mask, shiftNow()));
        }
      }
    }
    const lang = w.lang;
    if (r === "spawn-fx") sfx.chime(2);
    if (r === "spawn") {
      // ngân sách: tổng diễn viên chiến đấu ≤ 24
      let live = 0;
      for (const e of enemies) if (!e.deadAt && e.kind !== "moth") live++;
      const n = waveSize(ev.wave, live);
      S.waveN = Math.min(n, MAXM);
      for (let i = 0; i < n && S.moths.length < MAXM; i++) spawnMoth(i, n, ev.wave, false);
      sfx.chime(2);
    } else if (r === "cleared" || r === "done") {
      const n = LN.REWARD[Math.min(ev.wave, LN.REWARD.length - 1)] + (r === "done" ? 2 : 0);
      spawnDrop("phase_silk", n, p.x, p.y + 1.2, p.z);
      sfx.chime(5);
      toast(r === "done" ? `${tt(lang, "evDone")} ${tt(lang, "evCleared", { n })}` : tt(lang, "evCleared", { n }), "win");
      if (r === "done") {
        S.doneAt = now;
        sfx.fanfare();
      }
    } else if (r === "failed") {
      toast(tt(lang, "evFailed"), "warn");
      S.doneAt = now;
    }
    if (!S.ended && (ev.state === "done" || ev.state === "failed") && now - S.doneAt > (ev.state === "done" ? 9000 : 2500)) {
      S.ended = true;
      if (role === "host") encSend(seed, packLantern(ev, S.ox, S.oz, S.waveN, 0, shiftNow()));
      encEnd(seed, ev.state === "done" ? "win" : "retreat");
      onEnd();
      return;
    }
    // trận đã kết thúc ở chủ (chủ rời, không ai thay) → tắt sự kiện ở máy này
    const slot = role === "solo" ? encSlot(seed) : null;
    if (!S.ended && slot?.ended && ev.state !== "done") {
      S.ended = true;
      toast(tt(lang, "evFailed"), "warn");
      onEnd();
      return;
    }

    // tâm bay vòng đuổi theo người chơi chậm (0,8 m/s) — khách nhận tâm từ chủ
    const dx = p.x - S.ox;
    const dz = p.z - S.oz;
    const dd = Math.hypot(dx, dz);
    if (dd > 0.5 && role !== "guest") {
      const k = Math.min(dd, 0.8 * dt) / dd;
      S.ox += dx * k;
      S.oz += dz * k;
    }
    // bướm: vòng tròn + nhấp nhô tuần hoàn; chạm đáy gần người chơi → cắn
    const tw = (now - ev.waveAt) / 1000;
    const bm = bodies.current;
    const wm = wings.current;
    const lm = lamps.current;
    const rm = rings.current;
    let n = 0;
    for (const m of S.moths) {
      const e = m.e;
      const th = m.th0 + LN.OMEGA * tw;
      const x = S.ox + Math.cos(th) * m.r;
      const z = S.oz + Math.sin(th) * m.r;
      const gy = ENV.ground(x, z);
      const h = mothHeight(tw, m.T, 0);
      if (!e.deadAt) e.pos.set(x, gy + h, z);
      const kNow = Math.floor(tw / m.T + 1e-6);
      if (!e.deadAt && kNow > m.k) {
        m.k = kNow;
        if (Math.hypot(p.x - x, p.z - z) <= LN.DIVE_R && Math.abs(p.y - gy) < 2) {
          V1.set(x, gy, z);
          playerHurt(LN.DIVE_DMG, V1);
        }
      }
      if (!bm || !wm || !lm || !rm || n >= MAXM) continue;
      const dying = e.deadAt ? Math.max(0.001, 1 - (now - e.deadAt) / 600) : 1;
      const col = periodColor(m.T);
      // độ gần đáy: 1 lúc chạm đáy → đèn sáng rực, vòng sà đậm
      const phase = (tw / m.T) % 1;
      const near = Math.max(0, 1 - Math.min(phase, 1 - phase) * m.T / 0.6);
      DUMMY.position.copy(e.pos);
      DUMMY.rotation.set(0, -th, 0);
      DUMMY.scale.setScalar(dying);
      DUMMY.updateMatrix();
      bm.setMatrixAt(n, DUMMY.matrix);
      bm.setColorAt(n, col);
      const flap = Math.sin(time * 14 + n) * 0.7;
      for (let s = 0; s < 2; s++) {
        // cánh trái = cánh phải lật gương qua mặt phẳng giữa thân (giữ đúng mép trước / sau của cánh)
        DUMMY.rotation.set(0, -th, (s ? -1 : 1) * flap, "YXZ");
        DUMMY.scale.set(s ? -dying : dying, dying, dying);
        DUMMY.updateMatrix();
        wm.setMatrixAt(n * 2 + s, DUMMY.matrix);
        wm.setColorAt(n * 2 + s, col);
      }
      DUMMY.position.set(e.pos.x, e.pos.y - 0.42, e.pos.z);
      DUMMY.rotation.set(0, 0, 0);
      DUMMY.scale.setScalar(dying * (1 + near * 0.6));
      DUMMY.updateMatrix();
      lm.setMatrixAt(n, DUMMY.matrix);
      lm.setColorAt(n, TMPC.copy(col).multiplyScalar(1.4 + 2.2 * near));
      DUMMY.position.set(x, gy + 0.06, z);
      DUMMY.scale.setScalar(LN.DIVE_R * (e.deadAt ? 0.001 : 1));
      DUMMY.updateMatrix();
      rm.setMatrixAt(n, DUMMY.matrix);
      rm.setColorAt(n, TMPC.copy(col).multiplyScalar(0.15 + 0.85 * near));
      n++;
    }
    for (const mesh of [bm, wm, lm, rm]) {
      if (!mesh) continue;
      mesh.count = mesh === wm ? n * 2 : n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const SU = R.SU;
    SU.uTime.value = time;
    S.boost += ((ev.state === "done" ? 1 : 0) - S.boost) * Math.min(1, dt);
    SU.uBoost.value = S.boost;
    SU.uFade.value = Math.min(1, SU.uFade.value + dt * 0.5) * (S.ended || (ev.state === "failed" && now - S.doneAt > 1500) ? 0 : 1);
    SU.uCenter.value.set(ev.cx, baseY, ev.cz);
    if (alive > 0 && now - S.bumpAt > 1800) {
      S.bumpAt = now;
      bumpCombat(0.3);
    }
    // HUD
    if (now - S.hudAt > 150) {
      S.hudAt = now;
      const ps = ev.wave === 2 ? [2, 3] : [mothPeriod(ev.wave, 0)];
      const l = lcmPeriods(ps);
      useEventUi.setState({ on: true, wave: ev.wave + 1, waves: LN.WAVES.length, left: alive, state: ev.state, periods: ps, sync: ev.state === "wave" ? Math.round((l - (tw % l)) * 10) / 10 : 0 });
    }
  });

  return (
    <group>
      <mesh geometry={R.skyGeo} material={R.skyMat} frustumCulled={false} renderOrder={6} />
      <instancedMesh ref={bodies} args={[R.bodyGeo, R.bodyMat, MAXM]} frustumCulled={false} />
      <instancedMesh ref={wings} args={[R.wingGeo, R.wingMat, MAXM * 2]} frustumCulled={false} />
      <instancedMesh ref={lamps} args={[R.lampGeo, R.lampMat, MAXM]} frustumCulled={false} />
      <instancedMesh ref={rings} args={[R.ringGeo, R.ringMat, MAXM]} frustumCulled={false} renderOrder={4} />
    </group>
  );

  /** sinh bướm thứ i / n của đợt (bố trí tất định — chủ và khách giống hệt); khách: đòn gửi cho chủ */
  function spawnMoth(i: number, n: number, wave: number, guest: boolean) {
    const { th0, r: rr } = mothSlot(i, n, LN.R_MIN, LN.R_MAX);
    const e = spawnEnemy("moth", new THREE.Vector3(S.ox + Math.cos(th0) * rr, baseY + 3, S.oz + Math.sin(th0) * rr));
    e.ext = guest ? { mul: mothMul, boss: (_e, amount) => encHit(seed, `m${i}`, amount) } : { mul: mothMul };
    S.moths.push({ idx: i, e, th0, r: rr, T: mothPeriod(wave, i), k: 0, goneAt: 0 });
  }

  /** đòn có tới được độ cao của bướm không (cận chiến: từ chân người chơi; tên: ngay vị trí mũi tên) */
  function mothMul(e: Enemy, from: THREE.Vector3, now: number): number {
    if (e.pos.y - from.y <= LN.REACH_Y + 0.2) return 1;
    if (now - S.infoAt > 700) {
      S.infoAt = now;
      floatText(V1.set(e.pos.x, e.pos.y + 0.6, e.pos.z), tt(useWorld.getState().lang, "evHigh"), "info");
      sfx.miss();
    }
    return -1;
  }
}
