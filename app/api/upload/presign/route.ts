import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

    const { fileName, fileType } = await req.json();
    
    if (!fileName || !fileType) {
      return new NextResponse("Missing fileName or fileType", { status: 400 });
    }

    const uniqueFileName = `${nanoid()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    // Generate a presigned URL valid for 60 minutes
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    // Construct public URL for after upload
    const publicUrl = `${process.env.NEXT_PUBLIC_S3_DOMAIN}/${uniqueFileName}`;

    return NextResponse.json({
      presignedUrl,
      publicUrl,
      fileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error("Upload presign error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
