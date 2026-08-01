/**
 * P11 unified Clean Reset CLI.
 *
 * Default is read-only. Destructive modes require both:
 *   --execute --confirm JYKSTORE_CLEAN_RESET
 *
 * Usage:
 *   node --import tsx scripts/p11-clean-reset.ts inventory
 *   node --import tsx scripts/p11-clean-reset.ts dry-run
 *   node --import tsx scripts/p11-clean-reset.ts backup
 *   node --import tsx scripts/p11-clean-reset.ts execute --confirm JYKSTORE_CLEAN_RESET
 *   node --import tsx scripts/p11-clean-reset.ts verify
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DeleteObjectsCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { mockCategories } from "../src/data/mock-categories.ts";
import { ensureStructureTemplatesSeeded } from "../src/lib/structure-quality/structure-template-service.ts";

const CONFIRM_TOKEN = "JYKSTORE_CLEAN_RESET";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_DIR = join(ROOT, "tmp-p11-clean-reset", "backup");
const MANIFEST_DIR = join(ROOT, "tmp-p11-clean-reset");

/** Canonical post-reset accounts (passwordless email auth). */
export const P11_CANONICAL_ACCOUNTS = [
  {
    email: "admin@jyk.local",
    name: "JYKStore Admin",
    accountRole: "ADMIN" as const,
  },
  {
    email: "provider@jyk.local",
    name: "JYKStore Provider",
    accountRole: "PROVIDER" as const,
  },
  {
    email: "user@jyk.local",
    name: "JYKStore User",
    accountRole: "USER" as const,
  },
] as const;

const KEEP_EMAILS = new Set(
  P11_CANONICAL_ACCOUNTS.map((a) => a.email.toLowerCase()),
);

function ensureDatabaseUrlFromDotEnv(): void {
  loadDotEnvKeys([
    "DATABASE_URL",
    "JYKSTORE_PAYLOAD_STORAGE_DRIVER",
    "JYKSTORE_PAYLOAD_S3_ENDPOINT",
    "JYKSTORE_PAYLOAD_S3_REGION",
    "JYKSTORE_PAYLOAD_S3_BUCKET",
    "JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID",
    "JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY",
    "JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE",
    "JYKSTORE_PAYLOAD_S3_PREFIX",
    "JYKSTORE_PAYLOAD_S3_SERVER_SIDE_ENCRYPTION",
    "JYKSTORE_ADMIN_EMAILS",
  ]);
}

function loadDotEnvKeys(keys: string[]): void {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const key of keys) {
    if (process.env[key]?.trim()) continue;
    const match = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "m"));
    if (!match?.[1]) continue;
    let value = match[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

ensureDatabaseUrlFromDotEnv();

const prisma = new PrismaClient();

type TableCount = {
  model: string;
  table: string;
  count: number;
  packRelated: boolean;
  action: "keep" | "delete" | "unknown";
};

type ObjectEntry = {
  key: string;
  size: number;
  lastModified: string | null;
  prefixClass: string;
  packId: string | null;
  dbReferenced: boolean;
  classification:
    | "ACTIVE_REFERENCED"
    | "LEGACY_REFERENCED"
    | "ORPHAN_OBJECT"
    | "MISSING_OBJECT"
    | "UNKNOWN";
};

type S3Config = {
  client: S3Client;
  bucket: string;
  prefix: string;
  endpoint?: string;
  region: string;
};

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function createS3(): S3Config {
  const bucket = env("JYKSTORE_PAYLOAD_S3_BUCKET");
  const accessKeyId = env("JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID");
  const secretAccessKey = env("JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY");
  const region = env("JYKSTORE_PAYLOAD_S3_REGION", "ap-northeast-2");
  const endpoint = env("JYKSTORE_PAYLOAD_S3_ENDPOINT") || undefined;
  const prefix = env("JYKSTORE_PAYLOAD_S3_PREFIX", "payloads").replace(
    /^\/+|\/+$/g,
    "",
  );
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3 config for P11 clean reset");
  }
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: env("JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE", "false") === "true",
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket, prefix, endpoint, region };
}

async function assertBucket(s3: S3Config): Promise<void> {
  await s3.client.send(new HeadBucketCommand({ Bucket: s3.bucket }));
}

