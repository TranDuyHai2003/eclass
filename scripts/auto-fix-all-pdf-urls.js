const { PrismaClient } = require("@prisma/client");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const prisma = new PrismaClient();

const REAL_BUCKET = "teacherduc-video-storage";
const CDN_DOMAIN = process.env.NEXT_PUBLIC_VIDEO_DOMAIN || "https://cdn.teacherduc.me";

const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-005"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "005ab3dd6ee99500000000001",
    secretAccessKey: process.env.B2_APP_KEY || "K005XMcFrPbYidmDD+KKm0iNu/danJ0",
  },
  region: process.env.B2_REGION || "us-east-005",
  forcePathStyle: true,
});

async function autoFixAllPdfUrls() {
  console.log("🔍 Starting Automatic ASCII PDF & B2 Link Restoration...\n");

  const cmd = new ListObjectsV2Command({
    Bucket: REAL_BUCKET,
    Prefix: "documents/",
  });
  const res = await b2Client.send(cmd);

  // Filter ONLY clean ASCII-sanitized files (no spaces or %20 or Vietnamese accents)
  const b2Files = (res.Contents || []).filter(c => {
    if (!c.Key || !c.Key.endsWith(".pdf") || (c.Size || 0) <= 0) return false;
    const fileName = c.Key.split("/").pop() || "";
    // Check if filename is ASCII-only without spaces or percent encoding
    return /^[a-zA-Z0-9_\-\.]+$/.test(fileName);
  });

  console.log(`📦 Found ${b2Files.length} clean ASCII PDF files in documents/ on B2.\n`);

  const cleanCdnBase = CDN_DOMAIN.endsWith("/") ? CDN_DOMAIN.slice(0, -1) : CDN_DOMAIN;
  const b2Prefix = `${cleanCdnBase}/file/${REAL_BUCKET}`;

  const tests = await prisma.test.findMany();
  let updatedCount = 0;

  for (const t of tests) {
    let pdfUrl = t.pdfUrl;
    let explanation = t.explanation;
    let modified = false;

    const matchedPdfKey = findBestMatchingB2File(t.title, pdfUrl, b2Files, false);
    if (matchedPdfKey) {
      pdfUrl = `${b2Prefix}/${matchedPdfKey}`;
      modified = true;
    }

    const matchedExpKey = findBestMatchingB2File(t.title, explanation, b2Files, true);
    if (matchedExpKey) {
      explanation = `${b2Prefix}/${matchedExpKey}`;
      modified = true;
    }

    if (modified) {
      await prisma.test.update({
        where: { id: t.id },
        data: { pdfUrl, explanation }
      });
      console.log(`✅ Updated Test: "${t.title}"`);
      console.log(`   -> pdfUrl: ${pdfUrl}`);
      console.log(`   -> explanation: ${explanation}\n`);
      updatedCount++;
    }
  }

  console.log(`🎉 Automated DB Restoration Complete! Total tests updated: ${updatedCount}`);
}

function findBestMatchingB2File(title, currentUrl, b2Files, isExplanation) {
  const cleanTitle = (title || "").toLowerCase();
  const codeMatch = cleanTitle.match(/\b1\.\d+\b/);
  const code = codeMatch ? codeMatch[0] : null;

  for (const file of b2Files) {
    const key = file.Key;
    const lowerKey = key.toLowerCase();

    if (isExplanation && !lowerKey.includes("explanation")) continue;
    if (!isExplanation && lowerKey.includes("explanation")) continue;

    if (code) {
      const codeFormatted = code.replace(".", "-");
      const codeDot = code;
      if (lowerKey.includes(`h11-${codeFormatted}-`) || lowerKey.includes(`h11-${codeDot}-`)) {
        return key;
      }
    }
  }

  return null;
}

autoFixAllPdfUrls().finally(() => prisma.$disconnect());
