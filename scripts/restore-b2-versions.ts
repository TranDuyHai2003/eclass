import "dotenv/config";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "../lib/b2";
import { ListObjectVersionsCommand, CopyObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Đang quét toàn bộ các phiên bản file trong temp/ trên Backblaze B2 để khôi phục...");

  const cmd = new ListObjectVersionsCommand({
    Bucket: B2_BUCKET_NAME,
    Prefix: "temp/documents/",
  });

  const res = await b2Client.send(cmd);
  const versions = res.Versions || [];

  console.log(`📌 Tìm thấy ${versions.length} phiên bản file PDF trong temp/documents/`);

  for (const ver of versions) {
    if (!ver.Key || !ver.VersionId) continue;
    console.log(`\nKhôi phục: ${ver.Key} (VersionId: ${ver.VersionId})`);

    // Tạo destination key sạch ở documents/
    const baseName = ver.Key.replace("temp/documents/", "");
    // Tách bớt nanoid prefix nếu có
    const parts = baseName.split("-");
    const idPrefix = parts[0];
    const originalName = parts.slice(1).join("-") || baseName;
    const cleanName = sanitizeFileName(originalName);
    const destKey = `documents/${idPrefix}-${cleanName}`;

    try {
      // Copy từ phiên bản cụ thể (VersionId) sang documents/
      const copySource = `${B2_BUCKET_NAME}/${ver.Key}?versionId=${ver.VersionId}`;
      await b2Client.send(new CopyObjectCommand({
        Bucket: B2_BUCKET_NAME,
        CopySource: encodeURI(copySource),
        Key: destKey,
      }));

      const restoredUrl = `${CDN_DOMAIN}/${destKey}`;
      console.log(`  -> Restored to: ${restoredUrl}`);

      // Kiểm tra và cập nhật các DB test có chứa tên file hoặc key cũ
      const matchingTests = await prisma.test.findMany({
        where: {
          OR: [
            { pdfUrl: { contains: idPrefix } },
            { explanation: { contains: idPrefix } },
          ],
        },
      });

      for (const t of matchingTests) {
        let updated = false;
        const updateData: any = {};

        if (t.pdfUrl && t.pdfUrl.includes(idPrefix)) {
          updateData.pdfUrl = restoredUrl;
          updated = true;
        }
        if (t.explanation && t.explanation.includes(idPrefix)) {
          updateData.explanation = restoredUrl;
          updated = true;
        }

        if (updated) {
          await prisma.test.update({
            where: { id: t.id },
            data: updateData,
          });
          console.log(`  -> Updated Test DB ID: ${t.id}`);
        }
      }
    } catch (err: any) {
      console.error(`  -> Failed to restore version:`, err.message || err);
    }
  }

  console.log("\n✅ Hoàn tất khôi phục toàn bộ các file PDF!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
