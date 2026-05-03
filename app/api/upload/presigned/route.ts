import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "@/lib/b2";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    // Authorization: ADMIN or TEACHER only
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileName, fileType } = await req.json();

    if (!fileName || !fileType) {
      return new NextResponse("Missing file name or type", { status: 400 });
    }

    const fileExtension = fileName.split(".").pop();
    const sanitizedOriginalName = sanitizeFileName(fileName.replace(`.${fileExtension}`, ""));
    const uniqueFileName = `${nanoid()}-${sanitizedOriginalName}.${fileExtension}`;
    const key = `documents/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // Generate presigned URL valid for 1 hour
    const presignedUrl = await getSignedUrl(b2Client, command, { expiresIn: 3600 });

    return NextResponse.json({
      uploadUrl: presignedUrl,
      fileUrl: `${CDN_DOMAIN}/${key}`,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Error generating presigned URL for B2:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
