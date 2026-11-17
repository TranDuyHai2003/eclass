"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { ZoomIn, ZoomOut, RotateCw, Loader2, FileWarning, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, polyfillURLParse } from "@/lib/utils";
import { isGoogleDriveFolder, normalizePdfUrl, resolvePdfFileUrl } from "@/lib/pdf-url";

polyfillURLParse();

// Cấu hình worker cho PDF.js (dùng file local để tránh CORS)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.wrapper.js";

/** Chỉ render các trang trong khoảng này quanh vùng nhìn thấy; trang xa hơn là khung giữ chỗ. */
const RENDER_MARGIN = "1500px 0px";
const DEFAULT_ASPECT = 1.414; // A4

export interface PdfOverlayMarker {
  key: string;
  page: number;
  /** % chiều cao trang */
  y: number;
  label?: string;
  tone?: "active" | "default" | "end";
  onClick?: () => void;
}

interface PDFViewerProps {
  url: string;
  className?: string;
  hideToolbar?: boolean;
  noScroll?: boolean;
  flat?: boolean;
  renderLeft?: React.ReactNode;
  /** Gọi khi tài liệu tải xong (vd: để dò vị trí các câu) */
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void;
  /** Cuộn tới vị trí này và đánh dấu; đổi `key` để cuộn lại */
  scrollTarget?: { page: number; yPct: number; key: string; label?: string } | null;
  /** Các vạch đánh dấu vẽ đè lên trang */
  markers?: PdfOverlayMarker[];
  /** Bấm lên trang → trả về vị trí (trang, % chiều cao). Bật con trỏ chọn khi có. */
  onPageClick?: (page: number, y: number) => void;
  renderTextLayer?: boolean;
  /** Vẽ dải đánh dấu tại scrollTarget (mặc định có) */
  highlightTarget?: boolean;
  /** Giới hạn bề rộng trang (px) để dễ đọc trên màn hình rộng */
  maxPageWidth?: number;
}

