import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CourseTestBuilderClient from "./_components/CourseTestBuilderClient";

export default async function CourseFinalTestPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    redirect("/login");
  }

  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      finalTest: {
        include: {
          sections: {
            include: { questions: { orderBy: { position: "asc" } } },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!course) return notFound();

  if (course.userId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/teacher/courses");
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-gray-50">
      <CourseTestBuilderClient course={course} initialTest={course.finalTest} />
    </div>
  );
}
