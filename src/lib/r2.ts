import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "./env";
import { retry } from "./utils";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const env = getEnv();
  await retry(() =>
    getClient().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    )
  );
}

export async function deleteObject(key: string): Promise<void> {
  const env = getEnv();
  await retry(() =>
    getClient().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }))
  );
}

/** Batch-deletes up to 1000 keys per call (R2/S3 limit). */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const env = getEnv();
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) chunks.push(keys.slice(i, i + 1000));
  for (const chunk of chunks) {
    await retry(() =>
      getClient().send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET_NAME,
          Delete: { Objects: chunk.map((Key) => ({ Key })) },
        })
      )
    );
  }
}

export async function getSignedDownloadUrl(key: string, filename?: string): Promise<string> {
  const env = getEnv();
  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ...(filename
      ? { ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"` }
      : {}),
  });
  return getSignedUrl(getClient(), command, {
    expiresIn: env.R2_SIGNED_URL_EXPIRES_SECONDS,
  });
}

export async function checkR2Connection(): Promise<boolean> {
  try {
    const env = getEnv();
    await getClient().send(new HeadBucketCommand({ Bucket: env.R2_BUCKET_NAME }));
    return true;
  } catch {
    return false;
  }
}

export function isR2Configured(): boolean {
  const env = process.env;
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME &&
      env.R2_ENDPOINT
  );
}
