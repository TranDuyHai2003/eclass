"use client";
/**
 * Âm thanh theo SỰ KIỆN THẾ GIỚI — đọc trạng thái (không sửa file cảnh / chiến đấu):
 *  - bước chân theo mặt (cỏ / đá / gỗ / giấy / khối voxel), tiếp đất, té nước khi xuống nước, sải bơi — đọc `player` + `motion` mỗi 50 ms;
 *  - hover nút (uỷ quyền pointerover, chỉ chuột, ≥ 90 ms / lần), mở / đóng bảng (đăng ký `overlay`);
 *  - stinger: boss xuất hiện (bossStore.on ↑, Mê cung: vào đấu trường), gục (useCombat.downUntil ↑), cổng (useTransit.travelTo).
 * Trả về hàm dừng.
 */
import { useWorld } from "../store";
import { motion, useCombat } from "../combat/combat";
import { useBossUi } from "../bosses/bossStore";
import { useTransit } from "../ui/transit";
import { sfx } from "@/lib/world/sfx";
import { StrideCounter, surfaceFor } from "@/lib/world/foleyLogic";
import { blockAt } from "@/lib/world/voxels";
import { BLOCKS } from "@/lib/world/blocks";
import { playStinger } from "./stemPlayer";

export function startWorldAudioEvents(): () => void {
  const offs: (() => void)[] = [];
  // ── bước chân / nước ──
  const stride = new StrideCounter();
  let px = NaN;
  let pz = NaN;
  let wasSwim = false;
  let wasGround = true;
  let airT = 0;
  let swimAcc = 0;
  let last = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    const w = useWorld.getState();
    const p = w.player;
    const dx = Number.isFinite(px) ? p.x - px : 0;
    const dz = Number.isFinite(pz) ? p.z - pz : 0;
    px = p.x;
    pz = p.z;
    if (w.overlay) return;
    const scene = w.scene;
    const block = () => {
      if (scene !== "expanse") return null;
      try {
        return BLOCKS[blockAt(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z))] ?? null;
      } catch {
        return null;
      }
    };
    if (motion.swimming && !wasSwim) sfx.splash(Math.min(1.4, Math.abs(motion.vy) / 5 + 0.5));
    wasSwim = motion.swimming;
    if (motion.swimming) {
      swimAcc += Math.hypot(dx, dz);
      if (swimAcc > 1.6) {
        swimAcc = 0;
        sfx.swimStroke();
      }
      return;
    }
    if (!motion.grounded) airT += dt;
    else if (!wasGround && airT > 0.35) sfx.land(surfaceFor(scene, block()), Math.min(1.5, airT));
    if (motion.grounded) airT = 0;
    wasGround = motion.grounded;
    if (stride.step(dx, dz, dt, motion.grounded)) sfx.footstep(surfaceFor(scene, block()), stride.speed);
  }, 50);
  offs.push(() => clearInterval(id));

  // ── giao diện: hover, mở / đóng bảng ──
  let hoverEl: Element | null = null;
  let hoverAt = 0;
  const fine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  const over = (e: PointerEvent) => {
    if (!fine || e.pointerType !== "mouse") return;
    const el = (e.target as Element | null)?.closest?.("button, [role=button], .w-btn");
    if (!el || el === hoverEl || (el as HTMLButtonElement).disabled) return;
    hoverEl = el;
    const now = performance.now();
    if (now - hoverAt < 90) return;
    hoverAt = now;
    sfx.hover();
  };
  document.addEventListener("pointerover", over, { passive: true });
  offs.push(() => document.removeEventListener("pointerover", over));
  offs.push(
    useWorld.subscribe((s, prev) => {
      if (s.overlay === prev.overlay) return;
      if (s.overlay && !prev.overlay) sfx.uiOpen();
      else if (!s.overlay && prev.overlay) sfx.uiBack();
    }),
  );

  // ── stinger ──
  let revealAt = 0;
  offs.push(
    useBossUi.subscribe((s, prev) => {
      if (s.on && !prev.on && performance.now() - revealAt > 20000) {
        revealAt = performance.now();
        playStinger("bossReveal");
      }
    }),
  );
  offs.push(
    useCombat.subscribe((s, prev) => {
      if (s.downUntil > prev.downUntil && s.downUntil > performance.now()) playStinger("defeat");
    }),
  );
  offs.push(
    useTransit.subscribe((s, prev) => {
      if (s.travelTo && s.travelTo !== prev.travelTo) playStinger("portal", 0.8);
    }),
  );
  return () => offs.forEach((f) => f());
}

/** Mê cung Hoạ âm: vào đấu trường boss (gọi từ ZoneMusic khi cờ fight bật) */
let sirenRevealAt = 0;
export function sirenFightStarted() {
  if (performance.now() - sirenRevealAt < 60000) return;
  sirenRevealAt = performance.now();
  playStinger("bossReveal");
}
