import { filePathPatternsOverlap, pathMatchesAnyPattern } from "@/lib/prototype/codeTaskFileBoundary";
import { isExpectedOwnerForbiddenMirrorOverlap } from "@/lib/prototype/codeTaskFileOwnershipPolicy";
import { parseCodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { boundaryIncludesRouteEntryCandidates } from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
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
    | "peer_forbidden_owner_mirror"
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

function isPeerForbiddenOwnerMirrorBetweenTasks(
  a: ImplementationCodeTaskV1,
  b: ImplementationCodeTaskV1,
  filePath: string,
): boolean {
  const ga = branchGroupOf(a);
  const gb = branchGroupOf(b);
  if (!ga || !gb) return false;
  return (
    isExpectedOwnerForbiddenMirrorOverlap({
      executingBranchGroup: ga,
      peerBranchGroup: gb,
      filePath,
    }) ||
    isExpectedOwnerForbiddenMirrorOverlap({
      executingBranchGroup: gb,
      peerBranchGroup: ga,
      filePath,
    })
  );
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
          const mirror = isPeerForbiddenOwnerMirrorBetweenTasks(a, b, owned);
          issues.push({
            issueId: `forbidden:${a.codeTaskId}:${b.codeTaskId}:${owned}`,
            severity: mirror ? "warning" : "blocking",
            filePath: owned,
            codeTaskIds: [a.codeTaskId, b.codeTaskId],
            reason: mirror ? "peer_forbidden_owner_mirror" : "forbidden_file_violation",
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

function branchGroupOf(task: ImplementationCodeTaskV1 | undefined): string | null {
  return parseCodeTaskBranchPlanV1(task?.branchPlan)?.branchGroup ?? null;
}

function isIntegrationShellPeer(task: ImplementationCodeTaskV1): boolean {
  const group = branchGroupOf(task);
  if (group === "integration") return true;
  if (task.changeType === "integration") return true;
  if (task.codeTaskId === "CODE-DEV-INTEGRATION-001-001") return true;
  return /최종 연결|통합\s*wiring/i.test(task.title.trim());
}

function isFoundationShellPeer(task: ImplementationCodeTaskV1): boolean {
  const group = branchGroupOf(task);
  if (group === "foundation") return true;
  if (isIntegrationShellPeer(task)) return false;
  if (task.fileBoundary?.conflictGroupId === "workspace-shell") return true;
  return false;
}

function isShellOrRouteEntryPath(filePath: string): boolean {
  const p = String(filePath ?? "").trim();
  if (!p) return false;
  if (isShellPattern(p)) return true;
  return boundaryIncludesRouteEntryCandidates([p]);
}

/** Shell·route는 foundation/integration만 소유하고, 다른 Task forbidden에는 의도적으로 등록된다. */
function isExpectedShellForbiddenOverlapForExecute(
  issue: CodeTaskFileConflictIssueV1,
  executing: ImplementationCodeTaskV1,
): boolean {
  if (issue.reason !== "forbidden_file_violation") return false;
  if (!isShellOrRouteEntryPath(issue.filePath)) return false;
  return isFoundationShellPeer(executing) || isIntegrationShellPeer(executing);
}

/** Branch Plan상 Shell/Integration wiring과 겹치는 후보는 단일 CodeTask Cursor 실행에서 차단하지 않는다. */
function isPlannedShellRouteOverlapForExecute(
  issue: CodeTaskFileConflictIssueV1,
  executing: ImplementationCodeTaskV1,
  allTasks: readonly ImplementationCodeTaskV1[],
): boolean {
  const peerTasks = issue.codeTaskIds
    .map((id) => allTasks.find((t) => t.codeTaskId === id))
    .filter((t): t is ImplementationCodeTaskV1 => Boolean(t));
  if (peerTasks.length < 2) return false;

  const onlyFoundationAndIntegration =
    peerTasks.every((p) => isFoundationShellPeer(p) || isIntegrationShellPeer(p)) &&
    peerTasks.some(isFoundationShellPeer) &&
    peerTasks.some(isIntegrationShellPeer);

  if (
    onlyFoundationAndIntegration &&
    (isFoundationShellPeer(executing) || isIntegrationShellPeer(executing)) &&
    (issue.reason === "shared_shell_file" ||
      issue.reason === "owned_file_overlap" ||
      issue.issueId === "shell:multi-owner")
  ) {
    return true;
  }

  if (issue.reason !== "shared_shell_file" && issue.issueId !== "shell:multi-owner") {
    return false;
  }

  const execGroup = branchGroupOf(executing);
  if (execGroup === "foundation" && isFoundationShellPeer(executing)) {
    return peerTasks.every(
      (p) => p.codeTaskId === executing.codeTaskId || isIntegrationShellPeer(p),
    );
  }
  if (isIntegrationShellPeer(executing)) {
    return peerTasks.every(
      (p) =>
        p.codeTaskId === executing.codeTaskId ||
        isFoundationShellPeer(p) ||
        isIntegrationShellPeer(p),
    );
  }
  return false;
}

function isExpectedOwnerForbiddenMirrorOverlapForIssue(
  issue: CodeTaskFileConflictIssueV1,
  executing: ImplementationCodeTaskV1,
  allTasks: readonly ImplementationCodeTaskV1[],
): boolean {
  if (
    issue.reason !== "forbidden_file_violation" &&
    issue.reason !== "peer_forbidden_owner_mirror"
  ) {
    return false;
  }
  const peerIds = issue.codeTaskIds.filter((id) => id !== executing.codeTaskId);
  if (peerIds.length !== 1) return false;
  const peer = allTasks.find((t) => t.codeTaskId === peerIds[0]);
  if (!peer) return false;
  return isExpectedOwnerForbiddenMirrorOverlap({
    executingBranchGroup: branchGroupOf(executing),
    peerBranchGroup: branchGroupOf(peer),
    filePath: issue.filePath,
    executingIsIntegrationWiring: isIntegrationShellPeer(executing),
    peerIsIntegrationWiring: isIntegrationShellPeer(peer),
  });
}

function isExpectedCrossTaskForbiddenOverlapForExecute(
  issue: CodeTaskFileConflictIssueV1,
  executing: ImplementationCodeTaskV1,
  allTasks: readonly ImplementationCodeTaskV1[],
): boolean {
  return isExpectedOwnerForbiddenMirrorOverlapForIssue(issue, executing, allTasks);
}

export type IgnoredCrossForbiddenMirrorDiagnosticV1 = Readonly<{
  readonly executingCodeTaskId: string;
  readonly peerCodeTaskId: string;
  readonly filePath: string;
  readonly reason: string;
}>;

export function listIgnoredCrossForbiddenMirrorsForExecute(input: {
  readonly plan: CodeTaskConflictPlanV1 | null | undefined;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly allTasks: readonly ImplementationCodeTaskV1[];
}): readonly IgnoredCrossForbiddenMirrorDiagnosticV1[] {
  if (!input.plan) return [];
  const out: IgnoredCrossForbiddenMirrorDiagnosticV1[] = [];
  for (const issue of input.plan.issues) {
    if (issue.reason !== "peer_forbidden_owner_mirror") continue;
    if (!issue.codeTaskIds.includes(input.codeTask.codeTaskId)) continue;
    const peerId =
      issue.codeTaskIds.find((id) => id !== input.codeTask.codeTaskId)?.trim() ?? "";
    out.push({
      executingCodeTaskId: input.codeTask.codeTaskId,
      peerCodeTaskId: peerId,
      filePath: issue.filePath,
      reason: issue.reason,
    });
  }
  void input.allTasks;
  return out;
}

export function blockingIssuesForCodeTaskExecute(input: {
  readonly plan: CodeTaskConflictPlanV1 | null | undefined;
  readonly codeTask: ImplementationCodeTaskV1;
  readonly allTasks: readonly ImplementationCodeTaskV1[];
}): readonly CodeTaskFileConflictIssueV1[] {
  const issues = blockingIssuesForCodeTask(input.plan, input.codeTask.codeTaskId);
  return issues.filter(
    (issue) =>
      !isPlannedShellRouteOverlapForExecute(issue, input.codeTask, input.allTasks) &&
      !isExpectedShellForbiddenOverlapForExecute(issue, input.codeTask) &&
      !isExpectedCrossTaskForbiddenOverlapForExecute(issue, input.codeTask, input.allTasks),
  );
}

export function formatCodeTaskFileConflictBlockMessage(
  issues: readonly CodeTaskFileConflictIssueV1[],
): string {
  const files = [...new Set(issues.map((i) => i.filePath))].slice(0, 5);
  const hasShellOverlap = issues.some((i) => i.reason === "shared_shell_file");
  return [
    "CodeTask 파일 경계가 불명확하여 Cursor 실행을 차단했습니다.",
    files.length ? `충돌 가능 파일: ${files.join(", ")}` : "",
    hasShellOverlap
      ? "조치: App Shell 소유 Task(foundation)와 Integration wiring Task의 겹침이 아니라면, 구현 보드에서 Branch Plan/File Boundary 보정을 실행하세요."
      : "조치: dependency 또는 conflict group을 먼저 정리하거나 Branch Plan/File Boundary 보정을 실행하세요.",
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
