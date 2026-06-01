import type {
  ImplementationCodeTaskPlanV1,
  ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";

export const IMPLEMENTATION_CODE_TASK_QUALITY_GATE_VERSION =
  "implementation_code_task_quality_gate_v1" as const;

export type ImplementationCodeTaskQualityIssueSeverity = "info" | "warning" | "error";

export type ImplementationCodeTaskQualityIssueCode =
  | "too_broad"
  | "too_small"
  | "missing_candidate_hints"
  | "missing_test_task"
  | "mixed_change_types"
  | "weak_acceptance_criteria"
  | "weak_verification_hints"
  | "risky_dependency"
  | "unknown";

export type ImplementationCodeTaskQualityIssueV1 = Readonly<{
  readonly codeTaskId: string;
  readonly parentTaskId: string;
  readonly severity: ImplementationCodeTaskQualityIssueSeverity;
  readonly issueCode: ImplementationCodeTaskQualityIssueCode;
  readonly message: string;
}>;

export type ImplementationCodeTaskQualityGateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_CODE_TASK_QUALITY_GATE_VERSION;
  readonly projectId: string;
  readonly checkedAt: string;
  readonly status: "passed" | "warning" | "failed";
  readonly issueCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly issues: readonly ImplementationCodeTaskQualityIssueV1[];
}>;

const BROAD_TERMS = ["전체", "모든", "통합", "전반", "all", "entire", "overall"] as const;
const MIXED_UI_TERMS = ["ui", "화면", "component", "컴포넌트"] as const;
const MIXED_API_TERMS = ["api", "endpoint", "route"] as const;
const MIXED_DB_TERMS = ["db", "database", "schema", "데이터", "entity"] as const;
const MIXED_TEST_TERMS = ["test", "테스트", "spec"] as const;
const GENERIC_ACCEPTANCE = ["완료", "done", "complete", "구현 완료"] as const;
const GENERIC_VERIFICATION = ["확인", "check", "verify"] as const;

function normText(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function containsAny(text: string, terms: readonly string[]): boolean {
  const normalized = normText(text);
  return terms.some((term) => normalized.includes(normText(term)));
}

function countMixedDomains(text: string): number {
  let count = 0;
  if (containsAny(text, MIXED_UI_TERMS)) count += 1;
  if (containsAny(text, MIXED_API_TERMS)) count += 1;
  if (containsAny(text, MIXED_DB_TERMS)) count += 1;
  if (containsAny(text, MIXED_TEST_TERMS)) count += 1;
  return count;
}

function isWeakAcceptanceCriteria(criteria: readonly string[]): boolean {
  if (!criteria.length) return true;
  return criteria.every((item) => {
    const normalized = normText(item);
    return !normalized || GENERIC_ACCEPTANCE.some((term) => normalized === normText(term));
  });
}

function isWeakVerificationHints(hints: readonly string[]): boolean {
  if (!hints.length) return true;
  return hints.every((item) => {
    const normalized = normText(item);
    return !normalized || GENERIC_VERIFICATION.some((term) => normalized === normText(term));
  });
}

function hasWeakCandidateHints(task: ImplementationCodeTaskV1): boolean {
  const hints = task.candidateFileHints ?? [];
  const files = task.candidateFiles ?? [];
  const targets = task.targetHints ?? [];
  const meaningfulHints = hints.filter((hint) => normText(hint).length > 2);
  const meaningfulTargets = targets.filter((target) => {
    const normalized = normText(target);
    return normalized.length > 2 && normalized !== "scope";
  });
  return meaningfulHints.length === 0 && files.length === 0 && meaningfulTargets.length === 0;
}

function tasksAreTooSimilar(a: ImplementationCodeTaskV1, b: ImplementationCodeTaskV1): boolean {
  const aKey = normText(`${a.title}|${a.description}|${(a.acceptanceCriteria ?? []).join("|")}`);
  const bKey = normText(`${b.title}|${b.description}|${(b.acceptanceCriteria ?? []).join("|")}`);
  return aKey.length > 0 && aKey === bKey;
}

function evaluateCodeTaskQualityIssues(input: {
  readonly task: ImplementationCodeTaskV1;
  readonly allTasks: readonly ImplementationCodeTaskV1[];
  readonly knownCodeTaskIds: ReadonlySet<string>;
}): readonly ImplementationCodeTaskQualityIssueV1[] {
  const task = input.task;
  const issues: ImplementationCodeTaskQualityIssueV1[] = [];
  const combinedText = `${task.title} ${task.description}`;
  const hintCount = (task.candidateFileHints ?? []).length;
  const broadTermCount = BROAD_TERMS.filter((term) => containsAny(combinedText, [term])).length;
  const mixedDomains = countMixedDomains(combinedText);

  if (hintCount >= 6 || (mixedDomains >= 3 && hintCount >= 5)) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "error",
      issueCode: "too_broad",
      message: "CodeTask 범위가 과도하게 넓습니다.",
    });
  } else if (hintCount >= 5 || broadTermCount >= 2) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "too_broad",
      message: "CodeTask 범위가 넓을 수 있습니다.",
    });
  }

  if (
    (task.acceptanceCriteria?.length ?? 0) >= 5 &&
    (task.changeType === "unknown" || task.changeType === "component")
  ) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "too_broad",
      message: "acceptanceCriteria가 많지만 changeType이 단일합니다.",
    });
  }

  const siblingTasks = input.allTasks.filter(
    (candidate) =>
      candidate.parentTaskId === task.parentTaskId && candidate.codeTaskId !== task.codeTaskId,
  );
  if (siblingTasks.some((candidate) => tasksAreTooSimilar(task, candidate))) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "too_small",
      message: "같은 parent 아래 유사 CodeTask가 중복됩니다.",
    });
  }

  if (hasWeakCandidateHints(task)) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "missing_candidate_hints",
      message: "candidate hints가 부족합니다.",
    });
  }

  if (mixedDomains >= 3) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "error",
      issueCode: "mixed_change_types",
      message: "하나의 CodeTask에 UI/API/DB/테스트 변경이 섞여 있습니다.",
    });
  }

  if (isWeakAcceptanceCriteria(task.acceptanceCriteria ?? [])) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "error",
      issueCode: "weak_acceptance_criteria",
      message: "acceptanceCriteria가 비어 있거나 일반 문구뿐입니다.",
    });
  }

  if (isWeakVerificationHints(task.verificationHints ?? [])) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "weak_verification_hints",
      message: "verificationHints가 비어 있거나 일반 문구뿐입니다.",
    });
  }

  const dependencyCount =
    (task.parentTaskDependencies?.length ?? 0) + (task.codeTaskDependencies?.length ?? 0);
  const invalidDeps = [...(task.codeTaskDependencies ?? [])].filter(
    (dep) => dep && !input.knownCodeTaskIds.has(dep),
  );
  if (invalidDeps.length) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "error",
      issueCode: "risky_dependency",
      message: `존재하지 않는 codeTaskDependencies: ${invalidDeps.join(", ")}`,
    });
  } else if (dependencyCount > 5) {
    issues.push({
      codeTaskId: task.codeTaskId,
      parentTaskId: task.parentTaskId,
      severity: "warning",
      issueCode: "risky_dependency",
      message: "dependency가 과도하게 많습니다.",
    });
  }

  return issues;
}

