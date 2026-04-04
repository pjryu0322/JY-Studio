import { prisma } from "@/lib/prisma";
import { STAGE2_DEFAULT_DB_MEMBER_SLOTS } from "@/lib/ai-member/aiMemberRoleDefinitions";
import { inviteAiProjectMember } from "@/lib/service/projectMemberService";
import { resolveEnvTestStage2OpenAiModel } from "@/lib/service/envTestStage2OpenAiConfig";

export async function ensureStage2DefaultAiMembers(input: {
  projectId: string;
  actorUserId: string;
}): Promise<{ created: string[]; skipped: string[] }> {
  const projectId = String(input.projectId ?? "").trim();
  const model = resolveEnvTestStage2OpenAiModel();
  const created: string[] = [];
  const skipped: string[] = [];

  for (const slot of STAGE2_DEFAULT_DB_MEMBER_SLOTS) {
    const existing = await prisma.projectMember.findFirst({
      where: {
        projectId,
        memberType: "AI",
        orchestrationStage: slot.orchestrationStage,
        aiOrchestrationRole: slot.aiOrchestrationRole,
      },
      select: { id: true },
    });
    if (existing) {
      skipped.push(slot.aiOrchestrationRole);
      continue;
    }
    await inviteAiProjectMember({
      projectId,
      displayName: slot.displayName,
      role: slot.projectRole,
      aiProvider: "openai",
      aiOrchestrationRole: slot.aiOrchestrationRole,
      orchestrationStage: slot.orchestrationStage,
      aiModelOverride: model,
      orchestrationEnabled: true,
      invitedByUserId: input.actorUserId,
    });
    created.push(slot.aiOrchestrationRole);
  }

  return { created, skipped };
}
