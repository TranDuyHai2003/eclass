"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openChest } from "@/actions/gacha";
import { CHESTS, type ChestId, type Outcome } from "@/lib/game/gacha-shared";
import { play } from "@/lib/sound";

export type GachaPhase = "idle" | "shaking" | "reveal";

/**
 * Trạng thái + thao tác mở rương dùng chung cho trang /rewards/gacha và hộp thoại "Đài Cầu Nguyện" trong Tiệm Quà.
 * Kết quả luôn do server trả về (openChest); client chỉ diễn hoạt ảnh tối thiểu ~0,9 giây.
 */
export function useGachaPull({
  wallet: w0, pity: pity0, pullsToday: today0, owned: owned0, initialChest = "xu", onDone,
}: {
  wallet: { balance: number; gems: number };
  pity: number;
  pullsToday: number;
  owned: string[];
  initialChest?: ChestId;
  /** Gọi sau khi lật thẻ (vd cập nhật số dư ở thanh gỗ) */
  onDone?: (r: { outcome: Outcome; wallet?: { balance: number; gems: number } }) => void;
}) {
  const router = useRouter();
  const [wallet, setWallet] = useState(w0);
  const [pity, setPity] = useState(pity0);
  const [today, setToday] = useState(today0);
  const [owned, setOwned] = useState(() => new Set(owned0));
  const [phase, setPhase] = useState<GachaPhase>("idle");
  const [chest, setChest] = useState<ChestId>(initialChest);
  const [result, setResult] = useState<{ outcome: Outcome; guaranteed: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const limit = CHESTS.xu.dailyLimit ?? 0;
  const left = Math.max(0, limit - today);
  const pityMax = CHESTS.xu.pity ?? 5;
  // Khoá đồng bộ: chặn bấm đúp / bấm hộp + nút cùng lúc trước khi React kịp vẽ lại trạng thái disabled (review Gemini GĐ6)
  const inFlight = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const canAfford = (id: ChestId) => {
    const c = CHESTS[id];
    return "xu" in c.cost ? wallet.balance >= c.cost.xu : wallet.gems >= c.cost.gem;
  };

  const open = (id: ChestId) => {
    if (inFlight.current) return;
    if (id === "xu" && limit > 0 && left === 0) {
      play("error");
      toast.error(`Hôm nay đã mở đủ ${limit} lượt Hộp Sao. Mai quay lại nhé!`);
      return;
    }
    if (!canAfford(id)) {
      play("error");
      toast.error("xu" in CHESTS[id].cost ? "Chưa đủ xu để mở rương." : "Chưa đủ ngọc để mở rương.");
      return;
    }
    inFlight.current = true;
    setChest(id);
    setResult(null);
    setPhase("shaking");
    play("click");
    const ticks = [150, 350, 550, 750].map((t) => setTimeout(() => play("tick"), t));
    timers.current.push(...ticks);
    start(async () => {
      const res = await openChest(id);
      ticks.forEach(clearTimeout);
      if (!res.success || !res.outcome) {
        inFlight.current = false;
        setPhase("idle");
        play("error");
        toast.error(res.success ? "Không mở được rương." : res.error);
        return;
      }
      const outcome = res.outcome;
      const reveal = setTimeout(() => {
        inFlight.current = false;
        setResult({ outcome, guaranteed: !!res.guaranteed });
        setPhase("reveal");
        if (res.wallet) setWallet(res.wallet);
        if (typeof res.pity === "number") setPity(res.pity);
        if (id === "xu") setToday((n) => n + 1);
        if (outcome.kind === "item" && !outcome.duplicate) setOwned((o) => new Set([...o, outcome.itemId]));
        play(`reveal-${outcome.rarity}` as Parameters<typeof play>[0]);
        if (outcome.kind !== "item" || outcome.duplicate) setBurst((n) => n + 1);
        if (outcome.rarity === "epic" || outcome.rarity === "legendary") setConfetti((n) => n + 1);
        onDone?.({ outcome, wallet: res.wallet });
        router.refresh();
      }, 900);
      timers.current.push(reveal);
    });
  };

  const reset = () => {
    setPhase("idle");
    setResult(null);
  };

  return { wallet, pity, pityMax, today, limit, left, owned, phase, chest, setChest, result, pending, burst, confetti, open, reset, canAfford };
}
