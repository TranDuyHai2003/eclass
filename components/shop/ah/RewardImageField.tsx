"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { play } from "@/lib/sound";

/**
 * Ô ảnh quà trong form Quản lý quà (admin): đăng ảnh từ máy (bấm hoặc kéo thả), sửa ảnh (cắt vuông, kéo để căn,
 * phóng to / thu nhỏ, xoay), đổi ảnh, bỏ ảnh. Ảnh được vẽ lại thành ô vuông 800px (WebP) rồi mới tải lên CDN
 * qua /api/upload/image → nhẹ, vừa khung thẻ quà, không lộ dữ liệu EXIF (vị trí chụp…) của ảnh gốc.
 */

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SOURCE_MB = 15;
const OUT = 800;

export function RewardImageField({ value, onChange, disabled, onBusy }: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Đang sửa / tải ảnh → khoá nút Lưu của form */
  onBusy?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<{ url: string; local: boolean } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  useEffect(() => onBusy?.(uploading || !!src), [uploading, src, onBusy]);

  const pick = (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return toast.error("Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.");
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) return toast.error(`Ảnh quá lớn (tối đa ${MAX_SOURCE_MB}MB).`);
    play("click");
    setSrc({ url: URL.createObjectURL(file), local: true });
  };
  const closeEditor = () => {
    if (src?.local) URL.revokeObjectURL(src.url);
    setSrc(null);
  };

  const upload = async (blob: Blob) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], `qua.${blob.type === "image/png" ? "png" : "webp"}`, { type: blob.type }));
      const res = await fetch("/api/upload/image", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text().catch(() => ""));
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("no url");
      onChange(url);
      play("coin");
      toast.success("Đã tải ảnh lên — bấm Lưu để cập nhật quà.");
      closeEditor();
    } catch {
      play("error");
      toast.error("Tải ảnh lên không được. Thử lại sau nhé.");
    } finally {
      setUploading(false);
    }
  };

  const btn = "ah-btn h-9 px-3 text-[13px]";
  return (
    <div className="flex flex-col gap-2" data-testid="ed-image">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) pick(e.dataTransfer.files?.[0]); }}
        className={cn("flex items-center gap-3 rounded-[16px] border-[2.5px] border-dashed p-2.5", drag ? "border-[#241e1a] bg-[#fff1c9]" : "border-[#c9b08a] bg-[#fffdf8]")}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh CDN đã cắt vuông
          <img src={value} alt="Ảnh quà" data-testid="ed-image-thumb" className="h-16 w-16 shrink-0 rounded-[12px] border-2 border-[#241e1a] bg-white object-cover" />
        ) : (
          <span aria-hidden className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] border-2 border-dashed border-[#c9b08a] text-2xl">🖼️</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[11px] font-bold text-[#6e4722]">
            {value ? "Ảnh này thay tranh tự chọn trên thẻ quà." : "Chưa có ảnh — dùng tranh tự chọn theo tên. Kéo thả ảnh vào đây hoặc bấm Đăng ảnh."}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={disabled || uploading} data-testid="ed-image-pick" onClick={() => inputRef.current?.click()} className={cn(btn, "ah-gold")}>
              📷 {value ? "Đổi ảnh" : "Đăng ảnh"}
            </button>
            {value && (
              <>
                <button type="button" disabled={disabled || uploading} data-testid="ed-image-edit" onClick={() => { play("click"); setSrc({ url: value, local: false }); }} className={cn(btn, "ah-cream")}>✂️ Sửa ảnh</button>
                <button type="button" disabled={disabled || uploading} data-testid="ed-image-remove" onClick={() => { play("click"); onChange(null); }} className={cn(btn, "ah-cream")}>Bỏ ảnh</button>
              </>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        hidden
        data-testid="ed-image-input"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }}
      />
      {src && <ImageCropper src={src.url} crossOrigin={!src.local} busy={uploading} onCancel={closeEditor} onDone={upload} />}
    </div>
  );
}

