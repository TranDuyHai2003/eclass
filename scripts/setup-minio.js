const { S3Client, CreateBucketCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  credentials: {
    accessKeyId: "admin",
    secretAccessKey: "password123",
  },
  forcePathStyle: true,
});

async function createBucket() {
  const bucketName = "englearning-videos";
  console.log(`Creating bucket: ${bucketName}...`);
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log("Bucket created successfully.");
  } catch (err) {
    if (err.name === "BucketAlreadyOwnedByYou" || err.name === "BucketAlreadyExists") {
      console.log("Bucket already exists.");
    } else {
      console.error("Error creating bucket:", err);
    }
  }
}

createBucket();
