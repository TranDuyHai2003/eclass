"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ShopModal } from "./ShopModal";
import { ITEM_BY_ID, RARITY_LABEL, SLOTS, type Item } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import { Chibi } from "@/components/avatar/Chibi";
import { PetImage } from "@/components/studio/CutArt";

type Redemption = StudentPointsPageData["redemptions"][number];
type Tab = "all" | "gifts" | "frames" | "pets";

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Chờ nhận quà", cls: "bg-[#fff1c2] text-[#7c4a03]" },
  DELIVERED: { label: "Đã nhận", cls: "bg-[#d6f3cf] text-[#1f6b22]" },
  CANCELLED: { label: "Đã huỷ", cls: "bg-slate-100 text-slate-500" },
  REJECTED: { label: "Bị từ chối", cls: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Hết hạn", cls: "bg-slate-100 text-slate-500" },
};
const fmtDate = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));

/** "Túi đồ đã sở hữu": quà & thẻ đã đổi (trạng thái), đồ trang trí (Dùng / Đang chọn), mèo cưng */
export function InventoryModal({
  open, onOpenChange, inline, redemptions, owned, avatar, pending, onEquip, onCancel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Hiện như một khối trong trang (mục Túi đồ của tiệm) thay vì hộp thoại */
  inline?: boolean;
  redemptions: Redemption[];
  owned: string[];
  avatar: AvatarConfig;
  pending: boolean;
  onEquip: (item: Item) => void;
  onCancel: (redemptionId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const items = owned.map((id) => ITEM_BY_ID[id]).filter(Boolean);
  const cosmetics = items.filter((i) => i.slot !== "pet");
  const pets = items.filter((i) => i.slot === "pet");
  const total = redemptions.length + items.length;
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "gifts", label: "Quà & Thẻ" },
    { key: "frames", label: "Trang trí" },
    { key: "pets", label: "Mèo Cún" },
  ];
  const showGifts = tab === "all" || tab === "gifts";
  const showCos = tab === "all" || tab === "frames";
  const showPets = tab === "all" || tab === "pets";
  const slotLabel = (s: Item["slot"]) => SLOTS.find((x) => x.key === s)?.label ?? s;

  return (
    <ShopModal open={open} onOpenChange={onOpenChange} inline={inline} title={`🎒 Túi Đồ Đã Sở Hữu (${total})`} testId="inventory-modal" className="sm:max-w-2xl">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key} className={cn("btn-pill px-3 py-1 text-xs", tab === t.key && "btn-pill-yellow")}>
            {t.label}
          </button>
        ))}
      </div>
      {total === 0 && <p className="rounded-2xl bg-[#fff1c2] p-5 text-center text-sm font-semibold text-[#7a5a35]">Túi còn trống. Đổi quà hoặc mua đồ trang trí để lấp đầy nhé!</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {showGifts &&
          redemptions.map((r) => {
            const st = STATUS[r.status] ?? STATUS.CANCELLED;
            return (
              <div key={r.id} data-testid="redemption" className="flex items-center gap-2 rounded-2xl border-2 border-[#5b3d1e]/50 bg-white p-2">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fff1c2] text-2xl">{r.reward.emoji || "🎁"}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#3b2a14]">{r.reward.title}</p>
                  <p className="text-[11px] font-semibold text-[#7a5a35]">{fmtDate(r.createdAt)} · 💰 {r.price.toLocaleString("vi-VN")}{r.note ? ` · ${r.note}` : ""}</p>
                  <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-black", st.cls)}>{st.label}</span>
                </div>
                {r.status === "PENDING" && (
                  <button type="button" disabled={pending} onClick={() => onCancel(r.id)} className="btn-pill shrink-0 px-2.5 py-1 text-[11px]">
                    Huỷ
                  </button>
                )}
              </div>
            );
          })}
        {showCos &&
          cosmetics.map((item) => {
            const on = avatar[item.slot] === item.id;
            return (
              <div key={item.id} className={cn("flex items-center gap-2 rounded-2xl border-2 bg-white p-2", on ? "border-[#4fae4a]" : "border-[#5b3d1e]/50")}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eef6ff]">
                  <Chibi config={{ ...avatar, [item.slot]: item.id }} size={44} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#3b2a14]">{item.name}</p>
                  <p className="text-[11px] font-semibold text-[#7a5a35]">{slotLabel(item.slot)} · {RARITY_LABEL[item.rarity]}</p>
                </div>
                <button type="button" disabled={pending || on} data-testid={`equip-${item.id}`} onClick={() => onEquip(item)} className={cn("btn-pill shrink-0 px-2.5 py-1 text-[11px]", on ? "btn-pill-green" : "btn-pill-yellow")}>
                  {on ? "Đang chọn" : "Dùng"}
                </button>
              </div>
            );
          })}
        {showPets &&
          pets.map((item) => {
            const on = avatar.pet === item.id;
            return (
              <div key={item.id} className={cn("flex items-center gap-2 rounded-2xl border-2 bg-white p-2", on ? "border-[#4fae4a]" : "border-[#5b3d1e]/50")}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fff1c2]"><PetImage id={item.id} size={44} className="h-11 w-11" /></span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-black text-[#3b2a14]">{item.name}</p>
                  <p className="text-[11px] font-semibold text-[#7a5a35]">Mèo Cún · {RARITY_LABEL[item.rarity]}</p>
                </div>
                <button type="button" disabled={pending || on} data-testid={`equip-${item.id}`} onClick={() => onEquip(item)} className={cn("btn-pill shrink-0 px-2.5 py-1 text-[11px]", on ? "btn-pill-green" : "btn-pill-yellow")}>
                  {on ? "Đang chọn" : "Dùng"}
                </button>
              </div>
            );
          })}
      </div>
    </ShopModal>
  );
}
