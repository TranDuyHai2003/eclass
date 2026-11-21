"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ShopModal } from "./ShopModal";
import { redeemGiftCode } from "@/actions/giftcode";
import { CODE_LENGTH, normalizeCode } from "@/lib/game/giftcode-shared";
import { play } from "@/lib/sound";
import { CoinBurst } from "@/components/game/CoinBurst";

/**
 * "Thẻ cào & GiftCode": cào lớp nhũ bạc (canvas) để lộ ô nhập mã — niềm vui nhỏ như thẻ cào thật;
 * có nút "Nhập mã luôn" cho người dùng bàn phím/đọc màn hình. Mã do thầy phát, logic nhập giữ nguyên (actions/giftcode).
 */
export function ScratchCodeModal({ open, onOpenChange, canEarn }: { open: boolean; onOpenChange: (o: boolean) => void; canEarn: boolean }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [won, setWon] = useState<{ amount: number; currency: "XU" | "GEM" } | null>(null);
  const clean = normalizeCode(code);

  // Vẽ lớp nhũ bạc khi mở
  useEffect(() => {
    if (!open) return;
    setRevealed(false);
    setProgress(0);
    setWon(null);
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#d6d3d1");
    g.addColorStop(0.5, "#f5f5f4");
    g.addColorStop(1, "#a8a29e");
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(120,113,108,.35)";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 37) % c.width, (i * 53) % c.height, 3, 3);
    ctx.fillStyle = "#57534e";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✨ CÀO LỚP NHŨ BẠC TẠI ĐÂY ✨", c.width / 2, c.height / 2 + 6);
  }, [open]);

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealed || (e.buttons === 0 && e.type !== "pointerdown")) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    if (Math.random() < 0.25) play("tick");
    // Ước lượng phần đã cào: lấy mẫu alpha
    const img = ctx.getImageData(0, 0, c.width, c.height).data;
    let clear = 0;
    const step = 16;
    for (let i = 3; i < img.length; i += 4 * step) if (img[i] === 0) clear++;
    const pct = clear / (img.length / (4 * step));
    setProgress(pct);
    if (pct > 0.5) {
      setRevealed(true);
      play("success");
    }
  };

  const submit = () =>
    start(async () => {
      play("click");
      const res = await redeemGiftCode(clean);
      if (res.success) {
        setWon({ amount: res.amount ?? 0, currency: res.currency ?? "GEM" });
        setBurst((n) => n + 1);
        play("success");
        setTimeout(() => play("coin"), 250);
        toast.success(res.message || "Nhập mã thành công!");
        setCode("");
        router.refresh();
      } else {
        play("error");
        toast.error(res.error);
      }
    });

  return (
    <>
      <CoinBurst burst={burst} />
      <ShopModal open={open} onOpenChange={onOpenChange} title="🎟️ Thẻ Cào & GiftCode" description="Dùng chuột hoặc ngón tay cào lớp nhũ bạc để mở ô nhập mã thầy phát." testId="scratch-modal">
        {won ? (
          <div data-testid="giftcode-won" className="animate-pop-in rounded-2xl border-2 border-[#4fae4a] bg-[#eef9ea] p-5 text-center">
            <p className="text-4xl">{won.currency === "GEM" ? "💎" : "🪙"}</p>
            <p className="mt-1 text-2xl font-black text-[#1f6b22]">+{won.amount.toLocaleString("vi-VN")} {won.currency === "GEM" ? "Kim Cương" : "Xu"}</p>
            <p className="text-sm font-semibold text-[#2f7a33]">Đã cộng vào ví của bạn 🎉</p>
            <button type="button" onClick={() => setWon(null)} className="btn-pill mt-3 px-4 py-1.5 text-xs">Nhập mã khác</button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-2xl border-[2.5px] border-[#5b3d1e] bg-[#fff1c2]">
              <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
                <p className="text-sm font-black text-[#7c4a03]">Nhập mã bên dưới 👇</p>
                <p className="text-[11px] font-semibold text-[#9a7a4a]">Mỗi thẻ chỉ dùng một lần · 8 ký tự</p>
              </div>
              {!revealed && (
                <canvas
                  ref={canvasRef}
                  width={360}
                  height={128}
                  data-testid="scratch-canvas"
                  onPointerDown={scratch}
                  onPointerMove={scratch}
                  className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                />
              )}
            </div>
            {!revealed && (
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#efe6d6]"><div className="h-full rounded-full bg-[#4fae4a]" style={{ width: `${Math.min(100, progress * 200)}%` }} /></div>
                <button type="button" data-testid="scratch-skip" onClick={() => { setRevealed(true); play("click"); }} className="btn-pill px-3 py-1 text-[11px]">Nhập mã luôn</button>
              </div>
            )}
            <div className={revealed ? "" : "pointer-events-none opacity-50"}>
              <p className="text-xs font-black text-[#5b3d1e]">Nhập mã GiftCode giáo viên tặng:</p>
              <div className="mt-1 flex gap-2">
                <input
                  data-testid="giftcode-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && clean.length === CODE_LENGTH && !pending && canEarn && submit()}
                  placeholder="VÍ DỤ: ABCD2345"
                  maxLength={12}
                  spellCheck={false}
                  autoComplete="off"
                  className="h-11 min-w-0 flex-1 rounded-xl border-[2.5px] border-[#5b3d1e] bg-white px-3 font-mono text-lg font-black uppercase tracking-[0.2em] text-[#3b2a14] outline-none placeholder:font-sans placeholder:text-sm placeholder:tracking-normal placeholder:text-[#b9a58a]"
                />
                <button type="button" data-testid="giftcode-submit" disabled={pending || clean.length !== CODE_LENGTH || !canEarn} onClick={submit} className="btn-pill btn-pill-yellow px-4 text-sm">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Nhận quà
                </button>
              </div>
              {!canEarn && <p className="mt-1 text-[11px] font-semibold text-amber-700">Tài khoản cần được thầy duyệt mới nhập được mã.</p>}
            </div>
          </div>
        )}
      </ShopModal>
    </>
  );
}
