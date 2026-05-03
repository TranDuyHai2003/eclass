"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MoreHorizontal, MessageSquare, Pencil, Trash2, Heart, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommentForm } from "./CommentForm";
import { updateComment, deleteComment } from "@/actions/comment";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

interface CommentItemProps {
  comment: any; // Using basic type for now, improve with Prisma types later
  currentUserId?: string;
  isTeacherOrAdmin?: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  isTeacherOrAdmin,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = currentUserId === comment.userId;
  const canDelete = isOwner || isTeacherOrAdmin;

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    try {
      const res = await updateComment(comment.id, editContent);
      if (res.success) {
        toast.success("Đã cập nhật bình luận");
        setIsEditing(false);
      } else {
        toast.error("Lỗi cập nhật");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteComment(comment.id);
      if (res.success) {
        toast.success("Đã xóa bình luận");
      } else {
        toast.error("Lỗi xóa bình luận");
      }
    } catch {
      toast.error("Lỗi hệ thống");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex gap-x-4 group animate-in fade-in slide-in-from-left-2 duration-300">
      {/* Avatar with status indicator */}
      <div className="flex-shrink-0 pt-1">
        <div className="relative w-10 h-10 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-transform hover:scale-110 group-hover:border-red-100">
          <Image
            src={comment.user.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name || "User")}&background=random`}
            alt={comment.user.name || "User"}
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="bg-slate-50/50 hover:bg-white rounded-[24px] px-5 py-4 border border-slate-100/50 hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/20 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {comment.user.name}
              </span>
              {comment.user.role === "TEACHER" && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-red-200">
                  Mentor
                </span>
              )}
              {comment.user.role === "ADMIN" && (
                <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded-lg uppercase tracking-widest">
                  Staff
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </span>
            </div>

            {/* Actions Menu */}
            {(isOwner || canDelete) && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-100 rounded-xl"
                  >
                    <MoreHorizontal className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl border-slate-100 shadow-2xl p-2">
                  {isOwner && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="rounded-xl gap-2 font-bold text-slate-600 focus:text-red-600 focus:bg-red-50">
                      <Pencil className="h-4 w-4" />
                      Chỉnh sửa
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="rounded-xl gap-2 font-bold text-red-600 focus:bg-red-50">
                        <ConfirmModal 
                          title="Xóa bình luận?"
                          description="Hành động này không thể hoàn tác."
                          onConfirm={handleDelete}
                          disabled={isDeleting}
                        >
                           <div className="flex items-center w-full cursor-pointer">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa
                           </div>
                        </ConfirmModal>
                     </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Comment Text or Edit Form */}
          {isEditing ? (
            <div className="space-y-3 mt-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[100px] bg-white border-slate-200 rounded-2xl focus-visible:ring-red-500/20"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl font-bold"
                >
                  Hủy
                </Button>
                <Button size="sm" onClick={handleUpdate} className="bg-red-600 hover:bg-red-700 rounded-xl px-6 font-bold">
                  Lưu
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
              {comment.content}
            </p>
          )}

          {/* Comment Images - Grid Style */}
          {comment.images && comment.images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {comment.images.map((url: string, i: number) => (
                <div key={i} className="relative aspect-square rounded-[20px] overflow-hidden border border-slate-100 shadow-sm cursor-zoom-in group/img">
                  <Image
                    src={url}
                    alt={`Comment image ${i + 1}`}
                    fill
                    className="object-cover group-hover/img:scale-110 transition-transform duration-500"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Interaction Footer */}
        {!isEditing && (
          <div className="flex items-center gap-6 mt-3 ml-5">
            <button
              onClick={() => setIsReplying(!isReplying)}
              className={cn(
                "text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 active:scale-95",
                isReplying
                  ? "text-red-600"
                  : "text-slate-400 hover:text-red-600",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Trả lời
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 flex items-center gap-2 transition-all hover:scale-105">
               <Heart className="h-3.5 w-3.5" />
               Thích
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-all hover:scale-105">
               <Share2 className="h-3.5 w-3.5" />
               Chia sẻ
            </button>
          </div>
        )}

        {/* Reply Form Section */}
        {isReplying && (
          <div className="mt-5 pl-5 border-l-2 border-red-100 animate-in slide-in-from-top-2 duration-300">
            <CommentForm
              lessonId={comment.lessonId}
              parentId={comment.id}
              onSuccess={() => setIsReplying(false)}
              onCancel={() => setIsReplying(false)}
              placeholder={`Trả lời ${comment.user.name}...`}
            />
          </div>
        )}

        {/* Nested Replies with refined spacing */}
        {comment.children && comment.children.length > 0 && (
          <div className="mt-6 pl-5 border-l-2 border-slate-50 space-y-6">
            {comment.children.map((reply: any) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                isTeacherOrAdmin={isTeacherOrAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
