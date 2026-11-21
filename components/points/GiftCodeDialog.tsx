"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { redeemGiftCode } from "@/actions/giftcode";
import { normalizeCode, CODE_LENGTH } from "@/lib/game/giftcode-shared";
import { play } from "@/lib/sound";
import { CoinBurst } from "@/components/game/CoinBurst";

/** Hộp "Nhập code": thẻ cào thầy phát → ngọc (hoặc xu). Thành công → mưa xu + âm thanh + làm mới trang. */
export function GiftCodeDialog({ open, onOpenChange, canEarn }: { open: boolean; onOpenChange: (o: boolean) => void; canEarn: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const [burst, setBurst] = useState(0);
  const [won, setWon] = useState<{ amount: number; currency: "XU" | "GEM" } | null>(null);
  const clean = normalizeCode(code);

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
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setWon(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500 text-white"><Ticket className="h-5 w-5" /></span>
              Nhập mã quà tặng
            </DialogTitle>
            <DialogDescription>Cào thẻ thầy phát, nhập 8 ký tự trên thẻ để nhận ngọc. Mỗi thẻ chỉ dùng một lần.</DialogDescription>
          </DialogHeader>

          {won ? (
            <div data-testid="giftcode-won" className="animate-pop-in rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="text-4xl">{won.currency === "GEM" ? "💎" : "🪙"}</p>
              <p className="mt-1 text-2xl font-black text-emerald-700">+{won.amount.toLocaleString("vi-VN")} {won.currency === "GEM" ? "ngọc" : "xu"}</p>
              <p className="text-sm font-semibold text-emerald-700/80">Đã cộng vào ví của bạn 🎉</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                data-testid="giftcode-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && clean.length === CODE_LENGTH && !pending && canEarn && submit()}
                placeholder="VD: ABCD2345"
                maxLength={12}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="h-14 w-full rounded-2xl border-2 border-pink-200 bg-pink-50/50 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-pink-700 outline-none placeholder:text-pink-300 placeholder:tracking-normal focus:border-pink-400"
              />
              {!canEarn && <p className="text-xs font-semibold text-amber-700">Tài khoản cần được thầy duyệt mới nhập được mã.</p>}
            </div>
          )}

          <DialogFooter>
            {won ? (
              <button type="button" onClick={() => setWon(null)} className="btn-3d btn-3d-white px-4 py-2 text-sm">Nhập mã khác</button>
            ) : (
              <button
                type="button"
                data-testid="giftcode-submit"
                disabled={pending || clean.length !== CODE_LENGTH || !canEarn}
                onClick={submit}
                className="btn-3d btn-shine bg-pink-500 px-5 py-2 text-sm text-white [--btn-edge:#9d174d] hover:bg-pink-400 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Nhận quà
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
