import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function TestRedirectPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      lessonId: true,
      courseId: true,
    },
  });

  if (test?.lessonId) {
    return redirect(`/watch/${test.lessonId}/quiz`);
  }

  if (test?.courseId) {
    return redirect(`/courses/${test.courseId}/final-test`);
  }

  return redirect("/courses");
}
