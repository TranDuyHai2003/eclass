import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION}.backblazeb2.com`,
  region: process.env.B2_REGION || "us-west-004",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME!;

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "TEACHER")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const prefix = searchParams.get("prefix") || ""; // prefix should end with / if it's a folder

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
    });

    const response = await s3Client.send(command);

    // CommonPrefixes contains "folders"
    const folders = (response.CommonPrefixes || []).map((cp) => ({
      name: cp.Prefix?.replace(prefix, "").replace("/", "") || "",
      prefix: cp.Prefix,
      type: "FOLDER",
    })).filter(f => f.name !== "");

    // Contents contains "files"
    // We only care about .m3u8 or .mp4 files
    const files = (response.Contents || [])
      .filter((obj) => {
        const key = obj.Key || "";
        // Skip the prefix itself if it's returned as an object
        if (key === prefix) return false;
        return key.endsWith(".m3u8") || key.endsWith(".mp4");
      })
      .map((obj) => {
        const key = obj.Key!;
        const name = key.replace(prefix, "");
        return {
          name: name,
          key: key,
          url: `${process.env.NEXT_PUBLIC_VIDEO_DOMAIN}/${key}`,
          size: obj.Size || 0,
          type: "FILE",
        };
      });

    return NextResponse.json({
      folders,
      files,
      currentPrefix: prefix,
    });
  } catch (error) {
    console.error("GET_VIDEO_EXPLORER_ERROR", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
