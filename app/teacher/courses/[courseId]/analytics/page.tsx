import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getCourseProgressMatrix } from "@/actions/analytics";
import { SmartMatrix } from "./_components/SmartMatrix";
import { AnalyticsHeader } from "./_components/AnalyticsHeader";

export default async function CourseAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return redirect("/");
  }

  const { courseId } = await params;
  const { month: sMonth, year: sYear } = await searchParams;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const month = parseInt(sMonth || String(currentMonth));
  const year = parseInt(sYear || String(currentYear));

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true }
  });

  if (!course) return notFound();

  const data = await getCourseProgressMatrix(courseId, month, year);

  return (
    <div className="p-6 space-y-8">
      <AnalyticsHeader 
        courseTitle={course.title} 
        courseId={courseId}
        month={month} 
        year={year} 
      />

      <div className="space-y-4">
        <SmartMatrix 
          courseId={courseId}
          tests={data.tests} 
          matrix={data.matrix} 
        />
      </div>
    </div>
  );
}