/** Cắt ảnh vuông: kéo để căn, lăn chuột / thanh trượt để phóng, nút xoay 90°; xuất WebP 800×800 */
function ImageCropper({ src, crossOrigin, busy, onCancel, onDone }: {
  src: string;
  crossOrigin: boolean;
  busy: boolean;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState(300);
  const [rot, setRot] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Ảnh trên CDN: tải kèm CORS (CDN trả Access-Control-Allow-Origin: *) để vẽ lại được lên canvas
  const imgSrc = crossOrigin ? `${src}${src.includes("?") ? "&" : "?"}edit=1` : src;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setView(el.clientWidth || 300);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Kích thước ảnh sau xoay; "vừa khung" = phủ kín ô vuông (zoom 1); thu nhỏ tới mức thấy trọn ảnh
  const turned = rot % 180 !== 0;
  const W = nat ? (turned ? nat.h : nat.w) : 1;
  const H = nat ? (turned ? nat.w : nat.h) : 1;
  const cover = Math.max(view / W, view / H);
  const minZoom = Math.min(view / W, view / H) / cover;
  const scale = cover * zoom; // px màn hình / px ảnh

  const reset = () => { setZoom(1); setOff({ x: 0, y: 0 }); };

  const exportBlob = async () => {
    const img = imgRef.current;
    if (!img || !nat) return;
    const k = OUT / view;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.imageSmoothingQuality = "high";
    ctx.translate(OUT / 2 + off.x * k, OUT / 2 + off.y * k);
    ctx.rotate((rot * Math.PI) / 180);
    const w = nat.w * scale * k;
    const h = nat.h * scale * k;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.88));
      if (!blob) throw new Error("toBlob");
      onDone(blob);
    } catch {
      // Ảnh cũ không cho vẽ lại (thiếu CORS) → báo đăng lại từ máy
      play("error");
      toast.error("Không sửa được ảnh này — hãy bấm Đổi ảnh và chọn lại ảnh từ máy.");
    }
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center bg-[rgba(36,30,26,0.6)] p-4" onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-label="Sửa ảnh quà" data-testid="image-cropper" className="ah-dialog ah-panel v2-pop flex w-full max-w-[400px] flex-col gap-3 p-4">
        <h3 className="ah-hand text-xl font-bold">✂️ Sửa ảnh quà</h3>
        <p className="-mt-2 text-[12px] font-bold text-[#6e4722]">Kéo ảnh để căn giữa món quà, lăn chuột hoặc kéo thanh để phóng to.</p>
        <div
          ref={boxRef}
          className="relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-[18px] border-[3px] border-[#241e1a] bg-white active:cursor-grabbing"
          style={{ backgroundImage: "repeating-conic-gradient(#f3ece0 0 25%, #fffdf8 0 50%)", backgroundSize: "20px 20px" }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            dragRef.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (d) setOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
          }}
          onPointerUp={() => (dragRef.current = null)}
          onPointerCancel={() => (dragRef.current = null)}
          onWheel={(e) => setZoom((z) => Math.min(4, Math.max(minZoom, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tạm (blob:) hoặc ảnh CDN đang sửa */}
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            crossOrigin={crossOrigin ? "anonymous" : undefined}
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width: (nat?.w ?? 0) * scale,
              height: (nat?.h ?? 0) * scale,
              transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) rotate(${rot}deg)`,
              visibility: nat ? "visible" : "hidden",
            }}
          />
          {!nat && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#9e6b3f]">{failed ? "Không mở được ảnh" : "Đang mở ảnh…"}</span>}
          {/* khung gợi ý: phần thẻ quà thường thấy rõ nhất */}
          <span aria-hidden className="pointer-events-none absolute inset-[8%] rounded-[14px] border-2 border-dashed border-white/80 mix-blend-difference" />
        </div>
        <label className="flex items-center gap-2 text-[12px] font-black text-[#6e4722]">
          🔍
          <input type="range" min={minZoom} max={4} step={0.01} value={zoom} data-testid="crop-zoom" onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[#ea6a51]" aria-label="Phóng to / thu nhỏ" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="crop-rotate" onClick={() => { play("click"); setRot((r) => (r + 90) % 360); setOff({ x: 0, y: 0 }); }} className="ah-btn ah-cream h-10 px-3 text-[13px]">⟳ Xoay</button>
          <button type="button" onClick={() => { play("click"); setZoom(Math.max(minZoom, Math.min(1, minZoom))); setOff({ x: 0, y: 0 }); }} className="ah-btn ah-cream h-10 px-3 text-[13px]">Thấy trọn ảnh</button>
          <button type="button" onClick={() => { play("click"); reset(); }} className="ah-btn ah-cream h-10 px-3 text-[13px]">Phủ kín</button>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="ah-btn ah-cream h-11 flex-1">Huỷ</button>
          <button type="button" disabled={busy || !nat} data-testid="crop-ok" onClick={exportBlob} className="ah-btn ah-gold h-11 flex-[2]">{busy ? "Đang tải lên…" : "Dùng ảnh này"}</button>
        </div>
      </div>
    </div>
  );
}
