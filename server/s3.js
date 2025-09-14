import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "ap-south-1",  // replace with your bucket's region
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,     // store in .env
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export default s3;
