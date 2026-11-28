"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";
import { saveChestConfig, saveEarningConfig, saveItemPrices } from "@/actions/game-config";
import type { AvatarConfig } from "@/lib/game/avatar";
import { SLOTS } from "@/lib/game/items";
import {
  CHEST_DEFAULTS,
  CHEST_LIMITS,
  EARNING_DEFAULTS,
  EARNING_FIELDS,
  PRICE_EDITABLE_ITEMS,
  basePriceOf,
  parseVnd,
  vndToXu,
  type GameConfigData,
  type ItemPrice,
} from "@/lib/game/game-config-shared";
import { CoinDot, GemDot, ItemArt, RAR_LABEL, fmt } from "./parts";

/* Khu admin trong Tiệm quà (26/11/2026): sửa giá đồ trang trí theo tiền thật (28/11: mọi loại đồ + giá rương), sửa mức xu các hoạt động. */

const priceText = (p: { xu: number } | { gem: number } | undefined) => (!p ? "—" : "xu" in p ? `${fmt(p.xu)} xu` : `${p.gem} KC`);

type Draft = { mode: "xu" | "gem"; vnd: string; xu?: number; gem: string };
/** Tab theo loại đồ có món sửa giá được (thứ tự: thú cưng, khung, bảng tên trước — hay sửa nhất) + tab Rương */
const FIRST = ["pet", "frame", "nameplate"];
const rank = (k: string) => (FIRST.includes(k) ? FIRST.indexOf(k) : 99);
const SLOT_TABS: [string, string][] = [
  ...SLOTS.filter((sl) => PRICE_EDITABLE_ITEMS.some((i) => i.slot === sl.key))
    .sort((a, b) => rank(a.key) - rank(b.key))
    .map((sl): [string, string] => [sl.key, `${sl.icon} ${sl.label}`]),
  ["chest", "🎁 Rương bí ẩn"],
];

