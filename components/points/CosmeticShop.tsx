"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Backpack, Loader2, Lock, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { buyItem } from "@/actions/avatar";
import { ITEMS, RARITY_LABEL, SLOTS, type Item } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { RARITY } from "@/lib/points/rarity";
import { play } from "@/lib/sound";
import { Chibi } from "@/components/avatar/Chibi";
import { CoinBurst } from "@/components/game/CoinBurst";

/** Tab "Trang trí hồ sơ" trong tiệm: mua đồ cho nhân vật bằng xu/ngọc; món chỉ từ rương hiện khoá */
export function CosmeticShop({ avatar, owned: ownedInit, balance, gems, canEarn }: { avatar: AvatarConfig; owned: string[]; balance: number; gems: number; canEarn: boolean }) {
  const router = useRouter();
  const [owned, setOwned] = useState(() => new Set(ownedInit));
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const items = ITEMS.filter((i) => !i.free);
  const slotLabel = (s: Item["slot"]) => SLOTS.find((x) => x.key === s)?.label ?? s;

  const purchase = (item: Item) => {
    setBuying(item.id);
    start(async () => {
      const res = await buyItem(item.id);
      setBuying(null);
      if (res.success) {
        play("coin");
        setTimeout(() => play("success"), 200);
        setBurst((n) => n + 1);
        setOwned((o) => new Set([...o, item.id]));
        toast.success(res.message);
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-3" data-testid="cosmetic-shop">
      <CoinBurst burst={burst} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-violet-200 bg-violet-50 px-3 py-2">
        <p className="text-sm font-bold text-violet-800">Đồ mua xong tự vào túi; vào <b>Tuỳ chỉnh nhân vật</b> để mặc.</p>
        <Link href="/profile/avatar" data-testid="open-editor" className="btn-3d btn-3d-blue px-3 py-1.5 text-xs">
          <Backpack className="h-3.5 w-3.5" /> Túi đồ ({owned.size}) · Tuỳ chỉnh
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {items.map((item) => {
          const rar = RARITY[item.rarity];
          const own = owned.has(item.id);
          const price = item.price;
          const affordable = price ? ("xu" in price ? balance >= price.xu : gems >= price.gem) : false;
          return (
            <div key={item.id} data-testid="item-card" data-item={item.id} className={cn("group relative flex flex-col rounded-3xl border-2 bg-white p-2 transition-transform duration-200 hover:-translate-y-1", rar.card)}>
              <div className={cn("dots-bg relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br", rar.art)} style={{ "--dot": rar.dot } as React.CSSProperties}>
                <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", rar.chip)}>{RARITY_LABEL[item.rarity]}</span>
                <span className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-600">{slotLabel(item.slot)}</span>
                <Chibi config={{ ...avatar, [item.slot]: item.id }} size={84} className="group-hover-float" />
              </div>
              <div className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5">
                <p className="line-clamp-1 font-black leading-snug text-slate-900">{item.name}</p>
                <div className="mt-auto pt-2">
                  {own ? (
                    <span className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-50 py-1.5 text-xs font-black text-emerald-700">✓ Đã có</span>
                  ) : item.gachaOnly ? (
                    <span className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-violet-50 py-1.5 text-xs font-black text-violet-700">
                      <Lock className="h-3.5 w-3.5" /> Chỉ từ rương
                    </span>
                  ) : (
                    <button
                      type="button"
                      data-testid={`shop-buy-${item.id}`}
                      disabled={pending || !affordable || !canEarn}
                      onClick={() => purchase(item)}
                      title={!canEarn ? "Tài khoản cần được thầy duyệt" : !affordable ? "Chưa đủ tiền" : "Mua"}
                      className={cn("btn-3d h-9 w-full text-xs", affordable && canEarn ? "btn-3d-amber btn-shine" : "btn-3d-muted")}
                    >
                      {buying === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
                      {price && "xu" in price ? `🪙 ${price.xu.toLocaleString("vi-VN")} xu` : `💎 ${(price as { gem: number }).gem} ngọc`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
