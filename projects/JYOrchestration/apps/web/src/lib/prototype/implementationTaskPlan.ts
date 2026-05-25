import { buildCursorPromptDraft } from "@/lib/prototype/implementationCursorPromptDraft";
import {
  buildImplementationTaskExecutionHints,
  type ImplementationTaskExecutionHints,
} from "@/lib/prototype/implementationExecutionHints";

export { buildCursorPromptDraft } from "@/lib/prototype/implementationCursorPromptDraft";
import type { ArtifactOrchestrationStateV1 } from "@/lib/requirements/artifactOrchestration";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { PROJECT_ARTIFACT_LABELS, type ProjectArtifact, type ProjectArtifactType } from "@/lib/requirements/projectArtifactTypes";

export type { ImplementationTaskExecutionHints } from "@/lib/prototype/implementationExecutionHints";

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
  executionHints: ImplementationTaskExecutionHints;
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
    const executionHints = buildImplementationTaskExecutionHints({
      taskTitle: row.title,
      sourceArtifactTypes: row.artifactTypes,
      projectArtifacts: input.projectArtifacts,
      featureDraftTitles: input.featureDraftTitles,
    });
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
      executionHints,
      cursorPromptDraft: buildCursorPromptDraft({
        title: row.title,
        description: `${row.title} — 기획 산출물(${artifactLabels.join(", ")})을 반영한 구현 작업입니다.`,
        artifactLabels,
        acceptanceCriteria,
        securityChecks,
        reviewChecks,
        executionHints,
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
    if (!item.executionHints.testCommands.length) missing.push(`${item.title}: 테스트 명령`);
  }
  const uniq = [...new Set(missing)];
  return { ready: uniq.length === 0, missing: uniq };
}

export function hasImplementationTaskPlanSummary(
  messages: readonly RequirementsMessage[] | null | undefined,
): boolean {
  return (messages ?? []).some((m) => m.meta.internalType === IMPLEMENTATION_TASK_PLAN_SUMMARY_INTERNAL_TYPE);
}

export {
  buildImplementationTaskPlanSummaryContent,
  buildImplementationTaskPlanSummaryMessage,
  implementationTaskPlanSummaryChips,
  summarizeTaskPlanExecutionStats,
} from "@/lib/prototype/implementationTaskPlanSummary";
