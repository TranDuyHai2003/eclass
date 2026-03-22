import { NextResponse } from "next/server";
import axios from "axios";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const apiKey = process.env.BUNNY_STREAM_API_KEY;
    const hostname = process.env.NEXT_PUBLIC_BUNNY_STREAM_HOSTNAME;

    if (!libraryId || !apiKey) {
      return NextResponse.json(
        { error: "Thiếu cấu hình Bunny Stream" },
        { status: 500 }
      );
    }

    // Gọi API của Bunny Stream để lấy danh sách video
    // Tài liệu API: https://docs.bunny.net/reference/video_list
    const response = await axios.get(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        headers: {
          AccessKey: apiKey,
          Accept: "application/json",
        },
      }
    );

    const bunnyVideos = response.data.items;

    // Mapping dữ liệu từ Bunny về format ứng dụng của bạn
    const formattedVideos = bunnyVideos.map((video: any) => ({
      id: video.guid,
      title: video.title,
      fileName: video.title,
      url: `https://${hostname}/${video.guid}/playlist.m3u8`,
      size: video.storageSize || 0,
      status: video.status === 4 ? "READY" : "PROCESSING",
      thumbnail: `https://${hostname}/${video.guid}/${video.thumbnailFileName}`,
    }));

    // Lưu `formattedVideos` vào PostgreSQL (Prisma)
    for (const v of formattedVideos) {
      await prisma.videoAsset.upsert({
        where: { fileName: v.fileName },
        update: {
          title: v.title,
          url: v.url,
          size: BigInt(v.size),
          status: v.status,
        },
        create: {
          fileName: v.fileName,
          title: v.title,
          url: v.url,
          size: BigInt(v.size),
          status: v.status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      count: formattedVideos.length,
      data: formattedVideos.map((v: any) => ({
        ...v,
        size: Number(v.size)
      })),
    });
  } catch (error) {
    console.error("Lỗi đồng bộ Bunny Stream:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi đồng bộ" },
      { status: 500 }
    );
  }
}
