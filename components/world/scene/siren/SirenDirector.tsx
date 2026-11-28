"use client";
/**
 * Nhạc trưởng của Mê cung Hoạ âm: chỗ DUY NHẤT cập nhật trạng thái hoạ âm dùng chung (lib/world/harmonicState.ts) mỗi khung,
 * từ đồng hồ + máu / pha boss. Mọi thành phần khác (bầu trời cắt dán, con rối giấy, sàn phím, hiệu ứng boss…) chỉ ĐỌC HARMONIC.
 * Gắn TRƯỚC các thành phần đọc (useFrame chạy theo thứ tự gắn trong cùng độ ưu tiên).
 */
import { useFrame } from "@react-three/fiber";
import { HARMONIC, updateHarmonic } from "@/lib/world/harmonicState";

const DEV = typeof window !== "undefined" && process.env.NODE_ENV !== "production";

type BossView = { on: boolean; dead: boolean; hp: number; maxHp: number; phase: number };

/** boss: hàm đọc trạng thái boss (Siren.tsx truyền useBossUi.getState — tránh vòng import) */
export function SirenDirector({ boss }: { boss: () => BossView }) {
  useFrame((st, dt) => {
    const b = boss();
    let hpFrac = b.on && !b.dead ? b.hp / Math.max(1, b.maxHp) : 1;
    let phase = b.on ? b.phase : 1;
    // bản dev: window.__harmonicOverride = { hp: 0…1, phase: 1…3 } để xem phân rã / bất hoà mà không cần đánh boss
    const o = DEV ? (window as unknown as { __harmonicOverride?: { hp: number; phase: number } }).__harmonicOverride : undefined;
    if (o) {
      hpFrac = o.hp;
      phase = o.phase;
    }
    updateHarmonic(HARMONIC, st.clock.elapsedTime, hpFrac, phase, Math.min(dt, 0.1));
  });
  return null;
}
