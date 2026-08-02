import { P11_CANONICAL_ACCOUNTS } from "../policy/reset-allowlist.ts";
import type { DbInventoryResult, ObjectInventoryResult } from "../types.ts";
import { prisma } from "./client.ts";

const ZERO_MODELS = [
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
] as const;

export type VerifyChecks = {
  failures: string[];
  roleCounts: { ADMIN: number; PROVIDER: number; USER: number };
  providerProfileCount: number;
};

export async function collectVerifyFailures(
  db: DbInventoryResult,
  objects: ObjectInventoryResult,
): Promise<VerifyChecks> {
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

  const providerProfileCount = await prisma.providerProfile.count();
  if (providerProfileCount !== 1) {
    failures.push(`ProviderProfile=${providerProfileCount}`);
  }

  for (const name of ZERO_MODELS) {
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

  return { failures, roleCounts, providerProfileCount };
}
