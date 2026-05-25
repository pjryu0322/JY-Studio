import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import { newRequirementsMessage, type RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifact, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

export const IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE = "IMPLEMENTATION_TASK_PLAN_SUMMARY_V1";

export type ImplementationTaskPriority = "P0" | "P1" | "P2";

export type ImplementationTaskStatus =
  | "draft"
  | "ready"
  | "blocked"
  | "running"
  | "done"
  | "failed";

export type ImplementationTaskPlanItem = Readonly<{
  id: string;
  title: string;
  description: string;
  priority: ImplementationTaskPriority;
  sourceArtifactTypes: readonly string[];
  sourceRoles: readonly string[];
  acceptanceCriteria: readonly string[];
  securityChecks: readonly string[];
  reviewChecks: readonly string[];
  cursorPromptDraft: string;
  status: ImplementationTaskStatus;
  blockers: readonly string[];
}>;

export type ImplementationTaskPlanV1 = Readonly<{
  version: "implementation_task_plan_v1";
  projectId: string;
  createdAt: string;
  source: "implementation_orchestration";
  items: readonly ImplementationTaskPlanItem[];
  readiness: Readonly<{
    ready: boolean;
    missing: readonly string[];
  }>;
}>;

export type BuildImplementationTaskPlanInput = Readonly<{
  projectId: string;
  projectArtifacts: readonly ProjectArtifact[];
  artifactOrchestrationV1?: ArtifactOrchestrationStateV1 | null;
  featureDraftTitles?: readonly string[];
  envOk: boolean;
  designOk: boolean;
  nowIso?: string;
}>;

const IMPLEMENTATION_ARTIFACT_TYPES: readonly ProjectArtifactType[] = [
  "feature-spec",
  "screen-spec",
  "api-spec",
  "service-flow-doc",
];

function slugId(prefix: string, title: string, index: number): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${prefix}-${index + 1}-${slug || "task"}`;
}

function deriveTaskTitles(input: BuildImplementationTaskPlanInput): readonly { title: string; artifactTypes: string[] }[] {
  const fromFeatures = (input.featureDraftTitles ?? []).map((t) => String(t ?? "").trim()).filter(Boolean);
  if (fromFeatures.length) {
    return fromFeatures.map((title) => ({ title, artifactTypes: ["feature-spec"] }));
  }

  const fromArtifacts = input.projectArtifacts
    .filter((a) => IMPLEMENTATION_ARTIFACT_TYPES.includes(a.type))
    .map((a) => ({
      title: a.title.trim() || PROJECT_ARTIFACT_LABELS[a.type],
      artifactTypes: [a.type],
    }));
  if (fromArtifacts.length) return fromArtifacts.slice(0, 8);

  const planned = (input.artifactOrchestrationV1?.planned ?? []).map((p) => ({
    title: String(p.title ?? "").trim(),
    artifactTypes: [String(p.type ?? "feature-spec")],
  }));
  if (planned.length) return planned.filter((p) => p.title).slice(0, 8);

  return [
    { title: "핵심 기능 구현", artifactTypes: ["feature-spec"] },
    { title: "화면·API 연동", artifactTypes: ["screen-spec", "api-spec"] },
    { title: "검수·보안 점검 반영", artifactTypes: ["feature-spec"] },
  ];
}

function buildCursorPromptDraft(item: {
  title: string;
  description: string;
  artifactLabels: string[];
  acceptanceCriteria: readonly string[];
  securityChecks: readonly string[];
  reviewChecks: readonly string[];
}): string {
  const lines = [
    `# Cursor 작업 지시 — ${item.title}`,
    "",
    "## 작업 목적",
    item.description,
    "",
    "## 참조 산출물",
    ...item.artifactLabels.map((l) => `- ${l}`),
    "",
    "## 구현 요구사항",
    "- 기획 산출물 범위 안에서 최소 변경으로 구현한다.",
    "- 기존 프로젝트 컨벤션·타입·테스트 스타일을 따른다.",
    "",
    "## 검수 기준",
    ...item.acceptanceCriteria.map((c) => `- ${c}`),
    "",
    "## 보안 기준",
    ...item.securityChecks.map((c) => `- ${c}`),
    "",
    "## 완료 보고 형식",
    "- 변경 파일 목록",
    "- 핵심 동작 요약",
    "- 미해결 리스크(있을 경우)",
    "",
    "## 금지사항",
    "- projects/JYOrchestration 외 수정 금지",
    "- Stage1/Stage2/ENV_TEST 실행 파이프라인 수정 금지",
    "- package.json / lockfile 수정 금지",
  ];
  return lines.join("\n");
}

function scmBlockers(envOk: boolean, designOk: boolean): readonly string[] {
  const blockers: string[] = [];
  if (!envOk) blockers.push("실행 환경(Git/GitHub/Cursor/연결 테스트) 미완료");
  if (!designOk) blockers.push("기획 산출물·설계 readiness 미완료");
  return blockers;
}

