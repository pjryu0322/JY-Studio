import { parseCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { DATA_BRANCH_OWNED_PATTERNS } from "@/lib/prototype/codeTaskDataBoundaryNormalization";
import type { CodeTaskFileConflictIssueV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import {
  branchGroupLabelKo,
  findOwnedForbiddenInternalOverlaps,
  isDataBranchOwnedPattern,
  listShellGlobalOwnedViolations,
  patternIsShellOrGlobalRestricted,
} from "@/lib/prototype/codeTaskFileOwnershipPolicy";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  parseCodeTaskBranchPlanV1,
  type CodeTaskBranchGroupV1,
} from "@/lib/prototype/implementationBranchPlan";

export type CodeTaskFileBoundaryExecutionBlockCode =
  | "blocked_missing_branch_plan"
  | "blocked_missing_file_boundary"
  | "blocked_missing_branch_group"
  | "shell_global_files_owned_by_non_owner_group"
  | "owned_forbidden_overlap";

export type CodeTaskFileBoundaryExecutionGateResultV1 =
  | Readonly<{ readonly ok: true }>
  | Readonly<{
      readonly ok: false;
      readonly code: CodeTaskFileBoundaryExecutionBlockCode;
      readonly branchGroup?: CodeTaskBranchGroupV1;
      readonly violationFiles: readonly string[];
    }>;

export function evaluateCodeTaskFileBoundaryForExecution(input: {
  readonly codeTaskId: string;
  readonly branchGroup: CodeTaskBranchGroupV1;
  readonly changeType?: string | null;
  readonly ownedFiles: readonly string[];
  readonly allowedFiles: readonly string[];
  readonly forbiddenFiles: readonly string[];
  readonly forbiddenGlobs?: readonly string[];
  readonly allowedGlobs?: readonly string[];
  readonly conflictGroupId?: string | null;
}): CodeTaskFileBoundaryExecutionGateResultV1 {
  void input.codeTaskId;
  void input.changeType;
  void input.conflictGroupId;

  const overlapFiles = findOwnedForbiddenInternalOverlaps({
    branchGroup: input.branchGroup,
    ownedFiles: input.ownedFiles,
    allowedFiles: input.allowedFiles,
    forbiddenFiles: input.forbiddenFiles,
    forbiddenGlobs: input.forbiddenGlobs,
    allowedGlobs: input.allowedGlobs,
  });
  if (overlapFiles.length) {
    return {
      ok: false,
      code: "owned_forbidden_overlap",
      branchGroup: input.branchGroup,
      violationFiles: overlapFiles,
    };
  }

  const shellViolations = listShellGlobalOwnedViolations({
    branchGroup: input.branchGroup,
    ownedFiles: input.ownedFiles,
  });
  if (shellViolations.length) {
    return {
      ok: false,
      code: "shell_global_files_owned_by_non_owner_group",
      branchGroup: input.branchGroup,
      violationFiles: shellViolations,
    };
  }

  return { ok: true };
}

export function evaluateCodeTaskFileBoundaryGateFromTask(
  codeTask: ImplementationCodeTaskV1,
): CodeTaskFileBoundaryExecutionGateResultV1 {
  const branchPlan = parseCodeTaskBranchPlanV1(codeTask.branchPlan);
  if (codeTask.branchPlan == null || branchPlan == null) {
    return {
      ok: false,
      code: "blocked_missing_branch_plan",
      violationFiles: [],
    };
  }

  const branchGroup = branchPlan.branchGroup;
  if (!branchGroup) {
    return {
      ok: false,
      code: "blocked_missing_branch_group",
      violationFiles: [],
    };
  }

  const boundary = parseCodeTaskFileBoundaryV1(codeTask.fileBoundary);
  if (boundary == null) {
    return {
      ok: false,
      code: "blocked_missing_file_boundary",
      violationFiles: [],
    };
  }

  return evaluateCodeTaskFileBoundaryForExecution({
    codeTaskId: codeTask.codeTaskId,
    branchGroup,
    changeType: codeTask.changeType ?? null,
    ownedFiles: boundary.ownedFiles,
    allowedFiles: [
      ...boundary.expectedFiles,
    ],
    forbiddenFiles: boundary.forbiddenFiles,
    forbiddenGlobs: boundary.forbiddenGlobs,
    allowedGlobs: boundary.allowedGlobs,
    conflictGroupId: boundary.conflictGroupId ?? null,
  });
}

export function formatCodeTaskFileBoundaryExecutionBlockMessage(
  result: Extract<CodeTaskFileBoundaryExecutionGateResultV1, { ok: false }>,
): string {
  switch (result.code) {
    case "blocked_missing_branch_plan":
      return "CodeTask Branch Plan이 없어 Cursor 실행을 차단했습니다.\n조치: 구현 보드에서 Branch Plan/File Boundary 보정을 실행하세요.";
    case "blocked_missing_branch_group":
      return "CodeTask branch group이 없어 Cursor 실행을 차단했습니다.\n조치: Branch Plan/File Boundary 보정을 실행하세요.";
    case "blocked_missing_file_boundary":
      return "CodeTask File Boundary가 없어 Cursor 실행을 차단했습니다.\n조치: Branch Plan/File Boundary 보정을 실행하세요.";
    case "owned_forbidden_overlap": {
      const files = result.violationFiles.slice(0, 8).join("\n- ");
      return [
        "CodeTask 파일 경계가 충돌합니다.",
        "동일 파일이 수정 허용/소유 파일과 수정 금지 파일에 동시에 포함되어 있습니다.",
        files ? `충돌 파일:\n- ${files}` : "",
        "조치: Branch Plan/File Boundary 보정을 실행하세요.",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "shell_global_files_owned_by_non_owner_group": {
      const group = result.branchGroup ? branchGroupLabelKo(result.branchGroup) : "unknown";
      const shellOnlyViolations = result.violationFiles.filter((f) =>
        patternIsShellOrGlobalRestricted(f),
      );
      const files = shellOnlyViolations.slice(0, 8).join("\n- ");
      if (result.branchGroup === "data") {
        const dataExamples = DATA_BRANCH_OWNED_PATTERNS.slice(0, 4).join("\n- ");
        return [
          "Data CodeTask 파일 경계에 App Shell 소유 파일이 ownedFiles/allowedFiles로 포함되어 실행을 차단했습니다.",
          `branch group: ${group}`,
          files ? `위반 파일:\n- ${files}` : "",
          "허용되는 data 파일 예:",
          dataExamples ? `- ${dataExamples}` : "",
          "조치: data CodeTask ownedFiles에는 src/data/** 계열만 남기세요. App Shell 파일은 forbiddenFiles에만 두세요.",
        ]
          .filter(Boolean)
          .join("\n");
      }
      return [
        "CodeTask 파일 경계 위반으로 Cursor 실행을 차단했습니다.",
        `branch group: ${group}`,
        files ? `위반 파일:\n- ${files}` : "",
        `사유:\n${group} task는 App Shell/global 파일을 직접 수정할 수 없습니다.`,
        "필요한 연결은 requiresIntegrationChange에 기록하고 integration task에서 처리하세요.",
      ]
        .filter(Boolean)
        .join("\n");
    }
    default:
      return "CodeTask 파일 경계 검사에 실패했습니다.";
  }
}

export function formatCodeTaskFileConflictCrossTaskBlockMessage(
  issues: readonly CodeTaskFileConflictIssueV1[],
  executingBranchGroup: CodeTaskBranchGroupV1 | null,
): string {
  const ownedOverlap = issues.filter((i) => i.reason === "owned_file_overlap" || i.reason === "shared_shell_file");
  if (ownedOverlap.length) {
    const files = [...new Set(ownedOverlap.map((i) => i.filePath))].slice(0, 8);
    const taskIds = [...new Set(ownedOverlap.flatMap((i) => i.codeTaskIds))].slice(0, 6);
    return [
      "CodeTask 파일 소유권이 충돌하여 실행을 차단했습니다.",
      "동일 파일을 여러 CodeTask가 ownedFiles로 소유합니다.",
      files.length ? `충돌 파일:\n- ${files.join("\n- ")}` : "",
      taskIds.length ? `관련 CodeTask:\n- ${taskIds.join("\n- ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const files = [
    ...new Set(
      issues
        .map((i) => i.filePath)
        .filter((f) => !(executingBranchGroup === "data" && isDataBranchOwnedPattern(f))),
    ),
  ].slice(0, 8);
  const groupLine = executingBranchGroup ? `branch group: ${executingBranchGroup}` : "";
  const shellMixedInData =
    executingBranchGroup === "data" &&
    files.some((f) => patternIsShellOrGlobalRestricted(f));
  if (shellMixedInData) {
    const dataExamples = DATA_BRANCH_OWNED_PATTERNS.slice(0, 4).join("\n- ");
    return [
      "Data CodeTask 파일 경계에 App Shell 소유 파일이 ownedFiles/allowedFiles로 포함되어 실행을 차단했습니다.",
      groupLine,
      files.length ? `위반 파일:\n- ${files.join("\n- ")}` : "",
      "허용되는 data 파일 예:",
      dataExamples ? `- ${dataExamples}` : "",
      "조치: data CodeTask ownedFiles에는 src/data/** 계열만 남기세요.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "CodeTask 파일 경계가 다른 Task와 충돌하여 Cursor 실행을 차단했습니다.",
    groupLine,
    files.length ? `관련 파일:\n- ${files.join("\n- ")}` : "",
    "조치: dependency·conflict group을 정리하거나 Branch Plan/File Boundary 보정을 실행하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}
