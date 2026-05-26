import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import {
  PROJECT_ARTIFACT_LABELS,
  type ProjectArtifact,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";

export const IMPLEMENTATION_WORK_PLAN_DRAFT_VERSION = "implementation_work_plan_draft_v1" as const;

export const WORK_PLAN_DRAFT_GENERATE_CHIP = "구현 작업안 초안 생성";
export const WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP = "구현 범위 직접 입력";

export const IMPLEMENTATION_WORK_PLAN_DRAFT_MESSAGE_INTERNAL_TYPE =
  "IMPLEMENTATION_WORK_PLAN_DRAFT_MESSAGE_V1";

export const IMPLEMENTATION_ENTRY_READINESS_HEADLINE =
  "기획 산출물 기준으로 구현 준비 상태를 점검했습니다.";

/** Artifact Hub에 실제 존재하는 기획 산출물만, 표시 우선순위 */
export const REFERENCE_PLANNING_ARTIFACT_ORDER: readonly ProjectArtifactType[] = [
  "fast_prototype_plan",
  "service-flow-doc",
  "feature-spec",
  "screen-spec",
  "api-spec",
  "summary",
];

export type ImplementationWorkPlanDraftStatus = "draft" | "confirmed" | "revised";

export type ReferencePlanningArtifactRef = Readonly<{
  readonly id: string;
  readonly type: ProjectArtifactType;
  readonly title: string;
}>;

export type ImplementationWorkPlanDraftV1 = Readonly<{
  version: typeof IMPLEMENTATION_WORK_PLAN_DRAFT_VERSION;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  source: "planning_artifacts";
  referenceArtifacts: readonly ReferencePlanningArtifactRef[];
  implementationScope: readonly string[];
  implementationApproach: readonly string[];
  assumptions: readonly string[];
  blockers: readonly string[];
  status: ImplementationWorkPlanDraftStatus;
}>;

export function collectReferencePlanningArtifacts(
  projectArtifacts: readonly ProjectArtifact[],
): readonly ReferencePlanningArtifactRef[] {
  const byType = new Map<ProjectArtifactType, ProjectArtifact>();
  for (const a of projectArtifacts) {
    if (!REFERENCE_PLANNING_ARTIFACT_ORDER.includes(a.type)) continue;
    if (!byType.has(a.type)) byType.set(a.type, a);
  }
  const out: ReferencePlanningArtifactRef[] = [];
  for (const type of REFERENCE_PLANNING_ARTIFACT_ORDER) {
    const a = byType.get(type);
    if (!a) continue;
    out.push({
      id: a.id,
      type: a.type,
      title: a.title.trim() || PROJECT_ARTIFACT_LABELS[type],
    });
  }
  return out;
}

function scopeLineForReference(ref: ReferencePlanningArtifactRef): string {
  switch (ref.type) {
    case "fast_prototype_plan":
      return "Mock 데이터 기반 주요 화면 구성";
    case "service-flow-doc":
      return "서비스 흐름에 따른 사용자 동선 구현";
    case "feature-spec":
      return "기능 정의서 기준 핵심 기능 구현";
    case "screen-spec":
      return "화면 정의서 기준 UI 구성";
    case "api-spec":
      return "API 명세서 기준 연동·데이터 흐름 반영";
    case "summary":
      return "프로젝트 요약서 범위 내 핵심 목표 반영";
    default:
      return `${ref.title} 범위 반영`;
  }
}

export function buildImplementationScopeFromReferences(
  references: readonly ReferencePlanningArtifactRef[],
): readonly string[] {
  const fromRefs = references.map(scopeLineForReference);
  if (fromRefs.length) {
    return [...fromRefs, "검토용 프로토타입 상태 처리"].slice(0, 8);
  }
  return [
    "Mock 데이터 기반 주요 화면 구성",
    "핵심 사용자 동선 구현",
    "검토용 프로토타입 상태 처리",
  ];
}

const DEFAULT_IMPLEMENTATION_APPROACH = [
  "초기 구현은 DB 없이 Mock Data / Local State 기반으로 진행합니다.",
  "Code Agent WIP 작업 전 환경설정 확인이 필요합니다.",
  "WIP 작업 결과는 AI개발자가 검토한 뒤 SCM 공식 반영 단계로 넘깁니다.",
] as const;

export function buildImplementationWorkPlanDraft(input: {
  readonly projectId: string;
  readonly projectArtifacts: readonly ProjectArtifact[];
  readonly envOk: boolean;
  readonly designOk: boolean;
  readonly nowIso?: string;
}): ImplementationWorkPlanDraftV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const referenceArtifacts = collectReferencePlanningArtifacts(input.projectArtifacts);
  const blockers: string[] = [];
  if (!input.designOk) blockers.push("기획 산출물·설계 readiness 미완료");
  if (!input.envOk) blockers.push("실행 환경(Git/GitHub/Code Agent) 미완료");
  if (!referenceArtifacts.length) blockers.push("참조 기획 산출물 없음");

  return {
    version: IMPLEMENTATION_WORK_PLAN_DRAFT_VERSION,
    projectId: input.projectId.trim(),
    createdAt: now,
    updatedAt: now,
    source: "planning_artifacts",
    referenceArtifacts,
    implementationScope: buildImplementationScopeFromReferences(referenceArtifacts),
    implementationApproach: [...DEFAULT_IMPLEMENTATION_APPROACH],
    assumptions: ["초기 단계는 프로토타입 검토·동선 검증 우선"],
    blockers,
    status: "draft",
  };
}

