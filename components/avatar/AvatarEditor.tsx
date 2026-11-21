"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Lock, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buyItem, saveAvatar } from "@/actions/avatar";
import { ITEM_BY_ID, RARITY_LABEL, SLOTS, itemsOfSlot, type Item, type Slot } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { RARITY } from "@/lib/points/rarity";
import { play } from "@/lib/sound";
import { Chibi } from "./Chibi";
import { CoinBurst } from "@/components/game/CoinBurst";
import { Confetti } from "@/components/points/Confetti";
import { SoundToggle } from "@/components/game/SoundToggle";

/** Trình tuỳ chỉnh nhân vật: xem trước trực tiếp, chọn theo ô, mua món chưa có ngay tại chỗ */
export function AvatarEditor({
  initial,
  owned: ownedInit,
  wallet,
  canEarn,
  userId,
}: {
  initial: AvatarConfig;
  owned: string[];
  wallet: { balance: number; gems: number };
  canEarn: boolean;
  userId: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<AvatarConfig>(initial);
  const [saved, setSaved] = useState<AvatarConfig>(initial);
  const [owned, setOwned] = useState<Set<string>>(() => new Set(ownedInit));
  const [balance, setBalance] = useState(wallet.balance);
  const [gems, setGems] = useState(wallet.gems);
  const [slot, setSlot] = useState<Slot>("hair");
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [confetti, setConfetti] = useState(0);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const items = useMemo(() => itemsOfSlot(slot), [slot]);
  const optional = SLOTS.find((s) => s.key === slot)?.optional;

  const equip = (item: Item | null) => {
    play("click");
    setConfig((c) => ({ ...c, [slot]: item?.id ?? null }));
  };

  const purchase = (item: Item) =>
    start(async () => {
      const res = await buyItem(item.id);
      if (res.success) {
        play("coin");
        setTimeout(() => play("success"), 200);
        setBurst((n) => n + 1);
        setOwned((o) => new Set([...o, item.id]));
        const price = item.price;
        if (price && "xu" in price) {
          const xu = price.xu;
          setBalance((b) => b - xu);
        } else if (price) {
          const gem = price.gem;
          setGems((g) => g - gem);
        }
        setConfig((c) => ({ ...c, [slot]: item.id }));
        toast.success(res.message);
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  const save = () =>
    start(async () => {
      const res = await saveAvatar(config);
      if (res.success) {
        play("levelup");
        setConfetti((n) => n + 1);
        setSaved(res.config ?? config);
        toast.success(res.message);
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  return (
    <div className="space-y-4" data-testid="avatar-editor">
      <CoinBurst burst={burst} />
      <Confetti burst={confetti} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 sm:text-2xl">
            <span className="h-7 w-2 rounded-full bg-blue-600" /> Tuỳ chỉnh nhân vật
          </h1>
          <p className="text-sm font-medium text-slate-500">Chọn tóc, mắt, trang phục… Món có khoá thì mua bằng xu hoặc ngọc.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/profile/${userId}`} className="btn-3d btn-3d-white px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Hồ sơ
          </Link>
          <SoundToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Xem trước */}
        <div className="h-fit rounded-3xl border-2 border-blue-100/80 bg-white p-4 shadow-[0_4px_0_0_#e3ecff] lg:sticky lg:top-24">
          <div className="dots-bg flex items-center justify-center rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 p-3" style={{ "--dot": "rgba(37,99,235,.12)" } as React.CSSProperties}>
            <Chibi config={config} size={200} className="animate-float" />
          </div>
          {config.title && <p className="mt-2 text-center text-sm font-black text-violet-700">🏷️ {ITEM_BY_ID[config.title]?.name}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-amber-50 px-2 py-2">
              <p className="text-lg font-black text-amber-700 tabular-nums" data-testid="editor-xu">🪙 {balance.toLocaleString("vi-VN")}</p>
              <p className="text-[11px] font-bold text-amber-600">xu</p>
            </div>
            <div className="rounded-2xl bg-pink-50 px-2 py-2">
              <p className="text-lg font-black text-pink-700 tabular-nums">💎 {gems}</p>
              <p className="text-[11px] font-bold text-pink-600">ngọc</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="avatar-save"
            disabled={pending || !dirty}
            onClick={save}
            className={cn("btn-3d mt-3 h-11 w-full text-sm", dirty ? "btn-3d-blue btn-shine" : "btn-3d-muted")}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {dirty ? "Lưu nhân vật" : "Đã lưu"}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Bạn có {owned.size} món trong túi đồ</p>
        </div>

        {/* Chọn món */}
        <div className="min-w-0 space-y-3">
          <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap rounded-2xl border-2 border-slate-200/80 bg-slate-100/80 p-1.5" role="tablist">
            {SLOTS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={slot === s.key}
                data-testid={`slot-${s.key}`}
                onClick={() => { play("tick"); setSlot(s.key); }}
                className={cn(
                  "shrink-0 rounded-xl px-3 py-2 text-[13px] font-black transition-all",
                  slot === s.key ? "bg-white text-blue-700 shadow-[0_3px_0_0_#cbd5e1]" : "text-slate-500 hover:bg-white/60",
                )}
              >
                <span aria-hidden className="mr-1">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {optional && (
              <ItemTile
                selected={!config[slot]}
                onClick={() => equip(null)}
                preview={<span className="text-3xl text-slate-300">✕</span>}
                name="Không dùng"
                footer={<span className="text-[11px] font-bold text-slate-400">Bỏ trống</span>}
              />
            )}
            {items.map((item) => {
              const own = item.free || owned.has(item.id);
              const selected = config[slot] === item.id;
              const price = item.price;
              const affordable = price ? ("xu" in price ? balance >= price.xu : gems >= price.gem) : false;
              const rar = RARITY[item.rarity];
              return (
                <ItemTile
                  key={item.id}
                  testId={`item-${item.id}`}
                  selected={selected}
                  rarity={item.rarity}
                  locked={!own}
                  onClick={() => (own ? equip(item) : undefined)}
                  preview={<Chibi config={{ ...config, [slot]: item.id }} size={72} />}
                  name={item.name}
                  footer={
                    own ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-black", rar.chip)}>{item.free ? "Miễn phí" : RARITY_LABEL[item.rarity]}</span>
                    ) : item.gachaOnly ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">
                        <Lock className="h-3 w-3" /> Chỉ từ rương
                      </span>
                    ) : (
                      <button
                        type="button"
                        data-testid={`buy-${item.id}`}
                        disabled={pending || !affordable || !canEarn}
                        onClick={(e) => { e.stopPropagation(); purchase(item); }}
                        title={!canEarn ? "Tài khoản cần được thầy duyệt" : !affordable ? "Chưa đủ tiền" : "Mua và trang bị"}
                        className={cn("btn-3d px-2.5 py-1 text-[11px]", affordable && canEarn ? "btn-3d-amber btn-shine" : "btn-3d-muted")}
                      >
                        <ShoppingBag className="h-3 w-3" /> {price && "xu" in price ? `${price.xu.toLocaleString("vi-VN")} xu` : `${(price as { gem: number }).gem} ngọc`}
                      </button>
                    )
                  }
                />
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Món &quot;Chỉ từ rương&quot; trúng được ở Rương bí ẩn trong Tiệm quà.
          </p>
        </div>
      </div>
    </div>
  );
}

function ItemTile({
  selected, locked, rarity, onClick, preview, name, footer, testId,
}: {
  selected: boolean; locked?: boolean; rarity?: Item["rarity"]; onClick: () => void; preview: React.ReactNode; name: string; footer: React.ReactNode; testId?: string;
}) {
  const rar = rarity ? RARITY[rarity] : null;
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid={testId}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className={cn(
        "flex flex-col items-center rounded-2xl border-2 bg-white p-2 text-center transition-all",
        selected ? "border-blue-600 shadow-[0_4px_0_0_#1e3a8a]" : rar ? rar.card : "border-slate-200",
        !selected && "hover:-translate-y-0.5",
        locked && "opacity-90",
      )}
    >
      <div className={cn("dots-bg flex h-20 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br", rar ? rar.art : "from-slate-50 to-slate-100")} style={{ "--dot": rar?.dot ?? "#cbd5e1" } as React.CSSProperties}>
        {preview}
      </div>
      <p className="mt-1.5 line-clamp-1 text-xs font-black text-slate-800">{name}</p>
      <div className="mt-1">{footer}</div>
    </div>
  );
}
