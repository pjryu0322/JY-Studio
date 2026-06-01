import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { prioritizeImplementationChipsForState } from "@/lib/prototype/implementationStageNextActions";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { PrototypeChatEnvBadge, PrototypeChatEnvSnapshot } from "@/lib/prototype/buildPrototypeChatMessages";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import {
  dedupeRequirementsMessagesById,
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  appendPromptTimelineEntriesOnce,
  buildPromptTimelineEntryFingerprint,
  hasPromptTimelineFingerprint,
  sanitizePromptTimelineEntries,
  withDeterministicPlatformTimelineMeta,
} from "@/lib/requirements/promptTimelineState";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  collectReferencePlanningArtifacts,
  IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
  implementationBlockedEntryChips,
  implementationEntryChipsForState,
  implementationQuickDesignUnconfirmedEntryChips,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { evaluatePlanningArtifactReadiness } from "@/lib/prototype/planningArtifactReadiness";
import {
  buildImplementationEntryTimelineEntry,
  deriveImplementationEntryState,
} from "@/lib/prototype/implementationEntryState";
import { hasImplementationTaskListReady } from "@/lib/requirements/implementationTaskList";
import { evaluateImplementationEntrySurfaceReadiness } from "@/lib/requirements/implementationReadinessGates";
import {
  formatImplementationSeedStatusSummaryLines,
  summarizeImplementationSeedStatus,
  type ImplementationSeedV1,
} from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import {
  buildImplementationExecutionBoardFromOrchestration,
} from "@/lib/prototype/implementationExecutionBoard";
import {
  buildCompactImplementationExecutionBoardNoticeMessage,
  buildImplementationExecutionBoardMessage,
} from "@/lib/prototype/implementationExecutionBoardMessage";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import {
  buildImplementationTaskListEntryMessage,
  buildImplementationTaskListMissingEntryMessage,
  hasValidImplementationTaskListBootstrap,
  isTaskListExecutionReady,
} from "@/lib/prototype/implementationTaskListEntryMessage";
import type {
  RequirementsSingleChatOrchestrationStateV1,
  SingleChatOrchestrationSlotDefinition,
} from "@/lib/requirements/singleChatOrchestrationTypes";
import type { ImplementationStatusQueryIntent } from "@/lib/prototype/implementationStatusQueryIntent";
import type { FastPlanDraftStateV1 } from "@/lib/requirements/fastPlanDraftTypes";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

export const IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE = "IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_V1";
export const IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE =
  "IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_V1";
export const IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE =
  "참조 가능한 기획 산출물이나 Quick Design 초안이 없어 구현단계를 시작할 수 없습니다.";
export const IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_INTERNAL_TYPE =
  "IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_V1";
export const IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_HEADLINE =
  "Quick Design 초안이 준비되어 있습니다.";
export const IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE = "IMPLEMENTATION_ROLE_CHECK_DETAILS_V1";
export const IMPLEMENTATION_SCM_CHECK_DETAILS_INTERNAL_TYPE = "IMPLEMENTATION_SCM_CHECK_DETAILS_V1";
export const IMPLEMENTATION_ENVIRONMENT_CHECK_DETAILS_INTERNAL_TYPE =
  "IMPLEMENTATION_ENVIRONMENT_CHECK_DETAILS_V1";
export const IMPLEMENTATION_REVIEWER_CHECK_DETAILS_INTERNAL_TYPE = "IMPLEMENTATION_REVIEWER_CHECK_DETAILS_V1";
export const IMPLEMENTATION_SECURITY_CHECK_DETAILS_INTERNAL_TYPE = "IMPLEMENTATION_SECURITY_CHECK_DETAILS_V1";

export const IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP = "역할별 점검 보기";
export const IMPLEMENTATION_SCM_CHECK_VIEW_CHIP = "SCM 점검 결과 보기";
export const IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP = "환경설정 점검 결과 보기";

const REVIEWER_HIGHLIGHTS = [
  "업로드·입력 실패 처리",
  "대용량·장시간 처리 시 사용자 안내",
  "빈 결과·부분 실패 시 복구 경로",
  "요약·산출물 수정 가능 여부",
] as const;

const SECURITY_HIGHLIGHTS = [
  "허용 파일 형식·크기 제한",
  "개인정보·민감 데이터 처리·보관 정책",
  "외부 연동 시 자격·토큰 노출 방지",
  "임시 파일·로그 보관·삭제",
] as const;

export type ImplementationRoleCheckSummary = Readonly<{
  reviewer: Readonly<{
    count: number;
    highlights: readonly string[];
  }>;
  security: Readonly<{
    count: number;
    highlights: readonly string[];
  }>;
  scm: Readonly<{
    issueCount: number;
    highlights: readonly string[];
    envStatus: Readonly<{
      git: string;
      github: string;
      codeAgent: string;
      connectionTest: string;
    }>;
  }>;
}>;