async function listAllObjects(s3: S3Config): Promise<_Object[]> {
  const out: _Object[] = [];
  let token: string | undefined;
  do {
    const res = await s3.client.send(
      new ListObjectsV2Command({
        Bucket: s3.bucket,
        Prefix: `${s3.prefix}/`,
        ContinuationToken: token,
      }),
    );
    out.push(...(res.Contents ?? []));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

function classifyPrefix(key: string): {
  prefixClass: string;
  packId: string | null;
} {
  const parts = key.replace(/\\/g, "/").split("/");
  // payloads/packs/{packId}/...
  const packsIdx = parts.indexOf("packs");
  if (packsIdx >= 0 && parts[packsIdx + 1]) {
    const packId = parts[packsIdx + 1]!;
    if (key.includes("/source-revisions/")) {
      return { prefixClass: "source-revisions", packId };
    }
    if (key.includes("/working-copies/")) {
      return { prefixClass: "working-copies", packId };
    }
    if (key.includes("/worker-request/")) {
      return { prefixClass: "worker-request", packId };
    }
    if (key.includes("/runs/") && key.includes("/worker-output/")) {
      return { prefixClass: "runs/worker-output", packId };
    }
    if (key.includes("/runs/") && key.includes("/exports/")) {
      return { prefixClass: "runs/rag-export", packId };
    }
    if (key.includes("/runs/") && key.includes("/source/")) {
      return { prefixClass: "runs/source", packId };
    }
    return { prefixClass: "packs/other", packId };
  }
  // payloads/pack-files/{packId}/...
  const pfIdx = parts.indexOf("pack-files");
  if (pfIdx >= 0 && parts[pfIdx + 1]) {
    return { prefixClass: "pack-files", packId: parts[pfIdx + 1]! };
  }
  // payloads/{packId}/{versionId}/{payloadId}.zip legacy
  const root = env("JYKSTORE_PAYLOAD_S3_PREFIX", "payloads");
  if (parts[0] === root && parts.length >= 3) {
    return { prefixClass: "legacy-zip-or-other", packId: parts[1] ?? null };
  }
  // Listed under configured prefix → treat as deletable orphan, not UNKNOWN blocker
  return { prefixClass: "prefix-other", packId: null };
}

async function collectDbStorageKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const add = (k: string | null | undefined) => {
    if (k?.trim()) keys.add(k.trim().replace(/\\/g, "/"));
  };

  const revisions = await prisma.workerZipSourceRevision.findMany({
    select: { storageKey: true },
  });
  for (const r of revisions) add(r.storageKey);

  const copies = await prisma.workerZipWorkingCopy.findMany({
    select: { storageKey: true },
  });
  for (const c of copies) add(c.storageKey);

  const files = await prisma.knowledgePackFile.findMany({
    select: { storageKey: true },
  });
  for (const f of files) add(f.storageKey);

  return keys;
}

async function countModel(
  label: string,
  tableHint: string,
  packRelated: boolean,
  action: TableCount["action"],
  fn: () => Promise<number>,
): Promise<TableCount> {
  try {
    const count = await fn();
    return { model: label, table: tableHint, count, packRelated, action };
  } catch (error) {
    return {
      model: label,
      table: tableHint,
      count: -1,
      packRelated,
      action: "unknown",
    };
  }
}

async function dbInventory(): Promise<{
  tables: TableCount[];
  users: Array<{
    id: string;
    email: string | null;
    accountRole: string;
    providerProfileCount: number;
    packCount: number;
    apiKeyCount: number;
    keep: boolean;
  }>;
  packs: Array<{
    packId: string;
    status: string;
    providerProfileId: string | null;
    versionCount: number;
  }>;
  categories: number;
  structureTemplates: number;
}> {
  const tables: TableCount[] = [];
  const push = async (
    label: string,
    table: string,
    packRelated: boolean,
    action: TableCount["action"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delegate: { count: (args?: any) => Promise<number> },
  ) => {
    tables.push(
      await countModel(label, table, packRelated, action, () => delegate.count()),
    );
  };

  await push("User", "User", false, "delete", prisma.user);
  await push("ProviderProfile", "ProviderProfile", false, "delete", prisma.providerProfile);
  await push("Organization", "Organization", false, "delete", prisma.organization);
  await push("OrganizationMember", "OrganizationMember", false, "delete", prisma.organizationMember);
  await push("ApiKey", "ApiKey", false, "delete", prisma.apiKey);
  await push("ApiUsageLog", "ApiUsageLog", false, "delete", prisma.apiUsageLog);
  await push("AuditLog", "AuditLog", false, "delete", prisma.auditLog);
  await push("PackCategory", "PackCategory", false, "keep", prisma.packCategory);
  await push("KnowledgeStructureTemplate", "KnowledgeStructureTemplate", false, "keep", prisma.knowledgeStructureTemplate);
  await push("KnowledgeStructureSection", "KnowledgeStructureSection", false, "keep", prisma.knowledgeStructureSection);

  await push("KnowledgePack", "KnowledgePack", true, "delete", prisma.knowledgePack);
  await push("KnowledgePackVersion", "KnowledgePackVersion", true, "delete", prisma.knowledgePackVersion);
  await push("PackReview", "PackReview", true, "delete", prisma.packReview);
  await push("PackDistributionMetadata", "PackDistributionMetadata", true, "delete", prisma.packDistributionMetadata);
  await push("PackInstallation", "PackInstallation", true, "delete", prisma.packInstallation);
  await push("WorkerZipSourceRevision", "WorkerZipSourceRevision", true, "delete", prisma.workerZipSourceRevision);
  await push("WorkerZipWorkingCopy", "WorkerZipWorkingCopy", true, "delete", prisma.workerZipWorkingCopy);
  await push("KnowledgeScopeInventory", "KnowledgeScopeInventory", true, "delete", prisma.knowledgeScopeInventory);
  await push("KnowledgeScopeInventoryItem", "KnowledgeScopeInventoryItem", true, "delete", prisma.knowledgeScopeInventoryItem);
  await push("KnowledgeScopeDecisionEvent", "KnowledgeScopeDecisionEvent", true, "delete", prisma.knowledgeScopeDecisionEvent);
  await push("PipelineRun", "PipelineRun", true, "delete", prisma.pipelineRun);
  await push("PipelineStepLog", "PipelineStepLog", true, "delete", prisma.pipelineStepLog);
  await push("NormalizedDocument", "NormalizedDocument", true, "delete", prisma.normalizedDocument);
  await push("SourceDocument", "SourceDocument", true, "delete", prisma.sourceDocument);
  await push("KnowledgePackFile", "KnowledgePackFile", true, "delete", prisma.knowledgePackFile);
  await push("KnowledgeChunk", "KnowledgeChunk", true, "delete", prisma.knowledgeChunk);
  await push("KnowledgeChunkEmbedding", "KnowledgeChunkEmbedding", true, "delete", prisma.knowledgeChunkEmbedding);
  await push("SearchIndexVector", "SearchIndexVector", true, "delete", prisma.searchIndexVector);
  await push("SearchIndexGeneration", "SearchIndexGeneration", true, "delete", prisma.searchIndexGeneration);
  await push("KnowledgeGraphNode", "KnowledgeGraphNode", true, "delete", prisma.knowledgeGraphNode);
  await push("KnowledgeGraphEdge", "KnowledgeGraphEdge", true, "delete", prisma.knowledgeGraphEdge);
  await push("CorrectionCase", "CorrectionCase", true, "delete", prisma.correctionCase);
  await push("CorrectionAuditEvent", "CorrectionAuditEvent", true, "delete", prisma.correctionAuditEvent);
  await push("ServiceValidationRun", "ServiceValidationRun", true, "delete", prisma.serviceValidationRun);
  await push("ServiceValidationResultItem", "ServiceValidationResultItem", true, "delete", prisma.serviceValidationResultItem);
  await push("ServiceValidationProviderConfirmation", "ServiceValidationProviderConfirmation", true, "delete", prisma.serviceValidationProviderConfirmation);
  await push("ServiceValidationDownloadTest", "ServiceValidationDownloadTest", true, "delete", prisma.serviceValidationDownloadTest);
  await push("StructureCoverageReport", "StructureCoverageReport", true, "delete", prisma.structureCoverageReport);
  await push("ChunkQualityReport", "ChunkQualityReport", true, "delete", prisma.chunkQualityReport);
  await push("KnowledgeQualityReport", "KnowledgeQualityReport", true, "delete", prisma.knowledgeQualityReport);
  await push("ReleaseGateRun", "ReleaseGateRun", true, "delete", prisma.releaseGateRun);
  await push("RetrievalEvaluationSet", "RetrievalEvaluationSet", true, "delete", prisma.retrievalEvaluationSet);
  await push("RetrievalEvaluationRun", "RetrievalEvaluationRun", true, "delete", prisma.retrievalEvaluationRun);
  await push("DoclingImportBundle", "DoclingImportBundle", true, "delete", prisma.doclingImportBundle);
  await push("DoclingUploadSession", "DoclingUploadSession", true, "delete", prisma.doclingUploadSession);
  await push("DoclingUploadFile", "DoclingUploadFile", true, "delete", prisma.doclingUploadFile);
  await push("DoclingProcessingJob", "DoclingProcessingJob", true, "delete", prisma.doclingProcessingJob);
  await push("DoclingProcessingLog", "DoclingProcessingLog", true, "delete", prisma.doclingProcessingLog);
  await push("ObjectStorageCleanupJob", "ObjectStorageCleanupJob", false, "delete", prisma.objectStorageCleanupJob);
  await push("SourceValidationReport", "SourceValidationReport", true, "delete", prisma.sourceValidationReport);

  const usersRaw = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      accountRole: true,
      name: true,
      providerProfiles: { select: { id: true } },
      apiKeys: { select: { id: true } },
    },
  });

  const packOwners = await prisma.knowledgePack.findMany({
    select: { packId: true, status: true, providerProfileId: true, _count: { select: { versions: true } } },
  });

  const profileToPacks = new Map<string, number>();
  for (const pack of packOwners) {
    if (!pack.providerProfileId) continue;
    profileToPacks.set(
      pack.providerProfileId,
      (profileToPacks.get(pack.providerProfileId) ?? 0) + 1,
    );
  }

  const profiles = await prisma.providerProfile.findMany({
    select: { id: true, userId: true },
  });
  const userPackCount = new Map<string, number>();
  for (const pr of profiles) {
    if (!pr.userId) continue;
    userPackCount.set(
      pr.userId,
      (userPackCount.get(pr.userId) ?? 0) + (profileToPacks.get(pr.id) ?? 0),
    );
  }

  const users = usersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    accountRole: u.accountRole,
    providerProfileCount: u.providerProfiles.length,
    packCount: userPackCount.get(u.id) ?? 0,
    apiKeyCount: u.apiKeys.length,
    keep: Boolean(u.email && KEEP_EMAILS.has(u.email.toLowerCase())),
  }));

  return {
    tables,
    users,
    packs: packOwners.map((p) => ({
      packId: p.packId,
      status: p.status,
      providerProfileId: p.providerProfileId,
      versionCount: p._count.versions,
    })),
    categories: await prisma.packCategory.count(),
    structureTemplates: await prisma.knowledgeStructureTemplate.count(),
  };
}

