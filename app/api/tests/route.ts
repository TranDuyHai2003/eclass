import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { commitTempFile } from "@/lib/b2";

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") || "bank";

  if (scope !== "bank") {
    return NextResponse.json({ tests: [] });
  }

  const tests = await prisma.test.findMany({
    where: {
      lessonId: null,
      courseId: null,
      userId: session.user.role === "ADMIN" ? undefined : session.user.id,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      subject: true,
      duration: true,
      updatedAt: true,
      pdfUrl: true,
    },
  });

  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : null;
  const pdfUrl = typeof body.pdfUrl === "string" ? body.pdfUrl.trim() : "";
  const duration = Number(body.duration);
  const passScore =
    body.passScore !== undefined ? Number(body.passScore) : null;
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const showResultAfterSubmit = parseBoolean(
    body?.settings?.showResultAfterSubmit,
    true,
  );
  const accessCode =
    typeof body?.settings?.password === "string"
      ? body.settings.password.trim()
      : null;
  const dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const type = body.type === "EXAM" ? "EXAM" : "HOMEWORK";
  const explanation = typeof body.explanation === "string" ? body.explanation.trim() : undefined;
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : undefined;
  const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl.trim() : undefined;
  const solutionVideos = body.solutionVideos;

  if (!title) {
    return new NextResponse("Missing title", { status: 400 });
  }

  if (!pdfUrl) {
    return new NextResponse("Missing pdfUrl", { status: 400 });
  }

  const finalPdfUrl = await commitTempFile(pdfUrl) || pdfUrl;
  const finalExplanation = await commitTempFile(explanation) || undefined;
  const finalVideoUrl = await commitTempFile(videoUrl) || undefined;
  const finalAudioUrl = await commitTempFile(audioUrl) || undefined;

  let finalSolutionVideos = undefined;
  if (solutionVideos && Array.isArray(solutionVideos)) {
    finalSolutionVideos = [];
    for (const v of solutionVideos) {
      if (v.url) {
        v.url = await commitTempFile(v.url) || v.url;
      }
      finalSolutionVideos.push(v);
    }
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return new NextResponse("Invalid duration", { status: 400 });
  }

  if (passScore !== null && (!Number.isFinite(passScore) || passScore < 0)) {
    return new NextResponse("Invalid passScore", { status: 400 });
  }

  const questionsData = body.questions as
    | {
        order: number;
        question_category?: string;
        type: "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "ESSAY";
        correctAnswer?: string;
      }[]
    | undefined;

  const test = await prisma.test.create({
    data: {
      title,
      subject,
      description,
      passScore,
      accessCode,
      pdfUrl: finalPdfUrl,
      duration,
      showAnswers: showResultAfterSubmit,
      userId: session.user.id,
      dueDate,
      type,
      explanation: finalExplanation,
      videoUrl: finalVideoUrl,
      audioUrl: finalAudioUrl,
      ...(finalSolutionVideos !== undefined && { solutionVideos: finalSolutionVideos }),
      ...(questionsData && questionsData.length > 0
        ? {
            sections: {
              create: [
                {
                  name: "Phần 1",
                  position: 0,
                  questions: {
                    create: questionsData.map((q) => ({
                      position: q.order - 1,
                      category: q.question_category || null,
                      type: q.type || "MULTIPLE_CHOICE",
                      correctAnswer: q.correctAnswer || null,
                      points: 1.0,
                    })),
                  },
                },
              ],
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  return NextResponse.json({ testId: test.id });
}
