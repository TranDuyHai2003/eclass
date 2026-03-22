"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlaySquare, Loader2 } from "lucide-react";
import { createLesson, updateLesson } from "@/actions/course";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VideoAsset {
  id: string;
  title: string;
  fileName: string;
  url: string;
  size: number;
}

interface LibrarySelectProps {
  chapterId?: string;
  onSelectVideo?: (url: string) => void;
  customTrigger?: React.ReactNode;
}

export function LibrarySelect({ chapterId, onSelectVideo, customTrigger }: LibrarySelectProps) {
  const [open, setOpen] = useState(false);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  const fetchVideos = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get("/api/videos");
      setVideos(res.data);
    } catch (error) {
      toast.error("Lỗi khi tải thư viện video");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchVideos();
    }
  };

  const handleSelect = async (video: VideoAsset) => {
    try {
      setIsAdding(true);
      
      if (onSelectVideo) {
        // Mode 2: Just return the selected video URL to the parent component
        onSelectVideo(video.url);
        toast.success("Đã chọn video!");
        setOpen(false);
      } else if (chapterId) {
        // Mode 1: Create a brand new lesson in the chapter
        const createRes = await createLesson(chapterId, video.title);
        if (!createRes.success || !createRes.lesson) {
          toast.error("Không thể tạo bài học");
          return;
        }
        
        await updateLesson(createRes.lesson.id, { 
          videoUrl: video.url, 
          isPublished: false 
        });
        
        toast.success("Đã thả video vào chương!");
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Lỗi khi thêm video");
    } finally {
      setIsAdding(false);
    }
  };

  const formatSize = (kb: number) => {
    return (kb / 1024).toFixed(2) + " MB";
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {customTrigger ? customTrigger : (
          <Button
            variant="outline"
            className="w-full justify-start text-xs font-medium border-dashed border-gray-300 hover:border-orange-300 hover:bg-orange-50 text-gray-600 hover:text-orange-700 h-9"
          >
            <PlaySquare className="h-4 w-4 mr-2" />
            Chọn video từ Thư Viện
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thư viện Video của bạn</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : videos.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
            <PlaySquare className="h-10 w-10 text-gray-300 mb-3" />
            <p>Chưa có video nào trong thư viện.</p>
            <p className="text-sm mt-1">Hãy sang tab "Thư viện Video" bên trái để đồng bộ file từ BunnyCDN nhé.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
            {videos.map(video => (
              <div key={video.id} className="border rounded-md p-3 flex flex-col justify-between hover:border-orange-200 bg-gray-50/50 group">
                <div>
                  <h4 className="font-semibold text-sm line-clamp-2 text-gray-800" title={video.title}>{video.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{formatSize(video.size)}</p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleSelect(video)} 
                  disabled={isAdding}
                  className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-medium"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Thêm vào bài học"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
