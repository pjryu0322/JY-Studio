import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import {
  codeTaskHasPersistedBranchPlan,
  codeTaskHasPersistedFileBoundary,
} from "@/lib/prototype/stageOnePromptReadiness";
import {
  WORKSPACE_SHELL_OWNED_PATTERNS,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  DEFAULT_WORK_BRANCH_BY_GROUP,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";
import { codeTaskPlanHasBranchPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import {
  findIntegrationOrchestrationCodeTask,
  INTEGRATION_WIRING_CODE_TASK_ID,
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  INTEGRATION_WIRING_ROLE_TEXT,
  listExecutableCodeTasksFromPlan,
  planHasIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { CodeTaskPromptContextMapV1 } from "@/lib/prototype/codeTaskPromptContext";
import { getCodeTaskPromptContextFromMap } from "@/lib/prototype/codeTaskPromptContext";

export const STAGE_ONE_CONFLICT_PREVENTION_POLICY_LINES: readonly string[] = [
  "## 충돌 예방 정책",
  "",
  "- Shell/global 파일은 `foundation` 또는 `integration` branch group만 수정할 수 있다.",
  "- 아래 파일은 일반 feature/common/screen/data Task에서 직접 수정하지 않는다.",
  ...WORKSPACE_SHELL_OWNED_PATTERNS.map((p) => `  - \`${p}\``),
  "- 화면별 Task는 자기 화면 컴포넌트만 생성한다.",
  "- 공통 컴포넌트 Task는 `src/components/common/*` 하위만 수정한다.",
  "- 데이터 Task는 `src/data/*` 하위만 수정한다.",
  "- Shell 연결/import/route wiring은 `integration` Task에서 수행한다.",
];

export function buildBranchPlanSummarySections(
  plan: ImplementationCodeTaskPlanV1,
): string[] {
  const branchPlan = plan.implementationBranchPlanV1;
  const baseBranch = branchPlan?.baseBranch?.trim() || "main";
  const order = (branchPlan?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER).filter(
    (g) => g !== "integration",
  );
  const lines: string[] = [
    "## Branch Plan 요약",
    "",
    `- 기준 브랜치: \`${baseBranch}\``,
    "- 실행 정책: 충돌 예방을 위해 branch group 순차 실행",
    "- 실행 CodeTask branch group 순서:",
  ];
  order.forEach((groupId, index) => {
    const group = branchPlan?.groups.find((g) => g.groupId === groupId);
    const workBranch = group?.workBranch ?? DEFAULT_WORK_BRANCH_BY_GROUP[groupId];
    lines.push(`  ${index + 1}. ${groupId} → \`${workBranch}\``);
  });
  const orchestration = findIntegrationOrchestrationCodeTask(plan.tasks);
  if (orchestration) {
    const intBp = orchestration.branchPlan;
    const intBranch =
      intBp?.workBranch ?? branchPlan?.groups.find((g) => g.groupId === "integration")?.workBranch ?? DEFAULT_WORK_BRANCH_BY_GROUP.integration;
    const screenBranch =
      branchPlan?.groups.find((g) => g.groupId === "screen")?.workBranch ??
      DEFAULT_WORK_BRANCH_BY_GROUP.screen;
    lines.push(
      "",
      "## Integration Orchestration Branch",
      "",
      `- integration → \`${intBranch}\``,
      `- 기준 브랜치: \`${intBp?.baseBranch ?? screenBranch}\``,
      `- 실행 시점: 실행 CodeTask ${listExecutableCodeTasksFromPlan(plan.tasks).length}개 완료 후`,
      "- 실행 방식: 통합 버튼 또는 integration pipeline에서 자동 수행",
    );
  }
  return lines;
}

export function buildBranchPlanGroupListingSections(
  plan: ImplementationCodeTaskPlanV1,
): string[] {
  const order = (plan.implementationBranchPlanV1?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER).filter(
    (g) => g !== "integration",
  );
  const executableIds = new Set(
    listExecutableCodeTasksFromPlan(plan.tasks).map((t) => t.codeTaskId.trim()),
  );
  const lines: string[] = ["", "## Branch Group별 실행 CodeTask", ""];
  for (const groupId of order) {
    const inGroup = plan.tasks.filter(
      (t) => t.branchPlan?.branchGroup === groupId && executableIds.has(t.codeTaskId.trim()),
    );
    if (!inGroup.length) continue;
    lines.push(`### ${groupId}`);
    for (const task of inGroup) {
      lines.push(`- ${task.codeTaskId} — ${task.title}`);
    }
    lines.push("");
  }
  return lines;
}

export function buildIntegrationOrchestrationTaskSummarySection(input: {
  readonly orchestration: ImplementationCodeTaskV1 | null;
  readonly executableCount: number;
}): string[] {
  if (!input.orchestration) return [];
  return [
    "",
    "## Integration Orchestration Task",
    "",
    `### ${INTEGRATION_WIRING_PROCESS_TASK_TITLE}`,
    `- Orchestration Task ID: ${INTEGRATION_WIRING_CODE_TASK_ID}`,
    `- 역할: ${INTEGRATION_WIRING_ROLE_TEXT}`,
    `- 실행 시점: 모든 실행 CodeTask ${input.executableCount}개가 commit outcome 저장 완료된 후`,
    "- 실행 방식: 플랫폼 통합 파이프라인 또는 integration branch 작업",
  ];
}

export function formatIntegrationOrchestrationTaskDetailSection(input: {
  readonly orchestration: ImplementationCodeTaskV1;
  readonly parentTaskTitle?: string | null;
  readonly promptContext?: import("@/lib/prototype/codeTaskPromptContext").CodeTaskPromptContextV1 | null;
}): string {
  const ctx = input.promptContext;
  const lines = [
    "",
    "## Integration Orchestration Task 상세",
    "",
    `### ${INTEGRATION_WIRING_PROCESS_TASK_TITLE}`,
    `- Orchestration Task ID: ${input.orchestration.codeTaskId}`,
    `- Process Task: ${input.parentTaskTitle?.trim() || INTEGRATION_WIRING_PROCESS_TASK_TITLE}`,
    "",
    "#### sampleData 최종 연결 책임",
    "- `src/data/sampleData.ts`의 샘플 데이터를 App Shell 및 화면 컴포넌트에 연결한다.",
    "- sampleMeetingFiles → 회의 파일 영역",
    "- sampleParticipants → 참여자 영역",
    "- sampleTranscriptSegments → 중앙 작업 공간/스크립트 영역",
    "- sampleMeetingSummary → 결과 패널 요약 영역",
    "- sampleDecisions → 결정사항 영역",
    "- sampleActionItems → 할 일 영역",
    "- sampleDraftTimeline → 초안 생성 타임라인 영역",
    "",
    "#### 구현 요구사항 초안",
    ...input.orchestration.acceptanceCriteria.map((item) => `- ${item}`),
    "",
    "#### 검증 기준 초안",
    ...input.orchestration.verificationHints.map((item) => `- ${item}`),
    "",
    ...buildCodeTaskBranchPlanBlockLines(input.orchestration, 4),
    "",
    ...buildCodeTaskFileBoundaryStageOneBlockLines(input.orchestration, 4),
  ];
  if (ctx) {
    lines.push("", ...formatQualityBlockForOrchestration(ctx));
  }
  return lines;
}

function formatQualityBlockForOrchestration(
  ctx: import("@/lib/prototype/codeTaskPromptContext").CodeTaskPromptContextV1,
): string[] {
  const quality = ctx.quality;
  if (!quality) return ["#### 품질 상태", "- ready: unknown"];
  return [
    "#### 품질 상태",
    `- ready: ${String(quality.ready)}`,
    `- missing: ${quality.missing?.length ? quality.missing.join(", ") : "(없음)"}`,
    `- warnings: ${quality.warnings?.length ? quality.warnings.join(", ") : "(없음)"}`,
  ];
}

export function buildCodeTaskBranchPlanBlockLines(
  codeTask: ImplementationCodeTaskV1,
  headingLevel: 3 | 4 = 4,
): string[] {
  const bp = codeTask.branchPlan;
  if (!bp) {
    return [`${"#".repeat(headingLevel)} Branch Plan`, "- Branch Plan: 보정 필요 (branchPlan 없음)"];
  }
  const prefix = "#".repeat(headingLevel);
  const lines = [
    `${prefix} Branch Plan`,
    `- branch group: \`${bp.branchGroup}\``,
    `- 작업 브랜치: \`${bp.workBranch}\``,
    `- 기준 브랜치: \`${bp.baseBranch}\``,
    `- execution mode: \`${bp.executionMode}\``,
  ];
  if (bp.dependsOnBranchGroups?.length) {
    lines.push(`- depends on branch groups: ${bp.dependsOnBranchGroups.map((g) => `\`${g}\``).join(", ")}`);
  }
  const boundary = parseCodeTaskFileBoundaryV1(codeTask.fileBoundary);
  if (boundary?.conflictGroupId) {
    lines.push(`- conflict group: \`${boundary.conflictGroupId}\``);
  }
  return lines;
}

export function buildCodeTaskFileBoundaryStageOneBlockLines(
  codeTask: ImplementationCodeTaskV1,
  headingLevel: 3 | 4 = 4,
): string[] {
  const boundary = parseCodeTaskFileBoundaryV1(codeTask.fileBoundary);
  const prefix = "#".repeat(headingLevel);
  if (!boundary) {
    return [`${prefix} File Boundary`, "- File Boundary: 보정 필요 (fileBoundary 없음)"];
  }
  const sub = "#".repeat(headingLevel + 1);
  const allowed = [...boundary.ownedFiles, ...(boundary.allowedGlobs ?? [])].filter(Boolean);
  const forbidden = [...boundary.forbiddenFiles, ...(boundary.forbiddenGlobs ?? [])].filter(Boolean);
  const shared = boundary.sharedFiles ?? [];

  const lines: string[] = [
    `${prefix} File Boundary`,
    `- boundary confidence: ${boundary.fileBoundaryConfidence ?? "medium"}`,
    "",
    `${sub} 수정 허용 파일`,
  ];
  if (allowed.length) {
    lines.push(...allowed.map((p) => `- \`${p}\``));
  } else {
    lines.push("- (없음)");
  }
  lines.push("", `${sub} 수정 금지 파일`);
  if (forbidden.length) {
    lines.push(...forbidden.map((p) => `- \`${p}\``));
  } else {
    lines.push("- (없음)");
  }
  if (shared.length) {
    lines.push("", `${sub} shared/reference files`, ...shared.map((p) => `- \`${p}\``));
  }
  lines.push(
    "",
    `${sub} 파일 경계 원칙`,
    "- 수정 허용 파일 밖의 기존 파일을 재작성하지 않는다.",
    "- 수정 금지 파일은 생성·수정·삭제하지 않는다.",
    "- 기존 App Shell 구조를 재작성하지 않는다.",
    "- Shell/global 파일 연결이 필요하면 직접 수정하지 말고 `requiresIntegrationChange`에 기록한다.",
  );
  return lines;
}

export type StageOnePromptQualitySummary = Readonly<{
  readonly totalCodeTasks: number;
  readonly branchPlanCount: number;
  readonly fileBoundaryCount: number;
  readonly integrationTaskPresent: boolean;
  readonly readyCount: number;
  readonly warningTaskCount: number;
  readonly warningExamples: readonly string[];
}>;

export function summarizeStageOnePromptQuality(input: {
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly promptContextMap?: CodeTaskPromptContextMapV1 | null;
}): StageOnePromptQualitySummary {
  const tasks = listExecutableCodeTasksFromPlan(input.codeTaskPlan.tasks);
  let branchPlanCount = 0;
  let fileBoundaryCount = 0;
  let readyCount = 0;
  let warningTaskCount = 0;
  const warningExamples: string[] = [];

  for (const ct of tasks) {
    if (codeTaskHasPersistedBranchPlan(ct)) branchPlanCount += 1;
    if (codeTaskHasPersistedFileBoundary(ct)) fileBoundaryCount += 1;
    const ctx = getCodeTaskPromptContextFromMap(input.promptContextMap ?? null, ct.codeTaskId);
    if (ctx?.quality.ready) readyCount += 1;
    if (ctx?.quality.warnings?.length || ctx?.quality.missing?.length) {
      warningTaskCount += 1;
      if (warningExamples.length < 4) {
        const issue = ctx?.quality.missing[0] ?? ctx?.quality.warnings[0];
        if (issue) warningExamples.push(`${ct.codeTaskId}: ${issue}`);
      }
    }
  }

  return {
    totalCodeTasks: tasks.length,
    branchPlanCount,
    fileBoundaryCount,
    integrationTaskPresent: planHasIntegrationWiringCodeTask(tasks),
    readyCount,
    warningTaskCount,
    warningExamples,
  };
}

export function formatStageOnePromptQualitySummaryLines(
  summary: StageOnePromptQualitySummary,
): string[] {
  return [
    "CodeTask 1단계 프롬프트 품질",
    "",
    `전체 CodeTask: ${summary.totalCodeTasks}개`,
    `실행 CodeTask: ${summary.totalCodeTasks}개`,
    `Branch Plan 생성: ${summary.branchPlanCount}개`,
    `File Boundary 생성: ${summary.fileBoundaryCount}개`,
    `Integration Task: ${summary.integrationTaskPresent ? "있음" : "없음"}`,
    `ready CodeTask: ${summary.readyCount}개`,
    `warning CodeTask: ${summary.warningTaskCount}개`,
    ...(summary.warningExamples.length
      ? ["", "충돌 예방 정보가 누락된 CodeTask가 있습니다.", ...summary.warningExamples.map((l) => `- ${l}`)]
      : []),
  ];
}

export function codeTaskPlanHasStageOneBranchPlanCoverage(plan: ImplementationCodeTaskPlanV1): boolean {
  return codeTaskPlanHasBranchPlan(plan);
}

export function groupIdsWithTasks(plan: ImplementationCodeTaskPlanV1): readonly CodeTaskBranchGroupV1[] {
  return DEFAULT_BRANCH_PLAN_EXECUTION_ORDER.filter((g) =>
    plan.tasks.some((t) => t.branchPlan?.branchGroup === g),
  );
}