export default function PDFViewer({
  url: rawUrl,
  className,
  hideToolbar = false,
  noScroll = false,
  flat = false,
  renderLeft,
  onDocumentLoad,
  scrollTarget,
  markers,
  onPageClick,
  renderTextLayer = true,
  highlightTarget = true,
  maxPageWidth,
}: PDFViewerProps) {
  const url = normalizePdfUrl(rawUrl);

  const [numPages, setNumPages] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [defaultAspect, setDefaultAspect] = useState(DEFAULT_ASPECT);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([1, 2]));

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [renderTick, setRenderTick] = useState(0);
  const pendingScrollRef = useRef<string | null>(null);
  const lastScrolledKeyRef = useRef<string | null>(null);

  // Theo dõi kích thước vùng cuộn (đã trừ thanh cuộn; kể cả khi nằm trong tab bị ẩn rồi hiện lại)
  useEffect(() => {
    const container = scrollAreaRef.current;
    if (!container) return;
    const updateWidth = () => {
      // trừ padding (2×16px) + viền trang (2px) để không sinh thanh cuộn ngang
      if (container.clientWidth > 0) {
        const available = container.clientWidth - 34;
        setContainerWidth(maxPageWidth ? Math.min(available, maxPageWidth) : available);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxPageWidth]);

  // Lazy render: chỉ các trang gần vùng nhìn thấy
  useEffect(() => {
    if (!numPages) return;
    // noScroll: trang cuộn theo khung cha → dùng khung cuộn gần nhất làm root,
    // vì rootMargin của viewport không vượt qua được phần bị khung cha cắt
    const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
      for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
      }
      return null;
    };
    const root = noScroll ? findScrollParent(scrollAreaRef.current) : scrollAreaRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            if (entry.isIntersecting && !next.has(page)) {
              next.add(page);
              changed = true;
            } else if (!entry.isIntersecting && next.has(page)) {
              next.delete(page);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { root, rootMargin: RENDER_MARGIN },
    );
    scrollAreaRef.current?.querySelectorAll<HTMLElement>("[data-page]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [numPages, noScroll]);

  // Đánh dấu cần cuộn mỗi khi đích thay đổi
  useEffect(() => {
    pendingScrollRef.current = scrollTarget?.key ?? null;
  }, [scrollTarget?.key]);

  // Người dùng tự cuộn → ngừng tự căn chỉnh
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const stop = () => {
      pendingScrollRef.current = null;
    };
    area.addEventListener("wheel", stop, { passive: true });
    area.addEventListener("touchstart", stop, { passive: true });
    area.addEventListener("mousedown", stop);
    return () => {
      area.removeEventListener("wheel", stop);
      area.removeEventListener("touchstart", stop);
      area.removeEventListener("mousedown", stop);
    };
  }, []);

  // Cuộn tới đích, rồi tiếp tục căn lại mỗi khi trang render/đổi kích thước làm lệch vị trí
  useEffect(() => {
    if (!scrollTarget || pendingScrollRef.current !== scrollTarget.key) return;
    const area = scrollAreaRef.current;
    const pageEl = area?.querySelector<HTMLElement>(`[data-page="${scrollTarget.page}"]`);
    if (!area || !pageEl || pageEl.offsetHeight === 0) return;

    const areaTop = area.getBoundingClientRect().top;
    const pageTop = pageEl.getBoundingClientRect().top - areaTop + area.scrollTop;
    const top = Math.max(0, pageTop + (pageEl.offsetHeight * scrollTarget.yPct) / 100 - 24);
    const isNewTarget = lastScrolledKeyRef.current !== scrollTarget.key;
    lastScrolledKeyRef.current = scrollTarget.key;
    if (isNewTarget || Math.abs(area.scrollTop - top) > 4) {
      area.scrollTo({ top, behavior: isNewTarget ? "smooth" : "auto" });
    }
  }, [scrollTarget, renderTick, containerWidth, zoom, aspects]);

  const handlePageClick = useCallback(
    (pageNum: number, e: React.MouseEvent<HTMLDivElement>) => {
      if (!onPageClick || rotation !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPageClick(pageNum, Math.round(Math.min(100, Math.max(0, y)) * 10) / 10);
    },
    [onPageClick, rotation],
  );

  if (isGoogleDriveFolder(url)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-red-50 rounded-xl">
        <FileWarning className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-sm font-bold text-red-600">Đây là link thư mục Google Drive, không phải file PDF.</p>
        <p className="text-xs text-red-500 mt-2">
          Vui lòng upload file PDF trực tiếp lên hệ thống hoặc dùng link chia sẻ từng file.
        </p>
      </div>
    );
  }

  const fileUrl = resolvePdfFileUrl(rawUrl);

  function onDocumentLoadSuccess(pdf: PDFDocumentProxy) {
    setNumPages(pdf.numPages);
    setAspects({});
    pdf
      .getPage(1)
      .then((page) => {
        const vp = page.getViewport({ scale: 1 });
        if (vp.width > 0) setDefaultAspect(vp.height / vp.width);
      })
      .catch(() => {});
    onDocumentLoad?.(pdf);
  }

  const pageWidth = (containerWidth > 0 ? containerWidth : 600) * zoom;
  const isSideways = rotation % 180 !== 0;
  const pageHeight = (pageNum: number) => {
    const aspect = aspects[pageNum] ?? defaultAspect;
    return pageWidth * (isSideways ? 1 / aspect : aspect);
  };

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-slate-200/50",
        !noScroll && "h-full overflow-hidden",
        !flat && "rounded-xl border border-slate-200",
        className,
      )}
    >
      {/* PDF Toolbar */}
      {!hideToolbar && (
        <div
          className={cn(
            "flex items-center justify-between px-3 md:px-6 bg-white border-b border-slate-200 shadow-sm z-30 shrink-0 h-14 md:h-12",
            noScroll ? "sticky top-0" : "relative",
          )}
        >
          {renderLeft ? (
            <div className="flex-1 min-w-0 mr-4">{renderLeft}</div>
          ) : (
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {numPages} trang | {Math.round(zoom * 100)}%
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((prev) => Math.max(prev - 0.2, 0.5))}
              className="h-8 w-8 rounded-lg"
              disabled={zoom <= 0.5}
              aria-label="Thu nhỏ"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((prev) => Math.min(prev + 0.2, 3.0))}
              className="h-8 w-8 rounded-lg"
              disabled={zoom >= 3.0}
              aria-label="Phóng to"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Mở file PDF"
              className="flex items-center gap-2 px-3 py-1.5 ml-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg transition-all touch-manipulation"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="h-8 w-8 rounded-lg"
              aria-label="Xoay trang"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Content Area */}
      <div
        ref={scrollAreaRef}
        className={cn("flex-1 relative bg-slate-300/20 overflow-auto", !noScroll ? "h-full" : "overflow-y-visible")}
      >
        <div className="flex justify-center min-w-fit">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Đang tải tài liệu...</p>
              </div>
            }
            onLoadError={(error) => console.error("Lỗi tải PDF chi tiết:", error)}
            error={
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-blue-500">
                <FileWarning className="h-10 w-10" />
                <p className="text-sm font-bold uppercase tracking-widest">Không thể hiển thị PDF</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
                  Thử lại
                </Button>
              </div>
            }
          >
            <div className="space-y-4 p-4">
              {pages.map((pageNum) => {
                const pageMarkers = rotation === 0 ? markers?.filter((m) => m.page === pageNum) : undefined;
                const showTarget = highlightTarget && scrollTarget && scrollTarget.page === pageNum && rotation === 0;
                return (
                  <div key={pageNum} className="flex justify-center">
                    <div
                      className={cn("relative", onPageClick && "cursor-crosshair")}
                      data-page={pageNum}
                      style={{ minHeight: pageHeight(pageNum), minWidth: pageWidth }}
                      onClick={onPageClick ? (e) => handlePageClick(pageNum, e) : undefined}
                    >
                      {visiblePages.has(pageNum) ? (
                        <Page
                          pageNumber={pageNum}
                          scale={zoom}
                          rotate={rotation}
                          width={containerWidth > 0 ? containerWidth : undefined}
                          className="shadow-2xl border border-slate-300 rounded-sm overflow-hidden"
                          loading={null}
                          renderTextLayer={renderTextLayer}
                          onLoadSuccess={(page) => {
                            const ratio = page.originalHeight / page.originalWidth;
                            if (ratio > 0 && Math.abs((aspects[pageNum] ?? 0) - ratio) > 0.001) {
                              setAspects((prev) => ({ ...prev, [pageNum]: ratio }));
                            }
                          }}
                          onRenderSuccess={() => setRenderTick((t) => t + 1)}
                        />
                      ) : (
                        <div
                          className="bg-white border border-slate-300 rounded-sm shadow-2xl"
                          style={{ width: pageWidth, height: pageHeight(pageNum) }}
                        />
                      )}

                      {pageMarkers?.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            m.onClick?.();
                          }}
                          className={cn(
                            "absolute left-0 right-0 z-10 flex items-center text-left",
                            !m.onClick && "pointer-events-none",
                          )}
                          style={{ top: `${m.y}%` }}
                        >
                          <span
                            className={cn(
                              "-translate-y-1/2 rounded-r-md px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow",
                              m.tone === "active" ? "bg-amber-500" : m.tone === "end" ? "bg-rose-500" : "bg-blue-500/80",
                            )}
                          >
                            {m.label}
                          </span>
                          <span
                            className={cn(
                              "h-0 flex-1 border-t-2",
                              m.tone === "active"
                                ? "border-amber-500"
                                : m.tone === "end"
                                  ? "border-dashed border-rose-500"
                                  : "border-dashed border-blue-400/70",
                            )}
                          />
                        </button>
                      ))}

                      {showTarget && (
                        <div
                          key={scrollTarget.key}
                          className="pointer-events-none absolute left-0 right-0 z-10 flex items-center animate-in fade-in duration-500"
                          style={{ top: `calc(${scrollTarget.yPct}% - 6px)` }}
                        >
                          <div className="h-7 w-1.5 rounded-r bg-amber-400" />
                          {scrollTarget.label && (
                            <span className="ml-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[10px] font-black uppercase text-white shadow">
                              {scrollTarget.label}
                            </span>
                          )}
                          <div className="ml-1 h-7 flex-1 bg-amber-300/20" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