export function ItemPriceManager({ config, avatar }: { config: GameConfigData; avatar: AvatarConfig }) {
  const init = () => {
    const d: Record<string, Draft> = {};
    for (const [id, p] of Object.entries(config.itemPrices ?? {})) {
      d[id] = "gem" in p ? { mode: "gem", vnd: "", gem: String(p.gem) } : { mode: "xu", vnd: p.vnd ? String(p.vnd) : "", xu: p.xu, gem: "" };
    }
    return d;
  };
  const [draft, setDraft] = useState<Record<string, Draft>>(init);
  const [slot, setSlot] = useState<string>("pet");
  const [pending, start] = useTransition();

  /** Bảng giá gửi lên (chỉ món có ghi đè) + lỗi nhập */
  const { payload, bad } = useMemo(() => {
    const out: Record<string, { vnd: number } | { xu: number } | { gem: number }> = {};
    let bad: string | null = null;
    for (const it of PRICE_EDITABLE_ITEMS) {
      const d = draft[it.id];
      if (!d) continue;
      if (d.mode === "gem") {
        const g = Math.floor(Number(d.gem));
        if (!(g >= 1 && g <= 999)) bad ??= `Nhập số kim cương (1–999) cho "${it.name}".`;
        else out[it.id] = { gem: g };
      } else if (d.vnd.trim()) {
        const v = parseVnd(d.vnd);
        if (v === null || v < 1000 || v > 10_000_000) bad ??= `Giá tiền thật của "${it.name}" phải từ 1.000đ đến 10.000.000đ.`;
        else out[it.id] = { vnd: v };
      } else if (d.xu !== undefined) out[it.id] = { xu: d.xu };
    }
    return { payload: out, bad };
  }, [draft]);
  const saved = useMemo(() => {
    const o: Record<string, unknown> = {};
    for (const [id, p] of Object.entries(config.itemPrices ?? {})) o[id] = "gem" in p ? { gem: p.gem } : p.vnd ? { vnd: p.vnd } : { xu: p.xu };
    return JSON.stringify(o);
  }, [config]);
  const dirty = JSON.stringify(payload) !== saved;

  const set = (id: string, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? { mode: "xu", vnd: "", gem: "" }), ...patch } }));
  const reset = (id: string) => setDraft((d) => {
    const n = { ...d };
    delete n[id];
    return n;
  });
  const save = () =>
    start(async () => {
      const res = await saveItemPrices(payload);
      if (res.success) { play("coin"); toast.success(res.message); } else { play("error"); toast.error(res.error); }
    });

  const list = PRICE_EDITABLE_ITEMS.filter((i) => i.slot === slot);
  const changed = Object.keys(payload).length;
  return (
    <div className="flex flex-col gap-3" data-testid="price-manager">
      <div className="rounded-[16px] border-2 border-dashed border-[#c9b08a] bg-[#fffdf8] px-3 py-2 text-[13px] font-bold text-[#6e4722]">
        Nhập <b>giá tiền thật</b> (vd <b>20000</b>, <b>20k</b>) → tự đổi ra xu = tiền ÷ 3,6, làm tròn lên hàng trăm (20.000đ → 5.600 xu). Món huyền thoại có thể đặt giá bằng kim cương. Để trống = giá gốc.
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {SLOT_TABS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={slot === k} data-testid={`price-slot-${k}`} onClick={() => { play("click"); setSlot(k); }} className={cn("ah-btn h-9 px-3 text-[13px]", slot === k ? "ah-woodbtn" : "ah-cream")}>{label}</button>
        ))}
        <span className="ml-auto text-xs font-extrabold text-[#6e4722]">{changed} món đang đặt giá riêng</span>
      </div>
      {slot === "chest" && <ChestPriceManager key={JSON.stringify(config.chests ?? {})} config={config} />}
      {slot !== "chest" && (<>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-3">
        {list.map((it) => {
          const d = draft[it.id];
          const base = basePriceOf(it.id);
          // Chưa sửa → nút Xu / KC sáng theo loại tiền đang bán
          const mode = d?.mode ?? (base && "gem" in base ? "gem" : "xu");
          const vnd = d?.mode === "xu" && d.vnd.trim() ? parseVnd(d.vnd) : null;
          const now: ItemPrice | undefined = payload[it.id] && "vnd" in payload[it.id] ? { xu: vndToXu((payload[it.id] as { vnd: number }).vnd) } : (payload[it.id] as ItemPrice | undefined);
          return (
            <div key={it.id} data-testid="price-row" data-item={it.id} className={cn("flex flex-col gap-2 rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] p-3 shadow-[0_3px_0_#241e1a]", d && "bg-[#fff6db]")}>
              <div className="flex items-center gap-2.5">
                <span className="ah-part !aspect-square h-16 w-16 shrink-0 !rounded-[12px] !border-2">
                  <ItemArt it={it} avatar={avatar} withFace={it.slot === "frame"} />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="ah-hand block truncate text-[15px]">{it.name}</b>
                  <span className="text-[11px] font-extrabold text-[#9e6b3f]">{RAR_LABEL[it.rarity]} · gốc {priceText(base)}</span>
                  <span className="block text-[12px] font-black" data-testid="price-now">
                    Đang bán: {now ? <span className="text-[#b45309]">{priceText(now)}</span> : priceText(base)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex overflow-hidden rounded-full border-2 border-[#241e1a] text-[12px] font-black">
                  <button type="button" aria-pressed={mode === "xu"} data-testid="price-xu-mode" onClick={() => set(it.id, { mode: "xu" })} className={cn("flex items-center gap-1 px-2 py-1", mode === "xu" ? "bg-[#fbd048]" : "bg-[#fffdf8]")}><CoinDot size={12} />Xu</button>
                  <button type="button" aria-pressed={mode === "gem"} data-testid="price-gem-mode" onClick={() => set(it.id, { mode: "gem" })} className={cn("flex items-center gap-1 border-l-2 border-[#241e1a] px-2 py-1", mode === "gem" ? "bg-[#7dd3fc]" : "bg-[#fffdf8]")}><GemDot size={9} />KC</button>
                </div>
                {mode === "gem" ? (
                  <input value={d?.gem ?? ""} inputMode="numeric" placeholder={base && "gem" in base ? `${base.gem} KC` : "Số KC"} data-testid="price-gem" onChange={(e) => set(it.id, { mode: "gem", gem: e.target.value })} className="h-9 min-w-0 flex-1 rounded-[12px] border-2 border-[#241e1a] bg-white px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#fbd048]" />
                ) : (
                  <input value={d?.vnd ?? ""} inputMode="numeric" placeholder="Tiền thật (đ)" data-testid="price-vnd" onChange={(e) => set(it.id, { mode: "xu", vnd: e.target.value, xu: undefined })} className="h-9 min-w-0 flex-1 rounded-[12px] border-2 border-[#241e1a] bg-white px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#fbd048]" />
                )}
                {d && <button type="button" title="Về giá gốc" aria-label={`Về giá gốc ${it.name}`} data-testid="price-reset" onClick={() => { play("click"); reset(it.id); }} className="ah-btn ah-cream h-9 w-9 shrink-0 px-0 text-sm">↺</button>}
              </div>
              {mode === "xu" && vnd !== null && (
                <span className="text-[12px] font-black text-[#2f7d32]" data-testid="price-preview">{fmt(vnd)}đ ÷ 3,6 = {fmt(vndToXu(vnd))} xu</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-[16px] border-2 border-[#241e1a] bg-[#fff1c9] px-3 py-2">
        {bad && <span className="mr-auto text-[12px] font-black text-[#b83d27]">{bad}</span>}
        <button type="button" disabled={pending || !dirty} onClick={() => { play("click"); setDraft(init()); }} className="ah-btn ah-cream h-10 px-4 text-sm">Huỷ thay đổi</button>
        <button type="button" disabled={pending || !dirty || !!bad} data-testid="price-save" onClick={save} className="ah-btn ah-gold h-10 px-5 text-sm">{pending ? "Đang lưu…" : "Lưu giá"}</button>
      </div>
      </>)}
    </div>
  );
}

/** Giá mở rương + lượt Rương Xu mỗi ngày (28/11: thầy muốn sửa giá gacha) */
function ChestPriceManager({ config }: { config: GameConfigData }) {
  const c = config.chests ?? {};
  const init = () => ({ xuCost: c.xu?.cost ? String(c.xu.cost) : "", xuVnd: "", daily: c.xu?.dailyLimit ? String(c.xu.dailyLimit) : "", gemCost: c.gem?.cost ? String(c.gem.cost) : "" });
  const [v, setV] = useState(init);
  const [pending, start] = useTransition();
  const vnd = v.xuVnd.trim() ? parseVnd(v.xuVnd) : null;
  const xuCost = vnd ? vndToXu(vnd) : v.xuCost.trim() ? Number(v.xuCost) : undefined;
  const payload = { xu: { cost: xuCost, dailyLimit: v.daily.trim() ? Number(v.daily) : undefined }, gem: { cost: v.gemCost.trim() ? Number(v.gemCost) : undefined } };
  const bad =
    xuCost !== undefined && !(xuCost >= CHEST_LIMITS.xuMin && xuCost <= CHEST_LIMITS.xuMax)
      ? `Giá Rương Xu từ ${fmt(CHEST_LIMITS.xuMin)} đến ${fmt(CHEST_LIMITS.xuMax)} xu (thấp hơn ${fmt(CHEST_LIMITS.xuMin)} thì học sinh mở rương lãi xu).`
      : payload.xu.dailyLimit !== undefined && !(payload.xu.dailyLimit >= CHEST_LIMITS.dailyMin && payload.xu.dailyLimit <= CHEST_LIMITS.dailyMax)
        ? `Lượt mỗi ngày từ ${CHEST_LIMITS.dailyMin} đến ${CHEST_LIMITS.dailyMax}.`
        : payload.gem.cost !== undefined && !(payload.gem.cost >= CHEST_LIMITS.gemMin && payload.gem.cost <= CHEST_LIMITS.gemMax)
          ? `Giá Rương Ngọc từ ${CHEST_LIMITS.gemMin} đến ${CHEST_LIMITS.gemMax} ngọc.`
          : null;
  const field = "h-10 w-full rounded-[12px] border-2 border-[#241e1a] bg-white px-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#fbd048]";
  const save = (body: unknown) =>
    start(async () => {
      const res = await saveChestConfig(body);
      if (res.success) { play("coin"); toast.success(res.message); } else { play("error"); toast.error(res.error); }
    });
  const box = "flex flex-col gap-2 rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] p-3 shadow-[0_3px_0_#241e1a]";
  return (
    <div className="flex flex-col gap-3" data-testid="chest-manager">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={box}>
          <b className="ah-hand text-[16px]">🧰 Rương Xu</b>
          <label className="text-[12px] font-black text-[#6e4722]">
            Giá mở (xu) — gốc {fmt(CHEST_DEFAULTS.xu.cost)}
            <input value={v.xuCost} inputMode="numeric" placeholder={fmt(CHEST_DEFAULTS.xu.cost)} data-testid="chest-xu-cost" onChange={(e) => setV({ ...v, xuCost: e.target.value.replace(/[^\d]/g, ""), xuVnd: "" })} className={field} />
          </label>
          <label className="text-[12px] font-black text-[#6e4722]">
            …hoặc nhập giá tiền thật (đ) → tự đổi ra xu
            <input value={v.xuVnd} inputMode="numeric" placeholder="VD 3000" data-testid="chest-xu-vnd" onChange={(e) => setV({ ...v, xuVnd: e.target.value })} className={field} />
          </label>
          {vnd !== null && <span className="text-[12px] font-black text-[#2f7d32]">{fmt(vnd)}đ ÷ 3,6 = {fmt(vndToXu(vnd))} xu</span>}
          <label className="text-[12px] font-black text-[#6e4722]">
            Lượt mở mỗi ngày — gốc {CHEST_DEFAULTS.xu.dailyLimit}
            <input value={v.daily} inputMode="numeric" placeholder={String(CHEST_DEFAULTS.xu.dailyLimit)} data-testid="chest-xu-daily" onChange={(e) => setV({ ...v, daily: e.target.value.replace(/[^\d]/g, "") })} className={field} />
          </label>
        </div>
        <div className={box}>
          <b className="ah-hand text-[16px]">💎 Rương Ngọc</b>
          <label className="text-[12px] font-black text-[#6e4722]">
            Giá mở (ngọc) — gốc {CHEST_DEFAULTS.gem.cost}
            <input value={v.gemCost} inputMode="numeric" placeholder={String(CHEST_DEFAULTS.gem.cost)} data-testid="chest-gem-cost" onChange={(e) => setV({ ...v, gemCost: e.target.value.replace(/[^\d]/g, "") })} className={field} />
          </label>
          <p className="text-[11px] font-bold text-[#6e4722]">Ngọc chỉ có từ mã quà tặng thầy phát.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 rounded-[16px] border-2 border-[#241e1a] bg-[#fff1c9] px-3 py-2">
        {bad && <span className="mr-auto text-[12px] font-black text-[#b83d27]">{bad}</span>}
        <button type="button" disabled={pending} data-testid="chest-reset" onClick={() => { setV({ xuCost: "", xuVnd: "", daily: "", gemCost: "" }); save({}); }} className="ah-btn ah-cream h-10 px-4 text-sm">Về giá gốc</button>
        <button type="button" disabled={pending || !!bad} data-testid="chest-save" onClick={() => save(payload)} className="ah-btn ah-gold h-10 px-5 text-sm">{pending ? "Đang lưu…" : "Lưu giá rương"}</button>
      </div>
    </div>
  );
}

export function EarningManager({ config }: { config: GameConfigData }) {
  const init = () => Object.fromEntries(EARNING_FIELDS.map((f) => [f.key, config.earning?.[f.key] !== undefined ? String(config.earning[f.key]) : ""]));
  const [vals, setVals] = useState<Record<string, string>>(init);
  const [pending, start] = useTransition();
  const payload = useMemo(() => Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)])), [vals]);
  const bad = EARNING_FIELDS.find((f) => vals[f.key]?.trim() && !(Number(vals[f.key]) >= f.min && Number(vals[f.key]) <= f.max && Number.isInteger(Number(vals[f.key]))));
  const dirty = JSON.stringify(init()) !== JSON.stringify(vals);
  const groups = [...new Set(EARNING_FIELDS.map((f) => f.group))];
  const save = (body: Record<string, number>) =>
    start(async () => {
      const res = await saveEarningConfig(body);
      if (res.success) { play("coin"); toast.success(res.message); } else { play("error"); toast.error(res.error); }
    });
  return (
    <div className="flex flex-col gap-3" data-testid="earning-manager">
      <div className="rounded-[16px] border-2 border-dashed border-[#c9b08a] bg-[#fffdf8] px-3 py-2 text-[13px] font-bold text-[#6e4722]">
        Số xu học sinh nhận cho mỗi hoạt động. Để trống = dùng mức mặc định (số mờ). Áp dụng cho các lần nộp / chấm bài <b>từ lúc lưu</b>, không tính lại xu cũ.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g} className="rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#fffdf8] p-3 shadow-[0_3px_0_#241e1a]">
            <legend className="ah-hand px-1 text-[16px] font-bold">{g}</legend>
            <div className="flex flex-col gap-2">
              {EARNING_FIELDS.filter((f) => f.group === g).map((f) => {
                const v = vals[f.key];
                const changed = v.trim() !== "" && Number(v) !== EARNING_DEFAULTS[f.key];
                return (
                  <label key={f.key} className="flex items-center gap-2 text-[13px] font-bold">
                    <span className="min-w-0 flex-1">{f.label}</span>
                    <input
                      value={v}
                      inputMode="numeric"
                      placeholder={fmt(EARNING_DEFAULTS[f.key])}
                      data-testid={`earn-${f.key}`}
                      onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.value.replace(/[^\d]/g, "") }))}
                      className={cn("h-9 w-[104px] rounded-[12px] border-2 border-[#241e1a] bg-white px-2 text-right text-sm font-black outline-none focus:ring-2 focus:ring-[#fbd048]", changed && "bg-[#fff1c9]")}
                    />
                    <span className="w-6 text-[11px] font-black text-[#9e6b3f]">{f.key === "finalScoreMultiplier" ? "×" : "xu"}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-[16px] border-2 border-[#241e1a] bg-[#fff1c9] px-3 py-2">
        {bad && <span className="mr-auto text-[12px] font-black text-[#b83d27]">«{bad.label}» phải từ {fmt(bad.min)} đến {fmt(bad.max)}.</span>}
        <button type="button" disabled={pending || Object.keys(config.earning ?? {}).length === 0} data-testid="earn-reset-all" onClick={() => { play("click"); setVals(Object.fromEntries(EARNING_FIELDS.map((f) => [f.key, ""]))); save({}); }} className="ah-btn ah-cream h-10 px-4 text-sm">Về mặc định</button>
        <button type="button" disabled={pending || !dirty || !!bad} data-testid="earn-save" onClick={() => save(payload)} className="ah-btn ah-gold h-10 px-5 text-sm">{pending ? "Đang lưu…" : "Lưu mức xu"}</button>
      </div>
    </div>
  );
}
