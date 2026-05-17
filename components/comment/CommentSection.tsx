"use client";

import { useEffect, useState } from "react";
import { getComments } from "@/actions/comment";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { Loader2, MessageSquareDashed } from "lucide-react";
import { useSession } from "next-auth/react";

interface CommentSectionProps {
  lessonId: string;
}

export function CommentSection({ lessonId }: CommentSectionProps) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComments = async () => {
    const res = await getComments(lessonId);
    if (res.success) {
      setComments(res.comments);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [lessonId]);

  const currentUserId = session?.user?.id;
  const isTeacherOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";

  return (
    <div className="flex flex-col h-full w-full relative">
      {/* Khung nhập bình luận chính (Được làm nổi bật) */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <CommentForm
          lessonId={lessonId}
          onSuccess={fetchComments}
          placeholder="Bạn có câu hỏi gì không?"
        />
      </div>

      {/* Danh sách bình luận */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40 space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500">Đang tải bình luận...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
              <MessageSquareDashed className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              Chưa có bình luận nào
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hãy là người đầu tiên đặt câu hỏi hoặc chia sẻ ý kiến của bạn!
            </p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isTeacherOrAdmin={isTeacherOrAdmin}
              onReplySuccess={fetchComments}
              lessonId={lessonId}
            />
          ))
        )}
      </div>
    </div>
  );
}
