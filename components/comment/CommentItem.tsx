"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  MoreHorizontal,
  MessageSquare,
  Pencil,
  Trash2,
  Heart,
  Share2,
  User,
  CornerDownRight,
  ShieldCheck,
} from "lucide-react";
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
  comment: any;
  currentUserId?: string;
  isTeacherOrAdmin?: boolean;
  onReplySuccess?: () => void;
  lessonId: string;
  depth?: number;
}

export function CommentItem({
  comment,
  currentUserId,
  isTeacherOrAdmin,
  onReplySuccess,
  lessonId,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isDeleting, setIsDeleting] = useState(false);

  const replyRef = (node: HTMLDivElement | null) => {
    if (node && isReplying) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const isOwner = currentUserId === comment.userId;
  const canDelete = isOwner || isTeacherOrAdmin;

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    try {
      const res = await updateComment(comment.id, editContent);
      if (res.success) {
        toast.success("Đã cập nhật bình luận");
        setIsEditing(false);
        onReplySuccess?.();
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
        onReplySuccess?.();
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
    <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className={cn(
        "flex w-full",
        depth > 0 ? "gap-2" : "gap-3"
      )}>
        {/* Avatar Container */}
        <div className={cn(
          "rounded-full border border-slate-100 shadow-sm shrink-0 overflow-hidden relative flex items-center justify-center bg-slate-100",
          depth > 0 ? "w-6 h-6 mt-1" : "w-8 h-8"
        )}>
          {comment.user?.image ? (
            <Image
              src={comment.user.image}
              alt={comment.user.name || "User"}
              fill
              className="object-cover"
            />
          ) : (
            <User className={depth > 0 ? "w-3 h-3 text-slate-500" : "w-4 h-4 text-slate-500"} />
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* Chat Bubble */}
          <div className="bg-slate-100/80 rounded-2xl rounded-tl-sm px-4 py-3 relative group">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-slate-900 truncate">
                  {comment.user?.name || "Học viên"}
                </span>
                {comment.user?.role === "TEACHER" && (
                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded uppercase tracking-wider shrink-0">
                    Mentor
                  </span>
                )}
                {comment.user?.role === "ADMIN" && (
                  <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded uppercase tracking-wider shrink-0">
                    Staff
                  </span>
                )}
              </div>

              {/* Actions Menu */}
              {(isOwner || canDelete) && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-slate-400 hover:text-slate-600 p-0.5 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1.5">
                    {isOwner && (
                      <DropdownMenuItem
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg gap-2 font-bold text-slate-600 focus:text-blue-600 focus:bg-blue-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="rounded-lg gap-2 font-bold text-blue-600 focus:bg-blue-50"
                      >
                        <ConfirmModal
                          title="Xóa bình luận?"
                          description="Hành động này không thể hoàn tác."
                          onConfirm={handleDelete}
                          disabled={isDeleting}
                        >
                          <div className="flex items-center w-full cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
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
              <div className="space-y-2 mt-1.5">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[70px] bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500/20 text-sm"
                />
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg font-bold h-8 px-3 text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    className="bg-blue-600 hover:bg-blue-700 rounded-lg px-4 h-8 font-bold text-xs"
                  >
                    Lưu
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}

            {/* Comment Images - Grid Style */}
            {comment.images && comment.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5">
                {comment.images.map((url: string, i: number) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 shadow-sm cursor-zoom-in group/img"
                  >
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

          {/* Action Footer */}
          {!isEditing && (
            <div className="flex items-center gap-4 mt-1.5 pl-2 flex-wrap sm:flex-nowrap">
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: vi,
                })}
              </span>
              <button
                onClick={() => setIsReplying(!isReplying)}
                className={cn(
                  "text-[11px] font-semibold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0",
                  isReplying ? "text-blue-600" : "text-slate-500 hover:text-blue-600"
                )}
              >
                <MessageSquare className="w-3 h-3" />
                Trả lời
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reply Form Section - Pulled out to allow full width on mobile */}
      {isReplying && (
        <div 
          ref={replyRef}
          className={cn(
            "mt-3 w-full",
            depth === 0 ? "sm:pl-11" : "sm:pl-8"
          )}
        >
          <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
            <div className="hidden sm:flex w-8 justify-center pt-2.5 shrink-0">
              <CornerDownRight className="w-4 h-4 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <CommentForm
                lessonId={lessonId}
                parentId={comment.parentId || comment.id}
                onSuccess={() => {
                  setIsReplying(false);
                  onReplySuccess?.();
                }}
                onCancel={() => setIsReplying(false)}
                placeholder={`Trả lời ${comment.user?.name || "User"}...`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nested Replies */}
      {comment.children && comment.children.length > 0 && (
        <div className={cn(
          "mt-3 space-y-3",
          depth === 0 
            ? "pl-2 sm:pl-4 ml-4 sm:ml-6 border-l-2 border-slate-100" 
            : "pl-2 ml-3 sm:ml-4 border-l border-slate-100/50"
        )}>
          {comment.children.map((reply: any) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              isTeacherOrAdmin={isTeacherOrAdmin}
              onReplySuccess={onReplySuccess}
              lessonId={lessonId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
