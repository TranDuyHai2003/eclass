"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertCircle size={40} />
      </div>
      
      <h2 className="mb-2 text-2xl font-black text-slate-900 uppercase tracking-tight">
        Đã xảy ra lỗi không mong muốn
      </h2>
      
      <p className="mb-8 max-w-md text-slate-500 font-medium">
        Hệ thống gặp sự cố khi xử lý yêu cầu của bạn. Điều này thường do trình duyệt cũ hoặc xung đột tiện ích mở rộng.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={() => reset()}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-12 rounded-2xl shadow-lg shadow-blue-200"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Thử lại ngay
        </Button>
        
        <Button
          variant="outline"
          onClick={() => window.location.href = "/"}
          className="border-slate-200 text-slate-600 font-bold px-8 h-12 rounded-2xl"
        >
          Quay lại trang chủ
        </Button>
      </div>

      <div className="mt-12 p-4 bg-slate-50 rounded-xl border border-slate-100 max-w-lg text-left overflow-auto max-h-64">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
          Mã lỗi kỹ thuật
        </p>
        <p className="text-[11px] font-mono text-slate-600 break-all mb-2">
          {error.message || "Unknown Exception"} {error.digest && `(Digest: ${error.digest})`}
        </p>
        {error.stack && (
          <>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 border-t border-slate-200 pt-2 mt-2">
              Chi tiết (Stack Trace)
            </p>
            <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap break-all">
              {error.stack}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
