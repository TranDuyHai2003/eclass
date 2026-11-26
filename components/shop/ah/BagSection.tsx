"use client";

import Link from "next/link";
import { ITEM_BY_ID, SLOTS, type Item } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import type { StudentPointsPageData } from "@/lib/points/queries";
import { rarityOf } from "@/lib/points/rarity";
import { RewardPic } from "./RewardArt";
import { ItemArt, QUICK_EQUIP, RAR_LABEL, fmt } from "./parts";

type Redemption = StudentPointsPageData["redemptions"][number];

const STATUS: Record<string, string> = { PENDING: "Chờ nhận quà", DELIVERED: "Đã nhận", CANCELLED: "Đã huỷ", REJECTED: "Bị từ chối", EXPIRED: "Hết hạn" };
const fmtDate = (iso: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));
const slotLabel = (s: Item["slot"]) => SLOTS.find((x) => x.key === s)?.label ?? s;

/** Mục "Túi đồ của bé" (canvas v2): thẻ theo độ hiếm, ảnh nhỏ, Đang đeo / Trang bị; quà đã đổi có trạng thái + Huỷ */
export function BagSection({ redemptions, owned, avatar, pending, name, onEquip, onCancel }: {
  redemptions: Redemption[];
  owned: string[];
  avatar: AvatarConfig;
  pending: boolean;
  name?: string | null;
  onEquip: (item: Item) => void;
  onCancel: (redemptionId: string) => void;
}) {
  const items = owned.map((id) => ITEM_BY_ID[id]).filter(Boolean);
  const card = "flex items-center gap-3 rounded-[20px] border-[3px] border-[#241e1a] bg-[var(--bg)] p-3 shadow-[0_4px_0_#241e1a]";
  const thumb = "ah-part aspect-square w-[84px] shrink-0";
  return (
    <div data-testid="inventory-modal">
      {redemptions.length + items.length === 0 && <div className="ah-panel ah-hand p-10 text-center text-base">Túi còn trống. Đổi quà hoặc mua đồ trang trí để lấp đầy nhé!</div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3.5">
        {redemptions.map((r) => (
          <div key={r.id} data-testid="redemption" className={`${card} r-${rarityOf(r.price).key}`}>
            <div className={thumb}><RewardPic title={r.reward.title} kind={r.reward.kind} imageUrl={r.reward.imageUrl} className="relative w-[86%]" /></div>
            <div className="min-w-0 flex-1">
              <div className="ah-hand line-clamp-2 text-[15px] font-bold">{r.reward.title}</div>
              <div className="text-xs font-bold text-[#6e4722]">{STATUS[r.status] ?? r.status} · {fmtDate(r.createdAt)} · {fmt(r.price)} xu{r.note ? ` · ${r.note}` : ""}</div>
            </div>
            {r.status === "PENDING" && (
              <button type="button" disabled={pending} onClick={() => onCancel(r.id)} className="ah-btn ah-cream h-9 shrink-0 px-3 text-[13px]">Huỷ</button>
            )}
          </div>
        ))}
        {items.map((it) => {
          const on = avatar[it.slot] === it.id;
          const quick = QUICK_EQUIP.includes(it.slot);
          return (
            <div key={it.id} className={`${card} r-${it.rarity}`}>
              <div className={thumb}><ItemArt it={it} avatar={avatar} name={name} /></div>
              <div className="min-w-0 flex-1">
                <div className="ah-hand line-clamp-2 text-[15px] font-bold">{it.name}</div>
                <div className="text-xs font-bold text-[#6e4722]">{slotLabel(it.slot)} · {RAR_LABEL[it.rarity]}</div>
              </div>
              {on ? (
                <span className="ah-btn ah-mint h-9 shrink-0 cursor-default px-3 text-[13px]">Đang đeo</span>
              ) : quick ? (
                <button type="button" disabled={pending} data-testid={`equip-${it.id}`} onClick={() => onEquip(it)} className="ah-btn ah-cream h-9 shrink-0 px-3 text-[13px]">Trang bị</button>
              ) : (
                <Link href={`/profile?try=${it.id}`} className="ah-btn ah-cream h-9 shrink-0 px-3 text-[13px]">Mặc thử</Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