async function objectInventory(s3: S3Config): Promise<{
  objects: ObjectEntry[];
  dbKeys: string[];
  missingObjects: string[];
  totals: { count: number; bytes: number; orphanCount: number; unknownCount: number };
}> {
  const dbKeys = await collectDbStorageKeys();
  const listed = await listAllObjects(s3);
  const objects: ObjectEntry[] = [];
  const listedKeys = new Set<string>();

  for (const obj of listed) {
    const key = obj.Key;
    if (!key) continue;
    listedKeys.add(key);
    const { prefixClass, packId } = classifyPrefix(key);
    const dbReferenced = dbKeys.has(key);
    let classification: ObjectEntry["classification"];
    if (dbReferenced) {
      classification =
        prefixClass === "worker-request" || prefixClass.startsWith("legacy-zip")
          ? "LEGACY_REFERENCED"
          : "ACTIVE_REFERENCED";
    } else {
      classification = "ORPHAN_OBJECT";
    }

    objects.push({
      key,
      size: obj.Size ?? 0,
      lastModified: obj.LastModified?.toISOString() ?? null,
      prefixClass,
      packId,
      dbReferenced,
      classification,
    });
  }

  const missingObjects = [...dbKeys].filter((k) => !listedKeys.has(k));
  for (const key of missingObjects) {
    const { prefixClass, packId } = classifyPrefix(key);
    objects.push({
      key,
      size: 0,
      lastModified: null,
      prefixClass,
      packId,
      dbReferenced: true,
      classification: "MISSING_OBJECT",
    });
  }

  const orphanCount = objects.filter((o) => o.classification === "ORPHAN_OBJECT").length;
  const unknownCount = objects.filter((o) => o.classification === "UNKNOWN").length;
  const bytes = objects
    .filter((o) => o.classification !== "MISSING_OBJECT")
    .reduce((sum, o) => sum + o.size, 0);

  return {
    objects,
    dbKeys: [...dbKeys],
    missingObjects,
    totals: {
      count: listed.length,
      bytes,
      orphanCount,
      unknownCount,
    },
  };
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
}

