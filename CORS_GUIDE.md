# CORS Configuration Guide

## Cloudflare R2
To allow your Next.js app to play videos from R2, you must configure CORS on your R2 bucket.

1.  Go to Cloudflare Dashboard > R2.
2.  Select your bucket (`englearning-videos`).
3.  Go to **Settings** > **CORS Policy**.
4.  Add the following policy:
    ```json
    [
      {
        "AllowedOrigins": [
          "http://localhost:3000",
          "https://your-production-domain.com"
        ],
        "AllowedMethods": [
          "GET",
          "HEAD"
        ],
        "AllowedHeaders": [
          "*"
        ],
        "ExposeHeaders": [],
        "MaxAgeSeconds": 3000
      }
    ]
    ```

## MinIO (Local)
For local development with MinIO docker:
- MinIO usually allows CORS by default or you can start with `MINIO_API_CORS_ALLOW_ORIGIN="*"`.
- If you face issues, ensure your Docker run command includes correct environment variables or use the `mc` (MinIO Client) tool to set policy.
