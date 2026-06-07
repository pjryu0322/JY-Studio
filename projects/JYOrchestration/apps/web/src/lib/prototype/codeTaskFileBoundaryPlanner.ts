import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  resolveCodeTaskSpecificRole,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { normalizeCodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundaryNormalize";
import {
  integrationWiringFileBoundary,
  isIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import {
  mergeFoundationShellOwnedFiles,
  mergeIntegrationWiringOwnedFiles,
} from "@/lib/prototype/codeTaskRouteBoundaryPlanner";
import type { CodeTaskBranchGroupV1 } from "@/lib/prototype/implementationBranchPlan";
import {
  buildFileBoundaryPrincipleLines,
  ROUTE_ENTRY_USAGE_NOTE,
  shouldIncludeRouteEntryUsageNote,
} from "@/lib/prototype/codeTaskDeveloperPromptTemplate";
import {
  resolveCodeTaskCanonicalSlug,
  resolveFeatureFolderForRole,
  resolveScreenComponentFolder,
} from "@/lib/prototype/codeTaskSlug";

export const WORKSPACE_SHELL_OWNED_PATTERNS = [
  "app/index.html",
  "src/components/WorkspaceShell.*",
  "src/components/LeftPanel.*",
  "src/components/CenterPanel.*",
  "src/components/RightPanel.*",
  "src/styles/workspace.*",
  "src/styles/global.*",
] as const;

export const WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS = [...WORKSPACE_SHELL_OWNED_PATTERNS] as const;

export const SAMPLE_DATA_OWNED_PATTERNS = [
  "src/data/sample/*",
  "src/data/samples/*",
  "src/data/mock/*",
  "src/data/meetingDataProvider.*",
  "src/data/types.*",
  "src/fixtures/*",
  "public/sample-data/*",
  "public/mock-data/*",
] as const;

export const COMMON_COMPONENT_OWNED_PATTERNS = [
  "src/components/common/LoadingState.*",
  "src/components/common/Skeleton.*",
  "src/components/common/ErrorMessage.*",
  "src/components/common/EmptyState.*",
  "src/components/common/RetryAction.*",
] as const;

const COMMON_TASK_FORBIDDEN_PATTERNS = [
  "app/index.html",
  "src/App.*",
  "src/routes/*",
  ...WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS,
  "src/data/sample/*",
  "src/features/*",
  "src/screens/*",
  "src/components/screens/*",
] as const;

function commonOwnedFilesForRole(roleKind: CodeTaskRoleKind): readonly string[] {
  switch (roleKind) {
    case "common_loading":
      return ["src/components/common/LoadingState.*", "src/components/common/Skeleton.*"];
    case "common_error":
      return ["src/components/common/ErrorMessage.*", "src/components/common/ErrorState.*"];
    case "common_empty":
      return ["src/components/common/EmptyState.*", "src/components/common/NoResultState.*"];
    case "common_retry":
      return ["src/components/common/RetryAction.*", "src/components/common/RetryButton.*"];
    case "common_permission":
      return ["src/components/common/PermissionDenied.*", "src/components/common/AccessDenied.*"];
    case "common_draft":
      return ["src/components/common/DraftSaveStatus.*", "src/components/common/TemporarySaveHelper.*"];
    default:
      return [...COMMON_COMPONENT_OWNED_PATTERNS];
  }
}

function finalizeBoundary(boundary: CodeTaskFileBoundaryV1): CodeTaskFileBoundaryV1 {
  return normalizeCodeTaskFileBoundaryV1(boundary)!;
}

function shellForbiddenBoundary(): Pick<CodeTaskFileBoundaryV1, "forbiddenFiles" | "forbiddenGlobs"> {
  return {
    forbiddenFiles: [...WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS],
    forbiddenGlobs: ["src/components/WorkspaceShell.*", "src/styles/workspace.*"],
  };
}


export function inferCodeTaskFileBoundary(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly parentTaskTitle?: string | null;
}): CodeTaskFileBoundaryV1 {
  if (isIntegrationWiringCodeTask(input.codeTask)) {
    return integrationWiringFileBoundary();
  }
  const title = input.codeTask.title.trim();
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title ?? input.parentTaskTitle ?? undefined,
    changeType: input.codeTask.changeType,
  }).roleKind;

  return buildFileBoundaryForRole(role, {
    codeTaskId: input.codeTask.codeTaskId,
    title,
  });
}

