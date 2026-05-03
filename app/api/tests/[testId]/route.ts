import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireTestAccess(
  testId: string,
  userId: string,
  isAdmin: boolean,
  includeSections = false,
) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      lesson: { include: { chapter: { include: { course: true } } } },
      course: true,
      sections: includeSections
        ? {
            include: { questions: true },
            orderBy: { position: "asc" },
          }
        : false,
    },
  });

  if (!test) return null;

  if (isAdmin) return test;

  const ownerId =
    test.lesson?.chapter?.course?.userId ?? test.course?.userId ?? test.userId;
  if (ownerId !== userId) return null;

  return test;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { testId } = await params;

  const test = await requireTestAccess(
    testId,
    session.user.id,
    session.user.role === "ADMIN",
    true,
  );

  if (!test) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.json({
    test: {
      id: test.id,
      title: test.title,
      subject: test.subject,
      description: test.description,
      passScore: test.passScore,
      accessCode: test.accessCode,
      pdfUrl: test.pdfUrl,
      duration: test.duration,
      showAnswers: test.showAnswers,
      sections: test.sections,
    },
  });
}

export async function PATCH(
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
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const subject =
    typeof body.subject === "string" ? body.subject.trim() : undefined;
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;
  const pdfUrl =
    typeof body.pdfUrl === "string" ? body.pdfUrl.trim() : undefined;
  const duration =
    body.duration !== undefined ? Number(body.duration) : undefined;
  const passScore =
    body.passScore !== undefined ? Number(body.passScore) : undefined;
  const accessCode =
    typeof body.accessCode === "string" ? body.accessCode.trim() : undefined;
  const showAnswers =
    typeof body.showAnswers === "boolean" ? body.showAnswers : undefined;

  if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0)) {
    return new NextResponse("Invalid duration", { status: 400 });
  }

  if (
    passScore !== undefined &&
    (!Number.isFinite(passScore) || passScore < 0)
  ) {
    return new NextResponse("Invalid passScore", { status: 400 });
  }

  const updated = await prisma.test.update({
    where: { id: test.id },
    data: {
      title,
      subject,
      description,
      pdfUrl,
      duration,
      passScore,
      accessCode,
      showAnswers,
    },
  });

  return NextResponse.json({ testId: updated.id });
}

export async function DELETE(
  _req: NextRequest,
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

  await prisma.test.delete({ where: { id: test.id } });
  return NextResponse.json({ success: true });
}