export function evaluateImplementationCodeTaskQualityGate(input: {
  readonly projectId: string;
  readonly codeTaskPlan: ImplementationCodeTaskPlanV1;
  readonly nowIso?: string;
}): ImplementationCodeTaskQualityGateV1 {
  const tasks = input.codeTaskPlan.tasks ?? [];
  const knownCodeTaskIds = new Set(tasks.map((task) => task.codeTaskId));
  const issues: ImplementationCodeTaskQualityIssueV1[] = [];

  for (const task of tasks) {
    issues.push(
      ...evaluateCodeTaskQualityIssues({
        task,
        allTasks: tasks,
        knownCodeTaskIds,
      }),
    );
  }

  const parentTaskIds = [...new Set(tasks.map((task) => task.parentTaskId))];
  for (const parentTaskId of parentTaskIds) {
    const hasTestTask = tasks.some(
      (task) => task.parentTaskId === parentTaskId && task.changeType === "test",
    );
    if (!hasTestTask) {
      const sampleTask = tasks.find((task) => task.parentTaskId === parentTaskId);
      if (sampleTask) {
        issues.push({
          codeTaskId: sampleTask.codeTaskId,
          parentTaskId,
          severity: "warning",
          issueCode: "missing_test_task",
          message: "parentTask 아래 test changeType CodeTask가 없습니다.",
        });
      }
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const status: ImplementationCodeTaskQualityGateV1["status"] =
    errorCount > 0 ? "failed" : warningCount > 0 ? "warning" : "passed";

  return {
    version: IMPLEMENTATION_CODE_TASK_QUALITY_GATE_VERSION,
    projectId: input.projectId.trim(),
    checkedAt: input.nowIso ?? new Date().toISOString(),
    status,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
}

export function parseImplementationCodeTaskQualityGateV1(
  raw: unknown,
): ImplementationCodeTaskQualityGateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_CODE_TASK_QUALITY_GATE_VERSION) return null;
  const projectId = String(o.projectId ?? "").trim();
  if (!projectId) return null;
  const issuesRaw = Array.isArray(o.issues) ? o.issues : [];
  const issues: ImplementationCodeTaskQualityIssueV1[] = [];
  for (const item of issuesRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const codeTaskId = String(row.codeTaskId ?? "").trim();
    const parentTaskId = String(row.parentTaskId ?? "").trim();
    if (!codeTaskId || !parentTaskId) continue;
    const severity =
      row.severity === "error" || row.severity === "warning" ? row.severity : "info";
    issues.push({
      codeTaskId,
      parentTaskId,
      severity,
      issueCode: String(row.issueCode ?? "unknown") as ImplementationCodeTaskQualityIssueCode,
      message: String(row.message ?? "").trim() || "unknown issue",
    });
  }
  const status = o.status === "failed" || o.status === "warning" ? o.status : "passed";
  return {
    version: IMPLEMENTATION_CODE_TASK_QUALITY_GATE_VERSION,
    projectId,
    checkedAt: String(o.checkedAt ?? new Date().toISOString()),
    status,
    issueCount: Number(o.issueCount ?? issues.length) || issues.length,
    errorCount: Number(o.errorCount ?? issues.filter((issue) => issue.severity === "error").length),
    warningCount:
      Number(o.warningCount ?? issues.filter((issue) => issue.severity === "warning").length),
    issues,
  };
}
