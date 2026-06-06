import {
  filePathPatternsOverlap,
  pathMatchesAnyPattern,
  type CodeTaskFileBoundaryV1,
} from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

export type CodeTaskFileConflictIssueV1 = Readonly<{
  readonly issueId: string;
  readonly severity: "info" | "warning" | "blocking";
  readonly filePath: string;
  readonly codeTaskIds: readonly string[];
  readonly reason:
    | "owned_file_overlap"
    | "expected_file_overlap"
    | "forbidden_file_violation"
    | "shared_shell_file"
    | "global_style_overlap";
  readonly recommendation:
    | "merge_into_composite_task"
    | "add_dependency"
    | "restrict_file_boundary"
    | "create_integration_task";
}>;

export type CodeTaskConflictGroupPolicy = "sequential" | "composite" | "integration_only";

export type CodeTaskConflictGroupV1 = Readonly<{
  readonly groupId: string;
  readonly title: string;
  readonly codeTaskIds: readonly string[];
  readonly sharedFiles: readonly string[];
  readonly policy: CodeTaskConflictGroupPolicy;
}>;

export type CodeTaskDependencyPatchV1 = Readonly<{
  readonly codeTaskId: string;
  readonly addDependencies: readonly string[];
  readonly reason: string;
}>;

export type CodeTaskConflictPlanV1 = Readonly<{
  readonly issues: readonly CodeTaskFileConflictIssueV1[];
  readonly conflictGroups: readonly CodeTaskConflictGroupV1[];
  readonly dependencyPatches: readonly CodeTaskDependencyPatchV1[];
}>;

function isShellPattern(path: string): boolean {
  return pathMatchesAnyPattern(path, WORKSPACE_SHELL_OWNED_PATTERNS);
}

function ownedPatterns(task: ImplementationCodeTaskV1): readonly string[] {
  const b = task.fileBoundary;
  if (!b) return [];
  return [...b.ownedFiles, ...(b.allowedGlobs ?? [])];
}

function expectedPatterns(task: ImplementationCodeTaskV1): readonly string[] {
  const b = task.fileBoundary;
  if (!b) return [];
  return [...b.expectedFiles, ...b.ownedFiles];
}

function forbiddenPatterns(task: ImplementationCodeTaskV1): readonly string[] {
  const b = task.fileBoundary;
  if (!b) return [];
  return [...b.forbiddenFiles, ...(b.forbiddenGlobs ?? [])];
}

function hasDependency(from: ImplementationCodeTaskV1, toId: string): boolean {
  const deps = [
    ...(from.dependencies ?? []),
    ...(from.codeTaskDependencies ?? []),
  ];
  return deps.includes(toId);
}