export type ImplementationOrchestrationSummaryInput = Readonly<{
  readonly projectId: string;
  readonly env: PrototypeChatEnvSnapshot;
  readonly envOk: boolean;
  readonly envSettingsHref: string;
  readonly featureDraftTitles: readonly string[];
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly artifactOrchestrationV1: ArtifactOrchestrationStateV1 | null | undefined;
  readonly designOk: boolean;
  readonly orchestration?: RequirementsSingleChatOrchestrationStateV1 | null;
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly implementationSeedV1?: ImplementationSeedV1 | null;
  readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
  readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
  readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
  readonly fastPlanDraftV1?: FastPlanDraftStateV1 | null;
  readonly promptTimeline?: readonly import("@/lib/requirements/requirementsStateJson").RequirementsPromptTimelineEntry[];
  readonly executionSetup?: ExecutionSetupSourceGenerationRow | null;
  readonly nowIso?: string;
}>;

export function implementationEntryChipsForBootstrap(
  input: ImplementationOrchestrationSummaryInput,
): readonly string[] {
  const entryState = deriveImplementationEntryState({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskPlanV1: input.implementationTaskPlanV1,
    implementationCodeTaskPlanV1: input.implementationCodeTaskPlanV1,
    implementationTaskListV1: input.implementationTaskListV1,
    cursorWorkItemsV1: input.cursorWorkItemsV1,
    projectArtifacts: input.projectArtifacts,
    fastPlanDraftV1: input.fastPlanDraftV1,
    promptTimeline: input.promptTimeline,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
  });

  if (entryState.status === "board_ready") {
    const readiness = evaluateImplementationEntrySurfaceReadiness({
      implementationSeedV1: input.implementationSeedV1,
      implementationTaskListV1: input.implementationTaskListV1,
      orchestration: input.orchestration,
      slotDefinitions: input.slotDefinitions,
      projectArtifacts: input.projectArtifacts,
      envOk: input.envOk,
      designOk: input.designOk,
    });
    return implementationEntryChipsForState({
      seedReady: readiness.seedReady || entryState.hasImplementationTaskList,
      envOk: readiness.envOk,
      designOk: readiness.designOk,
      hasReferenceArtifacts: readiness.hasReferenceArtifacts,
      taskListReady: entryState.hasImplementationTaskList || readiness.taskListReady,
      implementationSeedV1: input.implementationSeedV1,
      implementationTaskListV1: input.implementationTaskListV1,
    });
  }

  const readiness = evaluateImplementationEntrySurfaceReadiness({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  return implementationEntryChipsForState({
    seedReady: readiness.seedReady,
    envOk: readiness.envOk,
    designOk: readiness.designOk,
    hasReferenceArtifacts: readiness.hasReferenceArtifacts,
    taskListReady: readiness.taskListReady,
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
  });
}

export type ImplementationBootstrapBundle = Readonly<{
  readonly messages: readonly RequirementsMessage[];
  readonly timelineEntries: readonly RequirementsPromptTimelineEntry[];
  readonly roleCheckSummary: ImplementationRoleCheckSummary;
}>;

function envLineState(b: PrototypeChatEnvBadge): string {
  if (b === "ok") return "완료";
  if (b === "error") return "오류";
  if (b === "loading") return "대기";
  return "필요";
}

function countScmIssues(env: PrototypeChatEnvSnapshot): number {
  let n = 0;
  if (env.git !== "ok") n += 1;
  if (env.github !== "ok") n += 1;
  if (env.cursor !== "ok") n += 1;
  if (env.connectionTest !== "ok") n += 1;
  return n;
}

export function buildImplementationRoleCheckSummary(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationRoleCheckSummary {
  const scmIssues: string[] = [];
  if (input.env.git !== "ok") scmIssues.push(`Git 저장소: ${envLineState(input.env.git)}`);
  if (input.env.github !== "ok") scmIssues.push(`GitHub 인증: ${envLineState(input.env.github)}`);
  if (input.env.cursor !== "ok") scmIssues.push(`코드 에이전트 연결: ${envLineState(input.env.cursor)}`);
  if (input.env.connectionTest !== "ok") scmIssues.push(`연결 테스트: ${envLineState(input.env.connectionTest)}`);
  if (!input.envOk && !scmIssues.length) scmIssues.push("환경설정 점검이 필요합니다.");

  return {
    reviewer: { count: REVIEWER_HIGHLIGHTS.length, highlights: REVIEWER_HIGHLIGHTS },
    security: { count: SECURITY_HIGHLIGHTS.length, highlights: SECURITY_HIGHLIGHTS },
    scm: {
      issueCount: countScmIssues(input.env),
      highlights: scmIssues,
      envStatus: {
        git: envLineState(input.env.git),
        github: envLineState(input.env.github),
        codeAgent: envLineState(input.env.cursor),
        connectionTest: envLineState(input.env.connectionTest),
      },
    },
  };
}

function developerScmReferenceLine(input: ImplementationOrchestrationSummaryInput): string | null {
  if (input.envOk) return null;
  if (input.env.cursor === "error" || input.env.cursor === "needs") {
    return "SCM 점검 결과, 코드 에이전트 연결에 문제가 있어 WIP 작업 요청 전 환경설정이 필요합니다.";
  }
  if (input.env.git !== "ok" || input.env.github !== "ok") {
    return "SCM 점검 결과, Git 연결 준비가 필요해 WIP 작업 요청 전 환경설정이 필요합니다.";
  }
  return "SCM 점검 결과, 환경설정이 필요합니다.";
}

export function implementationTaskPlanConfirmedChips(): readonly string[] {
  return [
    "코드 에이전트 WIP 작업 요청",
    "DB 연동 필요성 검토",
    "데이터 모델 초안 생성",
    "Mock 기반 구현 진행",
    "작업 범위 수정",
    "산출물 다시 보기",
    "환경설정 열기",
    IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP,
  ];
}

function roleCheckSummaryLines(summary: ImplementationRoleCheckSummary): string[] {
  return [
    "역할별 점검 요약",
    `- AI검수자: 검수 기준 ${summary.reviewer.count}건`,
    `- AI보안관: 보안 기준 ${summary.security.count}건`,
    `- SCM: 환경 이슈 ${summary.scm.issueCount}건`,
  ];
}

function buildImplementationBlockedMissingPlanningArtifactsMessage(input: {
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const lines = [
    IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE,
    "",
    "기획단계에서 Quick Design을 실행하거나 대화를 통해 기획 산출물을 먼저 생성해 주세요.",
    "",
    "다음 작업을 선택해 주세요.",
  ];
  return newRequirementsMessage({
    id: `impl-orch-blocked-no-planning-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE,
      implementationBootstrapKind: "blocked_missing_planning_artifacts",
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationBlockedEntryChips()],
      interviewAllowCustomInput: false,
      prototypeOrderKey: 1000,
    },
  });
}

function buildImplementationBlockedQuickDesignUnconfirmedMessage(input: {
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const lines = [
    IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_HEADLINE,
    "",
    "아직 구현단계 산출물로 확정되지는 않았습니다.",
    "구현 작업목록을 만들려면 Quick Design을 확정하거나, 현재 초안을 기준으로 구현 Seed를 생성해야 합니다.",
    "",
    "다음 작업을 선택해 주세요.",
  ];
  return newRequirementsMessage({
    id: `impl-orch-blocked-qd-unconfirmed-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_INTERNAL_TYPE,
      implementationBootstrapKind: "blocked_quick_design_unconfirmed",
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationQuickDesignUnconfirmedEntryChips()],
      interviewAllowCustomInput: false,
      prototypeOrderKey: 1000,
    },
  });
}

function buildImplementationBlockedBootstrapTimelineEntries(input: {
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const now = input.nowIso ?? new Date().toISOString();
  return [
    {
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_blocked_missing_planning_artifacts",
      source: "system",
      responseText: [
        "type=implementation_blocked_missing_planning_artifacts",
        "mode=implementation",
        "reason=no_planning_artifacts",
      ].join(" "),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    },
  ];
}

function buildImplementationBlockedQuickDesignUnconfirmedTimelineEntries(input: {
  readonly projectId: string;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const now = input.nowIso ?? new Date().toISOString();
  return [
    {
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_blocked_quick_design_unconfirmed",
      source: "system",
      responseText: [
        "type=implementation_blocked_quick_design_unconfirmed",
        "mode=implementation",
        "reason=quick_design_draft_unconfirmed",
        `projectId=${input.projectId}`,
        "hasQuickDesignDraft=true",
      ].join(" "),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    },
  ];
}

function emptyRoleCheckSummary(): ImplementationRoleCheckSummary {
  return {
    reviewer: { count: 0, highlights: [] },
    security: { count: 0, highlights: [] },
    scm: {
      issueCount: 0,
      highlights: [],
      envStatus: { git: "—", github: "—", codeAgent: "—", connectionTest: "—" },
    },
  };
}

function buildImplementationBlockedBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    messages: [buildImplementationBlockedMissingPlanningArtifactsMessage({ nowIso: now })],
    timelineEntries: buildImplementationBlockedBootstrapTimelineEntries({ nowIso: now }),
    roleCheckSummary: emptyRoleCheckSummary(),
  };
}

function buildImplementationBlockedQuickDesignUnconfirmedBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    messages: [buildImplementationBlockedQuickDesignUnconfirmedMessage({ nowIso: now })],
    timelineEntries: buildImplementationBlockedQuickDesignUnconfirmedTimelineEntries({
      projectId: input.projectId,
      nowIso: now,
    }),
    roleCheckSummary: emptyRoleCheckSummary(),
  };
}

function buildTaskListReadyImplementationBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  const taskList = input.implementationTaskListV1!;
  const roleCheckSummary = buildImplementationRoleCheckSummary(input);
  const board = buildImplementationExecutionBoardFromOrchestration({
    projectId: input.projectId,
    taskList,
    nowIso: now,
  });
  return {
    messages: [
      buildCompactImplementationExecutionBoardNoticeMessage({
        board,
        includeTaskSummary: true,
        envOk: input.envOk,
        nowIso: now,
      }),
    ],
    timelineEntries: buildImplementationBootstrapTimelineEntries({
      summaryInput: input,
      roleCheckSummary,
      nowIso: now,
    }),
    roleCheckSummary,
  };
}

function buildTaskListMissingImplementationBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  const roleCheckSummary = buildImplementationRoleCheckSummary(input);
  return {
    messages: [
      buildImplementationTaskListMissingEntryMessage({
        nowIso: now,
        implementationSeedV1: input.implementationSeedV1,
        implementationTaskListV1: input.implementationTaskListV1,
      }),
    ],
    timelineEntries: buildImplementationBootstrapTimelineEntries({
      summaryInput: input,
      roleCheckSummary,
      nowIso: now,
    }),
    roleCheckSummary,
  };
}

function buildNormalImplementationBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  const roleCheckSummary = buildImplementationRoleCheckSummary(input);
  return {
    messages: [
      buildLeadDeveloperBootstrapMessage({ summaryInput: input, roleCheckSummary, nowIso: now }),
    ],
    timelineEntries: buildImplementationBootstrapTimelineEntries({
      summaryInput: input,
      roleCheckSummary,
      nowIso: now,
    }),
    roleCheckSummary,
  };
}

function buildLeadDeveloperBootstrapMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary: ImplementationRoleCheckSummary;
  readonly nowIso: string;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const referenceArtifacts = collectReferencePlanningArtifacts(input.summaryInput.projectArtifacts);
  const scmRef = developerScmReferenceLine(input.summaryInput);
  const refLines = referenceArtifacts.map((r, i) => `${i + 1}. ${r.title}`);
  const seedStatusLines =
    input.summaryInput.slotDefinitions?.length
      ? formatImplementationSeedStatusSummaryLines({
          summary: summarizeImplementationSeedStatus({
            orchestration: input.summaryInput.orchestration,
            definitions: input.summaryInput.slotDefinitions,
            lifecycleStatus: input.summaryInput.implementationSeedV1?.lifecycleStatus,
          }),
          referenceArtifactCount: referenceArtifacts.length,
          envOk: input.summaryInput.envOk,
          env: input.summaryInput.env,
        })
      : [];
  const lines = [
    IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
    "",
    "참조 기획 산출물:",
    ...refLines,
    "",
    ...seedStatusLines,
    ...(seedStatusLines.length ? [""] : []),
    ...roleCheckSummaryLines(input.roleCheckSummary),
    ...(scmRef ? ["", scmRef] : []),
    "",
    "다음 작업을 선택해 주세요.",
  ];

  return newRequirementsMessage({
    id: `impl-orch-bootstrap-lead-${input.nowIso}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    createdAt: input.nowIso,
    meta: {
      internalType: IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE,
      implementationBootstrapKind: "lead_developer_summary",
      serviceDesignStage: "implementation",
      interviewSuggestions: prioritizeImplementationChipsForState(
        implementationEntryChipsForBootstrap(input.summaryInput),
        resolveEffectiveImplementationState({
          parsedRequirementsState: {
            implementationSeedV1: input.summaryInput.implementationSeedV1,
            implementationTaskListV1: input.summaryInput.implementationTaskListV1,
          },
          pendingPatch: {},
          envOk: input.summaryInput.envOk,
          designOk: input.summaryInput.designOk,
        }),
      ),
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1000,
    },
  });
}

function envStatusBulletLines(summary: ImplementationRoleCheckSummary): string[] {
  const s = summary.scm.envStatus;
  return [
    `- Git 저장소: ${s.git}`,
    `- GitHub 인증: ${s.github}`,
    `- 코드 에이전트 연결: ${s.codeAgent}`,
    `- 연결 테스트: ${s.connectionTest}`,
  ];
}

function prototypeBuildAiDeveloperMessage(input: {
  readonly id: string;
  readonly content: string;
  readonly nowIso: string;
  readonly internalType: string;
  readonly interviewSuggestions?: readonly string[];
  readonly prototypeOrderKey?: number;
}): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  return newRequirementsMessage({
    id: input.id,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: input.content,
    createdAt: input.nowIso,
    meta: {
      internalType: input.internalType,
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
      ...(input.interviewSuggestions?.length
        ? { interviewSuggestions: [...input.interviewSuggestions] }
        : {}),
      ...(input.prototypeOrderKey != null ? { prototypeOrderKey: input.prototypeOrderKey } : {}),
    },
  });
}

export function buildImplementationScmCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);
  const issueLine =
    summary.scm.issueCount > 0
      ? `- SCM 환경 이슈 ${summary.scm.issueCount}건이 있습니다.`
      : "- SCM 환경 이슈는 감지되지 않았습니다.";
  const policyLine = input.summaryInput.envOk
    ? "- 현재 플랫폼 기준으로 실행 환경이 완료 상태입니다."
    : "- Code Agent WIP 작업 요청 전 환경설정을 완료해야 합니다.";
  const lines = [
    "SCM 점검 결과입니다.",
    "",
    "환경 상태:",
    ...envStatusBulletLines(summary),
    "",
    "점검 결과:",
    issueLine,
    ...summary.scm.highlights.map((h) => `- ${h}`),
    policyLine,
    "",
    "조치 안내:",
    "- 환경설정 화면에서 Git 저장소, GitHub 인증, Cursor/코드 에이전트 연결, 연결 테스트 상태를 다시 확인해 주세요.",
    "",
    "다음 작업을 선택해 주세요.",
  ];

  return prototypeBuildAiDeveloperMessage({
    id: `impl-scm-check-details-${now}`,
    nowIso: now,
    internalType: IMPLEMENTATION_SCM_CHECK_DETAILS_INTERNAL_TYPE,
    content: lines.join("\n"),
    interviewSuggestions: [IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP, IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP],
    prototypeOrderKey: 1110,
  });
}

export function buildImplementationEnvironmentCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);
  const judgment = input.summaryInput.envOk
    ? ["- 플랫폼 기준으로 실행 환경이 완료 상태로 판정되어 있습니다."]
    : [
        "- 플랫폼 기준으로는 실행 환경이 아직 완료 상태가 아닙니다.",
        "- 사용자가 정상으로 알고 있더라도, 현재 화면의 실행 가능 판정에는 연결 테스트 또는 코드 에이전트 상태가 반영되지 않았을 수 있습니다.",
      ];
  const causes = input.summaryInput.envOk
    ? []
    : [
        "",
        "가능한 원인:",
        "- 저장된 Git/GitHub/Cursor 설정은 있으나 연결 테스트가 아직 완료되지 않았을 수 있습니다.",
        "- 최근 설정 변경 후 실행 환경 상태가 새로고침되지 않았을 수 있습니다.",
        "- 코드 에이전트 연결 또는 연결 테스트 항목이 아직 완료로 반영되지 않았을 수 있습니다.",
      ];
  const lines = [
    "환경설정 점검 결과입니다.",
    "",
    "현재 상태:",
    ...envStatusBulletLines(summary),
    "",
    "판단:",
    ...judgment,
    ...causes,
    "",
    "다음 확인:",
    "- 환경설정 화면을 열어 저장된 값과 최신 검증 결과를 다시 확인해 주세요.",
    "",
    "다음 작업을 선택해 주세요.",
  ];

  return prototypeBuildAiDeveloperMessage({
    id: `impl-env-check-details-${now}`,
    nowIso: now,
    internalType: IMPLEMENTATION_ENVIRONMENT_CHECK_DETAILS_INTERNAL_TYPE,
    content: lines.join("\n"),
    interviewSuggestions: [
      "환경설정 열기",
      IMPLEMENTATION_SCM_CHECK_VIEW_CHIP,
      IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP,
    ],
    prototypeOrderKey: 1120,
  });
}

export function buildImplementationReviewerCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);
  const lines = [
    "AI검수자 점검 결과입니다.",
    "",
    `검수 기준 ${summary.reviewer.count}건:`,
    ...summary.reviewer.highlights.map((h) => `- ${h}`),
    "",
    "다음 작업을 선택해 주세요.",
  ];
  return prototypeBuildAiDeveloperMessage({
    id: `impl-reviewer-check-details-${now}`,
    nowIso: now,
    internalType: IMPLEMENTATION_REVIEWER_CHECK_DETAILS_INTERNAL_TYPE,
    content: lines.join("\n"),
    interviewSuggestions: [IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP, IMPLEMENTATION_SCM_CHECK_VIEW_CHIP],
    prototypeOrderKey: 1130,
  });
}

export function buildImplementationSecurityCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);
  const lines = [
    "AI보안관 점검 결과입니다.",
    "",
    `보안 기준 ${summary.security.count}건:`,
    ...summary.security.highlights.map((h) => `- ${h}`),
    "",
    "다음 작업을 선택해 주세요.",
  ];
  return prototypeBuildAiDeveloperMessage({
    id: `impl-security-check-details-${now}`,
    nowIso: now,
    internalType: IMPLEMENTATION_SECURITY_CHECK_DETAILS_INTERNAL_TYPE,
    content: lines.join("\n"),
    interviewSuggestions: [IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP, IMPLEMENTATION_SCM_CHECK_VIEW_CHIP],
    prototypeOrderKey: 1140,
  });
}

export function buildImplementationStatusQueryMessage(input: {
  readonly intent: ImplementationStatusQueryIntent;
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage | null {
  switch (input.intent) {
    case "scm_check_details":
      return buildImplementationScmCheckDetailsMessage(input);
    case "environment_check_details":
      return buildImplementationEnvironmentCheckDetailsMessage(input);
    case "role_check_details":
      return buildImplementationRoleCheckDetailsMessage(input);
    case "reviewer_check_details":
      return buildImplementationReviewerCheckDetailsMessage(input);
    case "security_check_details":
      return buildImplementationSecurityCheckDetailsMessage(input);
    default:
      return null;
  }
}

export function buildImplementationStatusQueryTimelineEntry(input: {
  readonly query: ImplementationStatusQueryIntent;
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  const s = input.roleCheckSummary;
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_status_query_handled",
    source: "platform",
    routingDecision: input.query,
    responseText: [
      "type=implementation_status_query_handled",
      "mode=implementation",
      `query=${input.query}`,
      `envReady=${input.summaryInput.envOk}`,
      `scmIssueCount=${s.scm.issueCount}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationRoleCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);

  const sections = [
    "역할별 점검 결과입니다.",
    "",
    "AI검수자:",
    ...summary.reviewer.highlights.map((h) => `- ${h}`),
    "",
    "AI보안관:",
    ...summary.security.highlights.map((h) => `- ${h}`),
    "",
    "SCM:",
    ...summary.scm.highlights.map((h) => `- ${h}`),
    "",
    "WIP 정책: Code Agent는 WIP branch에 commit·push까지 담당하며, main 반영용 PR/merge는 SCM이 수행합니다.",
  ];

  return prototypeBuildAiDeveloperMessage({
    id: `impl-role-check-details-${now}`,
    nowIso: now,
    internalType: IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE,
    content: sections.join("\n"),
    interviewSuggestions: [
      "환경설정 열기",
      IMPLEMENTATION_SCM_CHECK_VIEW_CHIP,
      IMPLEMENTATION_ENVIRONMENT_CHECK_VIEW_CHIP,
    ],
    prototypeOrderKey: 1100,
  });
}

