import {
  buildWorkbenchSummary,
  toCorrectionAuditEventDto,
  toCorrectionCaseDto,
} from "@/lib/correction/correction-mapper";
import {
  CorrectionServiceError,
  type CorrectionAuditEventDto,
  type CorrectionCaseDto,
  type CorrectionWorkbenchSummaryDto,
} from "@/lib/correction/correction-types";
import { prisma } from "@/lib/prisma";

export async function getCorrectionWorkbench(input: {
  packId: string;
  includeClosed?: boolean;
  prismaClient?: typeof prisma;
}): Promise<{
  summary: CorrectionWorkbenchSummaryDto;
  cases: CorrectionCaseDto[];
}> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  if (!packId) {
    throw new CorrectionServiceError("PACK_ID_REQUIRED", "packId가 필요합니다.", 400);
  }

  const pack = await client.knowledgePack.findUnique({
    where: { packId },
    select: {
      packId: true,
      versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!pack) {
    throw new CorrectionServiceError("PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }

  const versionId = pack.versions[0]?.id ?? null;
  const cases = await client.correctionCase.findMany({
    where: {
      packId,
      ...(versionId ? { versionId } : {}),
      ...(input.includeClosed
        ? {}
        : { status: { in: ["OPEN", "APPLIED", "REGENERATED", "VERIFIED"] } }),
    },
    orderBy: [{ severity: "asc" }, { updatedAt: "desc" }],
  });

  return {
    summary: buildWorkbenchSummary({ packId, versionId, cases }),
    cases: cases.map(toCorrectionCaseDto),
  };
}

export async function listCorrectionCaseEvents(input: {
  packId: string;
  caseId: string;
  prismaClient?: typeof prisma;
}): Promise<CorrectionAuditEventDto[]> {
  const client = input.prismaClient ?? prisma;
  const row = await client.correctionCase.findFirst({
    where: { id: input.caseId.trim(), packId: input.packId.trim() },
    select: { id: true },
  });
  if (!row) {
    throw new CorrectionServiceError("CASE_NOT_FOUND", "보정 케이스를 찾을 수 없습니다.", 404);
  }
  const events = await client.correctionAuditEvent.findMany({
    where: { caseId: row.id },
    orderBy: { createdAt: "asc" },
  });
  return events.map(toCorrectionAuditEventDto);
}
