import "dotenv/config";
import { b2Client, B2_BUCKET_NAME } from "../lib/b2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

async function main() {
  console.log("🔍 Finding files matching 'mrwNnwM4Cdkhs5gKTzzpn' in B2...");
  const command = new ListObjectsV2Command({
    Bucket: B2_BUCKET_NAME,
    Prefix: "",
  });

  const res = await b2Client.send(command);
  const contents = res.Contents || [];
  console.log(`Found ${contents.length} objects total in bucket root prefix.`);
  
  const matching = contents.filter(c => c.Key?.includes("mrwNnwM4Cdkhs5gKTzzpn") || c.Key?.includes("1.1"));
  console.log("Matching objects:", matching);

  // Let's also check prefix temp/ and documents/
  const cmdDocs = new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, Prefix: "documents/" });
  const resDocs = await b2Client.send(cmdDocs);
  console.log(`Found ${(resDocs.Contents || []).length} objects in documents/`);
  const matchDocs = (resDocs.Contents || []).filter(c => c.Key?.includes("mrwNnwM4Cdkhs5gKTzzpn") || c.Key?.includes("1.1") || c.Key?.includes("h11"));
  console.log("Matching in documents/:", matchDocs);

  const cmdTemp = new ListObjectsV2Command({ Bucket: B2_BUCKET_NAME, Prefix: "temp/" });
  const resTemp = await b2Client.send(cmdTemp);
  console.log(`Found ${(resTemp.Contents || []).length} objects in temp/`);
  const matchTemp = (resTemp.Contents || []).filter(c => c.Key?.includes("mrwNnwM4Cdkhs5gKTzzpn") || c.Key?.includes("1.1") || c.Key?.includes("h11"));
  console.log("Matching in temp/:", matchTemp);
}

main().catch(console.error);
