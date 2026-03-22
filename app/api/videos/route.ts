import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const videos = await prisma.videoAsset.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(videos);
  } catch (error) {
    console.error("GET_VIDEOS_ERROR", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
