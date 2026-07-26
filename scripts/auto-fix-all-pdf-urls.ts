import { PrismaClient } from "@prisma/client";
import { b2Client, B2_BUCKET_NAME, CDN_DOMAIN } from "../lib/b2";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

async function autoFixAllPdfUrls() {
  console.log("🔍 Starting Automatic PDF & B2 Link Restoration...\n");

  // 1. Get all objects in documents/ from B2
  const cmd = new ListObjectsV2Command({
    Bucket: B2_BUCKET_NAME,
    Prefix: "documents/",
  });
  const res = await b2Client.send(cmd);
  const b2Files = (res.Contents || []).filter(c => (c.Size || 0) > 0 && c.Key?.endsWith(".pdf"));

  console.log(`📦 Found ${b2Files.length} valid PDF files (>0 bytes) in documents/ on B2.\n`);

  // Helper to extract clean base CDN URL
  const cleanCdnBase = CDN_DOMAIN.endsWith("/") ? CDN_DOMAIN.slice(0, -1) : CDN_DOMAIN;
  const b2Prefix = `${cleanCdnBase}/file/${B2_BUCKET_NAME}`;

  // 2. Fetch all Tests in DB
  const tests = await prisma.test.findMany();
  let updatedCount = 0;

  for (const t of tests) {
    let pdfUrl = t.pdfUrl;
    let explanation = t.explanation;
    let modified = false;

    // Fix pdfUrl
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

    // Fix explanation
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

  // 3. Fix any lingering dummy_bucket or temp/ references in all other fields
  const rawFixCount = await prisma.$executeRaw`
    UPDATE "Test" 
    SET "pdfUrl" = REPLACE(REPLACE("pdfUrl", 'dummy_bucket', ${B2_BUCKET_NAME}), '/temp/', '/'),
        "explanation" = REPLACE(REPLACE("explanation", 'dummy_bucket', ${B2_BUCKET_NAME}), '/temp/', '/')
    WHERE "pdfUrl" LIKE '%dummy_bucket%' OR "pdfUrl" LIKE '%/temp/%'
       OR "explanation" LIKE '%dummy_bucket%' OR "explanation" LIKE '%/temp/%';
  `;

  console.log(`🎉 Automated DB Restoration Complete! Total tests updated: ${updatedCount}, SQL rows modified: ${rawFixCount}`);
}

function findBestMatchingB2File(title: string | null | undefined, currentUrl: string, b2Files: any[]): string | null {
  const urlKey = currentUrl.split("/").pop() || "";
  const cleanTitle = (title || "").toLowerCase();

  // Extract lesson code if present e.g. "1.1", "1.2", "1.3", "1.4", "1.5"
  const codeMatch = cleanTitle.match(/\b1\.\d+\b/);
  const code = codeMatch ? codeMatch[0] : null;

  for (const file of b2Files) {
    const key = file.Key as string;
    const lowerKey = key.toLowerCase();

    // Match exact filename part
    if (urlKey && lowerKey.includes(urlKey.toLowerCase())) return key;

    // Match lesson code e.g. "1-1", "1.1", "1-2", "1-3"
    if (code) {
      const codeFormatted = code.replace(".", "-");
      const codeDot = code;
      if ((lowerKey.includes(`h11-${codeFormatted}-`) || lowerKey.includes(`h11-${codeDot}-`)) &&
          (!cleanTitle.includes("explanation") && !cleanTitle.includes("lời giải") || lowerKey.includes("explanation"))) {
        return key;
      }
    }
  }

  // Second pass: match title keywords
  for (const file of b2Files) {
    const key = file.Key as string;
    const lowerKey = key.toLowerCase();

    if (code) {
      const codeFormatted = code.replace(".", "-");
      if (lowerKey.includes(`h11-${codeFormatted}-`)) return key;
    }
  }

  return null;
}

autoFixAllPdfUrls().finally(() => prisma.$disconnect());
