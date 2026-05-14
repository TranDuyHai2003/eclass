import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TestTakerClient from "../_components/TestTakerClient";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    return redirect("/login");
  }

  const { lessonId } = await params;

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

  if (!lesson || !lesson.test) {
    return redirect(`/watch/${lessonId}`);
  }

  const courseId = lesson.chapter.courseId;

  // Access Control Check
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = lesson.chapter.course.userId === session.user.id;
  
  if (!isAdmin && !isOwner) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id!,
          courseId,
        },
      },
    });

    // TEMPORARILY DISABLED: Match WatchPage behavior to allow all students
    // if (!enrollment || enrollment.status !== "ACTIVE") {
    //   return redirect(`/courses/${courseId}`);
    // }
  }

  const course = lesson.chapter.course;

  return (
    <div className="h-screen bg-white">
      <TestTakerClient
        test={lesson.test}
        lesson={lesson}
        course={course}
        backPath={`/watch/${lessonId}`}
      />
    </div>
  );
}
