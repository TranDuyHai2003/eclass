import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { nanoid } from "nanoid";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "@/lib/b2";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
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
    
    // Get body as a buffer/Uint8Array for S3 client
    // Next.js App Router req.body is a ReadableStream
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[Proxy Upload] B2 Uploading: ${key}`);

    await b2Client.send(
      new PutObjectCommand({
        Bucket: B2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: req.headers.get("content-type") || "application/octet-stream",
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
