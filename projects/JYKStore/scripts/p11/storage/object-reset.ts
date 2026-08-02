import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { S3Config } from "../types.ts";

export async function deleteObjects(
  s3: S3Config,
  keys: string[],
): Promise<{ deleted: number; failed: string[] }> {
  const failed: string[] = [];
  let deleted = 0;
  const batchSize = 100;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    try {
      const res = await s3.client.send(
        new DeleteObjectsCommand({
          Bucket: s3.bucket,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      const errors = res.Errors ?? [];
      for (const err of errors) {
        if (err.Key) failed.push(err.Key);
      }
      deleted += batch.length - errors.length;
    } catch {
      failed.push(...batch);
    }
  }
  return { deleted, failed };
}
