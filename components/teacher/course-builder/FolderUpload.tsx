"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FolderUp, Loader2 } from "lucide-react";
import { createLesson, updateLesson } from "@/actions/course";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface FolderUploadProps {
  chapterId: string;
}

export function FolderUpload({ chapterId }: FolderUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [currentFileName, setCurrentFileName] = useState("");
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Filter only .mp4 files
    const videoFiles = files.filter(f => f.name.toLowerCase().endsWith(".mp4"));
    
    if (videoFiles.length === 0) {
      toast.error("Không tìm thấy file .mp4 nào trong thư mục.");
      return;
    }

    setIsUploading(true);
    setTotalFiles(videoFiles.length);
    let successCount = 0;

    for (let i = 0; i < videoFiles.length; i++) {
      setCurrentFileIndex(i + 1);
      setProgress(0);
      const file = videoFiles[i];
      setCurrentFileName(file.name);
      
      // Clean up title: 'Bai_01_Gioi_Thieu.mp4' -> 'Bài 01 Giới Thiệu'
      let title = file.name.replace(/\.mp4$/i, "");
      title = title.replace(/_/g, " ");

      try {
        // 1. Create empty lesson
        const createRes = await createLesson(chapterId, title);
        if (!createRes.success || !createRes.lesson) {
          toast.error(`Không thể tạo bài học: ${title}`);
          continue;
        }

        const lessonId = createRes.lesson.id;

        // 2. Tải file lên thông qua Proxy Server (Bypass CORS & bảo mật AccessKey)
        const uploadRes = await axios.put(`/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`, file, {
          headers: {
            "Content-Type": file.type || "video/mp4",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              ((progressEvent.loaded ?? 0) * 100) / (progressEvent.total ?? file.size)
            );
            setProgress(percentCompleted);
          },
        });

        const publicUrl = uploadRes.data.publicUrl;
        // 3. Update Lesson with publicUrl and make it unpublished by default
        await updateLesson(lessonId, { videoUrl: publicUrl, isPublished: false });
        successCount++;

      } catch (error) {
        console.error(`Lỗi upload file ${file.name}:`, error);
        toast.error(`Lỗi upload file ${file.name}`);
      }
    }

    setIsUploading(false);
    
    if (successCount > 0) {
      toast.success(`Đã tải lên thành công ${successCount}/${videoFiles.length} video.`);
      router.refresh(); 
    }
    
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="w-full mt-2 border-t pt-2">
      {isUploading ? (
        <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex flex-col gap-2">
          <div className="flex flex-col gap-1 text-sm font-medium text-red-700">
             <div className="flex items-center justify-between">
               <span className="flex items-center gap-2">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 Đang tải {currentFileIndex}/{totalFiles}
               </span>
               <span className="text-xs">{progress}%</span>
             </div>
             <span className="text-xs text-red-600/80 truncate">{currentFileName}</span>
          </div>
          <div className="w-full bg-red-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-red-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <label className="cursor-pointer w-full block">
          <Button
            asChild
            variant="outline"
            className="w-full justify-start text-xs font-medium border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50 text-gray-600 hover:text-red-700 h-9"
          >
            <span>
              <FolderUp className="h-4 w-4 mr-2" />
              Tải lên Folder Video (.mp4)
            </span>
          </Button>
          <input
            type="file"
            ref={inputRef}
            className="hidden"
            onChange={handleFolderSelect}
            // @ts-expect-error Custom attribute
            webkitdirectory="true"
            directory="true"
            multiple
          />
        </label>
      )}
    </div>
  );
}
