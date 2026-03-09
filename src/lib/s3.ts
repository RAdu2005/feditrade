import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

export function getPublicObjectUrl(key: string) {
  return `${env.S3_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;
}

export async function createSignedUploadUrl(params: {
  contentType: string;
  maxSizeBytes: number;
}) {
  const key = `listings/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: params.contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });
  return { key, url };
}