export function parseImplementationWorkPlanDraftV1(
  raw: unknown,
): ImplementationWorkPlanDraftV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_WORK_PLAN_DRAFT_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const createdAt = String(o.createdAt ?? "").trim();
  if (!createdAt) return null;
  const statusRaw = String(o.status ?? "draft").trim();
  const status: ImplementationWorkPlanDraftStatus =
    statusRaw === "confirmed" || statusRaw === "revised" ? statusRaw : "draft";

  const referenceArtifacts: ReferencePlanningArtifactRef[] = [];
  for (const row of Array.isArray(o.referenceArtifacts) ? o.referenceArtifacts : []) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const type = String(r.type ?? "").trim() as ProjectArtifactType;
    if (!REFERENCE_PLANNING_ARTIFACT_ORDER.includes(type)) continue;
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    referenceArtifacts.push({
      id,
      type,
      title: String(r.title ?? PROJECT_ARTIFACT_LABELS[type] ?? type).trim(),
    });
  }

  const strList = (key: string) =>
    (Array.isArray(o[key]) ? o[key] : [])
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);

  return {
    version: IMPLEMENTATION_WORK_PLAN_DRAFT_VERSION,
    projectId,
    createdAt,
    updatedAt: String(o.updatedAt ?? createdAt).trim(),
    source: "planning_artifacts",
    referenceArtifacts,
    implementationScope: strList("implementationScope"),
    implementationApproach: strList("implementationApproach"),
    assumptions: strList("assumptions"),
    blockers: strList("blockers"),
    status,
  };
}

export function hasImplementationWorkPlanDraftReady(
  draft: ImplementationWorkPlanDraftV1 | null | undefined,
): boolean {
  if (!draft?.implementationScope.length) return false;
  return draft.status === "draft" || draft.status === "revised";
}

export function canConfirmImplementationWorkPlanDraft(
  draft: ImplementationWorkPlanDraftV1 | null | undefined,
): boolean {
  return hasImplementationWorkPlanDraftReady(draft);
}

export function implementationEntryChips(): readonly string[] {
  return [
    WORK_PLAN_DRAFT_GENERATE_CHIP,
    "역할별 점검 보기",
    "환경설정 열기",
    WORK_PLAN_SCOPE_DIRECT_INPUT_CHIP,
    "산출물 다시 보기",
  ];
}

