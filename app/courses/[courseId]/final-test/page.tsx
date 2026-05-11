import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import TestTakerClient from "@/app/watch/[lessonId]/_components/TestTakerClient";

export default async function CourseFinalTestPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { courseId } = await params;

  const test = await prisma.test.findUnique({
    where: { courseId },
    include: {
      sections: {
        include: { questions: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" },
      },
    },
  });

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) return notFound();

  // Access Control Check
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = course.userId === session.user.id;
  
  if (!isAdmin && !isOwner) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id!,
          courseId,
        },
      },
    });

    if (!enrollment || enrollment.status !== "ACTIVE") {
      return redirect(`/courses/${courseId}`);
    }
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)]">
        <h2 className="text-2xl font-bold text-gray-900">Chưa có bài kiểm tra cuối khóa.</h2>
        <p className="text-gray-500 mt-2">Giảng viên đang cập nhật nội dung.</p>
      </div>
    );
  }

  // Create a fake "lesson" object so TestTakerClient can work unchanged
  const lessonProxy = {
    id: `course-test-${courseId}`,
    title: `Bài kiểm tra cuối khóa: ${course.title}`,
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col relative z-[60]">
      {/* Hide Global Header on Final Test Page */}
      <style dangerouslySetInnerHTML={{ __html: `
        header { display: none !important; }
      `}} />
      <TestTakerClient
        test={test}
        lesson={lessonProxy}
        course={course}
        resultsPath={`/courses/${courseId}/final-test/results`}
      />
    </div>
  );
}
