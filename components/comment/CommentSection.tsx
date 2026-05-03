"use client";

import { useEffect, useState } from "react";
import { getComments } from "@/actions/comment";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import { Loader2 } from "lucide-react";
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

  // Determine permissions
  const currentUserId = session?.user?.id;
  const isTeacherOrAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "TEACHER";

  return (
    <div className="flex flex-col h-full bg-white p-6 space-y-8 no-scrollbar overflow-y-auto">
      {/* Main Input - Now part of the natural scroll flow */}
      <CommentForm lessonId={lessonId} onSuccess={fetchComments} />

      {/* Comment List */}
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-red-600" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed text-gray-500">
            <p>Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ ý kiến!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isTeacherOrAdmin={isTeacherOrAdmin}
            />
          ))
        )}
      </div>
    </div>
  );
}
