import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import {
  inferCodeTaskFileBoundary,
  WORKSPACE_SHELL_OWNED_PATTERNS,
} from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  DEFAULT_BRANCH_PLAN_EXECUTION_ORDER,
  DEFAULT_WORK_BRANCH_BY_GROUP,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";
import { codeTaskPlanHasBranchPlan } from "@/lib/prototype/implementationBranchPlanBuilder";
import { planHasIntegrationWiringCodeTask } from "@/lib/prototype/codeTaskIntegrationWiringTask";
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
  const order = branchPlan?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  const lines: string[] = [
    "## Branch Plan 요약",
    "",
    `- base branch: \`${baseBranch}\``,
    "- 실행 정책: 충돌 예방을 위해 branch group 순차 실행",
    "- 실행 순서:",
  ];
  order.forEach((groupId, index) => {
    const group = branchPlan?.groups.find((g) => g.groupId === groupId);
    const workBranch = group?.workBranch ?? DEFAULT_WORK_BRANCH_BY_GROUP[groupId];
    lines.push(`  ${index + 1}. ${groupId} → \`${workBranch}\``);
  });
  return lines;
}

export function buildBranchPlanGroupListingSections(
  plan: ImplementationCodeTaskPlanV1,
): string[] {
  const order = plan.implementationBranchPlanV1?.executionOrder ?? DEFAULT_BRANCH_PLAN_EXECUTION_ORDER;
  const lines: string[] = ["", "## Branch Group별 CodeTask", ""];
  for (const groupId of order) {
    const inGroup = plan.tasks.filter((t) => t.branchPlan?.branchGroup === groupId);
    if (!inGroup.length) continue;
    lines.push(`### ${groupId}`);
    for (const task of inGroup) {
      lines.push(`- ${task.codeTaskId} — ${task.title}`);
    }
    lines.push("");
  }
  return lines;
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
    `- work branch: \`${bp.workBranch}\``,
    `- base branch: \`${bp.baseBranch}\``,
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
  const boundary =
    parseCodeTaskFileBoundaryV1(codeTask.fileBoundary) ?? inferCodeTaskFileBoundary({ codeTask });
  const prefix = "#".repeat(headingLevel);
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
  const tasks = input.codeTaskPlan.tasks;
  let branchPlanCount = 0;
  let fileBoundaryCount = 0;
  let readyCount = 0;
  let warningTaskCount = 0;
  const warningExamples: string[] = [];

  for (const ct of tasks) {
    if (ct.branchPlan?.workBranch) branchPlanCount += 1;
    if (parseCodeTaskFileBoundaryV1(ct.fileBoundary)) fileBoundaryCount += 1;
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