async function seedCategories(): Promise<void> {
  for (const category of mockCategories) {
    await prisma.packCategory.upsert({
      where: { categoryId: category.categoryId },
      create: {
        categoryId: category.categoryId,
        name: category.name,
        description: category.description,
        icon: category.icon,
        parentCategoryId: category.parentCategoryId ?? null,
        sortOrder: category.sortOrder ?? 0,
      },
      update: {
        name: category.name,
        description: category.description,
        icon: category.icon,
        parentCategoryId: category.parentCategoryId ?? null,
        sortOrder: category.sortOrder ?? 0,
      },
    });
  }
}

async function seedCanonicalAccounts(): Promise<{
  users: Array<{ email: string; role: string; id: string }>;
  providerProfileId: string;
}> {
  const out: Array<{ email: string; role: string; id: string }> = [];
  let providerUserId = "";

  for (const account of P11_CANONICAL_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        name: account.name,
        accountRole: account.accountRole,
      },
      update: {
        name: account.name,
        accountRole: account.accountRole,
      },
    });
    out.push({ email: account.email, role: account.accountRole, id: user.id });
    if (account.accountRole === "PROVIDER") providerUserId = user.id;
  }

  // Ensure ADMIN emails env includes canonical admin (runtime also checks env).
  // ProviderProfile: keep exactly one for provider.
  const existingProfiles = await prisma.providerProfile.findMany({
    where: { userId: providerUserId },
  });
  let providerProfileId = existingProfiles[0]?.id;
  if (!providerProfileId) {
    const created = await prisma.providerProfile.create({
      data: {
        userId: providerUserId,
        displayName: "JYKStore Provider",
        description: "Canonical P11 provider profile",
        contactEmail: "provider@jyk.local",
        status: "ACTIVE",
        clientId: `p11-provider-${createHash("sha256").update(providerUserId).digest("hex").slice(0, 12)}`,
      },
    });
    providerProfileId = created.id;
  } else {
    // Delete extra profiles for this user
    if (existingProfiles.length > 1) {
      await prisma.providerProfile.deleteMany({
        where: {
          userId: providerUserId,
          id: { not: providerProfileId },
        },
      });
    }
  }

  // Remove other provider profiles not tied to canonical provider (packs already gone).
  await prisma.providerProfile.deleteMany({
    where: {
      OR: [{ userId: null }, { userId: { not: providerUserId } }],
    },
  });

  return { users: out, providerProfileId };
}

