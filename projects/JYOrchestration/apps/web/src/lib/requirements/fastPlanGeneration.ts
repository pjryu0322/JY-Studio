/**
 * Fast prototype plan — build context, markdown artifact, orchestration patches (client-side).
 */

import type {
  FastPlanGenerationContext,
  FastPlanGenerationInput,
  FastPlanGenerationResult,
  FastPlanGenerationStateV1,
} from "@/lib/requirements/fastPlanGenerationTypes";
import { collectFastPlanFieldSnapshots } from "@/lib/requirements/fastPlanSlotAssumptions";
import {
  hashSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import { wireStageLabel } from "@/lib/requirements/projectArtifactTypes";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";
import { findOrchestrationSlotKeysBySuffix } from "@/lib/requirements/singleChatSlotNextAction";
import { buildFastPlanAssumptionMarkdownTable } from "@/lib/requirements/markdownTableCells";

function newArtifactId(nowIso: string): string {
  return `artifact-fast-${nowIso.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildFastPlanGenerationContext(input: FastPlanGenerationInput): FastPlanGenerationContext {
  const collected = collectFastPlanFieldSnapshots({
    orchestration: input.orchestration,
    definitions: input.slotDefinitions,
    interview: input.problemInterview,
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    conversationMessages: input.conversationMessages,
    serviceFlow: input.serviceFlow,
    featurePlanning: input.featurePlanning,
  });
  return {
    mode: "fast_plan_from_current_context",
    summary: collected.summary,
    servicePurpose: collected.servicePurpose,
    coreUsers: collected.coreUsers,
    coreProblem: collected.coreProblem,
    expectedOutcome: collected.expectedOutcome,
    featureCandidates: collected.featureCandidates,
    flowSteps: collected.flowSteps,
    screenCandidates: collected.screenCandidates,
    assumptions: collected.assumptions,
    missingAtGeneration: collected.missingAtGeneration,
  };
}

export function buildFastPlanMarkdown(input: {
  readonly projectName: string;
  readonly context: FastPlanGenerationContext;
}): string {
  const c = input.context;
  const name = String(input.projectName ?? "프로젝트").trim() || "프로젝트";
  const features =
    c.featureCandidates.length ?
      c.featureCandidates.map((f) => `- ${f}`).join("\n")
    : "- (대화·후보에서 추출된 기능 후보 없음 — 프로토타입 범위는 핵심 흐름 중심)";
  const flow =
    c.flowSteps.length ?
      c.flowSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "- (서비스 흐름 후보 없음 — 기획 대화 기준으로 화면 단위로 보완)";
  const screens =
    c.screenCandidates.length ?
      c.screenCandidates.map((s) => `- ${s}`).join("\n")
    : "- 홈 / 목록 / 상세 / 설정 (기본 화면 후보)";

  const assumptionTable = buildFastPlanAssumptionMarkdownTable(c.assumptions);

  return [
    "# 기획안",
    "",
    `> 프로젝트: **${name}** · 생성 모드: 빠른 기획 (현재 대화·슬롯 기준)`,
    "",
    "## 1. 서비스 한 줄 요약",
    c.summary,
    "",
    "## 2. 주 사용자",
    c.coreUsers.value,
    "",
    "## 3. 해결하려는 핵심 문제",
    c.coreProblem.value,
    "",
    "## 4. 기대 효과",
    c.expectedOutcome.value,
    "",
    "## 5. 핵심 기능 후보",
    features,
    "",
    "## 6. 기본 서비스 흐름",
    flow,
    "",
    "## 7. 주요 화면 후보",
    screens,
    "",
    "## 8. AI 보완 후보/가정",
    assumptionTable || "_모든 핵심 항목이 기존 후보·대화에서 채워졌습니다._",
    "",
    "## 9. 프로토타입 생성 범위",
    "- 핵심 사용자 시나리오 1~2개",
    "- 주요 화면 골격(목록·상세·작성/확인)",
    "- 서비스 흐름의 대표 경로만 구현",
    "",
    "## 10. 다음 선택",
    "- 현재 기획안으로 프로토타입 만들기",
    "- 기획안 일부 수정",
    "- 정밀 기획 계속하기",
  ].join("\n");
}

function ensureOrchestration(
  orchestration: RequirementsSingleChatOrchestrationStateV1 | null,
  definitions: FastPlanGenerationInput["slotDefinitions"],
  nowIso: string,
): RequirementsSingleChatOrchestrationStateV1 | null {
  if (!definitions.length) return orchestration;
  const defsHash = hashSlotDefinitions(definitions);
  if (orchestration?.slotDefinitionsHash === defsHash) return orchestration;
  return initialOrchestrationStateFromDefinitions(definitions, nowIso);
}

export function applyFastPlanAssumptionsToOrchestration(input: {
  readonly orchestration: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly definitions: FastPlanGenerationInput["slotDefinitions"];
  readonly context: FastPlanGenerationContext;
  readonly nowIso: string;
}): RequirementsSingleChatOrchestrationStateV1 | null {
  let base = ensureOrchestration(input.orchestration, input.definitions, input.nowIso);
  if (!base) return null;

  const suffixPatches: ReadonlyArray<{
    readonly suffix: string;
    readonly value: string;
    readonly confidence: FastPlanGenerationContext["servicePurpose"]["confidence"];
  }> = [
    { suffix: ".planning.servicePurpose", value: input.context.servicePurpose.value, confidence: input.context.servicePurpose.confidence },
    { suffix: ".planning.coreUsers", value: input.context.coreUsers.value, confidence: input.context.coreUsers.confidence },
    { suffix: ".planning.problem", value: input.context.coreProblem.value, confidence: input.context.coreProblem.confidence },
    {
      suffix: findOrchestrationSlotKeysBySuffix(input.definitions, ".planning.expectedOutcome")[0] ?
        ".planning.expectedOutcome"
      : ".planning.coreValue",
      value: input.context.expectedOutcome.value,
      confidence: input.context.expectedOutcome.confidence,
    },
  ];

  const patches: Array<{
    slotKey: string;
    status: "candidate" | "partial";
    value: string;
    confidence: number;
    derivedFrom: string;
  }> = [];

  for (const row of suffixPatches) {
    const slotKey = findOrchestrationSlotKeysBySuffix(input.definitions, row.suffix)[0];
    if (!slotKey || !row.value.trim()) continue;
    if (row.confidence === "confirmed") continue;
    const status = row.confidence === "partial" ? "partial" : "candidate";
    patches.push({
      slotKey,
      status,
      value: row.value.slice(0, 4000),
      confidence: row.confidence === "assumed_for_prototype" ? 0.55 : 0.72,
      derivedFrom: "fast_plan_assumption",
    });
  }

  if (!patches.length) return base;
  return mergeOrchestrationSlotPatches({
    base,
    patches,
    nowIso: input.nowIso,
    definitions: input.definitions,
  });
}

export function generateFastPlanFromCurrentContext(input: FastPlanGenerationInput): FastPlanGenerationResult {
  const context = buildFastPlanGenerationContext(input);
  const nowIso = input.nowIso;
  const artifactId = newArtifactId(nowIso);
  const content = buildFastPlanMarkdown({ projectName: input.projectName, context });
  const orchestration = applyFastPlanAssumptionsToOrchestration({
    orchestration: input.orchestration,
    definitions: input.slotDefinitions,
    context,
    nowIso,
  });

  const artifact: ProjectArtifact = {
    id: artifactId,
    type: "fast_prototype_plan",
    title: "기획안",
    createdAt: nowIso,
    createdBy: "ai",
    sourceStage: wireStageLabel(input.sourceStage),
    content,
  };

  const fastPlanGenerationV1: FastPlanGenerationStateV1 = {
    mode: "fast_plan_from_current_context",
    generatedAt: nowIso,
    source: "current_conversation_and_slots",
    assumptions: context.assumptions,
    missingAtGeneration: context.missingAtGeneration,
    artifactId,
  };

  const userFacingSummary =
    context.missingAtGeneration.length > 0 ?
      "현재까지의 대화와 후보 정보를 기준으로 빠른 기획안을 만들었습니다. 일부 항목은 AI가 임시 후보로 보완했습니다."
    : "현재까지의 대화와 후보 정보를 기준으로 빠른 기획안을 만들었습니다.";

  return {
    mode: "fast_plan_from_current_context",
    context,
    artifact,
    orchestration,
    fastPlanGenerationV1,
    userFacingSummary,
  };
}

/** 테스트·진단: strict gate 없이 fast path만 실행했는지 */
export function runForceGeneratePlanNowForTest(input: {
  readonly gateReady: boolean;
  readonly slotReadinessMissing: readonly string[];
  readonly generate: () => FastPlanGenerationResult;
}): Readonly<{ readonly mode: string; readonly blockedByStrictGate: boolean }> {
  void input.gateReady;
  void input.slotReadinessMissing;
  const result = input.generate();
  return { mode: result.mode, blockedByStrictGate: false };
}

export function runOrganizeStartGenerateFinalProposalForTest(input: {
  readonly gateReady: boolean;
}): Readonly<{ readonly blockedByStrictGate: boolean }> {
  return { blockedByStrictGate: !input.gateReady };
}
