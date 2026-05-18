import { prisma } from "@/lib/prisma";
import type { AiMemberRole } from "@/lib/ai-member/aiMemberOrchestration";
import { resolveEnvTestStage2OpenAiModel } from "@/lib/service/envTestStage2OpenAiConfig";

export type EnvTestStage2AiRole = "executor" | "reviewer" | "security" | "scm";

/** 플랫폼이 Stage 2에서 기대하는 AI 멤버 설정(표시·로그용). 실제 호출 모델은 항상 resolveEnvTestStage2OpenAiModel() 과 동일. */
export type Stage2AiMemberPublicConfig = {
  role: EnvTestStage2AiRole;
  provider: "openai";
  model: string;
  enabled: boolean;
};

export type Stage2MemberUnavailableReason = "missing" | "disabled";

export type Stage2AiMemberConfig =
  | { role: EnvTestStage2AiRole; available: false; unavailableReason?: Stage2MemberUnavailableReason; config?: Stage2AiMemberPublicConfig }
  | {
      role: EnvTestStage2AiRole;
      available: true;
      memberId: string;
      name: string;
      /** OpenAI chat 호출에 사용하는 모델(전 역할 공통 경량) */
      model: string;
      config: Stage2AiMemberPublicConfig;
    };

function mappedOrchestrationRole(role: Exclude<EnvTestStage2AiRole, "executor">): {
  orchestrationStage: string;
  aiOrchestrationRole: AiMemberRole;
} {
  if (role === "reviewer") {
    return { orchestrationStage: "execution-review", aiOrchestrationRole: "reviewer" };
  }
  if (role === "security") {
    return {
      orchestrationStage: "execution-review",
      aiOrchestrationRole: "security-reviewer",
    };
  }
  return { orchestrationStage: "scm-manager", aiOrchestrationRole: "scm-manager" };
}

export async function getAiMemberByRole(params: {
  projectId: string;
  role: EnvTestStage2AiRole;
}): Promise<Stage2AiMemberConfig> {
  const projectId = String(params.projectId ?? "").trim();
  if (!projectId) return { role: params.role, available: false };

  const lightweightModel = resolveEnvTestStage2OpenAiModel();

  if (params.role === "executor") {
    return {
      role: "executor",
      available: true,
      memberId: "cursor",
      name: "cursor_executor",
      model: lightweightModel,
      config: {
        role: "executor",
        provider: "openai",
        model: lightweightModel,
        enabled: true,
      },
    };
  }

  const r = params.role;
  const mapped = mappedOrchestrationRole(r as Exclude<EnvTestStage2AiRole, "executor">);
  const row = await prisma.projectMember.findFirst({
    where: {
      projectId,
      memberType: "AI",
      orchestrationEnabled: true,
      orchestrationStage: mapped.orchestrationStage,
      aiOrchestrationRole: mapped.aiOrchestrationRole,
    },
    select: { id: true, displayName: true, aiModelOverride: true },
    orderBy: { createdAt: "asc" },
  });

  if (!row) {
    const disabledProbe = await prisma.projectMember.findFirst({
      where: {
        projectId,
        memberType: "AI",
        orchestrationStage: mapped.orchestrationStage,
        aiOrchestrationRole: mapped.aiOrchestrationRole,
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      role: params.role,
      available: false,
      unavailableReason: disabledProbe ? "disabled" : "missing",
    };
  }

  return {
    role: params.role,
    available: true,
    memberId: row.id,
    name: row.displayName?.trim() || mapped.aiOrchestrationRole,
    model: lightweightModel,
    config: {
      role: params.role,
      provider: "openai",
      model: lightweightModel,
      enabled: true,
    },
  };
}
