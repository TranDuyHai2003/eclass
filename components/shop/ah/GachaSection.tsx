"use client";

import Link from "next/link";
import { CHESTS, describeOutcome, poolFor, type ChestId, type Outcome, type Prize } from "@/lib/game/gacha-shared";
import type { AvatarConfig } from "@/lib/game/avatar";
import type { Rarity } from "@/lib/points/rarity";
import { useGachaPull } from "@/components/game/useGachaPull";
import { GachaCinematic } from "@/components/studio/effects";
import { Confetti } from "@/components/points/Confetti";
import { CoinBurst } from "@/components/game/CoinBurst";
import { play } from "@/lib/sound";
import { CoinDot, GemDot, ItemArt, RAR_LABEL, fmt, itemById } from "./parts";
import { CardOrnaments, Feather, MagicCircle, Ribbon, RarityGem, Twinkle, type ChestTone } from "./ChestDecor";

const tone = (id: "xu" | "gem"): ChestTone => (id === "xu" ? "gold" : "lilac");

const RAR_DOT: Record<Rarity, string> = { common: "#22A05A", rare: "#3B82F6", epic: "#9333EA", legendary: "#E0A21B" };
const NAME: Record<ChestId, string> = { xu: "Hộp Sao Mèo Chuẩn", gem: "Hộp Tinh Tú VIP" };