export function buildCodeTaskFileConflictPlan(
  tasks: readonly ImplementationCodeTaskV1[],
): CodeTaskConflictPlanV1 {
  const issues: CodeTaskFileConflictIssueV1[] = [];
  const groupMap = new Map<string, { ids: Set<string>; files: Set<string> }>();
  const dependencyPatches: CodeTaskDependencyPatchV1[] = [];

  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i]!;
      const b = tasks[j]!;
      const aOwned = ownedPatterns(a);
      const bOwned = ownedPatterns(b);
      for (const pa of aOwned) {
        for (const pb of bOwned) {
          if (!filePathPatternsOverlap(pa, pb)) continue;
          const filePath = pa.includes("*") ? pa : pb.includes("*") ? pb : pa;
          const shell = isShellPattern(pa) || isShellPattern(pb);
          issues.push({
            issueId: `owned:${a.codeTaskId}:${b.codeTaskId}:${filePath}`,
            severity: "blocking",
            filePath,
            codeTaskIds: [a.codeTaskId, b.codeTaskId],
            reason: shell ? "shared_shell_file" : "owned_file_overlap",
            recommendation: shell ? "create_integration_task" : "merge_into_composite_task",
          });
          const groupId = shell ? "workspace-shell" : a.fileBoundary?.conflictGroupId ?? "overlap";
          const g = groupMap.get(groupId) ?? { ids: new Set<string>(), files: new Set<string>() };
          g.ids.add(a.codeTaskId);
          g.ids.add(b.codeTaskId);
          g.files.add(filePath);
          groupMap.set(groupId, g);
        }
      }

      for (const pa of expectedPatterns(a)) {
        for (const pb of expectedPatterns(b)) {
          if (!filePathPatternsOverlap(pa, pb)) continue;
          const dup = issues.some(
            (x) =>
              x.severity === "blocking" &&
              x.codeTaskIds.includes(a.codeTaskId) &&
              x.codeTaskIds.includes(b.codeTaskId),
          );
          if (dup) continue;
          issues.push({
            issueId: `expected:${a.codeTaskId}:${b.codeTaskId}:${pa}`,
            severity: "warning",
            filePath: pa,
            codeTaskIds: [a.codeTaskId, b.codeTaskId],
            reason: isShellPattern(pa) ? "global_style_overlap" : "expected_file_overlap",
            recommendation: "add_dependency",
          });
        }
      }

      for (const owned of aOwned) {
        if (forbiddenPatterns(b).some((fb) => filePathPatternsOverlap(owned, fb))) {
          issues.push({
            issueId: `forbidden:${a.codeTaskId}:${b.codeTaskId}:${owned}`,
            severity: "blocking",
            filePath: owned,
            codeTaskIds: [a.codeTaskId, b.codeTaskId],
            reason: "forbidden_file_violation",
            recommendation: "restrict_file_boundary",
          });
        }
      }
    }
  }

  const shellOwners = tasks.filter((t) =>
    ownedPatterns(t).some((p) => isShellPattern(p)),
  );
  if (shellOwners.length > 1) {
    issues.push({
      issueId: "shell:multi-owner",
      severity: "blocking",
      filePath: "src/components/WorkspaceShell.*",
      codeTaskIds: shellOwners.map((t) => t.codeTaskId),
      reason: "shared_shell_file",
      recommendation: "create_integration_task",
    });
  }

  const conflictGroups: CodeTaskConflictGroupV1[] = [...groupMap.entries()].map(
    ([groupId, g]) => ({
      groupId,
      title: groupId === "workspace-shell" ? "Workspace Shell / global layout" : groupId,
      codeTaskIds: [...g.ids],
      sharedFiles: [...g.files],
      policy:
        groupId === "workspace-shell"
          ? ("integration_only" as const)
          : g.ids.size > 2
            ? ("composite" as const)
            : ("sequential" as const),
    }),
  );

  for (const group of conflictGroups) {
    if (group.policy !== "sequential" || group.codeTaskIds.length < 2) continue;
    const ordered = [...group.codeTaskIds];
    for (let k = 1; k < ordered.length; k++) {
      const later = ordered[k]!;
      const earlier = ordered[k - 1]!;
      const task = tasks.find((t) => t.codeTaskId === later);
      if (!task || hasDependency(task, earlier)) continue;
      dependencyPatches.push({
        codeTaskId: later,
        addDependencies: [earlier],
        reason: `conflict group ${group.groupId} sequential policy`,
      });
    }
  }

  return { issues, conflictGroups, dependencyPatches };
}

export function blockingIssuesForCodeTask(
  plan: CodeTaskConflictPlanV1 | null | undefined,
  codeTaskId: string,
): readonly CodeTaskFileConflictIssueV1[] {
  if (!plan) return [];
  return plan.issues.filter(
    (i) => i.severity === "blocking" && i.codeTaskIds.includes(codeTaskId),
  );
}

export function formatCodeTaskFileConflictBlockMessage(
  issues: readonly CodeTaskFileConflictIssueV1[],
): string {
  const files = [...new Set(issues.map((i) => i.filePath))].slice(0, 5);
  return [
    "CodeTask 파일 경계가 불명확하여 Cursor 실행을 차단했습니다.",
    files.length ? `충돌 가능 파일: ${files.join(", ")}` : "",
    "조치: dependency 또는 conflict group을 먼저 정리해야 합니다.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function summarizeCodeTaskConflictRisk(
  boundary: CodeTaskFileBoundaryV1 | null | undefined,
  issues: readonly CodeTaskFileConflictIssueV1[],
  codeTaskId: string,
): Readonly<{
  readonly riskLabel: "낮음" | "보통" | "높음";
  readonly boundaryLabel: string;
  readonly policyLabel: string;
  readonly sharedFileLines: readonly string[];
}> {
  const related = issues.filter((i) => i.codeTaskIds.includes(codeTaskId));
  const blocking = related.filter((i) => i.severity === "blocking");
  const sharedFiles = [
    ...new Set(related.map((i) => i.filePath)),
  ].slice(0, 4);
  return {
    riskLabel: blocking.length ? "높음" : related.length ? "보통" : "낮음",
    boundaryLabel: boundary?.fileBoundaryConfidence === "high" ? "명확" : "추정",
    policyLabel: boundary?.conflictGroupId ? "sequential" : "independent",
    sharedFileLines: sharedFiles,
  };
}
