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
import {
  buildRoleDraftContent,
  formatRoleDraftInlineList,
} from "@/lib/platform-orchestration/fastPlanMemberDraftContent";

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
  const orch = input.orchestration ?? null;
  const content = buildRoleDraftContent([
    { label: "서비스 목적", value: c.servicePurpose.value, fallback: "핵심 사용자 문제를 해결하는 서비스" },
    { label: "핵심 사용자", value: c.coreUsers.value, fallback: "주요 이용자·운영 담당자" },
    { label: "문제 정의", value: c.coreProblem.value, fallback: "현재 대화에서 정의된 핵심 문제" },
    { label: "기대 효과", value: c.expectedOutcome.value, fallback: "업무 시간 단축·품질 향상" },
    {
      label: "MVP 범위",
      value: slotText(orch, input.definitions, ".planning.mvpScope", ""),
      fallback: "1차 MVP는 핵심 사용자 시나리오·필수 화면만 포함",
    },
  ]);
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
  const flowInline =
    input.collected.flowSteps.length > 0 ?
      input.collected.flowSteps.map((s, i) => `${i + 1}. ${s}`).join(" → ")
    : "";
  const content = buildRoleDraftContent([
    {
      label: "서비스 액터",
      value: slotText(input.orchestration, input.definitions, ".flow.actorTypes", ""),
      fallback: "서비스 이용자, 운영·검수 담당자",
    },
    {
      label: "기본 서비스 흐름",
      value: flowInline || slotText(input.orchestration, input.definitions, ".flow.serviceFlow", ""),
      fallback: "입력 → 처리 → 결과 확인의 기본 흐름",
    },
    {
      label: "예외/검토 흐름",
      value: [
        slotText(input.orchestration, input.definitions, ".flow.exceptionFlow", ""),
        slotText(input.orchestration, input.definitions, ".flow.approvalFlow", ""),
      ]
        .filter(Boolean)
        .join(" / "),
      fallback: "오류·권한 거부·검토 승인 등 예외 흐름은 MVP 이후 정교화",
    },
    {
      label: "입력/출력 후보",
      value: slotText(input.orchestration, input.definitions, ".design.dataFlow", ""),
      fallback: "업로드 파일, 구조화된 요약, TODO 목록, 검수 결과",
    },
  ]);
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
      ".design.dataFlow",
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
  const features = formatRoleDraftInlineList(
    input.collected.featureCandidates,
    slotText(input.orchestration, input.definitions, ".design.coreFeatures", "MVP 핵심 기능 후보"),
  );
  const content = buildRoleDraftContent([
    { label: "핵심 기능 후보", value: features, fallback: "핵심 시나리오를 지원하는 MVP 기능 묶음" },
    {
      label: "기능 우선순위",
      value: slotText(input.orchestration, input.definitions, ".design.featurePriority", ""),
      fallback: "핵심 흐름 우선, 부가 기능은 후순위",
    },
    {
      label: "시스템 책임",
      value: slotText(input.orchestration, input.definitions, ".architecture.automationLevel", ""),
      fallback: "반복 작업은 API/배치로 자동화, 사람은 검수·예외 처리",
    },
    {
      label: "데이터/API 후보",
      value: slotText(input.orchestration, input.definitions, ".design.dataFlow", ""),
      fallback: "파일 업로드 API, 요약·TODO 생성 API, 검수 상태 API",
    },
  ]);
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("architect"),
    role: "architect",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".design.coreFeatures",
      ".design.featurePriority",
      ".architecture.automationLevel",
      ".design.dataFlow",
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
  const screens = formatRoleDraftInlineList(
    input.collected.screenCandidates,
    slotText(input.orchestration, input.definitions, ".design.requiredScreens", "홈, 목록, 상세, 설정"),
  );
  const content = buildRoleDraftContent([
    { label: "주요 화면 후보", value: screens, fallback: "홈, 업로드, 결과 목록, 상세, 설정" },
    {
      label: "사용자 동선",
      value: input.collected.flowSteps.length > 0 ? input.collected.flowSteps.join(" → ") : "",
      fallback: "진입 → 탐색 → 핵심 작업 → 결과 확인",
    },
    {
      label: "화면별 목적",
      value: slotText(input.orchestration, input.definitions, ".design.prototypeScope", ""),
      fallback: "각 화면은 핵심 시나리오 1~2개를 지원",
    },
    {
      label: "UI 구성 방향",
      value: slotText(input.orchestration, input.definitions, ".design.userInteractionMode", ""),
      fallback: "목록·상세 중심, 핵심 작업은 단계형 흐름",
    },
  ]);
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("designer"),
    role: "designer",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".design.requiredScreens",
      ".design.prototypeScope",
      ".design.userInteractionMode",
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
