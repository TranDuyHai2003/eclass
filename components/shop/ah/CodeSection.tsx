"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { redeemGiftCode } from "@/actions/giftcode";
import { MAX_CODE_LENGTH, codeLengthOk, normalizeCode } from "@/lib/game/giftcode-shared";
import { buzz, play } from "@/lib/sound";
import { CoinDot, GemDot, fmt } from "./parts";

/** Mục "Thẻ cào Điểm 10 & Code" (canvas v2): cào lớp nhũ bạc + ô nhập GiftCode thầy phát (logic actions/giftcode giữ nguyên) */
export function CodeSection({ canEarn, onWon }: { canEarn: boolean; onWon?: () => void }) {
  const router = useRouter();
  const cv = useRef<HTMLCanvasElement | null>(null);
  const down = useRef(false);
  const [foil, setFoil] = useState(true);
  const [code, setCode] = useState("");
  const [err, setErr] = useState(false);
  const [won, setWon] = useState<{ amount: number; currency: "XU" | "GEM" } | null>(null);
  const [pending, start] = useTransition();
  const clean = normalizeCode(code);

  // Vẽ lớp nhũ bạc sọc chéo như canvas khi phần tử xuất hiện
  const foilRef = useCallback((el: HTMLCanvasElement | null) => {
    cv.current = el;
    const c = el?.getContext("2d");
    if (!c) return;
    c.globalCompositeOperation = "source-over";
    for (let x = -200; x < 840; x += 20) {
      c.fillStyle = (x / 20) % 2 ? "#B6C2D2" : "#CBD5E1";
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 20, 0);
      c.lineTo(x + 188, 168);
      c.lineTo(x + 168, 168);
      c.fill();
    }
    c.fillStyle = "#334155";
    c.font = "bold 26px sans-serif";
    c.textAlign = "center";
    c.fillText("Kéo để cào lớp nhũ bạc", 320, 94);
  }, []);

  const reveal = () => {
    setFoil(false);
    play("coin");
    buzz(25);
  };
  const scrAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = cv.current;
    const c = el?.getContext("2d");
    if (!el || !c) return;
    const r = el.getBoundingClientRect();
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    c.arc(((e.clientX - r.left) / r.width) * 640, ((e.clientY - r.top) / r.height) * 168, 34, 0, Math.PI * 2);
    c.fill();
  };
  const scrUp = () => {
    if (!down.current || !cv.current) return;
    down.current = false;
    try {
      const d = cv.current.getContext("2d")!.getImageData(0, 0, 640, 168).data;
      let clear = 0;
      let n = 0;
      for (let k = 3; k < d.length; k += 64) {
        n++;
        if (d[k] === 0) clear++;
      }
      if (clear / n > 0.45) reveal();
    } catch {
      /* bỏ qua */
    }
  };

  const bad = (msg: string) => {
    setErr(true);
    play("error");
    buzz(60);
    setTimeout(() => setErr(false), 450);
    toast.error(msg);
  };
  const submit = () => {
    if (!codeLengthOk(clean)) return bad("Mã chưa đúng, kiểm tra lại nhé.");
    start(async () => {
      play("click");
      const res = await redeemGiftCode(clean);
      if (res.success) {
        setWon({ amount: res.amount ?? 0, currency: res.currency ?? "GEM" });
        play("coin");
        buzz(20);
        toast.success(res.message || "Nhập mã thành công!");
        setCode("");
        onWon?.();
        router.refresh();
      } else bad(res.error);
    });
  };

  return (
    <section className="ah-panel flex max-w-[620px] flex-col gap-3.5 p-[22px]" data-testid="scratch-open">
      <div data-testid="scratch-modal" className="contents">
        <p className="font-bold text-[#6e4722]">Dùng chuột hoặc ngón tay cào lớp nhũ bạc, rồi nhập mã thầy phát để nhận thưởng.</p>
        <div className="relative flex h-[110px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-[18px] border-[3px] border-dashed border-[#d9911a] bg-[#fff6db]">
          <span className="text-xs font-black text-[#9e6b3f]">THẺ CÀO ĐIỂM 10</span>
          <span className="ah-hand text-2xl font-bold tracking-[0.08em]">Nhập mã bên dưới</span>
          {foil && (
            <canvas
              ref={foilRef}
              width={640}
              height={168}
              role="img"
              aria-label="Lớp nhũ bạc. Kéo chuột hoặc ngón tay để cào."
              data-testid="scratch-canvas"
              onPointerDown={(e) => {
                down.current = true;
                try {
                  e.currentTarget.setPointerCapture(e.pointerId);
                } catch {
                  /* bỏ qua */
                }
                scrAt(e);
              }}
              onPointerMove={(e) => down.current && scrAt(e)}
              onPointerUp={scrUp}
              onPointerLeave={scrUp}
              className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
            />
          )}
        </div>
        {foil && (
          <button type="button" data-testid="scratch-skip" onClick={reveal} className="ah-btn ah-cream h-[38px] self-start px-3.5 text-[13px]">Cào nhanh toàn bộ</button>
        )}
        {won ? (
          <div data-testid="giftcode-won" className="v2-pop flex flex-wrap items-center gap-3 rounded-[18px] border-[2.5px] border-[#241e1a] bg-[#eef8ec] px-4 py-3.5 shadow-[0_3px_0_#241e1a]">
            {won.currency === "GEM" ? <GemDot size={22} /> : <CoinDot size={26} />}
            <div className="flex-1">
              <div className="ah-hand text-xl font-bold text-[#173d15]">+{fmt(won.amount)} {won.currency === "GEM" ? "ngọc (Kim Cương)" : "xu"}</div>
              <div className="text-xs font-bold text-[#2f7a33]">Đã cộng vào ví của bạn.</div>
            </div>
            <button type="button" onClick={() => setWon(null)} className="ah-btn ah-cream h-10 px-4 text-sm">Nhập mã khác</button>
          </div>
        ) : (
          <>
            <label htmlFor="gc" className="ah-hand text-[15px] font-bold">Nhập mã GiftCode giáo viên phát</label>
            <div className="flex gap-2.5">
              <input
                id="gc"
                data-testid="giftcode-input"
                aria-invalid={err}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && !pending && canEarn && submit()}
                placeholder="VD: DIEM10, CHAMCHI…"
                maxLength={MAX_CODE_LENGTH + 4}
                spellCheck={false}
                autoComplete="off"
                className={cn("h-12 min-w-0 flex-1 rounded-full border-[2.5px] border-[#241e1a] bg-[#fffdf8] px-[18px] font-extrabold uppercase tracking-[0.12em] outline-none placeholder:tracking-normal placeholder:text-[#b9a58a]", err && "ah-shake")}
              />
              <button type="button" data-testid="giftcode-submit" disabled={pending || !canEarn || clean.length === 0} onClick={submit} className="ah-btn ah-coral h-12 px-[22px] text-base">
                {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}Nhận quà
              </button>
            </div>
            <div className="text-xs font-bold text-[#6e4722]">{canEarn ? "Mỗi mã chỉ nhận được một lần." : "Tài khoản cần được thầy duyệt mới nhập được mã."}</div>
          </>
        )}
      </div>
    </section>
  );
}
