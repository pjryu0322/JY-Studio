import { ORCHESTRATION_ROLE_TO_AGENT_ID } from "@/lib/agents/aiMemberAgentBridge";
import { collectFastPlanFieldSnapshots } from "@/lib/requirements/fastPlanSlotAssumptions";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  findOrchestrationSlotKeysBySuffix,
  findSlotRow,
} from "@/lib/requirements/singleChatSlotNextAction";
import { newPlatformOrchestrationId } from "@/lib/platform-orchestration/platformIds";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";
import { buildQuickDesignResultMessage } from "@/lib/requirements/quickDesignLabels";

const ROLE_AGENT_ID: Readonly<Partial<Record<PlatformMemberRole, string>>> = {
  planner: ORCHESTRATION_ROLE_TO_AGENT_ID.planner ?? "ai-planner",
  analyst: ORCHESTRATION_ROLE_TO_AGENT_ID.analyst ?? "ai-analyst",
  architect: ORCHESTRATION_ROLE_TO_AGENT_ID.architect ?? "ai-architect",
  designer: ORCHESTRATION_ROLE_TO_AGENT_ID.designer ?? "ai-designer",
  developer: ORCHESTRATION_ROLE_TO_AGENT_ID.developer ?? "ai-developer",
  reviewer: ORCHESTRATION_ROLE_TO_AGENT_ID.reviewer ?? "ai-reviewer",
  security: ORCHESTRATION_ROLE_TO_AGENT_ID["security-reviewer"] ?? "ai-security",
  scm: ORCHESTRATION_ROLE_TO_AGENT_ID["scm-manager"] ?? "ai-scm",
};

export function agentIdForPlatformRole(role: PlatformMemberRole): string {
  return ROLE_AGENT_ID[role] ?? `ai-${role}`;
}

function slotKeysForSuffixes(
  definitions: FastPlanGenerationInput["slotDefinitions"],
  suffixes: readonly string[],
): string[] {
  const keys: string[] = [];
  for (const suffix of suffixes) {
    const k = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
    if (k) keys.push(k);
  }
  return keys;
}

function slotText(
  orchestration: FastPlanGenerationInput["orchestration"],
  definitions: FastPlanGenerationInput["slotDefinitions"],
  suffix: string,
  fallback: string,
): string {
  const key = findOrchestrationSlotKeysBySuffix(definitions, suffix)[0];
  const v = key ? String(findSlotRow(orchestration, key)?.value ?? "").trim() : "";
  return v || fallback;
}

export type FastPlanDraftCollected = ReturnType<typeof collectFastPlanFieldSnapshots>;

export function collectFastPlanDraftContext(
  input: Omit<FastPlanGenerationInput, "sourceStage" | "nowIso">,
): FastPlanDraftCollected {
  return collectFastPlanFieldSnapshots({
    orchestration: input.orchestration,
    definitions: input.slotDefinitions,
    interview: input.problemInterview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: input.serviceFlow,
    featurePlanning: input.featurePlanning,
  });
}

export function buildPlannerMemberDraft(input: {
  readonly runId: string;
  readonly collected: FastPlanDraftCollected;
  readonly definitions: FastPlanGenerationInput["slotDefinitions"];
  readonly orchestration?: FastPlanGenerationInput["orchestration"];
}): PlatformMemberDraft {
  const c = input.collected;
  const mvpScope = slotText(
    input.orchestration ?? null,
    input.definitions,
    ".planning.mvpScope",
    "1차 MVP는 핵심 사용자 시나리오·필수 화면만 포함",
  );
  const content = [
    `- 서비스 목적: ${c.servicePurpose.value}`,
    `- 주 사용자: ${c.coreUsers.value}`,
    `- 핵심 문제: ${c.coreProblem.value}`,
    `- 기대 효과: ${c.expectedOutcome.value}`,
    `- MVP 범위: ${mvpScope}`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("planner"),
    role: "planner",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".planning.servicePurpose",
      ".planning.coreUsers",
      ".planning.problem",
      ".planning.expectedOutcome",
      ".planning.mvpScope",
    ]),
    content,
    confidence: c.servicePurpose.confidence,
  };
}

