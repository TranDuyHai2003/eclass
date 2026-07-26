const { PrismaClient } = require("@prisma/client");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

const prisma = new PrismaClient();

const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME || "teacherduc-video-storage";
const CDN_DOMAIN = process.env.NEXT_PUBLIC_VIDEO_DOMAIN || "https://cdn.teacherduc.me";

const b2Client = new S3Client({
  endpoint: `https://s3.${process.env.B2_REGION || "us-east-005"}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "dummy_key",
    secretAccessKey: process.env.B2_APP_KEY || "dummy_secret",
  },
  region: process.env.B2_REGION || "us-east-005",
  forcePathStyle: true,
});

async function autoFixAllPdfUrls() {
  console.log("🔍 Starting Automatic PDF & B2 Link Restoration...\n");

  const cmd = new ListObjectsV2Command({
    Bucket: B2_BUCKET_NAME,
    Prefix: "documents/",
  });
  const res = await b2Client.send(cmd);
  const b2Files = (res.Contents || []).filter(c => (c.Size || 0) > 0 && c.Key && c.Key.endsWith(".pdf"));

  console.log(`📦 Found ${b2Files.length} valid PDF files (>0 bytes) in documents/ on B2.\n`);

  const cleanCdnBase = CDN_DOMAIN.endsWith("/") ? CDN_DOMAIN.slice(0, -1) : CDN_DOMAIN;
  const b2Prefix = `${cleanCdnBase}/file/${B2_BUCKET_NAME}`;

  const tests = await prisma.test.findMany();
  let updatedCount = 0;

  for (const t of tests) {
    let pdfUrl = t.pdfUrl;
    let explanation = t.explanation;
    let modified = false;

    if (pdfUrl) {
      if (pdfUrl.includes("dummy_bucket") || pdfUrl.includes("/temp/") || !pdfUrl.includes("/file/")) {
        const matchedKey = findBestMatchingB2File(t.title, pdfUrl, b2Files);
        if (matchedKey) {
          pdfUrl = `${b2Prefix}/${matchedKey}`;
          modified = true;
        } else if (pdfUrl.includes("dummy_bucket")) {
          pdfUrl = pdfUrl.replace("dummy_bucket", B2_BUCKET_NAME);
          modified = true;
        }
      }
    }

    if (explanation) {
      if (explanation.includes("dummy_bucket") || explanation.includes("/temp/") || !explanation.includes("/file/")) {
        const matchedKey = findBestMatchingB2File(t.title + " explanation", explanation, b2Files);
        if (matchedKey) {
          explanation = `${b2Prefix}/${matchedKey}`;
          modified = true;
        } else if (explanation.includes("dummy_bucket")) {
          explanation = explanation.replace("dummy_bucket", B2_BUCKET_NAME);
          modified = true;
        }
      }
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

  const rawFixCount = await prisma.$executeRaw`
    UPDATE "Test" 
    SET "pdfUrl" = REPLACE(REPLACE("pdfUrl", 'dummy_bucket', ${B2_BUCKET_NAME}), '/temp/', '/'),
        "explanation" = REPLACE(REPLACE("explanation", 'dummy_bucket', ${B2_BUCKET_NAME}), '/temp/', '/')
    WHERE "pdfUrl" LIKE '%dummy_bucket%' OR "pdfUrl" LIKE '%/temp/%'
       OR "explanation" LIKE '%dummy_bucket%' OR "explanation" LIKE '%/temp/%';
  `;

  console.log(`🎉 Automated DB Restoration Complete! Total tests updated: ${updatedCount}, SQL rows modified: ${rawFixCount}`);
}

function findBestMatchingB2File(title, currentUrl, b2Files) {
  const urlKey = currentUrl ? currentUrl.split("/").pop() : "";
  const cleanTitle = (title || "").toLowerCase();

  const codeMatch = cleanTitle.match(/\b1\.\d+\b/);
  const code = codeMatch ? codeMatch[0] : null;

  for (const file of b2Files) {
    const key = file.Key;
    const lowerKey = key.toLowerCase();

    if (urlKey && lowerKey.includes(urlKey.toLowerCase())) return key;

    if (code) {
      const codeFormatted = code.replace(".", "-");
      const codeDot = code;
      if ((lowerKey.includes(`h11-${codeFormatted}-`) || lowerKey.includes(`h11-${codeDot}-`)) &&
          (!cleanTitle.includes("explanation") && !cleanTitle.includes("lời giải") || lowerKey.includes("explanation"))) {
        return key;
      }
    }
  }

  for (const file of b2Files) {
    const key = file.Key;
    const lowerKey = key.toLowerCase();

    if (code) {
      const codeFormatted = code.replace(".", "-");
      if (lowerKey.includes(`h11-${codeFormatted}-`)) return key;
    }
  }

  return null;
}

autoFixAllPdfUrls().finally(() => prisma.$disconnect());
