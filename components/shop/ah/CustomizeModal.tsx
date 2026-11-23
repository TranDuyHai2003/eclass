"use client";

import { useState } from "react";
import { ITEMS } from "@/lib/game/items";
import type { AvatarConfig } from "@/lib/game/avatar";
import { play } from "@/lib/sound";
import { Nameplate } from "@/components/studio/Nameplate";
import { AvatarRing, FrameOverlay, PlateBox } from "./parts";

const FRAMES = ITEMS.filter((i) => i.slot === "frame");
const PLATES = ITEMS.filter((i) => i.slot === "nameplate");

/** "Tùy chỉnh hồ sơ & bảng tên" (canvas v2): chọn viền avatar + bảng tên đã sở hữu; món chưa có / chưa đủ cấp thì khoá */
export function CustomizeModal({ avatar, owned, level, name, grade, pending, onCancel, onSave }: {
  avatar: AvatarConfig;
  owned: Set<string>;
  level: number;
  name: string | null;
  grade: number | null;
  pending: boolean;
  onCancel: () => void;
  onSave: (next: { frame: string | null; nameplate: string | null }) => void;
}) {
  const [frame, setFrame] = useState<string | null>(avatar.frame ?? null);
  const [plate, setPlate] = useState<string | null>(avatar.nameplate ?? null);
  const preview = { ...avatar, frame, nameplate: plate };
  const dark = (id: string | null) => !!id && ITEMS.find((i) => i.id === id)?.v2 === "dark";
  const lockOf = (id: string, minLevel?: number) => ((minLevel ?? 0) > level ? `Lv.${minLevel}` : owned.has(id) ? null : "Chưa có");
  return (
    <div className="fixed inset-0 z-[62] flex items-center justify-center bg-[rgba(36,30,26,0.55)] p-4" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label="Tùy chỉnh hồ sơ" data-testid="customize" className="ah-dialog ah-panel v2-pop flex max-h-[90vh] w-full max-w-[580px] flex-col gap-4 overflow-y-auto p-[22px]">
        <h2 className="ah-hand text-[22px] font-bold">Tùy chỉnh hồ sơ &amp; bảng tên</h2>
        <PlateBox id={plate} className="rounded-[18px] shadow-none">
          <div className="flex min-h-20 items-center gap-3 px-4 py-2.5">
            <AvatarRing config={preview} size={58} inset={11} />
            <div className={dark(plate) ? "text-white" : "text-[#1E1B2E]"}>
              <div className="ah-hand text-[17px] font-bold">{name || "Học sinh"}</div>
              <div className="text-xs font-extrabold">{grade ? `Khối ${grade} · ` : ""}Xem trước trên Bảng Vàng</div>
            </div>
          </div>
        </PlateBox>
        <div className="flex flex-col gap-2">
          <span className="ah-hand font-bold">Chọn viền avatar (mở khóa theo level)</span>
          <div className="flex flex-wrap gap-2">
            <Opt on={!frame} label="Không dùng viền" onClick={() => setFrame(null)}><span className="text-[11px] font-black">Không</span></Opt>
            {FRAMES.map((f) => {
              const lock = lockOf(f.id, f.minLevel);
              return (
                <Opt key={f.id} on={frame === f.id} lock={lock} label={`${f.name}${lock ? `, ${lock === "Chưa có" ? "chưa có" : `cần ${lock}`}` : ""}`} onClick={() => setFrame(f.id)}>
                  <span className="absolute inset-1"><FrameOverlay frameId={f.id} size={52} /></span>
                </Opt>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="ah-hand font-bold">Chọn hiệu ứng bảng tên</span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            <Opt wide on={!plate} label="Không dùng bảng tên" onClick={() => setPlate(null)}><span className="text-xs font-black">Không</span></Opt>
            {PLATES.map((p) => {
              const lock = lockOf(p.id, p.minLevel);
              return (
                <Opt key={p.id} wide on={plate === p.id} lock={lock} label={`${p.name}${lock ? `, ${lock === "Chưa có" ? "chưa có" : `cần ${lock}`}` : ""}`} onClick={() => setPlate(p.id)}>
                  <Nameplate id={p.id} className="absolute inset-0 rounded-none" />
                </Opt>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => { play("click"); onCancel(); }} className="ah-btn ah-cream h-12 flex-1">Hủy</button>
          <button type="button" data-testid="customize-save" disabled={pending} onClick={() => onSave({ frame, nameplate: plate })} className="ah-btn ah-gold h-12 flex-[2] text-base">Lưu</button>
        </div>
      </div>
    </div>
  );
}

function Opt({ on, lock, label, wide, onClick, children }: { on: boolean; lock?: string | null; label: string; wide?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      disabled={!!lock}
      onClick={() => { play("click"); onClick(); }}
      className={`relative flex items-center justify-center overflow-hidden bg-[#fffaf0] p-0 ${wide ? "h-[42px] rounded-xl" : "h-[62px] w-[62px] rounded-2xl"} ${lock ? "cursor-not-allowed" : "cursor-pointer"}`}
      style={on ? { border: "3px solid #ea6a51", boxShadow: "0 3px 0 #241e1a" } : { border: "2.5px solid #241e1a" }}
    >
      {children}
      {lock && <span className="absolute inset-0 flex items-center justify-center bg-[rgba(36,30,26,0.5)] text-[11px] font-black text-[#fffdf8]">{lock}</span>}
    </button>
  );
}
