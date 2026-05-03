"use client";

import { FileText, Download, ExternalLink } from "lucide-react";

type Attachment = {
  id: string;
  name: string;
  url: string;
};

interface DocumentViewerProps {
  attachments: Attachment[];
}

export function DocumentViewer({ attachments }: DocumentViewerProps) {
  const getSafeUrl = (url: string | null) => {
    if (!url) return "";
    // Encode characters that are common in filenames but illegal in URLs like &
    return url.replace(/ /g, "%20").replace(/&/g, "%26").replace(/\(/g, "%28").replace(/\)/g, "%29");
  };

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50/50">
        <FileText className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-bold">Không có tài liệu cho bài học này</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white p-6 space-y-4">
      <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 mb-2">Danh sách tài liệu</h3>
      <div className="flex flex-col gap-3">
        {attachments.map((doc) => {
          const safeUrl = getSafeUrl(doc.url);
          return (
            <div 
              key={doc.id} 
              className="group flex items-center justify-between p-4 bg-gray-50/50 border border-gray-100 rounded-2xl hover:border-red-200 hover:bg-white hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-xl text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-700 truncate max-w-[200px]">
                    {doc.name}
                  </span>
                  <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">Tài liệu học tập</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                  title="Mở trong tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <a
                  href={safeUrl}
                  download
                  className="p-2 bg-white border border-gray-100 rounded-xl text-gray-400 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                  title="Tải xuống"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
