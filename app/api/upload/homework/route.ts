import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "@/lib/b2";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileName, fileType } = await req.json();
    if (!fileName || !fileType) {
      return new NextResponse("Missing fileName or fileType", { status: 400 });
    }

    const fileExtension = fileName.split(".").pop();
    const sanitizedOriginalName = sanitizeFileName(fileName.replace(`.${fileExtension}`, ""));
    const uniqueFileName = `${nanoid()}-${sanitizedOriginalName}.${fileExtension}`;
    const key = `homework/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(b2Client, command, {
      expiresIn: 300,
    });

    return NextResponse.json({
      uploadUrl: presignedUrl,
      publicUrl: `${CDN_DOMAIN}/${key}`,
    });
  } catch (error) {
    console.error("Homework presigned error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return new NextResponse(message, { status: 500 });
  }
}
