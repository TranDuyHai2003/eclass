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

  // Fetch comments - In a real app with 'use server', this might be passed as initialData
  // But strictly client-side here to allow easy updates for now
  // OR we can use server component wrapper. For simplicity in 'use client' actions:
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
    <div className="space-y-8 mt-12 max-w-4xl mx-auto px-4 sm:px-0">
      <div className="flex items-center justify-between border-b pb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          Bình luận
          <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {comments.reduce(
              (acc, c) => acc + 1 + (c.children?.length || 0),
              0,
            )}
          </span>
        </h3>
      </div>

      {/* Main Input */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <CommentForm lessonId={lessonId} onSuccess={fetchComments} />
      </div>

      {/* Comment List */}
      <div className="space-y-6">
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
