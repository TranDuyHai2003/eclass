import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    const decodedUrl = decodeURIComponent(url);

    // Convert Google Drive share/view links to direct download
    let fetchUrl = decodedUrl;
    const driveMatch = decodedUrl.match(
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/
    );
    if (driveMatch) {
      fetchUrl = `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
    }

    const response = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Next.js; +https://teacherduc.me)",
      },
    });

    if (!response.ok) {
      return new NextResponse("Failed to fetch PDF", { status: response.status });
    }

    const contentType =
      response.headers.get("content-type") || "application/pdf";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[PDF Proxy Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