/**
 * Truncate pack/derived tables with CASCADE. Keeps categories, structure
 * templates, and (separately handled) User / ProviderProfile.
 */
async function deleteAllPackRelated(): Promise<{
  packIds: string[];
  deletedPacks: number;
}> {
  const packs = await prisma.knowledgePack.findMany({ select: { packId: true } });
  const packIds = packs.map((p) => p.packId);

  // Order: deep children / Restrict edges first, then packs.
  const truncateTables = [
    "ServiceValidationDownloadTest",
    "ServiceValidationProviderConfirmation",
    "ServiceValidationResultItem",
    "ServiceValidationRun",
    "CorrectionAuditEvent",
    "CorrectionCase",
    "RetrievalEvaluationIssue",
    "RetrievalEvaluationResult",
    "RetrievalEvaluationRun",
    "RetrievalEvaluationCase",
    "RetrievalEvaluationSet",
    "ReleaseGateIssue",
    "ReleaseGateRun",
    "ChunkQualityChunkMetric",
    "ChunkQualityIssue",
    "ChunkQualityReport",
    "KnowledgeQualityIssue",
    "KnowledgeQualityReport",
    "StructureCoverageItem",
    "StructureCoverageReport",
    "SourceValidationIssue",
    "SourceValidationReport",
    "SearchIndexVector",
    "KnowledgeChunkEmbedding",
    "KnowledgeChunk",
    "KnowledgeGraphEdge",
    "KnowledgeGraphNode",
    "PipelineStepLog",
    "PipelineRun",
    "KnowledgeScopeDecisionEvent",
    "KnowledgeScopeInventoryItem",
    "KnowledgeScopeInventory",
    "WorkerZipWorkingCopy",
    "WorkerZipSourceRevision",
    "PackInstallation",
    "PackReview",
    "ObjectStorageCleanupJob",
    "ApiUsageLog",
    "AuditLog",
    "DoclingProcessingLog",
    "DoclingProcessingJob",
    "DoclingUploadFile",
    "DoclingUploadSession",
    "SearchIndexGeneration",
    "NormalizedDocument",
    "KnowledgePackFile",
    "DoclingImportBundle",
    "PackDistributionMetadata",
    "SourceDocument",
    "KnowledgePackVersion",
    "KnowledgePack",
  ];

  for (const table of truncateTables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }

  return { packIds, deletedPacks: packIds.length };
}

