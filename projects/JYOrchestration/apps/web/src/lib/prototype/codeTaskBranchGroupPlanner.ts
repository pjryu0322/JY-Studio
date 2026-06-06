import { pathMatchesAnyPattern } from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import type { CodeTaskBranchGroupV1 } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  resolveCodeTaskSpecificRole,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";

export function classifyCodeTaskBranchGroup(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTaskTitle?: string | null;
}): CodeTaskBranchGroupV1 {
  const title = input.codeTask.title.trim();
  const boundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary);
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTaskTitle ?? undefined,
    changeType: input.codeTask.changeType,
  }).roleKind;

  const ownsShell =
    boundary &&
    [...boundary.ownedFiles, ...boundary.expectedFiles].some((p) =>
      pathMatchesAnyPattern(p, WORKSPACE_SHELL_OWNED_PATTERNS),
    );

  if (ownsShell && (role === "app_shell" || /shell|프레임|frame|layout/i.test(title))) {
    return "foundation";
  }

  const group = branchGroupFromRole(role, title, input.codeTask.changeType);
  if (group === "screen" || group === "common" || group === "data" || group === "feature") {
    if (ownsShell) return "integration";
  }
  return group;
}

function branchGroupFromRole(
  role: CodeTaskRoleKind,
  title: string,
  changeType: ImplementationCodeTaskV1["changeType"],
): CodeTaskBranchGroupV1 {
  if (role === "app_shell") return "foundation";
  if (role === "mock_data") return "data";
  if (
    role === "common_loading" ||
    role === "common_error" ||
    role === "common_empty" ||
    role === "common_retry" ||
    role === "common_permission" ||
    role === "common_draft"
  ) {
    return "common";
  }
  if (
    role === "feature_start" ||
    role === "feature_input" ||
    role === "feature_processing" ||
    role === "feature_result"
  ) {
    return "feature";
  }
  if (role === "screen_input" || role === "screen_result" || role === "screen_admin") {
    return "screen";
  }
  if (/integration|연결|wiring|import|route/i.test(title) || changeType === "integration") {
    return "integration";
  }
  if (changeType === "data") return "data";
  if (changeType === "style" && /workspace|shell/i.test(title)) return "foundation";
  if (changeType === "component" && /common/i.test(title)) return "common";
  return "feature";
}

export function projectShortIdForBranch(projectId: string): string {
  return projectId.trim().replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 12) || "project";
}

export function workBranchForGroup(
  group: CodeTaskBranchGroupV1,
  projectId: string,
  useProjectPrefix: boolean,
): string {
  const suffix: Record<CodeTaskBranchGroupV1, string> = {
    foundation: "foundation/app-shell",
    data: "data/sample-data",
    common: "common/components",
    feature: "feature/core-flow",
    screen: "screen/workspace",
    integration: "integration/final-wiring",
  };
  const tail = suffix[group];
  if (useProjectPrefix) {
    return `wip/${projectShortIdForBranch(projectId)}/${tail}`;
  }
  return `wip/${tail}`;
}
