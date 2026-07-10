import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordProviderAudit(input: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId: input.actorUserId?.trim() || null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
