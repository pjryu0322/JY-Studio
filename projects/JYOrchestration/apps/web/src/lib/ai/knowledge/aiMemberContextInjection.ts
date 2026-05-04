import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { FeaturePlanningTopicV1 } from "@/lib/featurePlanning/featurePlanningTopic";
import { buildProjectContext } from "@/lib/ai/knowledge/buildProjectContext";
import { PLATFORM_KNOWLEDGE } from "@/lib/ai/knowledge/platformKnowledge";

/** 플랫폼 지식 + 프로젝트 컨텍스트를 붙일 AI 멤버(서버 실행 기준). */
const CONTEXT_INJECTION_MEMBERS = new Set<WorkspaceAiMemberId>(["feature_planning", "security_reviewer"]);

/** 기능정리 단계 중 UI 밀도가 높은 주제에서만 디자이너 앵커 지식을 추가합니다. */
export function shouldAttachDesignerUxAnchorForFeaturePlanningTopic(topic: FeaturePlanningTopicV1): boolean {
  return topic === "MENU" || topic === "SCREENS" || topic === "SCREEN_DETAILS";
}

export type AppendAiContextInput = Readonly<{
  aiMemberId: WorkspaceAiMemberId;
  baseSystem: string;
  projectId: string;
  /** 기능정리 전용: 일부 주제에서 UX/UI 앵커 블록 추가 */
  featurePlanningTopic?: FeaturePlanningTopicV1;
}>;

/**
 * persona 등 기존 system 뒤에 플랫폼 지식·프로젝트 컨텍스트를 한 번만 덧붙입니다.
 * 대상 멤버가 아니면 `baseSystem` 그대로 반환합니다.
 */
export async function appendAiContextToSystemPrompt(input: AppendAiContextInput): Promise<string> {
  const base = String(input.baseSystem ?? "").trim();
  if (!CONTEXT_INJECTION_MEMBERS.has(input.aiMemberId)) {
    return base;
  }

  const projectId = String(input.projectId ?? "").trim();
  const blocks: string[] = [base];

  let featureDesignerBlock = "";
  let designerUxBlock = "";
  let securityBlock = "";

  if (input.aiMemberId === "feature_planning") {
    featureDesignerBlock = PLATFORM_KNOWLEDGE.feature_designer;
    const topic = input.featurePlanningTopic;
    if (topic && shouldAttachDesignerUxAnchorForFeaturePlanningTopic(topic)) {
      designerUxBlock = PLATFORM_KNOWLEDGE.designer;
    }
  } else if (input.aiMemberId === "security_reviewer") {
    securityBlock = PLATFORM_KNOWLEDGE.security;
  }

  const projectBlock = projectId ? (await buildProjectContext(projectId)).trim() : "";

  const hasPlatformKnowledge = Boolean(
    featureDesignerBlock.trim() || designerUxBlock.trim() || securityBlock.trim()
  );
  const hasProjectContext = Boolean(projectBlock);

  console.log("[AI CONTEXT]", {
    member: input.aiMemberId,
    hasPlatformKnowledge,
    hasProjectContext,
    ...(input.aiMemberId === "feature_planning" && input.featurePlanningTopic
      ? {
          designerUxAnchored: Boolean(designerUxBlock.trim()),
          planningTopic: input.featurePlanningTopic,
        }
      : {}),
  });

  if (featureDesignerBlock.trim()) {
    blocks.push(`\n\n[플랫폼 기본 지식 — 기능 정리]\n${featureDesignerBlock.trim()}`);
  }
  if (designerUxBlock.trim()) {
    blocks.push(`\n\n[플랫폼 기본 지식 — UX/UI]\n${designerUxBlock.trim()}`);
  }
  if (securityBlock.trim()) {
    blocks.push(`\n\n[플랫폼 기본 지식 — 보안 점검]\n${securityBlock.trim()}`);
  }
  if (hasProjectContext) {
    blocks.push(`\n\n[프로젝트 컨텍스트]\n${projectBlock}`);
  }

  return blocks.join("");
}
