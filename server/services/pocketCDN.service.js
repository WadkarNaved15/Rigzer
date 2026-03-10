// services/pocketCDN.service.js
//
// Uploads the compiled bundle to S3 and returns the CloudFront URL.
// Key is deterministic per pocket so every publish overwrites the
// previous bundle — no stale files accumulate, no cleanup needed.
//
// Install: npm install @aws-sdk/client-s3
// Env vars (already used by your platform):
//   AWS_REGION, AWS_S3_BUCKET, VITE_GAMES_STORAGE_PRIVATE_CLOUDFRONT

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3       = new S3Client({ region: process.env.AWS_REGION });
const BUCKET   = process.env.AWS_BUCKET_NAME;
const CDN_BASE = process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT;

/**
 * @param {string} code   - Compiled JS string
 * @param {string} s3Key  - e.g. "pockets/<pocketId>/bundle.js"
 * @returns {Promise<string>} - Public CloudFront URL
 */
export async function uploadBundleToCDN(code, s3Key) {
  await s3.send(new PutObjectCommand({
    Bucket:       BUCKET,
    Key:          s3Key,
    Body:         Buffer.from(code, "utf-8"),
    ContentType:  "application/javascript",
    CacheControl: "public, max-age=3600",
  }));

  return `${CDN_BASE}/${s3Key}`;
}