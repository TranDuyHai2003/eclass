"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/actions/comment";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  Image as ImageIcon,
  X,
  Plus,
  Paperclip,
} from "lucide-react";
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
          },
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
    setImages((prev) => prev.filter((_, i) => i !== index));
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

  const { ref, ...rest } = register("content");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("w-full space-y-2", className)}
    >
      <div className={cn(
        "relative group/form border border-slate-200 bg-white focus-within:border-red-500/50 focus-within:shadow-lg focus-within:shadow-red-500/5 transition-all duration-300 overflow-hidden",
        parentId ? "rounded-xl" : "rounded-2xl"
      )}>
        <textarea
          {...rest}
          ref={(e) => {
            ref(e);
          }}
          onChange={(e) => {
            rest.onChange(e);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder={placeholder}
          disabled={isSubmitting}
          rows={1}
          className={cn(
            parentId ? "min-h-[44px] px-3.5 py-2.5 text-xs" : "min-h-[48px] px-4 py-3 text-sm",
            "w-full border-none bg-transparent resize-none focus:outline-none focus:ring-0 text-slate-700 placeholder:text-slate-400 leading-relaxed custom-scrollbar max-h-[160px]"
          )}
        />

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2.5">
            {images.map((url, i) => (
              <div
                key={i}
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-100 group/img shadow-sm transition-transform hover:scale-105"
              >
                <img
                  src={url}
                  alt="Upload"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 bg-slate-900/60 hover:bg-slate-900 p-1 rounded-full text-white opacity-0 group-hover/img:opacity-100 transition-all backdrop-blur-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {isUploading && (
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            )}
          </div>
        )}

        <div className={cn(
          "flex items-center justify-between border-t border-slate-50 bg-slate-50/50 backdrop-blur-md",
          parentId ? "px-3 py-2" : "px-4 py-2.5"
        )}>
          <div className="flex items-center gap-1">
            <label className={cn(
              "cursor-pointer rounded-lg hover:bg-white hover:text-red-600 text-slate-400 transition-all hover:shadow-sm",
              parentId ? "p-1.5" : "p-2"
            )}>
              <Paperclip className={parentId ? "w-4 h-4" : "w-5 h-5"} />
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
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 px-3 h-7 rounded-lg"
              >
                Hủy
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isUploading}
              className={cn(
                parentId ? "h-7 px-3.5 rounded-lg text-[9px]" : "h-8.5 px-4.5 rounded-xl text-[10px]",
                "bg-red-500 hover:bg-red-600 text-white font-black uppercase tracking-widest gap-2 transition-all shadow-md active:scale-95 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <span>Gửi</span>
                  <Send className="h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {errors.content && (
        <p className="text-[10px] text-red-500 px-3 font-semibold tracking-wide animate-pulse">
          {errors.content.message}
        </p>
      )}
    </form>
  );
}
