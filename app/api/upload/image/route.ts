import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN, sanitizeFileName } from "@/lib/b2";
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

    // Limit image size to 2MB as per plan
    if (file.size > 2 * 1024 * 1024) {
      return new NextResponse("File too large (> 2MB)", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExtension = file.name.split(".").pop();
    const sanitizedOriginalName = sanitizeFileName(file.name.replace(`.${fileExtension}`, ""));
    const uniqueFileName = `${nanoid()}-${sanitizedOriginalName}.${fileExtension}`;
    const key = `images/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: B2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/jpeg",
      CacheControl: "public, max-age=31536000",
    });

    await b2Client.send(command);

    return NextResponse.json({
      url: `${CDN_DOMAIN}/${key}`,
      fileName: uniqueFileName,
    });
  } catch (error) {
    console.error("Error uploading image to B2:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
