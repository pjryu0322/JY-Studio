import type { AuditAction, CorrectionCaseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";

export async function appendCorrectionAuditEvent(input: {
  caseId: string;
  actorUserId?: string | null;
  action: string;
  fromStatus?: CorrectionCaseStatus | null;
  toStatus?: CorrectionCaseStatus | null;
  detail?: Record<string, unknown>;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const db = input.client ?? prisma;
  return db.correctionAuditEvent.create({
    data: {
      caseId: input.caseId,
      actorUserId: input.actorUserId?.trim() || null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function recordCorrectionProviderAudit(input: {
  action: AuditAction;
  caseId: string;
  packId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  await recordProviderAudit({
    action: input.action,
    entityType: "CorrectionCase",
    entityId: input.caseId,
    actorUserId: input.actorUserId,
    metadata: { packId: input.packId, ...(input.metadata ?? {}) },
    client: input.client,
  });
}
