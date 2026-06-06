import type { CodeTaskFileBoundaryV1 } from "@/lib/prototype/codeTaskFileBoundary";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import {
  resolveCodeTaskSpecificRole,
  type CodeTaskRoleKind,
} from "@/lib/prototype/codeTaskPromptRoleResolver";
import type { ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";

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
  "src/data/meetingDataProvider.*",
  "src/data/types.*",
] as const;

export const COMMON_COMPONENT_OWNED_PATTERNS = [
  "src/components/common/LoadingState.*",
  "src/components/common/Skeleton.*",
  "src/components/common/ErrorMessage.*",
  "src/components/common/EmptyState.*",
  "src/components/common/RetryAction.*",
] as const;

function shellForbiddenBoundary(): Pick<CodeTaskFileBoundaryV1, "forbiddenFiles" | "forbiddenGlobs"> {
  return {
    forbiddenFiles: [...WORKSPACE_SHELL_FORBIDDEN_FOR_OTHERS],
    forbiddenGlobs: ["src/components/WorkspaceShell.*", "src/styles/workspace.*"],
  };
}

function screenSlugFromTitle(title: string): string {
  const t = title.trim();
  const m = t.match(/(?:화면|screen)[:\s·-]*(.+)/i);
  const raw = (m?.[1] ?? t).replace(/[^\p{L}\p{N}]+/gu, "");
  return raw.slice(0, 32) || "Screen";
}

export function inferCodeTaskFileBoundary(input: {
  readonly codeTask: ImplementationCodeTaskV1;
  readonly parentTask?: ImplementationTaskV1 | null;
  readonly parentTaskTitle?: string | null;
}): CodeTaskFileBoundaryV1 {
  const title = input.codeTask.title.trim();
  const role = resolveCodeTaskSpecificRole({
    codeTaskTitle: title,
    codeTaskDescription: input.codeTask.description,
    parentTaskTitle: input.parentTask?.title ?? input.parentTaskTitle ?? undefined,
    changeType: input.codeTask.changeType,
  }).roleKind;

  return buildFileBoundaryForRole(role, title);
}

export function buildFileBoundaryForRole(
  roleKind: CodeTaskRoleKind,
  title: string,
): CodeTaskFileBoundaryV1 {
  const base = {
    version: CODE_TASK_FILE_BOUNDARY_VERSION,
    fileBoundaryConfidence: "high" as const,
    conflictGroupId: null as string | null,
  };

  switch (roleKind) {
    case "app_shell":
      return {
        ...base,
        conflictGroupId: "workspace-shell",
        expectedFiles: [...WORKSPACE_SHELL_OWNED_PATTERNS],
        ownedFiles: [...WORKSPACE_SHELL_OWNED_PATTERNS],
        forbiddenFiles: ["src/data/sample/*", "src/components/common/*"],
        sharedFiles: [],
      };
    case "mock_data":
      return {
        ...base,
        expectedFiles: [...SAMPLE_DATA_OWNED_PATTERNS],
        ownedFiles: [...SAMPLE_DATA_OWNED_PATTERNS],
        ...shellForbiddenBoundary(),
        forbiddenFiles: [
          ...shellForbiddenBoundary().forbiddenFiles,
          "src/components/common/*",
        ],
      };
    case "common_loading":
    case "common_error":
    case "common_empty":
    case "common_retry":
    case "common_permission":
    case "common_draft":
      return {
        ...base,
        conflictGroupId: "common-components",
        expectedFiles: [...COMMON_COMPONENT_OWNED_PATTERNS],
        ownedFiles: [...COMMON_COMPONENT_OWNED_PATTERNS],
        ...shellForbiddenBoundary(),
        forbiddenFiles: [
          ...shellForbiddenBoundary().forbiddenFiles,
        ],
      };
    case "screen_input":
    case "screen_result":
    case "screen_admin":
    case "feature_start":
    case "feature_input":
    case "feature_processing":
    case "feature_result": {
      const slug = screenSlugFromTitle(title);
      const owned = [
        `src/screens/${slug}.*`,
        `src/components/screens/${slug}/*`,
      ];
      return {
        ...base,
        expectedFiles: owned,
        ownedFiles: owned,
        ...shellForbiddenBoundary(),
        sharedFiles: ["src/components/WorkspaceShell.*"],
      };
    }
    default: {
      const slug = screenSlugFromTitle(title);
      const owned = [`src/components/${slug}.*`, `src/screens/${slug}.*`];
      return {
        ...base,
        fileBoundaryConfidence: "medium",
        expectedFiles: owned,
        ownedFiles: owned,
        ...shellForbiddenBoundary(),
      };
    }
  }
}

export function buildCodeTaskFileBoundaryPromptSections(
  boundary: CodeTaskFileBoundaryV1 | null | undefined,
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

  lines.push("", "## 수정 금지 파일");
  if (forbidden.length) {
    lines.push(...forbidden.map((p) => `- ${p}`));
  } else {
    lines.push("- (명시적 금지 경로 없음 — Shell/global 재작성 금지)");
  }

  lines.push(
    "",
    "## 파일 경계 원칙",
    "- 위 허용 파일 밖의 기존 파일을 재작성하지 않는다.",
    "- 수정 금지 파일은 생성·수정·삭제하지 않는다.",
    "- 기존 App Shell 구조를 재작성하지 않는다.",
    "- 필요한 연결이 수정 금지 파일에 필요한 경우, 직접 수정하지 말고 `integration-required` 메모를 남긴다.",
    "- 새 파일은 허용 경로 하위에만 생성한다.",
    "- 이 Task의 목적을 달성하기 위해 forbiddenFiles 수정이 필요하다고 판단되면, 해당 파일을 직접 수정하지 말고 작업 결과에 `requiresIntegrationChange`를 기록한다.",
  );
  return lines;
}
