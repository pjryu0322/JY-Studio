import {
  HeadBucketCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { prisma } from "../db/client.ts";
import { env } from "../paths.ts";
import type { ObjectEntry, ObjectInventoryResult, S3Config } from "../types.ts";

export function createS3(): S3Config {
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

export async function assertBucket(s3: S3Config): Promise<void> {
  await s3.client.send(new HeadBucketCommand({ Bucket: s3.bucket }));
}

export async function listAllObjects(s3: S3Config): Promise<_Object[]> {
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

export function classifyPrefix(key: string): {
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

export async function collectDbStorageKeys(): Promise<Set<string>> {
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

export async function objectInventory(
  s3: S3Config,
): Promise<ObjectInventoryResult> {
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
