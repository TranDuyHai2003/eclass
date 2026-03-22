"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MoreHorizontal, MessageSquare, Pencil, Trash2 } from "lucide-react";
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
    <div className="flex gap-x-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gray-100">
          <Image
            src={comment.user.image || "/placeholder-avatar.jpg"}
            alt={comment.user.name || "User"}
            fill
            className="object-cover"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50/80 rounded-2xl px-4 py-2 border border-transparent group-hover:border-gray-100 transition-colors">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {comment.user.name}
              </span>
              {comment.user.role === "TEACHER" && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wide">
                  Giảng viên
                </span>
              )}
              {comment.user.role === "ADMIN" && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">
                  Admin
                </span>
              )}
              <span className="text-xs text-gray-400">
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
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                  >
                    <MoreHorizontal className="h-4 w-4 text-gray-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwner && (
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Chỉnh sửa
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <ConfirmModal 
                          title="Xóa bình luận?"
                          description="Hành động này không thể hoàn tác."
                          onConfirm={handleDelete}
                          disabled={isDeleting}
                        >
                           <div className="flex items-center text-red-600 w-full cursor-pointer">
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
            <div className="space-y-2 mt-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] bg-white"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Hủy
                </Button>
                <Button size="sm" onClick={handleUpdate}>
                  Lưu
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {comment.content}
            </p>
          )}
        </div>

        {/* Footer Actions (Like, Reply) */}
        {!isEditing && (
          <div className="flex items-center gap-4 mt-1 ml-4">
            <button
              onClick={() => setIsReplying(!isReplying)}
              className={cn(
                "text-xs font-medium flex items-center gap-1 transition-colors",
                isReplying
                  ? "text-red-600"
                  : "text-gray-500 hover:text-gray-900",
              )}
            >
              <MessageSquare className="h-3 w-3" />
              Trả lời
            </button>
          </div>
        )}

        {/* Reply Form */}
        {isReplying && (
          <div className="mt-4 pl-4 border-l-2 border-red-100">
            <CommentForm
              lessonId={comment.lessonId}
              parentId={comment.id}
              onSuccess={() => setIsReplying(false)}
              onCancel={() => setIsReplying(false)}
              placeholder={`Trả lời ${comment.user.name}...`}
            />
          </div>
        )}

        {/* Nested Replies */}
        {comment.children && comment.children.length > 0 && (
          <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-4">
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
