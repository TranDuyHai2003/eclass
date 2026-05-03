import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { VideoLibraryClient } from "./_components/VideoLibraryClient";

export default async function VideosPage() {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")
  ) {
    return redirect("/");
  }

  const videos = await prisma.videoAsset.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  
  const formattedVideos = videos.map((video) => ({
    ...video,
    size: Number(video.size),
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Thư viện Video (Backblaze B2)
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tải video mp4/m3u8 lên Backblaze B2 sau đó bấm Đồng bộ để tải danh
            sách về hệ thống.
          </p>
        </div>
      </div>

      <VideoLibraryClient initialData={formattedVideos} />
    </div>
  );
}