export function buildImplementationBootstrapTimelineEntries(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): readonly RequirementsPromptTimelineEntry[] {
  const now = input.nowIso ?? new Date().toISOString();
  const s = input.roleCheckSummary;
  const referenceArtifacts = collectReferencePlanningArtifacts(input.summaryInput.projectArtifacts);
  const payload = [
    "type=implementation_bootstrap_lead_developer_summary",
    "mode=implementation",
    "leadMember=ai_developer",
    `reviewerCheckCount=${s.reviewer.count}`,
    `securityCheckCount=${s.security.count}`,
    `scmIssueCount=${s.scm.issueCount}`,
    "codeAgentProvider=cursor",
    `envReady=${input.summaryInput.envOk}`,
    `referenceArtifactCount=${referenceArtifacts.length}`,
  ].join(" ");

  return [
    withDeterministicPlatformTimelineMeta({
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_entry_reference_artifacts_checked",
      source: "platform",
      provider: "platform",
      model: "deterministic",
      responseText: [
        "type=implementation_entry_reference_artifacts_checked",
        "mode=implementation",
        `referenceArtifactCount=${referenceArtifacts.length}`,
      ].join(" "),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    }),
    withDeterministicPlatformTimelineMeta({
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_bootstrap_lead_developer_summary",
      source: "platform",
      provider: "platform",
      model: "deterministic",
      responseText: payload,
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    }),
    withDeterministicPlatformTimelineMeta({
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_role_check_summary_ready",
      source: "platform",
      provider: "platform",
      model: "deterministic",
      responseText: payload.replace(
        "implementation_bootstrap_lead_developer_summary",
        "implementation_role_check_summary_ready",
      ),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    }),
  ];
}

