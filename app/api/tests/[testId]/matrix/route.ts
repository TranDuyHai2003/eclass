import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireTestAccess(
  testId: string,
  userId: string,
  isAdmin: boolean,
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
    },
  });

  if (!test) return null;
  if (isAdmin) return test;

  const ownerId =
    test.lesson?.chapter?.course?.userId ?? test.course?.userId ?? test.userId;
  if (ownerId !== userId) return null;

  return test;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { testId } = await params;

  const test = await requireTestAccess(
    testId,
    session.user.id,
    session.user.role === "ADMIN",
  );

  if (!test) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const body = await req.json();
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (sections.length === 0) {
    return new NextResponse("Missing sections", { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.testSection.deleteMany({ where: { testId: test.id } });

    for (const section of sections) {
      const createdSection = await tx.testSection.create({
        data: {
          testId: test.id,
          name: section.name,
          position: Number(section.order ?? section.position ?? 0),
        },
      });

      if (Array.isArray(section.questions) && section.questions.length > 0) {
        const questionsData = section.questions.map((q: {
          order?: number;
          position?: number;
          type: string;
          correctAnswer: string;
          points?: number;
          explanation?: string;
          videoUrl?: string;
          audioUrl?: string;
          needsManualGrading?: boolean;
        }) => ({
          sectionId: createdSection.id,
          position: Number(q.order ?? q.position ?? 0),
          type: q.type,
          correctAnswer: q.correctAnswer,
          points: Number(q.points ?? 1),
          explanation: q.explanation || null,
          videoUrl: q.videoUrl || null,
          audioUrl: q.audioUrl || null,
          needsManualGrading: Boolean(q.needsManualGrading),
        }));

        await tx.question.createMany({ data: questionsData });
      }
    }
  });

  return NextResponse.json({ success: true });
}
