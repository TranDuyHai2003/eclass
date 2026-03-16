import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, BUCKET_NAME } from "@/lib/s3";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    // Check auth
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
    ) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new NextResponse("No file provided", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueFileName = `${nanoid()}-${file.name}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);

    // Construct public URL
    // Use env var or fallback to constructing it manually if needed,
    // but better to use the one we just fixed in .env
    const publicUrl = `${process.env.NEXT_PUBLIC_S3_DOMAIN}/${uniqueFileName}`;

    return NextResponse.json({
      url: publicUrl,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Upload proxy error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
