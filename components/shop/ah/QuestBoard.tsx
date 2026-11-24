"use client";

import { ITEM_BY_ID } from "@/lib/game/items";
import { QUESTS } from "@/lib/game/quests-shared";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";

export type QuestRow = { itemId: string; at: string; expiresAt: string | null };

const RAR_BG: Record<string, string> = { common: "#eef8ec", rare: "#e8f4fd", epic: "#f4ecff", legendary: "#fff1c9" };
const dateVi = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
const hoursLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3600000));

/** Bảng "Nhiệm vụ ẩn": ô đã mở hiện biệt danh + cách đạt + ngày mở (đeo được), ô chưa mở hiện ??? + gợi ý mơ hồ */
export function QuestBoard({ quests, equipped, pending, onEquip, onClose }: {
  quests: QuestRow[];
  equipped: string | null | undefined;
  pending: boolean;
  onEquip: (itemId: string) => void;
  onClose: () => void;
}) {
  const got = new Map(quests.map((q) => [q.itemId, q]));
  return (
    <div className="fixed inset-0 z-[62] flex items-end justify-center bg-[rgba(36,30,26,0.55)] sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="quest-title" data-testid="quest-board" className="ah-dialog ah-panel v2-pop flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-[760px] sm:rounded-b-[26px]">
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-[#efe3cc] px-4 py-3 sm:px-5">
          <h2 id="quest-title" className="ah-hand flex-1 text-[22px] font-bold">🕵️ Nhiệm vụ ẩn <span className="text-base text-[#9e6b3f]">({got.size}/{QUESTS.length})</span></h2>
          <button type="button" aria-label="Đóng" data-testid="quest-close" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-[2.5px] border-[#241e1a] bg-[#ef5b4c] text-lg font-black text-white shadow-[0_3px_0_#241e1a]">×</button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-5">
          <p className="mb-3 text-[13px] font-bold text-[#6e4722]">Làm đúng điều bí mật là tự nhận biệt danh hài hước, hiện trên hồ sơ và Bảng Vàng. Ô ??? là nhiệm vụ chưa ai bật mí cho bạn — đoán qua gợi ý nhé!</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {QUESTS.map((q) => {
              const row = got.get(q.itemId);
              const item = ITEM_BY_ID[q.itemId];
              const on = equipped === q.itemId;
              return row ? (
                <div key={q.id} data-testid="quest-card" data-quest={q.id} data-open="true" className="flex flex-col gap-1.5 rounded-[18px] border-[2.5px] border-[#241e1a] p-3 shadow-[0_3px_0_#241e1a]" style={{ background: RAR_BG[item?.rarity ?? "common"] }}>
                  <b className="ah-hand text-[15px] leading-snug">{item?.name}</b>
                  <span className="text-[12px] font-bold text-[#6e4722]">{q.how}</span>
                  <span className="text-[11px] font-extrabold text-[#9e6b3f]">
                    Mở ngày {dateVi(row.at)}{row.expiresAt ? ` · còn ${hoursLeft(row.expiresAt)} giờ` : ""}
                  </span>
                  <button type="button" disabled={pending || on} data-testid={`quest-equip-${q.id}`} onClick={() => { play("click"); onEquip(q.itemId); }} className={cn("ah-btn mt-auto h-9 text-[13px]", on ? "ah-mint" : "ah-cream")}>
                    {on ? "✓ Đang đeo" : "Đeo biệt danh"}
                  </button>
                </div>
              ) : (
                <div key={q.id} data-testid="quest-card" data-quest={q.id} data-open="false" className="flex flex-col items-center justify-center gap-1.5 rounded-[18px] border-[2.5px] border-dashed border-[#c9b08a] bg-[#fffdf8] p-3 text-center">
                  <span className="ah-hand text-2xl font-bold text-[#c9b08a]" aria-hidden>???</span>
                  <span className="text-[12px] font-bold italic text-[#9e6b3f]">{q.hint}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hộp chúc mừng khi có biệt danh mới (so với các biệt danh máy này đã thấy) */
export function QuestUnlocked({ itemIds, onClose, onOpenBoard }: { itemIds: string[]; onClose: () => void; onOpenBoard: () => void }) {
  return (
    <div className="fixed inset-0 z-[64] flex items-center justify-center bg-[rgba(36,30,26,0.6)] p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Hoàn thành nhiệm vụ ẩn" data-testid="quest-unlocked" className="ah-dialog ah-panel v2-pop flex w-full max-w-[420px] flex-col items-center gap-3 p-6 text-center">
        <span className="rounded-full border-2 border-[#241e1a] bg-[#fbd048] px-3 py-0.5 text-xs font-black">NHIỆM VỤ ẨN</span>
        <h2 className="ah-hand text-[24px] font-bold">Hoàn thành nhiệm vụ ẩn!</h2>
        {itemIds.map((id) => {
          const q = QUESTS.find((x) => x.itemId === id);
          return (
            <div key={id} className="w-full rounded-[16px] border-[2.5px] border-[#241e1a] bg-[#fff6db] px-4 py-3 shadow-[0_3px_0_#241e1a]">
              <b className="ah-hand block text-lg">{ITEM_BY_ID[id]?.name}</b>
              {q && <span className="text-[12px] font-bold text-[#6e4722]">{q.how}</span>}
            </div>
          );
        })}
        <p className="text-[12px] font-bold text-[#6e4722]">Biệt danh đã tự đeo lên hồ sơ và Bảng Vàng — muốn đổi thì vào bảng Nhiệm vụ ẩn.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onOpenBoard} className="ah-btn ah-cream h-11 px-4">Xem bảng nhiệm vụ</button>
          <button type="button" data-testid="quest-unlocked-ok" onClick={onClose} className="ah-btn ah-gold h-11 px-5">Tuyệt vời!</button>
        </div>
      </div>
    </div>
  );
}
