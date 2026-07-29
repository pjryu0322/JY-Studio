/**
 * Sync exception-only correction cases from quality blockers/warnings + source WARNING docs.
 */
import type {
  CorrectionRequestedAction,
  CorrectionSeverity,
  CorrectionTargetType,
  Prisma,
} from "@prisma/client";
import {
  buildCorrectionQueueIssues,
  type CorrectionQueueIssue,
} from "@/lib/admin-correction-queue-issues";
import { getAdminReviewDetail } from "@/lib/admin-review-service";
import { appendCorrectionAuditEvent } from "@/lib/correction/correction-audit";
import { toCorrectionCaseDto } from "@/lib/correction/correction-mapper";
import {
  CorrectionServiceError,
  type CorrectionCaseDto,
} from "@/lib/correction/correction-types";
import { prisma } from "@/lib/prisma";
import { buildAdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

function mapSeverity(severity: CorrectionQueueIssue["severity"]): CorrectionSeverity {
  return severity === "block" ? "BLOCKER" : "WARNING";
}

function mapTarget(issue: CorrectionQueueIssue): {
  targetType: CorrectionTargetType;
  recommendedAction: CorrectionRequestedAction | null;
} {
  if (issue.category === "sourceDocument") {
    return { targetType: "FILE", recommendedAction: "FILE_EXCLUDE" };
  }
  if (issue.category === "provider") {
    return { targetType: "FILE", recommendedAction: "FILE_REQUEST_PROVIDER" };
  }
  if (issue.category === "knowledgeUnit") {
    return { targetType: "STRUCTURE", recommendedAction: "STRUCTURE_MERGE" };
  }
  if (issue.category === "chunk" || issue.category === "searchData") {
    if (/병합|merge/i.test(issue.recommendedAction)) {
      return { targetType: "CHUNK", recommendedAction: "CHUNK_MERGE" };
    }
    return { targetType: "CHUNK", recommendedAction: "CHUNK_DELETE" };
  }
  return { targetType: "CHUNK", recommendedAction: null };
}

function issueFingerprint(issue: CorrectionQueueIssue): string {
  return [issue.severity, issue.category, issue.targetId ?? "", issue.title.slice(0, 160)].join(
    "|",
  );
}

async function resolveInventoryLink(input: {
  packId: string;
  versionId: string;
  sourceDocumentId: string | null;
  client: typeof prisma;
}): Promise<{ inventoryItemId: string | null; relativePath: string | null }> {
  if (!input.sourceDocumentId) return { inventoryItemId: null, relativePath: null };

  const doc = await input.client.sourceDocument.findFirst({
    where: { id: input.sourceDocumentId, versionId: input.versionId },
    select: { id: true, title: true, fileName: true, sourceUrl: true },
  });
  if (!doc) return { inventoryItemId: null, relativePath: null };

  const candidates = [doc.title, doc.fileName, doc.sourceUrl]
    .map((v) => v?.replace(/\\/g, "/").trim())
    .filter((v): v is string => Boolean(v));

  const inventory = await input.client.knowledgeScopeInventory.findFirst({
    where: { packId: input.packId, versionId: input.versionId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!inventory || candidates.length === 0) {
    return { inventoryItemId: null, relativePath: candidates[0] ?? null };
  }

  const items = await input.client.knowledgeScopeInventoryItem.findMany({
    where: { inventoryId: inventory.id },
    select: { id: true, relativePath: true, fileName: true },
  });

  for (const candidate of candidates) {
    const exact = items.find(
      (item) =>
        item.relativePath === candidate ||
        item.fileName === candidate ||
        item.relativePath.endsWith(`/${candidate}`) ||
        candidate.endsWith(`/${item.relativePath}`),
    );
    if (exact) {
      return { inventoryItemId: exact.id, relativePath: exact.relativePath };
    }
  }

  return { inventoryItemId: null, relativePath: candidates[0] ?? null };
}

export async function syncCorrectionCasesFromQuality(input: {
  packId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
}): Promise<{ created: number; cases: CorrectionCaseDto[] }> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  if (!packId) {
    throw new CorrectionServiceError("PACK_ID_REQUIRED", "packId가 필요합니다.", 400);
  }

  const version = await client.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!version) {
    throw new CorrectionServiceError("VERSION_NOT_FOUND", "팩 버전을 찾을 수 없습니다.", 404);
  }

  const detail = await getAdminReviewDetail(packId);
  if (!detail) {
    throw new CorrectionServiceError("PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const quality = buildAdminQualityGateSnapshot(detail);
  const issues = buildCorrectionQueueIssues(quality, detail);
  const existingOpen = await client.correctionCase.findMany({
    where: {
      packId,
      versionId: version.id,
      status: { in: ["OPEN", "APPLIED", "REGENERATED", "VERIFIED"] },
    },
    select: { issueCode: true, targetId: true, title: true, status: true },
  });
  const existingKeys = new Set(
    existingOpen.map((row) => row.issueCode ?? `${row.targetId}|${row.title.slice(0, 160)}`),
  );

  let created = 0;
  const createdIds: string[] = [];

  for (const issue of issues) {
    const fingerprint = issueFingerprint(issue);
    if (existingKeys.has(fingerprint)) continue;

    const mapped = mapTarget(issue);
    const targetId = issue.targetId?.trim() || fingerprint;
    const link =
      mapped.targetType === "FILE"
        ? await resolveInventoryLink({
            packId,
            versionId: version.id,
            sourceDocumentId: issue.category === "sourceDocument" ? issue.targetId : null,
            client,
          })
        : { inventoryItemId: null, relativePath: null };

    const row = await client.correctionCase.create({
      data: {
        packId,
        versionId: version.id,
        targetType: mapped.targetType,
        targetId,
        issueCode: fingerprint,
        severity: mapSeverity(issue.severity),
        title: issue.title.slice(0, 240),
        description: issue.raw,
        sourceLocation: issue.sourceLocation,
        contentPreview: issue.contentPreview,
        recommendedAction: mapped.recommendedAction,
        status: "OPEN",
        inventoryItemId: link.inventoryItemId,
        relativePath: link.relativePath,
        parameters: {
          queueCategory: issue.category,
          recommendedActionLabel: issue.recommendedAction,
        } as Prisma.InputJsonValue,
      },
    });

    await appendCorrectionAuditEvent({
      caseId: row.id,
      actorUserId: input.actorUserId,
      action: "SYNC_FROM_QUALITY",
      fromStatus: null,
      toStatus: "OPEN",
      detail: { fingerprint, category: issue.category },
      client,
    });

    existingKeys.add(fingerprint);
    createdIds.push(row.id);
    created += 1;
  }

  const cases = await client.correctionCase.findMany({
    where: { packId, versionId: version.id },
    orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
  });

  return { created, cases: cases.map(toCorrectionCaseDto) };
}
