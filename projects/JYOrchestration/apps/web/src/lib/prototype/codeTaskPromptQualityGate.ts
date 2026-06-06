import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { WORKSPACE_SHELL_OWNED_PATTERNS } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { evaluateIntegrationWiringTaskContent } from "@/lib/prototype/integrationWiringContentValidation";
import { evaluateCommonBoundarySpecificity } from "@/lib/prototype/codeTaskCommonBoundaryValidation";
import {
  INTEGRATION_WIRING_PROCESS_TASK_TITLE,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";

export type CodeTaskPromptCollisionReadiness = Readonly<{
  readonly missing: readonly string[];
  readonly warnings: readonly string[];
}>;

function uniq(items: readonly string[]): string[] {
  return [...new Set(items.map((x) => x.trim()).filter(Boolean))];
}

export function evaluateCodeTaskPromptCollisionReadiness(input: {
  readonly codeTask: ImplementationCodeTaskV1;
}): CodeTaskPromptCollisionReadiness {
  const missing: string[] = [];
  const warnings: string[] = [];
  const bp = input.codeTask.branchPlan;

  if (!bp?.workBranch?.trim()) {
    missing.push("branchPlan");
    warnings.push("branch_plan_required");
  }
  if (!bp?.branchGroup) {
    warnings.push("branch_group_required");
  }
  if (!bp?.baseBranch?.trim()) {
    missing.push("baseBranch");
    warnings.push("base_branch_required");
  }

  const boundary = parseCodeTaskFileBoundaryV1(input.codeTask.fileBoundary);
  if (!boundary) {
    missing.push("fileBoundary");
    warnings.push("file_boundary_required");
    return { missing: uniq(missing), warnings: uniq(warnings) };
  }

  const allowed = [...boundary.ownedFiles, ...(boundary.allowedGlobs ?? [])].filter(Boolean);
  const forbidden = [...boundary.forbiddenFiles, ...(boundary.forbiddenGlobs ?? [])].filter(Boolean);

  if (!allowed.length) {
    missing.push("allowedFiles");
    warnings.push("allowed_files_required");
  }
  if (!forbidden.length) {
    missing.push("forbiddenFiles");
    warnings.push("forbidden_files_required");
  }

  const group = bp?.branchGroup;
  const ownsShell = allowed.some((p) =>
    WORKSPACE_SHELL_OWNED_PATTERNS.some((shell) => p.includes(shell.replace("*", ""))),
  );
  if (ownsShell && group !== "foundation" && group !== "integration") {
    warnings.push("shell_global_protection");
    missing.push("shellGlobalPolicy");
  }

  if (isIntegrationWiringCodeTask(input.codeTask)) {
    const content = evaluateIntegrationWiringTaskContent({
      codeTask: input.codeTask,
      processTaskTitle: INTEGRATION_WIRING_PROCESS_TASK_TITLE,
    });
    if (!content.ok) {
      missing.push(...content.issues);
      warnings.push("integration_task_not_final_wiring");
    }
  }

  const commonBoundary = evaluateCommonBoundarySpecificity({ codeTask: input.codeTask });
  if (commonBoundary.missing.length) {
    missing.push(...commonBoundary.missing);
  }
  if (commonBoundary.warnings.length) {
    warnings.push(...commonBoundary.warnings);
  }

  return { missing: uniq(missing), warnings: uniq(warnings) };
}

export function mergePromptContextQualityWithCollisionReadiness(input: {
  readonly base: { readonly ready: boolean; readonly missing: readonly string[]; readonly warnings: readonly string[] };
  readonly collision: CodeTaskPromptCollisionReadiness;
}): { readonly ready: boolean; readonly missing: string[]; readonly warnings: string[] } {
  const missing = uniq([...input.base.missing, ...input.collision.missing]);
  const warnings = uniq([...input.base.warnings, ...input.collision.warnings]);
  const ready = input.base.ready && !missing.length && input.collision.missing.length === 0;
  return { ready, missing, warnings };
}
