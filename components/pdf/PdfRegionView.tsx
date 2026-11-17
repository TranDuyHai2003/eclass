"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Document, Page, pdfjs } from "react-pdf";
import { FileWarning, Loader2 } from "lucide-react";
import { cn, polyfillURLParse } from "@/lib/utils";
import { resolvePdfFileUrl } from "@/lib/pdf-url";
import type { PdfLayout } from "@/lib/pdf-question-anchors";

polyfillURLParse();
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.wrapper.js";

const DEFAULT_ASPECT = 1.414;

export interface RegionSegment {
  page: number;
  /** % chiều cao trang */
  top: number;
  bottom: number;
}

interface PdfRegionViewProps {
  url: string;
  /** null = chưa có vùng (vẫn tải tài liệu để onDocumentLoad chạy) */
  segments: RegionSegment[] | null;
  layout: Pick<PdfLayout, "left" | "right">;
  zoom?: number;
  onDocumentLoad?: (pdf: PDFDocumentProxy) => void;
  /** Nội dung hiển thị khi chưa có vùng */
  placeholder?: React.ReactNode;
  className?: string;
  /**
   * Tài liệu đã tải sẵn (từ PdfDocumentLoader). Có thì dùng chung, không tạo <Document> riêng —
   * cho phép vẽ nhiều vùng của cùng một file ở nhiều chỗ mà chỉ tải/phân tích file một lần.
   */
  pdf?: PDFDocumentProxy | null;
}

/**
 * Hiển thị một vùng của PDF (có thể trải qua nhiều trang) như một ảnh liền mạch:
 * cắt lề trái/phải để chữ to hơn và chỉ render các trang thuộc vùng.
 * Giữ nguyên một <Document> khi đổi vùng nên chuyển câu không phải tải lại file.
 */
export default function PdfRegionView({
  url,
  segments,
  layout,
  zoom = 1,
  onDocumentLoad,
  placeholder,
  className,
  pdf,
}: PdfRegionViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const viewWidth = Math.round((width || 600) * zoom);
  const visibleFraction = Math.max(0.3, (layout.right - layout.left) / 100);
  const pageRenderWidth = Math.round(viewWidth / visibleFraction);
  const offsetX = (pageRenderWidth * layout.left) / 100;

  const renderSegments = () =>
    segments?.map((seg, i) => {
      const pageHeight = pageRenderWidth * (aspects[seg.page] ?? DEFAULT_ASPECT);
      const height = (pageHeight * (seg.bottom - seg.top)) / 100;
      return (
        <div key={`${seg.page}-${seg.top}-${seg.bottom}`}>
          {i > 0 && <div className="mx-auto my-1 border-t border-dashed border-slate-300" style={{ width: viewWidth }} />}
          <div className="relative mx-auto overflow-hidden bg-white" style={{ width: viewWidth, height }}>
            <div className="absolute" style={{ left: -offsetX, top: -(pageHeight * seg.top) / 100 }}>
              <Page
                {...(pdf ? { pdf } : {})}
                pageNumber={seg.page}
                width={pageRenderWidth}
                devicePixelRatio={Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1)}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={<div className="bg-white" style={{ width: pageRenderWidth, height: pageHeight }} />}
                onLoadSuccess={(page) => {
                  const ratio = page.originalHeight / page.originalWidth;
                  if (ratio > 0 && Math.abs((aspects[seg.page] ?? 0) - ratio) > 0.001) {
                    setAspects((prev) => ({ ...prev, [seg.page]: ratio }));
                  }
                }}
              />
            </div>
          </div>
        </div>
      );
    });

  if (pdf) {
    return (
      <div ref={wrapperRef} className={cn("w-full overflow-x-auto", className)}>
        {!segments || segments.length === 0 ? placeholder : renderSegments()}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={cn("w-full overflow-x-auto", className)}>
      <Document
        file={resolvePdfFileUrl(url)}
        onLoadSuccess={(doc) => {
          setLoaded(true);
          onDocumentLoad?.(doc);
        }}
        loading={
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Đang tải lời giải...
          </div>
        }
        error={
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-blue-500">
            <FileWarning className="h-8 w-8" />
            <p className="text-sm font-bold">Không thể tải file lời giải</p>
          </div>
        }
      >
        {loaded && (!segments || segments.length === 0) && placeholder}
        {renderSegments()}
      </Document>
    </div>
  );
}

/** Tải một file PDF (không hiển thị gì) và trả tài liệu qua onLoad để các PdfRegionView dùng chung. */
export function PdfDocumentLoader({
  url,
  onLoad,
  onError,
}: {
  url: string;
  onLoad: (pdf: PDFDocumentProxy) => void;
  onError?: () => void;
}) {
  return (
    <div className="hidden" aria-hidden>
      <Document file={resolvePdfFileUrl(url)} onLoadSuccess={onLoad} onLoadError={onError} loading={null} error={null} />
    </div>
  );
}