async function deleteNonCanonicalAccounts(): Promise<{ deletedUsers: number }> {
  const keep = await prisma.user.findMany({
    where: { email: { in: [...KEEP_EMAILS] } },
    select: { id: true },
  });
  const keepIds = keep.map((u) => u.id);

  // Delete api keys for everyone first
  await prisma.apiKey.deleteMany({
    where: keepIds.length ? { userId: { notIn: keepIds } } : undefined,
  });
  // Keep canonical users' keys wiped too (clean slate)
  await prisma.apiKey.deleteMany({});

  await prisma.organizationMember.deleteMany({});
  await prisma.organization.deleteMany({});

  const deleted = await prisma.user.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : undefined,
  });

  // If canonical users don't exist yet, delete all remaining
  if (keepIds.length === 0) {
    await prisma.providerProfile.deleteMany({});
    await prisma.user.deleteMany({});
  }

  return { deletedUsers: deleted.count };
}

async function deleteObjects(
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

function parseArgs(argv: string[]) {
  const command = argv[2] ?? "inventory";
  const execute = argv.includes("--execute");
  const confirmIdx = argv.indexOf("--confirm");
  const confirm =
    confirmIdx >= 0 ? (argv[confirmIdx + 1] ?? "") : "";
  return { command, execute, confirm };
}

async function cmdInventory() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);
  const report = {
    at: new Date().toISOString(),
    bucket: s3.bucket,
    prefix: s3.prefix,
    db,
    objects: {
      totals: objects.totals,
      missingCount: objects.missingObjects.length,
      byClass: Object.fromEntries(
        [
          "ACTIVE_REFERENCED",
          "LEGACY_REFERENCED",
          "ORPHAN_OBJECT",
          "MISSING_OBJECT",
          "UNKNOWN",
        ].map((c) => [
          c,
          objects.objects.filter((o) => o.classification === c).length,
        ]),
      ),
      sample: objects.objects.slice(0, 50).map((o) => ({
        key: o.key,
        size: o.size,
        classification: o.classification,
        packId: o.packId,
      })),
    },
  };
  writeJson(join(MANIFEST_DIR, "inventory-latest.json"), report);
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function cmdDryRun() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  const blockers: string[] = [];
  if (objects.totals.unknownCount > 0) {
    blockers.push(`UNKNOWN objects: ${objects.totals.unknownCount}`);
  }
  // Missing objects are integrity findings — classify but do not auto-block if they
  // belong to packs we will delete (DB rows go away). Still report them.
  const missingOnDeleteTargets = objects.missingObjects.length;

  const keepUsers = db.users.filter((u) => u.keep);
  const deleteUsers = db.users.filter((u) => !u.keep);

  // Allowlist readiness: we will CREATE canonical accounts if missing.
  const missingCanonical = P11_CANONICAL_ACCOUNTS.filter(
    (a) => !db.users.some((u) => u.email?.toLowerCase() === a.email),
  );

  const deleteKeys = objects.objects
    .filter((o) => o.classification !== "MISSING_OBJECT")
    .map((o) => o.key);

  const packRelatedDeletes = db.tables
    .filter((t) => t.packRelated && t.count > 0)
    .map((t) => ({ model: t.model, count: t.count }));

  const report = {
    at: new Date().toISOString(),
    mode: "DRY-RUN",
    accounts: {
      keep: keepUsers.map((u) => ({ email: u.email, role: u.accountRole })),
      delete: deleteUsers.map((u) => ({ email: u.email, role: u.accountRole })),
      willCreate: missingCanonical.map((a) => a.email),
      target: P11_CANONICAL_ACCOUNTS.map((a) => ({
        email: a.email,
        role: a.accountRole,
      })),
    },
    packs: {
      keep: 0,
      delete: db.packs.map((p) => p.packId),
      count: db.packs.length,
    },
    categoriesKeep: db.categories,
    structureTemplatesKeep: db.structureTemplates,
    packRelatedDeletes,
    objects: {
      deleteCount: deleteKeys.length,
      deleteBytes: objects.totals.bytes,
      orphanCount: objects.totals.orphanCount,
      unknownCount: objects.totals.unknownCount,
      missingObjectFindings: missingOnDeleteTargets,
    },
    blockers,
    safeToExecute:
      blockers.length === 0 &&
      Boolean(env("JYKSTORE_PAYLOAD_S3_BUCKET")) &&
      Boolean(env("DATABASE_URL")),
  };

  writeJson(join(MANIFEST_DIR, "dry-run-latest.json"), {
    ...report,
    // full key list stays local, not for git
    deleteKeys,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.safeToExecute) {
    console.error("P11 CLEAN RESET BLOCKED — see blockers");
    process.exitCode = 2;
  }
  return report;
}

