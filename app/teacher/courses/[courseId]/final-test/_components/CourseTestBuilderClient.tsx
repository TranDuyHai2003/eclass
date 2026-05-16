"use client";

import { toast } from "sonner";
import { upsertCourseTest } from "@/actions/test";
import { useRouter } from "next/navigation";
import UnifiedTestBuilder from "@/components/teacher/test-builder/UnifiedTestBuilder";

export default function CourseTestBuilderClient({
  course,
  initialTest,
}: {
  course: { id: string; title: string };
  initialTest: any;
}) {
  const router = useRouter();

  return (
    <UnifiedTestBuilder
      initialTest={initialTest}
      title="Bài kiểm tra cuối khóa"
      subtitle={course.title}
      onBack={() => router.push(`/teacher/courses/${course.id}`)}
      analyticsHref={`/teacher/courses/${course.id}/final-test/analytics`}
      disableAutoParse
      onSave={async (data) => {
        const resTest = await upsertCourseTest(course.id, {
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


