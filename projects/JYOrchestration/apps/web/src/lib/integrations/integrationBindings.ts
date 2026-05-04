import type { IntegrationCapability, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** `project_integrations`와 `workspace_integrations`에 동일 값으로 맞춥니다. */
export async function upsertMirroredIntegrationBinding(
  client: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  capability: IntegrationCapability,
  userIntegrationId: string | null
): Promise<void> {
  const now = new Date();
  await client.projectIntegration.upsert({
    where: { projectId_capability: { projectId, capability } },
    create: { projectId, capability, userIntegrationId, updatedAt: now },
    update: { userIntegrationId, updatedAt: now },
  });
  await client.workspaceIntegration.upsert({
    where: { projectId_capability: { projectId, capability } },
    create: { projectId, capability, userIntegrationId, updatedAt: now },
    update: { userIntegrationId, updatedAt: now },
  });
}
