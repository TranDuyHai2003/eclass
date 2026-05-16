"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertTest } from "@/actions/test";
import UnifiedTestBuilder from "@/components/teacher/test-builder/UnifiedTestBuilder";

interface TestBuilderClientProps {
  lesson: any;
  initialTest: any;
}

export default function TestBuilderClient({
  lesson,
  initialTest,
}: TestBuilderClientProps) {
  const router = useRouter();

  return (
    <UnifiedTestBuilder
      initialTest={initialTest}
      title={lesson.title}
      subtitle="Trình tạo Bài Quiz bài giảng"
      onBack={() => router.back()}
      previewHref={`/watch/${lesson.id}/quiz`}
      analyticsHref={`/teacher/tests/${lesson.id}/analytics`}
      showDelete
      onDelete={async () => {
        if (!initialTest?.id) {
          toast.error("Chưa có bài kiểm tra để xóa");
          return;
        }
        const res = await fetch(`/api/tests/${initialTest.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Xóa bài kiểm tra thất bại");
        toast.success("Đã xóa bài kiểm tra");
        router.push("/teacher/tests");
      }}
      onSave={async (data) => {
        const resTest = await upsertTest(lesson.id, {
          pdfUrl: data.pdfUrl,
          duration: data.duration,
          showAnswers: data.showAnswers,
          explanation: data.explanation,
          videoUrl: data.videoUrl,
          audioUrl: data.audioUrl,
          dueDate: data.dueDate,
        });
        if (!resTest.success) throw new Error("Lỗi khi lưu thông tin chung");
        router.refresh();
        return { success: true, testId: resTest.test!.id };
      }}
    />
  );
}