export function implementationWorkPlanDraftChips(): readonly string[] {
  return [
    "구현 작업안 확정",
    "구현 범위 수정",
    "DB 연동 필요성 검토",
    "데이터 모델 초안 생성",
    "Mock 기반 구현 진행",
    "산출물 다시 보기",
    "환경설정 열기",
  ];
}

export function buildImplementationEntryReferenceArtifactsTimelineEntry(input: {
  readonly referenceArtifactCount: number;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_entry_reference_artifacts_checked",
    source: "system",
    responseText: [
      "type=implementation_entry_reference_artifacts_checked",
      "mode=implementation",
      `referenceArtifactCount=${input.referenceArtifactCount}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationWorkPlanDraftTimelineEntry(input: {
  readonly draft: ImplementationWorkPlanDraftV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_work_plan_draft_generated",
    source: "system",
    responseText: [
      "type=implementation_work_plan_draft_generated",
      "mode=implementation",
      `referenceArtifactCount=${input.draft.referenceArtifacts.length}`,
      `implementationScopeCount=${input.draft.implementationScope.length}`,
      `draftStatus=${input.draft.status}`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildImplementationWorkPlanDraftConfirmedTimelineEntry(input: {
  readonly draft: ImplementationWorkPlanDraftV1;
  readonly nowIso?: string;
}): RequirementsPromptTimelineEntry {
  return {
    stage: "implementation",
    stageGroup: "구현",
    workspaceScreenKey: "prototype_execution",
    action: "implementation_work_plan_draft_confirmed",
    source: "system",
    responseText: [
      "type=implementation_work_plan_draft_confirmed",
      "mode=implementation",
      `implementationScopeCount=${input.draft.implementationScope.length}`,
      `draftStatus=confirmed`,
    ].join(" "),
    createdAt: input.nowIso ?? new Date().toISOString(),
    orchestrationTraceGroup: "implementation_orchestration",
  };
}

export function buildWorkPlanDraftMessage(
  draft: ImplementationWorkPlanDraftV1,
  input?: { readonly nowIso?: string },
): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const now = input?.nowIso ?? new Date().toISOString();
  const lines = [
    "기획 산출물을 바탕으로 구현 작업안 초안을 생성했습니다.",
    "",
    "구현 범위:",
    ...draft.implementationScope.map((s, i) => `${i + 1}. ${s}`),
    "",
    "구현 방식:",
    ...draft.implementationApproach.map((a) => `- ${a}`),
    "",
    "다음 작업을 선택해 주세요.",
  ];

  return newRequirementsMessage({
    id: `impl-work-plan-draft-msg-${draft.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: lines.join("\n"),
    createdAt: now,
    meta: {
      internalType: IMPLEMENTATION_WORK_PLAN_DRAFT_MESSAGE_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [...implementationWorkPlanDraftChips()],
      interviewAllowCustomInput: true,
      prototypeOrderKey: 1050,
    },
  });
}

export function hasImplementationWorkPlanDraftMessage(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some(
    (m) => m.meta.internalType === IMPLEMENTATION_WORK_PLAN_DRAFT_MESSAGE_INTERNAL_TYPE,
  );
}

export function formatWorkPlanDraftMarkdown(draft: ImplementationWorkPlanDraftV1): string {
  return [
    "# 구현 작업안 초안",
    "",
    "## 참조 기획 산출물",
    ...(draft.referenceArtifacts.length
      ? draft.referenceArtifacts.map((r, i) => `${i + 1}. ${r.title}`)
      : ["- (없음)"]),
    "",
    "## 구현 범위",
    ...draft.implementationScope.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## 구현 방식",
    ...draft.implementationApproach.map((a) => `- ${a}`),
    "",
    `상태: ${draft.status}`,
  ].join("\n");
}