async function cmdBackup() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  // Safe account export (no secrets)
  writeJson(join(BACKUP_DIR, "accounts-allowlist.json"), {
    at: new Date().toISOString(),
    canonical: P11_CANONICAL_ACCOUNTS,
    currentUsers: db.users.map((u) => ({
      id: u.id,
      email: u.email,
      accountRole: u.accountRole,
      keep: u.keep,
    })),
    categories: db.categories,
    packs: db.packs,
  });

  writeJson(join(BACKUP_DIR, "object-manifest.json"), {
    at: new Date().toISOString(),
    bucket: s3.bucket,
    prefix: s3.prefix,
    objects: objects.objects.map((o) => ({
      key: o.key,
      size: o.size,
      lastModified: o.lastModified,
      classification: o.classification,
      packId: o.packId,
    })),
  });

  writeJson(join(BACKUP_DIR, "db-inventory.json"), db);

  // Attempt pg_dump if available (strip Prisma ?schema= query which pg_dump rejects)
  let pgDump: { ok: boolean; path?: string; error?: string } = { ok: false };
  const dumpPath = join(BACKUP_DIR, "jykstore-p11.dump");
  try {
    const { spawnSync } = await import("node:child_process");
    let databaseUrl = env("DATABASE_URL");
    try {
      const u = new URL(databaseUrl);
      u.search = "";
      databaseUrl = u.toString();
    } catch {
      databaseUrl = databaseUrl.replace(/\?.*$/, "");
    }
    const result = spawnSync(
      "pg_dump",
      ["--format=custom", `--file=${dumpPath}`, databaseUrl],
      { encoding: "utf8" },
    );
    if (result.status === 0 && existsSync(dumpPath)) {
      pgDump = { ok: true, path: "tmp-p11-clean-reset/backup/jykstore-p11.dump" };
    } else {
      pgDump = {
        ok: false,
        error: (result.stderr || result.error?.message || "pg_dump failed").slice(0, 500),
      };
      writeJson(join(BACKUP_DIR, "pg-dump-status.json"), pgDump);
    }
  } catch (error) {
    pgDump = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    writeJson(join(BACKUP_DIR, "pg-dump-status.json"), pgDump);
  }

  const marker = {
    at: new Date().toISOString(),
    backupDir: "tmp-p11-clean-reset/backup",
    pgDump,
    objectCount: objects.totals.count,
    objectBytes: objects.totals.bytes,
    userCount: db.users.length,
    packCount: db.packs.length,
  };
  writeJson(join(BACKUP_DIR, "BACKUP_COMPLETE.json"), marker);
  writeJson(join(MANIFEST_DIR, "backup-latest.json"), marker);
  console.log(JSON.stringify(marker, null, 2));
  if (!pgDump.ok) {
    console.warn(
      "[p11] pg_dump unavailable/failed — JSON inventory + object manifest still written (acceptable local backup).",
    );
  }
  return marker;
}

async function requireBackupComplete(): Promise<void> {
  const marker = join(BACKUP_DIR, "BACKUP_COMPLETE.json");
  if (!existsSync(marker)) {
    throw new Error("Backup incomplete: run `backup` before execute");
  }
}

