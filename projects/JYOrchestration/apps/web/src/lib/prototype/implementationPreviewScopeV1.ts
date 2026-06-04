import type {
  CompletedCodeTaskIntegrationTarget,
  ExcludedCodeTaskIntegrationTarget,
} from "@/lib/prototype/completedCodeTaskIntegrationSelector";

export const IMPLEMENTATION_PREVIEW_SCOPE_VERSION = "implementation_preview_scope_v1" as const;

export type ImplementationPreviewScopeV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_PREVIEW_SCOPE_VERSION;
  readonly generatedAt: string;
  readonly includedCodeTasks: readonly {
    readonly codeTaskId: string;
    readonly taskId: string;
    readonly title: string;
    readonly commitSha?: string | null;
    readonly workBranch?: string | null;
  }[];
  readonly excludedCodeTasks: readonly {
    readonly codeTaskId: string;
    readonly taskId: string;
    readonly title: string;
    readonly status: string;
    readonly reason: string;
  }[];
  readonly warnings: readonly string[];
}>;

export function buildImplementationPreviewScopeV1(input: {
  readonly generatedAt?: string;
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly excluded: readonly ExcludedCodeTaskIntegrationTarget[];
  readonly warnings: readonly string[];
}): ImplementationPreviewScopeV1 {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  return {
    version: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    generatedAt,
    includedCodeTasks: input.included.map((row) => ({
      codeTaskId: row.codeTaskId,
      taskId: row.taskId,
      title: row.title,
      ...(row.commitSha ? { commitSha: row.commitSha } : {}),
      ...(row.workBranch ? { workBranch: row.workBranch } : {}),
    })),
    excludedCodeTasks: input.excluded.map((row) => ({
      codeTaskId: row.codeTaskId,
      taskId: row.taskId,
      title: row.title,
      status: row.status,
      reason: row.reason,
    })),
    warnings: [...input.warnings],
  };
}

export function parseImplementationPreviewScopeV1(
  raw: unknown,
): ImplementationPreviewScopeV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (String(o.version ?? "") !== IMPLEMENTATION_PREVIEW_SCOPE_VERSION) return null;
  const generatedAt = String(o.generatedAt ?? "").trim();
  if (!generatedAt) return null;
  const includedCodeTasks = Array.isArray(o.includedCodeTasks)
    ? o.includedCodeTasks
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const codeTaskId = String(r.codeTaskId ?? "").trim();
          const taskId = String(r.taskId ?? "").trim();
          const title = String(r.title ?? "").trim();
          if (!codeTaskId || !taskId || !title) return null;
          return {
            codeTaskId,
            taskId,
            title,
            ...(typeof r.commitSha === "string" && r.commitSha.trim()
              ? { commitSha: r.commitSha.trim() }
              : {}),
            ...(typeof r.workBranch === "string" && r.workBranch.trim()
              ? { workBranch: r.workBranch.trim() }
              : {}),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
    : [];
  const excludedCodeTasks = Array.isArray(o.excludedCodeTasks)
    ? o.excludedCodeTasks
        .map((row) => {
          if (!row || typeof row !== "object") return null;
          const r = row as Record<string, unknown>;
          const codeTaskId = String(r.codeTaskId ?? "").trim();
          const taskId = String(r.taskId ?? "").trim();
          const title = String(r.title ?? "").trim();
          const status = String(r.status ?? "").trim();
          const reason = String(r.reason ?? "").trim();
          if (!codeTaskId || !taskId || !title) return null;
          return { codeTaskId, taskId, title, status, reason: reason || "unknown" };
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
    : [];
  const warnings = Array.isArray(o.warnings)
    ? o.warnings.map((w) => String(w).trim()).filter(Boolean)
    : [];
  return {
    version: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    generatedAt,
    includedCodeTasks,
    excludedCodeTasks,
    warnings,
  };
}
