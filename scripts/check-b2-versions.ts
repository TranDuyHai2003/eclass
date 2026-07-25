import "dotenv/config";
import { b2Client, B2_BUCKET_NAME } from "../lib/b2";
import { ListObjectVersionsCommand } from "@aws-sdk/client-s3";

async function main() {
  console.log("🔍 Checking Backblaze B2 file versions for deleted/hidden files...");

  try {
    const cmd = new ListObjectVersionsCommand({
      Bucket: B2_BUCKET_NAME,
      Prefix: "temp/",
    });

    const res = await b2Client.send(cmd);
    const versions = res.Versions || [];
    const deleteMarkers = res.DeleteMarkers || [];

    console.log(`Found ${versions.length} versions in temp/`);
    console.log(`Found ${deleteMarkers.length} delete markers in temp/`);

    if (versions.length > 0) {
      console.log("Sample versions:", versions.slice(0, 10));
    }
  } catch (error) {
    console.error("Error listing object versions:", error);
  }
}

main().catch(console.error);
