/**
 * P11 evidence audit — live SQL + S3 counts (read-only).
 * Usage: node --import tsx scripts/p11-evidence-sql-audit.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HeadBucketCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "tmp-p11-clean-reset", "evidence-sql-audit.json");

function loadDotEnv(): void {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]!]?.trim()) continue;
    let v = m[2]!.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]!] = v;
  }
}

loadDotEnv();
const prisma = new PrismaClient();

async function count(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
    `SELECT COUNT(*)::int AS c FROM "${table}"`,
  );
  return rows[0]?.c ?? -1;
}

async function main() {
  const tables = [
    "User",
    "ProviderProfile",
    "KnowledgePack",
    "KnowledgePackVersion",
    "PackReview",
    "SearchIndexGeneration",
    "KnowledgeChunk",
    "SearchIndexVector",
    "WorkerZipSourceRevision",
    "WorkerZipWorkingCopy",
    "KnowledgeScopeInventory",
    "CorrectionCase",
    "ServiceValidationRun",
    "PipelineRun",
    "ApiKey",
    "PackCategory",
    "KnowledgeStructureTemplate",
    "DoclingImportBundle",
    "NormalizedDocument",
  ];
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = await count(t);

  const users = await prisma.$queryRawUnsafe<
    Array<{ email: string | null; accountRole: string }>
  >(`SELECT email, "accountRole" FROM "User" ORDER BY email ASC`);

  const profiles = await prisma.$queryRawUnsafe<
    Array<{ id: string; userId: string | null; displayName: string }>
  >(
    `SELECT id, "userId", "displayName" FROM "ProviderProfile" ORDER BY "createdAt" ASC`,
  );

  const orphanProfiles = await count_where(
    `SELECT COUNT(*)::int AS c FROM "ProviderProfile" WHERE "userId" IS NULL`,
  );
  const danglingPackCategory = await count_where(
    `SELECT COUNT(*)::int AS c FROM "KnowledgePack" kp
     LEFT JOIN "PackCategory" pc ON kp."categoryId" = pc."categoryId"
     WHERE pc."categoryId" IS NULL`,
  );

  const bucket = process.env.JYKSTORE_PAYLOAD_S3_BUCKET!;
  const prefix = (process.env.JYKSTORE_PAYLOAD_S3_PREFIX || "payloads").replace(
    /^\/+|\/+$/g,
    "",
  );
  const client = new S3Client({
    region: process.env.JYKSTORE_PAYLOAD_S3_REGION || "ap-northeast-2",
    endpoint: process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY!,
    },
  });
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  const buckets = await client.send(new ListBucketsCommand({}));
  let token: string | undefined;
  let objectCount = 0;
  let bytes = 0;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${prefix}/`,
        ContinuationToken: token,
      }),
    );
    for (const o of res.Contents ?? []) {
      objectCount += 1;
      bytes += o.Size ?? 0;
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  // Before snapshot from local backup inventory (not git)
  let before: unknown = null;
  const beforePath = join(ROOT, "tmp-p11-clean-reset", "backup", "db-inventory.json");
  if (existsSync(beforePath)) {
    const inv = JSON.parse(readFileSync(beforePath, "utf8")) as {
      users: Array<{ email: string | null; accountRole: string }>;
      packs: unknown[];
      tables: Array<{ model: string; count: number }>;
    };
    before = {
      userCount: inv.users.length,
      users: inv.users.map((u) => ({
        email: u.email,
        accountRole: u.accountRole,
      })),
      packCount: inv.packs.length,
      tableCounts: Object.fromEntries(
        inv.tables
          .filter((t) =>
            [
              "User",
              "ProviderProfile",
              "KnowledgePack",
              "KnowledgePackVersion",
            ].includes(t.model),
          )
          .map((t) => [t.model, t.count]),
      ),
    };
  }

  const report = {
    at: new Date().toISOString(),
    after: {
      counts,
      users,
      profiles: profiles.map((p) => ({
        idPrefix: p.id.slice(0, 8),
        userIdPrefix: p.userId?.slice(0, 8) ?? null,
        displayName: p.displayName,
      })),
      orphanProfiles,
      danglingPackCategory,
    },
    before,
    objectStorage: {
      bucket,
      prefix,
      bucketNames: (buckets.Buckets ?? []).map((b) => b.Name),
      objectCount,
      bytes,
    },
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
}

async function count_where(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(sql);
  return rows[0]?.c ?? -1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
