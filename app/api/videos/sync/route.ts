import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export async function POST(req: Request) {
  try {
    const keyId = process.env.B2_KEY_ID;
    const applicationKey = process.env.B2_APP_KEY;
    const endpoint = process.env.B2_ENDPOINT;
    const bucketName = process.env.B2_BUCKET_NAME;
    const cdnDomain = process.env.NEXT_PUBLIC_VIDEO_DOMAIN;

    if (!keyId || !applicationKey || !endpoint || !bucketName || !cdnDomain) {
      return NextResponse.json(
        { error: "Thiếu cấu hình Backblaze B2 hoặc CDN" },
        { status: 500 }
      );
    }

    const s3Client = new S3Client({
      endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
      region: process.env.B2_REGION || "us-west-004",
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: applicationKey,
      },
      forcePathStyle: true,
    });

    // List all objects recursively (no delimiter)
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      // We can keep a Prefix like "videos/" if we want to restrict the sync
      // Prefix: "videos/", 
    });

    const response = await s3Client.send(command);
    const objects = response.Contents || [];

    // Filter for video files (.m3u8, .mp4)
    const videoFiles = objects.filter(obj => {
      const key = obj.Key || "";
      return key.endsWith(".m3u8") || key.endsWith(".mp4");
    });

    console.log(`Tìm thấy ${videoFiles.length} tệp video từ B2.`);

    let updatedCount = 0;
    for (const obj of videoFiles) {
      const key = obj.Key!;
      const parts = key.split("/");
      const fileName = parts[parts.length - 1];
      
      // Derive a title from the path if possible, or just use the filename
      // e.g. "lesson1/intro/master.m3u8" -> "lesson1 intro master"
      const title = key
        .replace(/\.[^/.]+$/, "") // remove extension
        .replace(/\//g, " ")     // replace slashes with spaces
        .replace(/_/g, " ");      // replace underscores with spaces

      await prisma.videoAsset.upsert({
        where: { fileName: key }, // Use full key as unique identifier
        update: {
          title: title,
          url: `${cdnDomain}/${key}`,
          size: BigInt(obj.Size || 0),
          status: "READY",
        },
        create: {
          fileName: key,
          title: title,
          url: `${cdnDomain}/${key}`,
          size: BigInt(obj.Size || 0),
          status: "READY",
        },
      });
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      count: updatedCount,
      message: `Đã đồng bộ ${updatedCount} video vào Database.`
    });
  } catch (error) {
    console.error("Lỗi đồng bộ Backblaze B2:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi đồng bộ" },
      { status: 500 }
    );
  }
}
