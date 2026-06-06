import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { resolveCodeTaskSpecificRole } from "@/lib/prototype/codeTaskPromptRoleResolver";
import { COMMON_COMPONENT_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";

const ALL_COMMON_OWNED = new Set(COMMON_COMPONENT_OWNED_PATTERNS);

export function evaluateCommonBoundarySpecificity(input: {
  readonly codeTask: ImplementationCodeTaskV1;
}): Readonly<{ readonly warnings: readonly string[]; readonly missing: readonly string[] }> {
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: input.codeTask.title,
    codeTaskDescription: input.codeTask.description,
    changeType: input.codeTask.changeType,
  }).roleKind;
  if (!role.startsWith("common_")) {
    return { warnings: [], missing: [] };
  }
  const boundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary);
  if (!boundary) {
    return { warnings: [], missing: ["fileBoundary"] };
  }
  const owned = [...boundary.ownedFiles, ...(boundary.allowedGlobs ?? [])];
  const warnings: string[] = [];
  const missing: string[] = [];

  const overlapsAllCommon = ALL_COMMON_OWNED.size > 0 && [...ALL_COMMON_OWNED].every((p) => owned.includes(p));
  if (overlapsAllCommon || owned.length >= 5) {
    warnings.push("common_boundary_too_broad");
    missing.push("common_boundary_not_role_specific");
  }

  if (role === "common_loading" && owned.some((p) => /ErrorMessage|EmptyState|RetryAction/i.test(p))) {
    warnings.push("common_boundary_not_role_specific");
  }
  if (role === "common_error" && owned.some((p) => /LoadingState|EmptyState|RetryAction/i.test(p))) {
    warnings.push("common_boundary_not_role_specific");
  }
  if (role === "common_empty" && owned.some((p) => /LoadingState|ErrorMessage|RetryAction/i.test(p))) {
    warnings.push("common_boundary_not_role_specific");
  }
  if (role === "common_retry" && owned.some((p) => /LoadingState|ErrorMessage|EmptyState/i.test(p))) {
    warnings.push("common_boundary_not_role_specific");
  }

  return { warnings: [...new Set(warnings)], missing: [...new Set(missing)] };
}
