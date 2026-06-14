import { NextResponse } from "next/server";
import { saveTestDraft } from "@/actions/test";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { attemptId, answersArray } = body;

    if (!attemptId || !answersArray) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await saveTestDraft(attemptId, answersArray);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Save Test Draft Error]", error);
    return NextResponse.json({ success: false, error: "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
