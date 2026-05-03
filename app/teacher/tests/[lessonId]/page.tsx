import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TestBuilderClient from "./_components/TestBuilderClient";

export default async function TestBuilderPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return redirect("/login");
  }

  const { lessonId } = await params;

  // 1. Verify lesson and ownership
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      chapter: {
        include: {
          course: true,
        },
      },
      test: {
        include: {
          sections: {
            include: {
              questions: {
                orderBy: { position: "asc" },
              },
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!lesson) return notFound();

  // Basic ownership check
  if (lesson.chapter.course.userId !== session.user.id && session.user.role !== "ADMIN") {
    return redirect("/");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white">
      <TestBuilderClient 
        lesson={lesson} 
        initialTest={lesson.test} 
      />
    </div>
  );
}