export function buildFileBoundaryForRole(
  roleKind: CodeTaskRoleKind,
  codeTaskRef: Pick<ImplementationCodeTaskV1, "codeTaskId" | "title"> | string,
): CodeTaskFileBoundaryV1 {
  const title = typeof codeTaskRef === "string" ? codeTaskRef : codeTaskRef.title;
  const codeTaskId = typeof codeTaskRef === "string" ? "" : codeTaskRef.codeTaskId;
  const base = {
    version: CODE_TASK_FILE_BOUNDARY_VERSION,
    fileBoundaryConfidence: "high" as const,
    conflictGroupId: null as string | null,
  };

  switch (roleKind) {
    case "integration_wiring":
      return integrationWiringFileBoundary();
    case "app_shell":
      return finalizeBoundary({
        ...base,
        conflictGroupId: "workspace-shell",
        expectedFiles: mergeFoundationShellOwnedFiles(WORKSPACE_SHELL_OWNED_PATTERNS),
        ownedFiles: mergeFoundationShellOwnedFiles(WORKSPACE_SHELL_OWNED_PATTERNS),
        forbiddenFiles: ["src/data/sample/*", "src/components/common/*"],
        sharedFiles: [],
      });
    case "mock_data":
      return finalizeBoundary({
        ...base,
        expectedFiles: [...SAMPLE_DATA_OWNED_PATTERNS],
        ownedFiles: [...SAMPLE_DATA_OWNED_PATTERNS],
        ...shellForbiddenBoundary(),
        forbiddenFiles: [
          ...shellForbiddenBoundary().forbiddenFiles,
          "src/components/common/*",
        ],
      });
    case "common_loading":
    case "common_error":
    case "common_empty":
    case "common_retry":
    case "common_permission":
    case "common_draft": {
      const owned = commonOwnedFilesForRole(roleKind);
      return finalizeBoundary({
        ...base,
        conflictGroupId: "common-components",
        expectedFiles: owned,
        ownedFiles: owned,
        forbiddenFiles: [...COMMON_TASK_FORBIDDEN_PATTERNS],
        sharedFiles: [],
      });
    }
    case "screen_input":
    case "screen_result":
    case "screen_admin":
    case "feature_start":
    case "feature_input":
    case "feature_processing":
    case "feature_result": {
      const slug = resolveCodeTaskCanonicalSlug({
        codeTaskId,
        title,
        roleKind,
      });
      if (roleKind.startsWith("feature_")) {
        const folder = resolveFeatureFolderForRole(roleKind);
        const owned = [`src/features/${folder}/${slug}.*`];
        return finalizeBoundary({
          ...base,
          expectedFiles: owned,
          ownedFiles: owned,
          ...shellForbiddenBoundary(),
          sharedFiles: ["src/components/WorkspaceShell.*"],
        });
      }
      const screenFolder = resolveScreenComponentFolder(slug);
      const owned = [
        `src/screens/${slug}.*`,
        `src/components/screens/${screenFolder}/*`,
      ];
      return finalizeBoundary({
        ...base,
        expectedFiles: owned,
        ownedFiles: owned,
        ...shellForbiddenBoundary(),
        sharedFiles: ["src/components/WorkspaceShell.*"],
      });
    }
    default: {
      const slug = resolveCodeTaskCanonicalSlug({
        codeTaskId,
        title,
        roleKind,
      });
      const owned = [`src/components/${slug}.*`];
      return finalizeBoundary({
        ...base,
        fileBoundaryConfidence: "medium",
        expectedFiles: owned,
        ownedFiles: owned,
        ...shellForbiddenBoundary(),
      });
    }
  }
}

export function buildCodeTaskFileBoundaryPromptSections(
  boundary: CodeTaskFileBoundaryV1 | null | undefined,
  branchGroup?: CodeTaskBranchGroupV1 | null,
): string[] {
  if (!boundary) return [];
  const allowed = [
    ...boundary.ownedFiles,
    ...(boundary.allowedGlobs ?? []),
  ].filter(Boolean);
  const forbidden = [
    ...boundary.forbiddenFiles,
    ...(boundary.forbiddenGlobs ?? []),
  ].filter(Boolean);
  if (!allowed.length && !forbidden.length) return [];

  const lines: string[] = ["", "## 수정 허용 파일"];
  if (allowed.length) {
    lines.push(...allowed.map((p) => `- ${p}`));
  } else {
    lines.push("- (ownedFiles 없음 — 작업 범위 최소화)");
  }

  if (shouldIncludeRouteEntryUsageNote(branchGroup, allowed)) {
    lines.push("", ROUTE_ENTRY_USAGE_NOTE);
  }

  lines.push("", "## 수정 금지 파일");
  if (forbidden.length) {
    lines.push(...forbidden.map((p) => `- ${p}`));
  } else {
    lines.push("- (명시적 금지 경로 없음 — Shell/global 재작성 금지)");
  }

  lines.push("", "## 파일 경계 원칙", ...buildFileBoundaryPrincipleLines(branchGroup).map((l) => l));
  return lines;
}