/** Mục "Hộp bí ẩn" (canvas v2): nền đêm sao, 2 hộp có thanh tỉ lệ, sao bảo hiểm; cầu nguyện → sao băng → thẻ kết quả */
export function GachaSection({ wallet, pity, pullsToday, owned, avatar, canEarn, onDone }: {
  wallet: { balance: number; gems: number };
  pity: number;
  pullsToday: number;
  owned: string[];
  avatar: AvatarConfig;
  canEarn: boolean;
  onDone: (r: { outcome: Outcome }) => void;
}) {
  const g = useGachaPull({ wallet, pity, pullsToday, owned, onDone });
  const busy = g.pending || g.phase === "shaking";
  const res = g.result;
  const pityMax = g.pityMax;
  return (
    <section className="flex flex-col gap-[18px] rounded-[26px] border-[3px] border-[#241e1a] bg-[#1c1a42] p-[22px] text-[#fffdf8] shadow-[0_7px_0_rgba(36,30,26,0.92)]" data-testid="gacha-section">
      <CoinBurst burst={g.burst} />
      <Confetti burst={g.confetti} />
      {g.phase === "shaking" && <GachaCinematic rarity={g.incoming} onSkip={g.skip} />}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="rounded-full border-2 border-[#241e1a] bg-[#fbd048] px-3 py-0.5 text-xs font-black text-[#241e1a]">CẦU NGUYỆN SAO BĂNG HỌC ĐƯỜNG</span>
        <h2 className="ah-hand text-2xl font-bold text-[#fef08a]">Chọn hộp tinh tú &amp; thử nhân phẩm!</h2>
        <span className="text-xs font-bold text-[#bae6fd]" data-testid="gacha-wallet">Ví: {fmt(g.wallet.balance)} xu · {g.wallet.gems} KC</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-[18px]">
        {(["xu", "gem"] as const).map((id) => {
          const c = CHESTS[id];
          const cost = "xu" in c.cost ? `${fmt(c.cost.xu)} xu` : `${c.cost.gem} KC`;
          const outOfDay = id === "xu" && g.limit > 0 && g.left === 0;
          return (
            <div key={id} className={`cx-card ${id === "xu" ? "cx-gold" : "cx-lilac"} flex flex-col gap-3 px-4 pb-5 pt-4 sm:px-[22px]`} data-testid="chest-card" data-chest={id} aria-label={`${NAME[id]}, ${id === "xu" ? "Sử thi" : "Huyền thoại"}`}>
              <CardOrnaments tone={tone(id)} />
              {/* Ruy băng tên hộp */}
              <Ribbon tone={tone(id)}>{NAME[id]}</Ribbon>
              {/* Sân khấu: quầng sáng, tia xoay, vòng phép dưới chân, vòng quỹ đạo (VIP), sao lấp lánh, hạt sáng bay lên; rương bồng bềnh, lắc khi rê / mở */}
              <div className="group relative flex h-52 items-center justify-center" data-testid="chest-stage">
                <span aria-hidden className="cx-glow" />
                <span aria-hidden className="ah-rays" style={{ "--ray": id === "xu" ? "rgba(253,224,71,0.30)" : "rgba(221,214,254,0.34)" } as React.CSSProperties} />
                <MagicCircle tone={tone(id)} />
                {id === "gem" && (
                  <>
                    <span aria-hidden className="cx-ring r1" />
                    <span aria-hidden className="cx-ring r2" />
                  </>
                )}
                {[[10, 20, 0, 18], [86, 14, 0.7, 14], [16, 70, 1.3, 12], [88, 64, 0.4, 16], [52, 2, 1.0, 12], [70, 30, 1.7, 9]].map(([l, t, d, sz]) => (
                  <Twinkle key={`${l}-${t}`} className="cx-twinkle" style={{ left: `${l}%`, top: `${t}%`, width: sz, height: sz, animationDelay: `${d}s`, color: id === "xu" ? "#fde68a" : "#f5f3ff" }} />
                ))}
                {[[30, 0], [46, 0.8], [60, 0.4], [72, 1.2]].map(([l, d]) => (
                  <span key={l} aria-hidden className="ah-mote" style={{ left: `${l}%`, animationDelay: `${d}s`, background: id === "xu" ? "#fde68a" : "#ddd6fe" }} />
                ))}
                <span className={`ah-chest-wob relative ${busy && g.chest === id ? "ah-chest-open" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- tranh rương tách nền (public/studio/cut), ảnh tĩnh nhỏ */}
                  <img src={`/studio/cut/chest-${id}.webp`} alt="" draggable={false} className="v2-float cx-chest relative h-[170px] w-[170px] object-contain" />
                </span>
              </div>
              {/* Tỉ lệ: ô màu theo độ hiếm */}
              <div className="relative grid grid-cols-2 gap-1.5 sm:gap-2">
                {(["common", "rare", "epic", "legendary"] as Rarity[]).filter((r) => (c.rates[r] ?? 0) > 0).map((r) => (
                  <div key={r} className="cx-chip" style={{ "--rc": RAR_DOT[r] } as React.CSSProperties}>
                    <RarityGem color={RAR_DOT[r]} />
                    <span className="min-w-0 flex-1">{RAR_LABEL[r]}</span>
                    <b className="tabular-nums" style={{ color: r === "legendary" ? "#fde68a" : undefined }}>{c.rates[r]}%</b>
                  </div>
                ))}
              </div>
              {/* Có thể nhận: vài món hiếm nhất trong rương */}
              {(() => {
                // Ưu tiên món nhìn khác nhau rõ (viền, thú cưng, bảng tên, hiệu ứng) hơn đồ mặc lên nhân vật
                const SLOT_ORDER = ["frame", "pet", "nameplate", "effect", "background", "accessory", "outfit", "hair"];
                const picks = (["legendary", "epic"] as Rarity[])
                  .flatMap((r) => poolFor(id, r))
                  .filter((p): p is Extract<Prize, { kind: "item" }> => p.kind === "item")
                  .sort((a, b) => (SLOT_ORDER.indexOf(a.item.slot) + 99) % 99 - (SLOT_ORDER.indexOf(b.item.slot) + 99) % 99)
                  .slice(0, 4);
                if (picks.length === 0) return null;
                return (
                  <div className="flex items-center gap-2" data-testid="chest-preview">
                    <span className="shrink-0 text-[11px] font-black text-[#fef3c7] opacity-90">Có thể nhận</span>
                    <div className="flex min-w-0 flex-1 gap-1.5">
                      {picks.map((p) => (
                        <span key={p.item.id} title={`${p.item.name} · ${RAR_LABEL[p.item.rarity]}`} className="cx-tile" style={{ "--rc": RAR_DOT[p.item.rarity] } as React.CSSProperties}>
                          <ItemArt it={p.item} avatar={avatar} />
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <button type="button" data-testid={`chest-open-${id}`} disabled={busy || !canEarn || outOfDay} onClick={() => g.open(id)} className={`cx-btn ${id === "xu" ? "cx-btn-gold" : "cx-btn-crystal"}`}>
                <Feather />
                <span>Cầu nguyện · {cost}</span>
              </button>
              {id === "xu" && g.limit > 0 && <span className="relative text-center text-xs font-bold text-[#fef3c7]/90" data-testid="pray-xu-left">Còn {g.left}/{g.limit} lượt hôm nay</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border-2 border-[rgba(255,253,248,0.3)] bg-white/[0.08] px-4 py-3.5" data-testid="pity">
        <div className="flex-[1_1_260px]">
          <div className="ah-hand font-bold text-[#fef08a]">Bảo hiểm nhân phẩm ({g.pity}/{pityMax} lượt)</div>
          <div className="text-[13px] font-bold text-[#bae6fd]">{g.pity >= pityMax - 1 ? "Lần mở Hộp Sao Mèo tiếp theo chắc chắn ra Sử thi hoặc Huyền thoại." : `Còn ${pityMax - g.pity} lần Hộp Sao Mèo nữa chắc chắn ra Sử thi hoặc Huyền thoại.`}</div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: pityMax }, (_, i) => (
            <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#241e1a] font-black" style={i < g.pity ? { background: "#fbd048", color: "#241e1a" } : { background: "#2a275c", color: "rgba(255,255,255,0.4)" }}>★</span>
          ))}
        </div>
      </div>
      <div className="text-center text-xs font-bold text-[#bae6fd]">
        {!canEarn ? "Tài khoản cần được thầy duyệt mới mở được hộp. " : "Kết quả tính ở máy chủ. Trúng đồ đã có thì được trả lại xu theo bậc. "}
        <Link href="/rewards/gacha" className="underline decoration-dotted">Lịch sử mở hộp →</Link>
      </div>

      {g.phase === "reveal" && res && (
        <div className="fixed inset-0 z-[62] flex items-center justify-center bg-[rgba(28,26,66,0.75)] p-4">
          <div role="dialog" aria-modal="true" aria-label="Kết quả mở hộp" data-testid="gacha-result" data-rarity={res.outcome.rarity} className={`ah-dialog v2-pop ah-pcard r-${res.outcome.rarity} w-full max-w-[400px] cursor-default items-center p-5 text-center hover:transform-none`}>
            <span className="ah-ppill">{RAR_LABEL[res.outcome.rarity]}{res.guaranteed ? " · bảo hiểm" : ""}</span>
            <div className="ah-part aspect-square w-full">
              <span className="ah-sun" aria-hidden />
              <ResultArt outcome={res.outcome} avatar={avatar} />
            </div>
            <h2 className="ah-hand text-[21px] font-bold">Chúc mừng! Bạn nhận được {res.outcome.kind === "item" ? itemById(res.outcome.itemId)?.name : describeOutcome(res.outcome)}</h2>
            <div className="text-[13px] font-bold">{res.outcome.kind === "item" ? (res.outcome.duplicate ? describeOutcome(res.outcome) : "Đã cất vào Túi đồ.") : "Đã cộng vào ví."}</div>
            <div className="flex w-full gap-2.5">
              <button type="button" onClick={() => { play("click"); g.reset(); }} className="ah-btn ah-cream h-12 flex-1">Đóng</button>
              <button type="button" data-testid="gacha-again" onClick={() => { const c = g.chest; g.reset(); g.open(c); }} disabled={!canEarn || (g.chest === "xu" && g.left === 0)} className="ah-btn ah-gold h-12 flex-1">Quay tiếp</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ResultArt({ outcome, avatar }: { outcome: Outcome; avatar: AvatarConfig }) {
  if (outcome.kind === "item") {
    const it = itemById(outcome.itemId);
    if (it) return <span className="relative flex h-[80%] w-[80%] items-center justify-center"><ItemArt it={it} avatar={avatar} withFace /></span>;
  }
  return <span className="relative flex items-center gap-3">{outcome.kind === "gem" ? <GemDot size={64} /> : <CoinDot size={88} />}</span>;
}
