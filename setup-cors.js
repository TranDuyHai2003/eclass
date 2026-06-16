const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  endpoint: "https://s3.us-east-005.backblazeb2.com",
  region: "us-east-005",
  credentials: {
    accessKeyId: "005ab3dd6ee99500000000001",
    secretAccessKey: "K005XMcFrPbYidmDD+KKm0iNu/danJ0",
  },
});

const setupCors = async () => {
  const params = {
    Bucket: "teacherduc-video-storage",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://localhost:3000", "https://teacherduc.me"],
          AllowedMethods: ["GET", "PUT", "POST", "HEAD"],
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  };

  try {
    const data = await s3Client.send(new PutBucketCorsCommand(params));
    console.log("✅ Cập nhật CORS thành công! Bạn có thể upload file ngay bây giờ.");
  } catch (err) {
    console.error("❌ Lỗi cấu hình CORS:", err);
  }
};

setupCors();
