import { S3Client } from "@aws-sdk/client-s3"

export const s3Client = new S3Client({
  region: "sg",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
})

export const BUCKET_NAME = process.env.S3_BUCKET_NAME!
