import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import TestTakerClient from "./TestTakerClient";
import { notFound } from "next/navigation";

export default async function TestTakerWrapper({ lessonId, course, lesson }: { lessonId: string, course: any, lesson: any }) {
  // Fetch test details
  const test = await prisma.test.findUnique({
    where: { lessonId },
    include: {
      sections: {
        include: {
          questions: {
            orderBy: { position: "asc" }
          }
        },
        orderBy: { position: "asc" }
      }
    }
  });

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)]">
        <h2 className="text-2xl font-bold">Bài kiểm tra chưa được thiết lập.</h2>
        <p className="text-gray-500">Giảng viên đang cập nhật nội dung.</p>
      </div>
    );
  }

  // We should also fetch any pending attempt or create one using client action
  return <TestTakerClient test={test} lesson={lesson} course={course} backPath={`/courses/${course.id}`} />;

}
