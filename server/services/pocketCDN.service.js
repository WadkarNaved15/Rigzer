// services/pocketCDN.service.js
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const cf = new CloudFrontClient({ region: "us-east-1" }); // CloudFront is global, always us-east-1

const BUCKET           = process.env.AWS_BUCKET_NAME;
const CDN_BASE         = process.env.GAMES_STORAGE_PRIVATE_CLOUDFRONT;
const CF_DISTRIBUTION  = process.env.CLOUDFRONT_DISTRIBUTION_ID; // optional — only needed for manual invalidations

/**
 * Upload a compiled JS bundle to S3 and return its CloudFront URL.
 *
 * Key design: the caller passes a VERSIONED key, e.g.
 *   pockets/<pocketId>/bundle-<timestamp>.js
 * This means every approval writes a brand-new S3 object.
 * CloudFront never serves a stale response because the URL itself changes.
 * No invalidation is needed — old versioned objects are simply orphaned.
 * Add an S3 lifecycle rule to expire pockets/<id>/bundle-*.js after 30 days
 * if you want automatic cleanup of superseded bundles.
 */
export async function uploadBundleToCDN(code, s3Key) {
  if (!BUCKET)    throw new Error("AWS_BUCKET_NAME env var is not set");
  if (!CDN_BASE)  throw new Error("GAMES_STORAGE_PRIVATE_CLOUDFRONT env var is not set");

  await s3.send(new PutObjectCommand({
    Bucket:       BUCKET,
    Key:          s3Key,
    Body:         code,
    ContentType:  "application/javascript",
    CacheControl: "public, max-age=31536000, immutable",
    // No ACL — bucket has ACLs disabled; access is via CloudFront OAC
  }));

  return `${CDN_BASE}/${s3Key}`;
}

/**
 * Delete a previously uploaded bundle from S3 immediately.
 * Throws on failure — caller is responsible for handling the error.
 */
export async function deleteBundleFromCDN(s3Key) {
  if (!s3Key) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  console.log(`Deleted old bundle from S3: ${s3Key}`);
}

/**
 * Manually invalidate a CloudFront path.
 * Not needed when using versioned keys — kept here for operational convenience
 * (e.g. emergency takedowns, admin tooling).
 *
 * Requires CLOUDFRONT_DISTRIBUTION_ID to be set.
 * CloudFront charges $0.005 per invalidation path after the first 1,000/month.
 */
export async function invalidateCDNPath(s3Key) {
  if (!CF_DISTRIBUTION) {
    console.warn("invalidateCDNPath: CLOUDFRONT_DISTRIBUTION_ID not set — skipping invalidation");
    return;
  }
  await cf.send(new CreateInvalidationCommand({
    DistributionId: CF_DISTRIBUTION,
    InvalidationBatch: {
      CallerReference: `${s3Key}-${Date.now()}`,
      Paths: {
        Quantity: 1,
        Items: [`/${s3Key}`],
      },
    },
  }));
  console.log(`CloudFront invalidation created for /${s3Key}`);
}