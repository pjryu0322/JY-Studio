import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { PrototypeChatEnvBadge, PrototypeChatEnvSnapshot } from "@/lib/prototype/buildPrototypeChatMessages";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import {
  dedupeRequirementsMessagesById,
  newRequirementsMessage,
  type RequirementsMessage,
} from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";
import {
  collectReferencePlanningArtifacts,
  IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
  implementationBlockedEntryChips,
  implementationEntryChips as workPlanDraftEntryChips,
} from "@/lib/prototype/implementationWorkPlanDraft";

export const IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_INTERNAL_TYPE = "IMPLEMENTATION_ORCHESTRATION_BOOTSTRAP_V1";
export const IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_INTERNAL_TYPE =
  "IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_V1";
export const IMPLEMENTATION_BLOCKED_MISSING_PLANNING_ARTIFACTS_HEADLINE =
  "기획 산출물이 없어 구현단계를 시작할 수 없습니다.";
export const IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE = "IMPLEMENTATION_ROLE_CHECK_DETAILS_V1";

export const IMPLEMENTATION_ROLE_CHECK_VIEW_CHIP = "역할별 점검 보기";

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
  readonly nowIso?: string;
}>;

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

/** @deprecated — `implementationWorkPlanDraft.implementationEntryChips` */
export function implementationEntryChips(_input: ImplementationOrchestrationSummaryInput): readonly string[] {
  return workPlanDraftEntryChips();
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
    "구현 작업안 초안은 기획 산출물과 구현 Seed를 기준으로 생성됩니다.",
    "현재 참조 가능한 기획 산출물이 없으므로, 먼저 기획단계에서 대화와 산출물을 준비해 주세요.",
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
  const lines = [
    IMPLEMENTATION_ENTRY_READINESS_HEADLINE,
    "",
    "참조 기획 산출물:",
    ...refLines,
    "",
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
      interviewSuggestions: [...workPlanDraftEntryChips()],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1000,
    },
  });
}

export function buildImplementationRoleCheckDetailsMessage(input: {
  readonly summaryInput: ImplementationOrchestrationSummaryInput;
  readonly roleCheckSummary?: ImplementationRoleCheckSummary;
  readonly nowIso?: string;
}): RequirementsMessage {
  const now = input.nowIso ?? new Date().toISOString();
  const summary = input.roleCheckSummary ?? buildImplementationRoleCheckSummary(input.summaryInput);
  const def = getWorkspaceAiMember("prototype_build");

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
    "WIP 정책: Code Agent는 WIP branch/commit까지만 담당하며, 공식 push/PR/merge는 SCM이 수행합니다.",
  ];

  return newRequirementsMessage({
    id: `impl-role-check-details-${now}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: sections.join("\n"),
    createdAt: now,
    meta: {
      internalType: IMPLEMENTATION_ROLE_CHECK_DETAILS_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1100,
    },
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
    {
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_entry_reference_artifacts_checked",
      source: "system",
      responseText: [
        "type=implementation_entry_reference_artifacts_checked",
        "mode=implementation",
        `referenceArtifactCount=${referenceArtifacts.length}`,
      ].join(" "),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    },
    {
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_bootstrap_lead_developer_summary",
      source: "system",
      responseText: payload,
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    },
    {
      stage: "implementation",
      stageGroup: "구현",
      workspaceScreenKey: "prototype_execution",
      action: "implementation_role_check_summary_ready",
      source: "system",
      responseText: payload.replace(
        "implementation_bootstrap_lead_developer_summary",
        "implementation_role_check_summary_ready",
      ),
      createdAt: now,
      orchestrationTraceGroup: "implementation_orchestration",
    },
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

export function hasAnyValidImplementationBootstrap(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return hasValidImplementationLeadBootstrap(messages) || hasValidImplementationBlockedBootstrap(messages);
}

export function sanitizeImplementationConversationMessages(
  messages: readonly RequirementsMessage[] | null | undefined,
): RequirementsMessage[] {
  return dedupeRequirementsMessagesById(
    (messages ?? []).filter((m) => !isLegacyImplementationMemberBootstrapMessage(m)),
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

/** 구현 진입: AI개발자 주도 메시지 1개 + timeline (역할별 상세는 요청 시). */
export function buildImplementationBootstrapBundle(input: ImplementationOrchestrationSummaryInput): ImplementationBootstrapBundle {
  const referenceArtifacts = collectReferencePlanningArtifacts(input.projectArtifacts);
  if (referenceArtifacts.length === 0) {
    return buildImplementationBlockedBootstrapBundle(input);
  }
  return buildNormalImplementationBootstrapBundle(input);
}

/** @deprecated — `buildImplementationBootstrapBundle` 사용 */
export function buildImplementationOrchestrationSummary(
  input: ImplementationOrchestrationSummaryInput,
): readonly RequirementsMessage[] {
  return buildImplementationBootstrapBundle(input).messages;
}
