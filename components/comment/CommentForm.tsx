"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/actions/comment";
import { toast } from "sonner";
import { Loader2, Send, Image as ImageIcon, X, Plus, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";

const commentSchema = z.object({
  content: z.string().min(1, "Nội dung không được để trống"),
});

type CommentFormValues = z.infer<typeof commentSchema>;

interface CommentFormProps {
  lessonId: string;
  parentId?: string; // If replying
  onSuccess?: () => void;
  onCancel?: () => void; // If reply mode
  placeholder?: string;
  className?: string;
}

export function CommentForm({
  lessonId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = "Viết bình luận của bạn...",
  className,
}: CommentFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const uploadedUrls: string[] = [...images];

    for (const file of files) {
      try {
        const res = await axios.put<{ publicUrl: string }>(
          `/api/upload/proxy?fileName=${encodeURIComponent(file.name)}`,
          file,
          {
            headers: {
              "Content-Type": file.type || "image/jpeg",
            },
          }
        );
        if (res.data.publicUrl) {
          uploadedUrls.push(res.data.publicUrl);
        }
      } catch (error) {
        toast.error(`Lỗi tải ảnh: ${file.name}`);
      }
    }

    setImages(uploadedUrls);
    setIsUploading(false);
    e.target.value = ""; // Reset
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CommentFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await createComment(lessonId, data.content, parentId, images);
      if (res.success) {
        toast.success(parentId ? "Đã gửi câu trả lời" : "Đã đăng bình luận");
        reset();
        setImages([]);
        onSuccess?.();
      } else {
        toast.error(res.error || "Có lỗi xảy ra");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("space-y-4", className)}
    >
      <div className="relative group/form border border-slate-200 rounded-[24px] bg-white focus-within:border-red-500/50 focus-within:shadow-xl focus-within:shadow-red-500/5 transition-all duration-300 overflow-hidden">
        <Textarea
          {...register("content")}
          placeholder={placeholder}
          disabled={isSubmitting}
          className={cn(
            "min-h-[120px] w-full border-none bg-transparent px-5 py-4 resize-none focus-visible:ring-0 text-slate-700 placeholder:text-slate-400 text-sm leading-relaxed",
            errors.content && "placeholder:text-red-300"
          )}
        />
        
        {/* Image Previews */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3 px-5 pb-3">
            {images.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-100 group/img shadow-sm transition-transform hover:scale-105">
                <img src={url} alt="Upload" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 bg-slate-900/60 hover:bg-slate-900 p-1.5 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {isUploading && (
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-50 bg-slate-50/50 backdrop-blur-md">
          <div className="flex items-center gap-1">
            <label className="cursor-pointer p-2.5 rounded-xl hover:bg-white hover:text-red-600 text-slate-400 transition-all hover:shadow-sm">
              <Paperclip className="w-5 h-5" />
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={isSubmitting || isUploading}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            {parentId && onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-4 h-10 rounded-xl"
              >
                Hủy bỏ
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploading}
              className="h-10 px-6 rounded-xl bg-slate-900 hover:bg-red-600 text-white font-black uppercase tracking-widest text-[10px] gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Đăng bài</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {errors.content && (
        <p className="text-[10px] text-red-500 px-4 font-black uppercase tracking-widest animate-pulse">
          {errors.content.message}
        </p>
      )}
    </form>
  );
}
