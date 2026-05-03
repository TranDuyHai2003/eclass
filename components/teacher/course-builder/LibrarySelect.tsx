"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlaySquare, Loader2 } from "lucide-react";
import { createLesson, updateLesson } from "@/actions/course";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VideoExplorer } from "@/components/teacher/videos/VideoExplorer";

interface FileItem {
  name: string;
  key: string;
  url: string;
  size: number;
  type: "FILE";
}

interface LibrarySelectProps {
  chapterId?: string;
  onSelectVideo?: (url: string) => void;
  customTrigger?: React.ReactNode;
}

export function LibrarySelect({ chapterId, onSelectVideo, customTrigger }: LibrarySelectProps) {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();

  const handleSelect = async (file: FileItem) => {
    try {
      setIsAdding(true);
      
      if (onSelectVideo) {
        // Mode 2: Just return the selected video URL to the parent component
        onSelectVideo(file.url);
        toast.success("Đã chọn video!");
        setOpen(false);
      } else if (chapterId) {
        // Mode 1: Create a brand new lesson in the chapter
        const title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        const createRes = await createLesson(chapterId, title);
        if (!createRes.success || !createRes.lesson) {
          toast.error("Không thể tạo bài học");
          return;
        }
        
        await updateLesson(createRes.lesson.id, { 
          videoUrl: file.url, 
          isPublished: false 
        });
        
        toast.success("Đã thêm video vào chương!");
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      toast.error("Lỗi khi thêm video");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Thư viện Video (Cloud Explorer)</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden p-6 pt-0">
          {isAdding ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
              <p className="text-gray-500 font-medium">Đang xử lý bài học...</p>
            </div>
          ) : (
            <VideoExplorer 
              onSelect={handleSelect} 
              className="h-full border-none shadow-none"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
