"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { VideoExplorer } from "@/components/teacher/videos/VideoExplorer";

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
      toast.success(`Đã đồng bộ thành công ${res.data.count} video từ Backblaze B2.`);
      router.refresh();
    } catch (error) {
      toast.error("Lỗi khi đồng bộ video.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Khám phá tệp tin</h2>
        <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm" className="border-orange-200 text-orange-700 hover:bg-orange-50">
          <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? "Đang cập nhật DB..." : "Đồng bộ Database"}
        </Button>
      </div>

      <div className="h-[600px]">
        <VideoExplorer />
      </div>
    </div>
  );
}
