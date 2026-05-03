"use client";

import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("@/components/ui/pdf-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-50 font-bold text-slate-400">
      Đang tải đề thi...
    </div>
  ),
});

interface PDFViewerClientWrapperProps {
  url: string;
}

export function PDFViewerClientWrapper({ url }: PDFViewerClientWrapperProps) {
  return <PDFViewer url={url} />;
}
