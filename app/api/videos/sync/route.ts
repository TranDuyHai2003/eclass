import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const bunnyEndpoint = process.env.S3_ENDPOINT || "https://sg.storage.bunnycdn.com";
    const bucketName = process.env.S3_BUCKET_NAME || "eclass";
    const accessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicDomain = process.env.NEXT_PUBLIC_S3_DOMAIN || "";

    if (!accessKey) {
      return new NextResponse("Missing BunnyCDN AccessKey", { status: 500 });
    }

    const targetUrl = `${bunnyEndpoint}/${bucketName}/`;
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "AccessKey": accessKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return new NextResponse("Failed to fetch BunnyCDN listing", { status: response.status });
    }

    const files = await response.json();
    let syncedCount = 0;

    for (const file of files) {
      if (!file.ObjectName.endsWith(".mp4") && !file.ObjectName.endsWith(".m3u8")) {
         continue;
      }

      const fileName = file.ObjectName;
      const fileUrl = `${publicDomain}/${fileName}`;
      let title = fileName.replace(/\.[^/.]+$/, "");
      title = title.replace(/_/g, " ");

      await prisma.videoAsset.upsert({
        where: { fileName: fileName },
        update: {
          url: fileUrl,
          size: Math.round(file.Length / 1024),
        },
        create: {
          fileName: fileName,
          title: title,
          url: fileUrl,
          size: Math.round(file.Length / 1024),
          userId: session.user.id,
        }
      });
      syncedCount++;
    }

    return NextResponse.json({ success: true, count: syncedCount });
  } catch (error: any) {
    console.error("SYNC_VIDEOS", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
