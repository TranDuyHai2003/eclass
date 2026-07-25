import "dotenv/config";
import { b2Client, B2_BUCKET_NAME, commitTempFile, CDN_DOMAIN } from "../lib/b2";
import { ListObjectsV2Command, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚚 Quét và di chuyển toàn bộ file trong temp/documents/ sang documents/ trên Backblaze B2...");

  const cmdTemp = new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, Prefix: "temp/documents/" });
  const resTemp = await b2Client.send(cmdTemp);
  const tempFiles = resTemp.Contents || [];

  console.log(`📌 Tìm thấy ${tempFiles.length} file trong temp/documents/ trên B2.`);

  for (const item of tempFiles) {
    if (!item.Key) continue;
    const tempUrl = `${CDN_DOMAIN}/${item.Key}`;
    console.log(`\nProcessing: ${item.Key}`);

    const committedUrl = await commitTempFile(tempUrl);
    console.log(`  -> Committed URL: ${committedUrl}`);

    // If commit was successful, delete the temp file from B2
    if (committedUrl && !committedUrl.includes("/temp/")) {
      try {
        await b2Client.send(new DeleteObjectCommand({
          Bucket: B2_BUCKET_NAME,
          Key: item.Key,
        }));
        console.log(`  -> Deleted old temp file: ${item.Key}`);
      } catch (e) {
        console.error(`  -> Failed to delete temp file:`, e);
      }
    }
  }

  // Sửa các link trong Database bị lỗi 404 cho bài kiểm tra `mrwNnwM4Cdkhs5gKTzzpn`
  // Tìm bài kiểm tra đang dùng mrwNnwM4Cdkhs5gKTzzpn
  const testWithBrokenUrl = await prisma.test.findFirst({
    where: {
      OR: [
        { pdfUrl: { contains: "mrwNnwM4Cdkhs5gKTzzpn" } },
        { explanation: { contains: "mrwNnwM4Cdkhs5gKTzzpn" } },
      ],
    },
  });

  if (testWithBrokenUrl) {
    console.log(`\n📌 Tìm thấy bài kiểm tra bị hỏng URL ID: ${testWithBrokenUrl.id}`);
    // Tìm file tương ứng 1.1 trong documents/ trên B2
    const validFileInDocs = "https://cdn.teacherduc.me/documents/ltBHKohaP8m8CcmOpIe6w-h11-1-1-hs-mo-dau-ve-hinh-khong-gian-tim-giao-tuyen.pdf";
    console.log(`Replacing broken URL with valid file URL: ${validFileInDocs}`);
    await prisma.test.update({
      where: { id: testWithBrokenUrl.id },
      data: { pdfUrl: validFileInDocs },
    });
  }

  console.log("\n✅ Hoàn tất di chuyển file B2 và khôi phục link!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
