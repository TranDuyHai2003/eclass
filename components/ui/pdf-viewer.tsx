"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Cấu hình worker cho PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  className?: string;
  hideToolbar?: boolean;
  noScroll?: boolean;
  flat?: boolean;
  renderLeft?: React.ReactNode;
}

export default function PDFViewer({
  url,
  className,
  hideToolbar = false,
  noScroll = false,
  flat = false,
  renderLeft,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);

  // Resize listener to make PDF responsive
  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById("pdf-container");
      if (container) {
        setContainerWidth(container.clientWidth - 32); 
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  // Render all pages in continuous scroll mode
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div
      id="pdf-container"
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
            <div className="flex-1 min-w-0 mr-4">
              {renderLeft}
            </div>
          ) : (
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {numPages} trang | {Math.round(zoom * 100)}%
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="h-8 w-8 rounded-lg"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="h-8 w-8 rounded-lg"
              disabled={zoom >= 3.0}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="h-8 w-8 rounded-lg"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* PDF Content Area */}
      <div
        className={cn(
          "flex-1 relative bg-slate-300/20 overflow-auto",
          !noScroll ? "h-full" : "overflow-y-visible",
        )}
      >
        <div className="flex justify-center min-w-fit">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  Đang tải tài liệu...
                </p>
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-500">
                <FileWarning className="h-10 w-10" />
                <p className="text-sm font-bold uppercase tracking-widest">
                  Không thể hiển thị PDF
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="mt-2"
                >
                  Thử lại
                </Button>
              </div>
            }
          >
            <div className="space-y-4 p-4">
              {pages.map((pageNum) => (
                <div key={pageNum} className="flex justify-center">
                  <Page
                    pageNumber={pageNum}
                    scale={zoom}
                    rotate={rotation}
                    width={containerWidth > 0 ? containerWidth : undefined}
                    className="shadow-2xl border border-slate-300 rounded-sm overflow-hidden"
                    loading={null}
                  />
                </div>
              ))}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
