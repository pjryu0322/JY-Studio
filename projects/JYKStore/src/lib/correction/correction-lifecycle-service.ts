import { AuditAction } from "@prisma/client";
import {
  appendCorrectionAuditEvent,
  recordCorrectionProviderAudit,
} from "@/lib/correction/correction-audit";
import { toCorrectionCaseDto } from "@/lib/correction/correction-mapper";
import {
  CorrectionServiceError,
  type CorrectionCaseDto,
} from "@/lib/correction/correction-types";
import { prisma } from "@/lib/prisma";

export async function verifyCorrectionCase(input: {
  packId: string;
  caseId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
}): Promise<CorrectionCaseDto> {
  const client = input.prismaClient ?? prisma;
  const row = await client.correctionCase.findFirst({
    where: { id: input.caseId.trim(), packId: input.packId.trim() },
  });
  if (!row) {
    throw new CorrectionServiceError("CASE_NOT_FOUND", "보정 케이스를 찾을 수 없습니다.", 404);
  }
  if (row.status !== "REGENERATED") {
    throw new CorrectionServiceError(
      "INVALID_STATUS",
      "검증은 REGENERATED 상태에서만 가능합니다.",
      409,
    );
  }

  const updated = await client.correctionCase.update({
    where: { id: row.id },
    data: { status: "VERIFIED", verifiedAt: new Date() },
  });
  await appendCorrectionAuditEvent({
    caseId: row.id,
    actorUserId: input.actorUserId,
    action: "VERIFY",
    fromStatus: "REGENERATED",
    toStatus: "VERIFIED",
    client,
  });
  await recordCorrectionProviderAudit({
    action: AuditAction.ADMIN_CORRECTION_VERIFY,
    caseId: row.id,
    packId: input.packId,
    actorUserId: input.actorUserId,
    client,
  });
  return toCorrectionCaseDto(updated);
}

export async function closeCorrectionCase(input: {
  packId: string;
  caseId: string;
  actorUserId: string;
  prismaClient?: typeof prisma;
}): Promise<CorrectionCaseDto> {
  const client = input.prismaClient ?? prisma;
  const row = await client.correctionCase.findFirst({
    where: { id: input.caseId.trim(), packId: input.packId.trim() },
  });
  if (!row) {
    throw new CorrectionServiceError("CASE_NOT_FOUND", "보정 케이스를 찾을 수 없습니다.", 404);
  }
  if (row.status !== "VERIFIED") {
    throw new CorrectionServiceError(
      "INVALID_STATUS",
      "종료는 VERIFIED 상태에서만 가능합니다.",
      409,
    );
  }

  const updated = await client.correctionCase.update({
    where: { id: row.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByUserId: input.actorUserId,
    },
  });
  await appendCorrectionAuditEvent({
    caseId: row.id,
    actorUserId: input.actorUserId,
    action: "CLOSE",
    fromStatus: "VERIFIED",
    toStatus: "CLOSED",
    client,
  });
  await recordCorrectionProviderAudit({
    action: AuditAction.ADMIN_CORRECTION_CLOSE,
    caseId: row.id,
    packId: input.packId,
    actorUserId: input.actorUserId,
    client,
  });
  return toCorrectionCaseDto(updated);
}
