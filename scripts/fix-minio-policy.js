
const { S3Client, PutBucketPolicyCommand, PutBucketCorsCommand, GetBucketPolicyCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  credentials: {
    accessKeyId: "admin",
    secretAccessKey: "password123",
  },
  forcePathStyle: true,
});

const BUCKET_NAME = "englearning-videos";

async function fixPolicy() {
  try {
    console.log(`Checking bucket: ${BUCKET_NAME}...`);

    // 1. Set Public Read Policy
    console.log("Setting Public Read policy...");
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
        },
      ],
    };

    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(policy),
    }));
    console.log("Public Read policy set successfully.");

    // 2. Set CORS
    console.log("Setting CORS policy...");
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }));
    console.log("CORS policy set successfully.");

    // 3. Verify
    console.log("Verifying policy...");
    const currentPolicy = await s3Client.send(new GetBucketPolicyCommand({ Bucket: BUCKET_NAME }));
    console.log("Current Bucket Policy:", currentPolicy.Policy);

  } catch (err) {
    console.error("Error fixing bucket policy:", err);
  }
}

fixPolicy();
