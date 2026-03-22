"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, PlaySquare } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VideoAsset {
  id: string;
  title: string;
  fileName: string;
  url: string;
  size: number;
}

export function VideoLibraryClient({ initialData }: { initialData: VideoAsset[] }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await axios.post("/api/videos/sync");
      toast.success(`Đã đồng bộ thành công ${res.data.count} video từ máy chủ Bunny.`);
      router.refresh();
    } catch (error) {
      toast.error("Lỗi khi đồng bộ video.");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatSize = (kb: number) => {
    return (kb / 1024).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <Button onClick={handleSync} disabled={isSyncing} className="bg-orange-600 hover:bg-orange-700 text-white">
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? "Đang đồng bộ..." : "Đồng bộ từ BunnyCDN"}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialData.length === 0 ? (
            <div className="col-span-full py-16 text-center text-muted-foreground flex flex-col items-center">
              <PlaySquare className="h-12 w-12 text-gray-200 mb-3" />
              Chưa có video nào. Hãy tải video lên BunnyCDN và bấm "Đồng bộ".
            </div>
          ) : (
            initialData.map((video) => (
              <div key={video.id} className="border border-gray-100 rounded-lg p-3 hover:shadow-md transition-all flex items-center gap-3 bg-gray-50/50">
                <div className="bg-orange-100 p-2.5 rounded-md">
                  <PlaySquare className="h-6 w-6 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate" title={video.title}>
                    {video.title}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 mt-1 gap-1.5">
                    <span className="truncate max-w-[140px]" title={video.fileName}>{video.fileName}</span>
                    <span>•</span>
                    <span className="font-medium">{formatSize(video.size)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