export function buildImplementationRoleCheckDetailsTimelineEntry(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  const now = input.nowIso ?? new Date().toISOString();
  const s = input.roleCheckSummary;
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_role_check_details_shown",
    source: "system",
    responseText: [
      "type=implementation_role_check_details_shown",
      "mode=implementation",
      "leadMember=ai_developer",
      `reviewerCheckCount=${s.reviewer.count}`,
      `securityCheckCount=${s.security.count}`,
      `scmIssueCount=${s.scm.issueCount}`,
      `envReady=${input.summaryInput.envOk}`,
    ].join(" "),
    createdAt: now,
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

const FORBIDDEN_LEAD_DEVELOPER_ENV_MARKERS = [
  "현재 개발 준비 상태",
  "Git 저장소:",
  "AI 개발 도구 연결:",
] as const;

const LEGACY_IMPLEMENTATION_MEMBER_SPEAKER_IDS = new Set([
  "prototype_review",
  "security_reviewer",
  "memo",
]);

export function leadDeveloperMessageHasForbiddenEnvDetail(content: string): boolean {
  const text = String(content ?? "");
  return FORBIDDEN_LEAD_DEVELOPER_ENV_MARKERS.some((marker) => text.includes(marker));
}

export function isLegacyImplementationMemberBootstrapMessage(m: RequirementsMessage): boolean {
  if (m.meta.internalType === IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE) return false;
  if (m.meta.internalType === IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE) return false;

  if (
    m.meta.serviceDesignStage === "implementation" &&
    LEGACY_IMPLEMENTATION_MEMBER_SPEAKER_IDS.has(m.speakerId)
  ) {
    return true;
  }

  if (m.meta.internalType !== IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE) return false;

  // TaskList bootstrap is a first-class implementation entry message; never treat as legacy.
  if (
    m.speakerId === "prototype_build" &&
    (m.meta.implementationBootstrapKind === "task_list_ready" ||
      m.meta.implementationBootstrapKind === "task_list_missing" ||
      m.meta.implementationBootstrapKind === "blocked_quick_design_unconfirmed") &&
    (m.content.includes("구현 작업목록") || m.content.includes("Quick Design 초안"))
  ) {
    return false;
  }

  if (m.speakerId !== "prototype_build") return true;
  if (m.meta.implementationBootstrapKind !== "lead_developer_summary") return true;
  if (!m.content.includes(IMPLEMENTATION_ENTRY_READINESS_HEADLINE)) return true;
  if (!m.content.includes("역할별 점검 요약")) return true;
  if (m.content.includes("우선 구현 task:")) return true;
  if (m.content.includes("현재 산출물 기준으로 구현 작업안을 준비했습니다.")) return true;
  if (leadDeveloperMessageHasForbiddenEnvDetail(m.content)) return true;
  return false;
}

export function hasValidImplementationLeadBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => {
    if (m.meta.internalType !== IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE) return false;
    if (m.meta.implementationBootstrapKind !== "lead_developer_summary") return false;
    if (m.speakerId !== "prototype_build") return false;
    if (!m.content.includes(IMPLEMENTATION_ENTRY_READINESS_HEADLINE)) return false;
    if (!m.content.includes("참조 기획 산출물:")) return false;
    if (!m.content.includes("역할별 점검 요약")) return false;
    if (leadDeveloperMessageHasForbiddenEnvDetail(m.content)) return false;
    return true;
  });
}

export function hasValidImplementationBlockedBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => {
    if (m.meta.internalType !== IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE) return false;
    if (m.meta.implementationBootstrapKind !== "blocked_missing_planning_artifacts") return false;
    if (m.speakerId !== "prototype_build") return false;
    if (!m.content.includes(IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE)) return false;
    return true;
  });
}

export function hasValidImplementationQuickDesignUnconfirmedBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => {
    if (m.meta.internalType !== IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_INTERNAL_TYPE) return false;
    if (m.meta.implementationBootstrapKind !== "blocked_quick_design_unconfirmed") return false;
    if (m.speakerId !== "prototype_build") return false;
    if (!m.content.includes(IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_HEADLINE)) return false;
    return true;
  });
}

export function hasAnyValidImplementationBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (
    hasValidImplementationLeadBootstrap(messages) ||
    hasValidImplementationBlockedBootstrap(messages) ||
    hasValidImplementationQuickDesignUnconfirmedBootstrap(messages) ||
    hasValidImplementationTaskListBootstrap(messages)
  );
}

export function isStaleImplementationBlockedBootstrapMessage(
  m: RequirementsMessage,
  ctx?: Readonly<{
    readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
    readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
    readonly implementationSeedV1?: ImplementationSeedV1 | null;
  }> | null,
): boolean {
  if (!ctx) return false;
  const hasTaskList = hasImplementationTaskListReady(ctx.implementationTaskListV1);
  const hasWorkItems = (ctx.cursorWorkItemsV1?.length ?? 0) > 0;
  const hasSeed = Boolean(ctx.implementationSeedV1);
  if (!hasTaskList && !hasWorkItems && !hasSeed) return false;

  if (m.meta.internalType === IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE) {
    return true;
  }
  if (
    m.meta.internalType === IMPLEMENTATION_BLOCKED_QUICK_DESIGN_UNCONFIRMED_INTERNAL_TYPE &&
    (hasTaskList || hasWorkItems || hasSeed)
  ) {
    return true;
  }
  return false;
}

export function sanitizeImplementationConversationMessages(
  messages: readonly RequirementsMessage[] | null | undefined,
  ctx?: Readonly<{
    readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
    readonly cursorWorkItemsV1?: readonly CursorWorkItem[] | null;
    readonly implementationSeedV1?: ImplementationSeedV1 | null;
  }> | null,
): RequirementsMessage[] {
  return dedupeRequirementsMessagesById(
    (messages ?? []).filter((m) => {
      if (isLegacyImplementationMemberBootstrapMessage(m)) return false;
      if (isStaleImplementationBlockedBootstrapMessage(m, ctx)) return false;
      return true;
    }),
  );
}

export function hasImplementationOrchestrationBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return hasAnyValidImplementationBootstrap(messages);
}

export function hasImplementationRoleCheckDetailsShown(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => m.meta.internalType === IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE);
}

function collectNewBootstrapTimelineEntries(input: {
  readonly existingTimeline: readonly RequirementsPromptTimelineEntry[] | null | undefined;
  readonly candidateEntries: readonly RequirementsPromptTimelineEntry[];
}): readonly RequirementsPromptTimelineEntry[] {
  const beforeCount = (input.existingTimeline ?? []).length;
  const merged = appendPromptTimelineEntriesOnce(
    input.existingTimeline,
    sanitizePromptTimelineEntries(input.candidateEntries),
  );
  if (merged.length <= beforeCount) return [];
  return merged.slice(beforeCount);
}

function finalizeBootstrapBundle(
  input: ImplementationOrchestrationSummaryInput,
  bundle: ImplementationBootstrapBundle,
  extraTimelineEntries: readonly RequirementsPromptTimelineEntry[] = [],
): ImplementationBootstrapBundle {
  return {
    ...bundle,
    timelineEntries: collectNewBootstrapTimelineEntries({
      existingTimeline: input.promptTimeline,
      candidateEntries: [...extraTimelineEntries, ...bundle.timelineEntries],
    }),
  };
}

export function hasImplementationBootstrapSummaryShown(
  timeline: readonly RequirementsPromptTimelineEntry[] | null | undefined,
  fingerprint: string,
): boolean {
  return hasPromptTimelineFingerprint(timeline, fingerprint);
}

export function buildImplementationBootstrapTimelineFingerprint(
  entry: RequirementsPromptTimelineEntry,
): string {
  return buildPromptTimelineEntryFingerprint(entry);
}

/** 구현 진입: AI개발자 주도 메시지 1개 + timeline (역할별 상세는 요청 시). */
export function buildImplementationBootstrapBundle(input: ImplementationOrchestrationSummaryInput): ImplementationBootstrapBundle {
  const now = input.nowIso ?? new Date().toISOString();
  const entryState = deriveImplementationEntryState({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskPlanV1: input.implementationTaskPlanV1,
    implementationCodeTaskPlanV1: input.implementationCodeTaskPlanV1,
    implementationTaskListV1: input.implementationTaskListV1,
    cursorWorkItemsV1: input.cursorWorkItemsV1,
    projectArtifacts: input.projectArtifacts,
    fastPlanDraftV1: input.fastPlanDraftV1,
    promptTimeline: input.promptTimeline,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
  });

  if (entryState.status === "board_ready" && hasImplementationTaskListReady(input.implementationTaskListV1)) {
    return finalizeBootstrapBundle(
      input,
      buildTaskListReadyImplementationBootstrapBundle(input),
      [
        buildImplementationEntryTimelineEntry({
          projectId: input.projectId,
          entryState,
          nowIso: now,
        }),
      ],
    );
  }

  const planningReadiness = evaluatePlanningArtifactReadiness({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskPlanV1: input.implementationTaskPlanV1,
    implementationTaskListV1: input.implementationTaskListV1,
    cursorWorkItemsV1: input.cursorWorkItemsV1,
    projectArtifacts: input.projectArtifacts,
    fastPlanDraftV1: input.fastPlanDraftV1,
    promptTimeline: input.promptTimeline,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
  });

  if (planningReadiness.status === "quick_design_draft_unconfirmed") {
    return finalizeBootstrapBundle(input, buildImplementationBlockedQuickDesignUnconfirmedBootstrapBundle(input));
  }

  if (planningReadiness.status === "missing_planning_artifacts") {
    return finalizeBootstrapBundle(input, buildImplementationBlockedBootstrapBundle(input));
  }

  const entryReadiness = evaluateImplementationEntrySurfaceReadiness({
    implementationSeedV1: input.implementationSeedV1,
    implementationTaskListV1: input.implementationTaskListV1,
    orchestration: input.orchestration,
    slotDefinitions: input.slotDefinitions,
    projectArtifacts: input.projectArtifacts,
    envOk: input.envOk,
    designOk: input.designOk,
  });

  if (entryReadiness.taskListReady && input.implementationTaskListV1) {
    return finalizeBootstrapBundle(input, buildTaskListReadyImplementationBootstrapBundle(input));
  }
  if (entryReadiness.seedReady || entryState.status === "seed_only" || entryState.status === "task_plan_only") {
    return finalizeBootstrapBundle(input, buildTaskListMissingImplementationBootstrapBundle(input));
  }
  return finalizeBootstrapBundle(input, buildNormalImplementationBootstrapBundle(input));
}
