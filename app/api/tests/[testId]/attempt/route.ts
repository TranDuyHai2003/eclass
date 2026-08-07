import { NextRequest, NextResponse } from "next/server";
import { startTestAttempt } from "@/actions/test";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;
    if (!testId) {
      return NextResponse.json({ success: false, error: "Missing testId" }, { status: 400 });
    }

    const result = await startTestAttempt(testId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Start Attempt Error]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi máy chủ nội bộ" },
      { status: 500 }
    );
  }
}
