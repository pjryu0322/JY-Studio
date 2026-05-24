import { ORCHESTRATION_ROLE_TO_AGENT_ID } from "@/lib/agents/aiMemberAgentBridge";
import { collectFastPlanFieldSnapshots } from "@/lib/requirements/fastPlanSlotAssumptions";
import type { FastPlanGenerationInput } from "@/lib/requirements/fastPlanGenerationTypes";
import {
  findOrchestrationSlotKeysBySuffix,
  findSlotRow,
} from "@/lib/requirements/singleChatSlotNextAction";
import { newPlatformOrchestrationId } from "@/lib/platform-orchestration/platformIds";
import type { PlatformMemberDraft, PlatformMemberRole } from "@/lib/platform-orchestration/types";

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

function confidenceKo(c: string): string {
  if (c === "confirmed") return "확정";
  if (c === "partial") return "부분";
  if (c === "candidate") return "후보";
  return "프로토타입용 가정";
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
}): PlatformMemberDraft {
  const c = input.collected;
  const content = [
    `- 서비스 목적: ${c.servicePurpose.value}`,
    `- 주 사용자: ${c.coreUsers.value}`,
    `- 핵심 문제: ${c.coreProblem.value}`,
    `- 기대 효과: ${c.expectedOutcome.value}`,
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
      ".planning.coreValue",
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
      input.collected.flowSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : slotText(input.orchestration, input.definitions, ".flow.serviceFlow", "기본 서비스 흐름 후보");
  const approval = slotText(
    input.orchestration,
    input.definitions,
    ".flow.approvalFlow",
    "검토·승인이 필요한 예외 흐름은 MVP 이후로 분리 검토",
  );
  const content = [`- 주요 액터: ${actors}`, `- 기본 서비스 흐름:\n${flow}`, `- 검토가 필요한 예외 흐름: ${approval}`].join(
    "\n",
  );
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("analyst"),
    role: "analyst",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".flow.actorTypes",
      ".flow.serviceFlow",
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
  const responsibility = slotText(
    input.orchestration,
    input.definitions,
    ".architecture.systemResponsibility",
    "프론트 UI · API · 저장소 역할 분리(초안)",
  );
  const content = [
    `- MVP 기능 후보:\n${features}`,
    `- 제외할 기능: 고급 권한·다국어·대량 배치(초기 제외 후보)`,
    `- 데이터/API 후보: ${responsibility}`,
    `- 우선순위: ${priority}`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("architect"),
    role: "architect",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [
      ".design.coreFeatures",
      ".design.featurePriority",
      ".architecture.systemResponsibility",
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
  const journey = slotText(
    input.orchestration,
    input.definitions,
    ".design.userJourney",
    "진입 → 탐색 → 핵심 작업 → 결과 확인",
  );
  const content = [
    `- 주요 화면 후보:\n${screens}`,
    `- 사용자 동선: ${journey}`,
    `- 화면별 목적: 각 화면은 핵심 시나리오 1~2개를 지원`,
  ].join("\n");
  return {
    draftId: newPlatformOrchestrationId("mdft"),
    runId: input.runId,
    agentId: agentIdForPlatformRole("designer"),
    role: "designer",
    targetSlotKeys: slotKeysForSuffixes(input.definitions, [".design.requiredScreens", ".design.userJourney"]),
    content,
    confidence: "candidate",
  };
}

export function buildFastPlanDraftUserMessage(input: {
  readonly memberDrafts: readonly PlatformMemberDraft[];
  readonly assumptions: FastPlanDraftCollected["assumptions"];
}): string {
  const roleHeading: Readonly<Record<PlatformMemberRole, string>> = {
    planner: "AI기획자",
    analyst: "AI분석가",
    architect: "AI설계자",
    designer: "AI디자이너",
    developer: "AI개발자",
    reviewer: "검수자",
    security: "보안관",
    scm: "SCM",
    aa: "AA",
    da: "DA",
    etl: "ETL",
    eai: "EAI",
    vlm_analyst: "VLM 분석가",
  };

  const sections = input.memberDrafts
    .filter((d) => d.content.trim())
    .map((d) => `### ${roleHeading[d.role] ?? d.role} 제안\n${d.content}`)
    .join("\n\n");

  const assumptionRows = input.assumptions
    .map(
      (a) =>
        `| ${a.label} | ${a.value.replace(/\|/g, "\\|").slice(0, 120)} | ${confidenceKo(a.confidence)} | ${a.reason.replace(/\|/g, "\\|")} |`,
    )
    .join("\n");

  const assumptionsBlock =
    assumptionRows ?
      ["### AI 보완 후보/가정", "| 항목 | 보완 내용 | 신뢰도 | 근거 |", "|---|---|---|---|", assumptionRows].join("\n")
    : "";

  return [
    "현재까지의 대화와 슬롯 후보를 기준으로 AI팀 빠른 기획 초안을 제안합니다.",
    "확정되지 않은 항목은 AI가 후보/가정으로 보완했습니다.",
    "",
    sections,
    assumptionsBlock,
    "",
    "아래 버튼에서 다음 동작을 선택해 주세요.",
  ]
    .filter(Boolean)
    .join("\n");
}
