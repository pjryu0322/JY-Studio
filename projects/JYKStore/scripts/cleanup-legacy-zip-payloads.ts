/**
 * Delete legacy KnowledgePayload ZIP objects from MinIO, then drop DB rows.
 *
 * Default: dry-run (lists only).
 * Apply:   npm run cleanup:legacy-zip-payloads -- --apply
 *
 * Run BEFORE `prisma migrate` that drops KnowledgePayload.
 * Uses raw SQL so it still works after the Prisma model is removed from schema.
 *
 * Safety: never deletes a DB row if the object delete fails (unless already missing).
 * Logs never include secrets or presigned URLs.
 */

import { PrismaClient } from "@prisma/client";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

type PayloadRow = {
  id: string;
  packId: string;
  versionId: string;
  storagePath: string;
  originalFileName: string;
  fileSize: bigint | number;
  validationStatus: string;
};

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function isObjectAlreadyMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = e.Code ?? e.code ?? e.name ?? "";
  if (
    code === "NoSuchKey" ||
    code === "NotFound" ||
    code === "NoSuchBucket" ||
    String(code).includes("NotFound")
  ) {
    return true;
  }
  if (e.$metadata?.httpStatusCode === 404) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /not\s*found|nosuchkey|404/i.test(message);
}

function createS3Client(): { client: S3Client; bucket: string } {
  const endpoint = env("JYKSTORE_PAYLOAD_S3_ENDPOINT");
  const region = env("JYKSTORE_PAYLOAD_S3_REGION", "ap-northeast-2");
  const bucket = env("JYKSTORE_PAYLOAD_S3_BUCKET");
  const accessKeyId = env("JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID");
  const secretAccessKey = env("JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY");
  const forcePathStyle = env("JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE", "false") === "true";

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing S3 config (JYKSTORE_PAYLOAD_S3_BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY).",
    );
  }

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket };
}

async function tableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'KnowledgePayload'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";
  console.log(`[cleanup-legacy-zip-payloads] mode=${mode}`);

  if (!(await tableExists())) {
    console.log("[cleanup-legacy-zip-payloads] KnowledgePayload table already dropped — nothing to do");
    return;
  }

  const rows = await prisma.$queryRaw<PayloadRow[]>`
    SELECT id, "packId", "versionId", "storagePath", "originalFileName", "fileSize", "validationStatus"
    FROM "KnowledgePayload"
    ORDER BY "createdAt" ASC
  `;

  console.log(`[cleanup-legacy-zip-payloads] found=${rows.length} KnowledgePayload rows`);
  if (rows.length === 0) {
    console.log("[cleanup-legacy-zip-payloads] nothing to do");
    return;
  }

  for (const row of rows) {
    console.log(
      `  - id=${row.id} packId=${row.packId} versionId=${row.versionId} size=${row.fileSize} status=${row.validationStatus} objectKey=${row.storagePath}`,
    );
  }

  if (!apply) {
    console.log(
      "[cleanup-legacy-zip-payloads] dry-run complete. Re-run with --apply to delete objects then DB rows.",
    );
    return;
  }

  const { client, bucket } = createS3Client();
  let deletedObjects = 0;
  let deletedRows = 0;
  let failed = 0;

  for (const row of rows) {
    const objectKey = row.storagePath;
    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
      deletedObjects += 1;
    } catch (error) {
      if (!isObjectAlreadyMissing(error)) {
        failed += 1;
        console.error(
          `[cleanup-legacy-zip-payloads] object delete failed id=${row.id} objectKey=${objectKey} err=${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      console.log(
        `[cleanup-legacy-zip-payloads] object already missing id=${row.id} objectKey=${objectKey}`,
      );
    }

    try {
      await prisma.$executeRaw`DELETE FROM "KnowledgePayload" WHERE id = ${row.id}`;
      deletedRows += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `[cleanup-legacy-zip-payloads] DB delete failed id=${row.id} err=${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(
    `[cleanup-legacy-zip-payloads] done deletedObjects=${deletedObjects} deletedRows=${deletedRows} failed=${failed}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      "[cleanup-legacy-zip-payloads] fatal:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
