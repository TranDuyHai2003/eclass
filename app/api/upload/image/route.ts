import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { b2Client, B2_BUCKET_NAME, normalizeCdnUrl, sanitizeFileName } from "@/lib/b2";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    // Authorization: ADMIN or TEACHER only
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new NextResponse("Missing file", { status: 400 });
    }

    // Chỉ nhận ảnh (trước đây nhận mọi loại file rồi gắn ContentType theo trình duyệt gửi lên)
    const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (!(file.type in IMAGE_TYPES)) {
      return new NextResponse("Only JPG, PNG, WEBP or GIF images", { status: 400 });
    }

    // Limit image size to 2MB as per plan
    if (file.size > 2 * 1024 * 1024) {
      return new NextResponse("File too large (> 2MB)", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Đuôi file theo loại ảnh thật, không theo tên gửi lên
    const sanitizedFileName = `${sanitizeFileName(file.name).replace(/\.[a-z0-9]+$/, "")}.${IMAGE_TYPES[file.type]}`;
    const uniqueFileName = `${nanoid()}-${sanitizedFileName}`;
    const key = `images/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000",
    });

    await b2Client.send(command);

    return NextResponse.json({
      url: normalizeCdnUrl(`https://cdn.teacherduc.me/${key}`),
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Error uploading image to B2:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
