import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { nanoid } from "nanoid";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get("fileName");
    if (!fileName) {
      return new NextResponse("Missing fileName", { status: 400 });
    }

    const uniqueFileName = `${nanoid()}-${fileName}`;
    const bunnyEndpoint = process.env.S3_ENDPOINT || "";
    const bunnyZone = process.env.S3_BUCKET_NAME || "";
    const accessKey = process.env.S3_SECRET_ACCESS_KEY || "";

    const targetUrl = `${bunnyEndpoint}/${bunnyZone}/${uniqueFileName}`;

    // Stream the request body directly to BunnyCDN
    const response = await fetch(targetUrl, {
      method: "PUT",
      headers: {
        "AccessKey": accessKey,
        "Content-Type": req.headers.get("content-type") || "application/octet-stream",
      },
      body: req.body,
      // @ts-ignore - Required for NextJS fetch streams
      duplex: "half",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("BunnyCDN upload failed:", errorText);
      return new NextResponse("Upload to CDN failed", { status: 502 });
    }

    const publicDomain = process.env.NEXT_PUBLIC_S3_DOMAIN || "";
    const publicUrl = `${publicDomain}/${uniqueFileName}`;

    return NextResponse.json({ publicUrl });
  } catch (error: any) {
    console.error("Upload proxy error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