export function buildImplementationTaskPlan(input: BuildImplementationTaskPlanInput): ImplementationTaskPlanV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const titles = deriveTaskTitles(input);
  const globalBlockers = scmBlockers(input.envOk, input.designOk);

  const items: ImplementationTaskPlanItem[] = titles.map((row, index) => {
    const priority: ImplementationTaskPriority = index === 0 ? "P0" : index < 3 ? "P1" : "P2";
    const artifactLabels = row.artifactTypes.map((t) => PROJECT_ARTIFACT_LABELS[t as ProjectArtifactType] ?? t);
    const acceptanceCriteria = [
      "정상·예외 입력에 대한 사용자 피드백이 있다.",
      "기능 정의서·화면 정의서 범위를 벗어나지 않는다.",
      "회귀 없이 기존 플로우와 연결된다.",
    ];
    const reviewChecks = [
      "업로드·입력 실패 처리",
      "빈 결과·부분 실패 시 복구 경로",
      "요약·산출물 수정 가능 여부",
    ];
    const securityChecks = [
      "허용 파일 형식·크기 제한",
      "개인정보·민감 데이터 처리·보관 정책",
      "외부 연동 자격·토큰 노출 방지",
    ];
    const itemBlockers = [...globalBlockers];
    const status: ImplementationTaskStatus =
      itemBlockers.length ? "blocked" : input.envOk && input.designOk ? "ready" : "draft";

    return {
      id: slugId("impl-task", row.title, index),
      title: row.title,
      description: `${row.title} — 기획 산출물(${artifactLabels.join(", ")})을 반영한 구현 작업입니다.`,
      priority,
      sourceArtifactTypes: row.artifactTypes,
      sourceRoles: ["prototype_build", "prototype_review", "security_reviewer", "memo"],
      acceptanceCriteria,
      securityChecks,
      reviewChecks,
      cursorPromptDraft: buildCursorPromptDraft({
        title: row.title,
        description: `${row.title} 구현`,
        artifactLabels,
        acceptanceCriteria,
        securityChecks,
        reviewChecks,
      }),
      status,
      blockers: itemBlockers,
    };
  });

  const planDraft: ImplementationTaskPlanV1 = {
    version: "implementation_task_plan_v1",
    projectId: input.projectId.trim(),
    createdAt: now,
    source: "implementation_orchestration",
    items,
    readiness: { ready: false, missing: [] },
  };
  const readiness = evaluateImplementationTaskPlanReadiness({
    plan: planDraft,
    envOk: input.envOk,
    designOk: input.designOk,
  });

  return { ...planDraft, readiness };
}

export function evaluateImplementationTaskPlanReadiness(input: {
  readonly plan: ImplementationTaskPlanV1 | null | undefined;
  readonly envOk: boolean;
  readonly designOk: boolean;
}): { readonly ready: boolean; readonly missing: readonly string[] } {
  const missing: string[] = [];
  const plan = input.plan;
  if (!plan?.items?.length) {
    missing.push("구현 task plan 없음");
    return { ready: false, missing };
  }
  if (!input.envOk) missing.push("AI 개발 도구·연결 환경");
  if (!input.designOk) missing.push("기획 산출물 completeness");
  for (const item of plan.items) {
    if (!item.acceptanceCriteria.length) missing.push(`${item.title}: 검수 기준`);
    if (!item.securityChecks.length) missing.push(`${item.title}: 보안 기준`);
    if (!item.cursorPromptDraft.trim()) missing.push(`${item.title}: Cursor prompt`);
  }
  const uniq = [...new Set(missing)];
  return { ready: uniq.length === 0, missing: uniq };
}

export function buildImplementationTaskPlanSummaryContent(plan: ImplementationTaskPlanV1): string {
  const lines = [
    "구현 작업안을 정리했습니다.",
    "",
    "우선 구현 task:",
    ...plan.items.map((it, i) => `${i + 1}. ${it.title}${it.blockers.length ? " (차단: 환경·설계)" : ""}`),
    "",
    "각 task에는 검수 기준과 보안 기준, Cursor prompt 초안을 함께 연결했습니다.",
    plan.readiness.ready
      ? "환경·설계 준비가 완료되었습니다. Cursor 실행 요청을 진행할 수 있습니다."
      : "환경·설계 준비가 부족하면 Cursor 실행 요청은 차단됩니다. [환경설정 열기]로 연결 상태를 먼저 완료해 주세요.",
  ];
  if (!plan.readiness.ready && plan.readiness.missing.length) {
    lines.push("", "부족 항목:", ...plan.readiness.missing.map((m) => `- ${m}`));
  }
  return lines.join("\n");
}

export function implementationTaskPlanSummaryChips(input: {
  readonly plan: ImplementationTaskPlanV1;
  readonly envOk: boolean;
  readonly designOk: boolean;
}): readonly string[] {
  const base = ["작업 범위 수정", "산출물 다시 보기", "환경설정 열기"];
  const gate = evaluateImplementationTaskPlanReadiness({
    plan: input.plan,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  if (gate.ready) return [...base, "Cursor 실행 요청", "구현 실행 준비"];
  return [...base, "구현 실행 준비"];
}

export function hasImplementationTaskPlanSummary(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => m.meta.internalType === IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE);
}

export function buildImplementationTaskPlanSummaryMessage(
  plan: ImplementationTaskPlanV1,
  input: { readonly envOk: boolean; readonly designOk: boolean; readonly nowIso?: string },
): RequirementsMessage {
  const def = getWorkspaceAiMember("prototype_build");
  const chips = implementationTaskPlanSummaryChips({
    plan,
    envOk: input.envOk,
    designOk: input.designOk,
  });
  return newRequirementsMessage({
    id: `impl-task-plan-summary-${plan.createdAt}`,
    role: "ai",
    speakerType: "AI",
    speakerId: "prototype_build",
    speakerName: def?.title ?? "AI개발자",
    messageType: "STATEMENT",
    content: buildImplementationTaskPlanSummaryContent(plan),
    createdAt: input.nowIso ?? new Date().toISOString(),
    meta: {
      internalType: IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE,
      serviceDesignStage: "implementation",
      interviewSuggestions: [...chips],
      interviewAllowCustomInput: true,
    },
  });
}