export function buildAnalystMemberDraft(input: {
  readonly runId: string;
  readonly collected: FastPlanDraftCollected;
  readonly definitions: FastPlanGenerationInput["slotDefinitions"];
  readonly orchestration: FastPlanGenerationInput["orchestration"];
}): PlatformMemberDraft {
  const actors = slotText(
    input.orchestration,
    input.definitions,
    ".flow.actorTypes",
    "주요 액터: 서비스 이용자, 운영자",
  );
  const flow =
    input.collected.flowSteps.length > 0 ?
      input.collected.flowSteps.map((s, i) => `${i + 1}. ${s}`).join(" → ")
    : slotText(input.orchestration, input.definitions, ".flow.serviceFlow", "기본 서비스 흐름 후보");
  const exception = slotText(
    input.orchestration,
    input.definitions,
    ".flow.exceptionFlow",
    "오류·권한 거부·타임아웃 등 예외 흐름은 MVP 이후 정교화",
  );
  const approval = slotText(
    input.orchestration,
    input.definitions,
    ".flow.approvalFlow",
    "검토·승인이 필요한 예외 흐름은 MVP 이후로 분리 검토",
  );
  const content = [
    `- 주요 액터: ${actors}`,
    `- 기본 서비스 흐름: ${flow}`,
    `- 예외 흐름: ${exception}`,
    `- 검토가 필요한 예외 흐름: ${approval}`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("analyst"),
    role: "analyst",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".flow.actorTypes",
      ".flow.serviceFlow",
      ".flow.exceptionFlow",
      ".flow.approvalFlow",
    ]),
    content,
    confidence: "candidate",
  };
}

export function buildArchitectMemberDraft(input: {
  readonly runId: string;
  readonly collected: FastPlanDraftCollected;
  readonly definitions: FastPlanGenerationInput["slotDefinitions"];
  readonly orchestration: FastPlanGenerationInput["orchestration"];
}): PlatformMemberDraft {
  const features =
    input.collected.featureCandidates.length > 0 ?
      input.collected.featureCandidates.map((f) => `- ${f}`).join("\n")
    : slotText(input.orchestration, input.definitions, ".design.coreFeatures", "- MVP 핵심 기능 후보");
  const priority = slotText(
    input.orchestration,
    input.definitions,
    ".design.featurePriority",
    "핵심 흐름 우선, 부가 기능은 후순위",
  );
  const automation = slotText(
    input.orchestration,
    input.definitions,
    ".architecture.automationLevel",
    "반복 작업은 API/배치 자동화 검토",
  );
  const boundary = slotText(
    input.orchestration,
    input.definitions,
    ".architecture.prototypeBoundary",
    "프로토타입은 핵심 시나리오·주요 화면만 포함",
  );
  const content = [
    `- MVP 기능 후보:\n${features}`,
    `- 우선순위: ${priority}`,
    `- 자동화 수준: ${automation}`,
    `- 프로토타입 경계: ${boundary}`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("architect"),
    role: "architect",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".design.coreFeatures",
      ".design.featurePriority",
      ".architecture.automationLevel",
      ".architecture.prototypeBoundary",
    ]),
    content,
    confidence: "candidate",
  };
}

export function buildDesignerMemberDraft(input: {
  readonly runId: string;
  readonly collected: FastPlanDraftCollected;
  readonly definitions: FastPlanGenerationInput["slotDefinitions"];
  readonly orchestration: FastPlanGenerationInput["orchestration"];
}): PlatformMemberDraft {
  const screens =
    input.collected.screenCandidates.length > 0 ?
      input.collected.screenCandidates.map((s) => `- ${s}`).join("\n")
    : slotText(input.orchestration, input.definitions, ".design.requiredScreens", "- 홈 / 목록 / 상세 / 설정");
  const prototypeScope = slotText(
    input.orchestration,
    input.definitions,
    ".design.prototypeScope",
    "핵심 시나리오 검증용 최소 화면 묶음",
  );
  const content = [
    `- 주요 화면 후보:\n${screens}`,
    `- 프로토타입 범위: ${prototypeScope}`,
    `- 화면별 목적: 각 화면은 핵심 시나리오 1~2개를 지원`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("designer"),
    role: "designer",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".design.requiredScreens",
      ".design.prototypeScope",
    ]),
    content,
    confidence: "candidate",
  };
}

export function buildFastPlanDraftUserMessage(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly assumptions: FastPlanDraftCollected["assumptions"];
}): string {
  return buildQuickDesignResultMessage({
    memberDrafts: input.memberDrafts,
    assumptions: input.assumptions,
  });
}
