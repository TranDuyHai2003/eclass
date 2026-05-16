import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ status: "error", message: "Vui lòng gửi file PDF" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ status: "error", message: "File không đúng định dạng PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: buffer });
    const data = await pdf.getText();

    const text = data.text || "";
    const textLines = text.split("\n").filter((l: string) => l.trim());

    if (!text.trim()) {
      return NextResponse.json({
        status: "warning",
        message: "Hệ thống không nhận diện được chữ trong PDF này. Vui lòng tạo danh sách câu hỏi thủ công hoặc sử dụng PDF xuất từ Word.",
        data: { total_questions: 0, questions: [] },
      });
    }

    const regex = /(?:Câu|Bài|Cau|Bai)\s*(\d+)\s*[\[\(]\s*(.*?)\s*[\]\)]/gi;
    const matches: { order: number; question_label: string; question_category: string }[] = [];
    const seen = new Set<number>();

    let match;
    while ((match = regex.exec(text)) !== null) {
      const order = parseInt(match[1], 10);
      const category = match[2].trim();

      if (!seen.has(order)) {
        seen.add(order);
        matches.push({
          order,
          question_label: `Câu ${order}`,
          question_category: category,
        });
      }
    }

    matches.sort((a, b) => a.order - b.order);

    return NextResponse.json({
      status: "success",
      message: `Phân tích thành công, tìm thấy ${matches.length} câu hỏi`,
      data: {
        total_questions: matches.length,
        questions: matches,
      },
    });

  } catch (error: any) {
    console.error("[Parse PDF Error]", error);
    return NextResponse.json({
      status: "error",
      message: "Lỗi xử lý file PDF. Vui lòng thử lại.",
    }, { status: 500 });
  }
}
