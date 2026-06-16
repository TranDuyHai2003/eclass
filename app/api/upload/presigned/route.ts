import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "@/lib/b2";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    // Authorization: ANY authenticated user can upload
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName || !fileType || !fileSize) {
      return new NextResponse("Missing file metadata", { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize > MAX_FILE_SIZE) {
      return new NextResponse("File too large. Maximum size is 50MB", { status: 413 });
    }

    const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
    const sanitizedOriginalName = sanitizeFileName(fileName.replace(`.${fileExtension}`, ""));
    const uniqueFileName = `${nanoid()}-${sanitizedOriginalName}.${fileExtension}`;
    
    // Phân loại folder dựa trên đuôi file
    const folder = ["pdf", "doc", "docx", "xls", "xlsx", "txt"].includes(fileExtension) 
      ? "documents" 
      : "images";
      
    const key = `temp/${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    // Generate presigned URL valid for 15 minutes (900 seconds)
    // 15 minutes is secure while providing ample time for a 50MB upload on slow connections
    const presignedUrl = await getSignedUrl(b2Client, command, { expiresIn: 900 });

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
