import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { s3Client, BUCKET_NAME } from "@/lib/s3"
import { nanoid } from "nanoid"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    // Check if user is authenticated and is an admin
    if (!session || session.user.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { fileName, fileType } = await req.json()

    if (!fileName || !fileType) {
      return new NextResponse("Missing file name or type", { status: 400 })
    }

    // Generate a unique filename to prevent collisions
    const uniqueFileName = `${nanoid()}-${fileName}`

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
    })

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

    return NextResponse.json({
      url: presignedUrl,
      fileName: uniqueFileName,
    })
  } catch (error) {
    console.error("Error generating presigned URL:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
