import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { nanoid } from "nanoid";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName, validateB2Config } from "@/lib/b2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const configError = validateB2Config();
    if (configError) {
      console.error("[Proxy Upload] B2 config error:", configError);
      return new NextResponse(`Upload chưa được cấu hình: ${configError}`, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");
    if (!fileName) {
      return new NextResponse("Missing fileName", { status: 400 });
    }

    const sanitizedName = sanitizeFileName(fileName);
    const uniqueFileName = `${nanoid()}-${sanitizedName}`;
    
    // Phân loại folder dựa trên đuôi file
    const extension = fileName.split(".").pop()?.toLowerCase();
    const folder = ["pdf", "doc", "docx", "xls", "xlsx", "txt"].includes(extension || "") 
      ? "documents" 
      : "images";
    
    const key = `${folder}/${uniqueFileName}`;
    
    // Validate Content-Type BEFORE reading body
    const contentType = req.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/") && contentType !== "application/pdf" && contentType !== "application/octet-stream") {
      return new NextResponse("Chỉ chấp nhận file ảnh hoặc PDF.", { status: 415 });
    }

    // Get body as a buffer/Uint8Array for S3 client
    // Next.js App Router req.body is a ReadableStream
    const arrayBuffer = await req.arrayBuffer();
    const MAX_UPLOAD_SIZE = 64 * 1024 * 1024; // 64MB
    if (arrayBuffer.byteLength > MAX_UPLOAD_SIZE) {
      return new NextResponse("File vượt quá 64MB.", { status: 413 });
    }
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Proxy Upload] B2 Uploading: ${key}`);

    await b2Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000",
      })
    );

    const publicUrl = `${CDN_DOMAIN}/${key}`;

    console.log(`[Proxy Upload] B2 Success: ${publicUrl}`);

    return NextResponse.json({ publicUrl });
  } catch (error: any) {
    console.error("[Proxy Upload] S3 Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