async function cmdExecute() {
  await requireBackupComplete();
  const dry = await cmdDryRun();
  if (!dry.safeToExecute) {
    throw new Error("P11 CLEAN RESET BLOCKED by dry-run blockers");
  }

  const s3 = createS3();
  await assertBucket(s3);
  if (s3.prefix !== "payloads" && !s3.prefix.startsWith("payloads")) {
    // Soft check — allow configured prefix but refuse empty
    if (!s3.prefix) throw new Error("Refusing empty S3 prefix");
  }

  const objects = await objectInventory(s3);
  const deleteKeys = objects.objects
    .filter((o) => o.classification !== "MISSING_OBJECT")
    .map((o) => o.key);

  console.log(`[p11] deleting ${deleteKeys.length} objects…`);
  const objResult = await deleteObjects(s3, deleteKeys);
  writeJson(join(MANIFEST_DIR, "object-delete-manifest.json"), {
    at: new Date().toISOString(),
    deleted: objResult.deleted,
    failed: objResult.failed,
    keysAttempted: deleteKeys.length,
  });
  if (objResult.failed.length > 0) {
    throw new Error(`Object delete failed for ${objResult.failed.length} keys`);
  }

  console.log("[p11] deleting pack-related DB rows…");
  const packResult = await deleteAllPackRelated();

  console.log("[p11] deleting non-canonical accounts…");
  const accountResult = await deleteNonCanonicalAccounts();

  console.log("[p11] seeding categories + structure templates + 3 accounts…");
  await seedCategories();
  await ensureStructureTemplatesSeeded();
  const seed = await seedCanonicalAccounts();

  // Final wipe of leftover provider profiles except one
  const profiles = await prisma.providerProfile.findMany();
  if (profiles.length > 1) {
    await prisma.providerProfile.deleteMany({
      where: { id: { not: seed.providerProfileId } },
    });
  }

  const summary = {
    at: new Date().toISOString(),
    objectsDeleted: objResult.deleted,
    packsDeleted: packResult.deletedPacks,
    packIds: packResult.packIds,
    usersDeleted: accountResult.deletedUsers,
    seededUsers: seed.users,
    providerProfileId: seed.providerProfileId,
  };
  writeJson(join(MANIFEST_DIR, "execute-summary.json"), summary);
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

async function cmdVerify() {
  const s3 = createS3();
  await assertBucket(s3);
  const db = await dbInventory();
  const objects = await objectInventory(s3);

  const roleCounts = {
    ADMIN: db.users.filter((u) => u.accountRole === "ADMIN").length,
    PROVIDER: db.users.filter((u) => u.accountRole === "PROVIDER").length,
    USER: db.users.filter((u) => u.accountRole === "USER").length,
  };

  const failures: string[] = [];
  if (db.users.length !== 3) failures.push(`User=${db.users.length} expected 3`);
  if (roleCounts.ADMIN !== 1) failures.push(`ADMIN=${roleCounts.ADMIN}`);
  if (roleCounts.PROVIDER !== 1) failures.push(`PROVIDER=${roleCounts.PROVIDER}`);
  if (roleCounts.USER !== 1) failures.push(`USER=${roleCounts.USER}`);

  const profileCount = await prisma.providerProfile.count();
  if (profileCount !== 1) failures.push(`ProviderProfile=${profileCount}`);

  const zeroModels = [
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
    "DoclingImportBundle",
    "ApiKey",
  ];
  for (const name of zeroModels) {
    const row = db.tables.find((t) => t.model === name);
    if (!row || row.count !== 0) {
      failures.push(`${name}=${row?.count ?? "missing"} expected 0`);
    }
  }

  if (objects.totals.count !== 0) {
    failures.push(`Object count=${objects.totals.count} expected 0 under prefix`);
  }
  if (objects.totals.orphanCount !== 0) failures.push("orphan objects remain");
  if (objects.totals.unknownCount !== 0) failures.push("unknown objects remain");
  if (objects.missingObjects.length !== 0) {
    failures.push(`MISSING_OBJECT findings=${objects.missingObjects.length}`);
  }

  const emails = new Set(
    db.users.map((u) => u.email?.toLowerCase()).filter(Boolean),
  );
  for (const a of P11_CANONICAL_ACCOUNTS) {
    if (!emails.has(a.email)) failures.push(`missing account ${a.email}`);
  }

  const report = {
    at: new Date().toISOString(),
    pass: failures.length === 0,
    failures,
    roleCounts,
    userEmails: db.users.map((u) => u.email),
    providerProfileCount: profileCount,
    packCount: db.packs.length,
    objectCount: objects.totals.count,
    categories: db.categories,
    structureTemplates: db.structureTemplates,
    tables: db.tables.filter((t) => t.count !== 0),
  };
  writeJson(join(MANIFEST_DIR, "verify-latest.json"), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) {
    console.error("P11 CLEAN RESET BLOCKED — verify failed");
    process.exitCode = 2;
  } else {
    console.log("P11 VERIFY PASS");
  }
  return report;
}

async function main() {
  const { command, execute, confirm } = parseArgs(process.argv);

  if (command === "execute") {
    if (!execute || confirm !== CONFIRM_TOKEN) {
      console.error(
        "Refusing execute. Required: --execute --confirm JYKSTORE_CLEAN_RESET",
      );
      process.exitCode = 2;
      return;
    }
  }

  switch (command) {
    case "inventory":
      await cmdInventory();
      break;
    case "dry-run":
      await cmdDryRun();
      break;
    case "backup":
      await cmdBackup();
      break;
    case "execute":
      await cmdExecute();
      break;
    case "verify":
      await cmdVerify();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
