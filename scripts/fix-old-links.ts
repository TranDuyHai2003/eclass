import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Bắt đầu quét và cập nhật link cũ...");

  // 1. Sửa dữ liệu trong bảng Test (Đề thi)
  const tests = await prisma.test.findMany({
    where: {
      OR: [
        { pdfUrl: { contains: "/file/teacherduc-video-storage/" } },
        { explanation: { contains: "/file/teacherduc-video-storage/" } },
      ],
    },
  });

  console.log(`📌 Tìm thấy ${tests.length} bài kiểm tra cần sửa.`);

  for (const test of tests) {
    const updatedPdfUrl = test.pdfUrl?.replace(
      "/file/teacherduc-video-storage/",
      "/",
    );
    const updatedExplanation = test.explanation?.replace(
      "/file/teacherduc-video-storage/",
      "/",
    );

    await prisma.test.update({
      where: { id: test.id },
      data: {
        pdfUrl: updatedPdfUrl,
        explanation: updatedExplanation,
      },
    });
  }

  // 2. Sửa dữ liệu bài làm tự luận của học sinh (Nếu có bảng Answer)
  // Bạn có thể lặp lại logic tương tự cho các bảng khác chứa URL file rác cũ ở đây

  console.log("✅ Hoàn thành cập nhật toàn bộ link cũ sang CDN mới!");
}

main()
  .catch((e) => {
    console.error("❌ Lỗi trong quá trình chạy script:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
