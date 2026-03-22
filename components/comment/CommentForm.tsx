"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createComment } from "@/actions/comment";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentSchema),
  });

  const onSubmit = async (data: CommentFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await createComment(lessonId, data.content, parentId);
      if (res.success) {
        toast.success(parentId ? "Đã gửi câu trả lời" : "Đã đăng bình luận");
        reset();
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
      <div className="relative">
        <Textarea
          {...register("content")}
          placeholder={placeholder}
          disabled={isSubmitting}
          className={cn(
            "min-h-[80px] pr-12 resize-none focus-visible:ring-red-500",
            errors.content && "border-red-500 focus-visible:ring-red-500",
          )}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full bg-red-600 hover:bg-red-700"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <Send className="h-4 w-4 text-white ml-0.5" />
          )}
        </Button>
      </div>
      {errors.content && (
        <p className="text-xs text-red-500">{errors.content.message}</p>
      )}
      {parentId && onCancel && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 h-auto py-1"
          >
            Hủy bỏ
          </Button>
        </div>
      )}
    </form>
  );
}
