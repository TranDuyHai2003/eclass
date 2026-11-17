import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileWarning } from "lucide-react";
import { parseSolutionAnchors } from "@/lib/pdf-question-anchors";
import SolutionAnchorEditor from "./_components/SolutionAnchorEditor";

export const dynamic = "force-dynamic";

export default async function SolutionAnchorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ testId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return redirect("/login");
  }

  const { testId } = await params;
  const { q } = await searchParams;

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      title: true,
      pdfUrl: true,
      explanation: true,
      solutionAnchors: true,
      lessonId: true,
      courseId: true,
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          questions: { orderBy: { position: "asc" }, select: { id: true, type: true } },
        },
      },
    },
  });
  if (!test) return notFound();

  const backHref = test.lessonId
    ? `/teacher/tests/${test.lessonId}`
    : test.courseId
      ? `/teacher/courses/${test.courseId}/final-test`
      : `/teacher/tests/bank/${test.id}`;
  const title = test.title || test.pdfUrl.split("/").pop() || "Bài kiểm tra";

  if (!test.explanation?.trim()) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <FileWarning className="h-12 w-12 text-amber-500" />
        <h1 className="text-xl font-black text-slate-900">Đề chưa có file PDF lời giải</h1>
        <p className="max-w-md text-sm text-slate-500">
          Hãy tải file lời giải trong tab &quot;Lời giải toàn bài&quot; của đề và lưu lại, sau đó quay lại đây để gắn lời
          giải cho từng câu.
        </p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại đề
        </Link>
      </div>
    );
  }

  return (
    <SolutionAnchorEditor
      testId={test.id}
      title={title}
      backHref={backHref}
      solutionPdfUrl={test.explanation}
      sections={test.sections}
      initialAnchors={parseSolutionAnchors(test.solutionAnchors, test.explanation)}
      hadStaleAnchors={!!test.solutionAnchors && !parseSolutionAnchors(test.solutionAnchors, test.explanation)}
      initialQuestionId={q ?? null}
    />
  );
}
