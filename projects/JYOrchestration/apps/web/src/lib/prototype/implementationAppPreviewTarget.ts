import { buildInternalGeneratedAppPreviewUrl } from "@/lib/prototype/generatedAppPreviewUrlResolver";
import type { CodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { asReadonlyArray } from "@/lib/prototype/implementationIntegrationPlanNormalize";
import { integrationPlanHasSuccessfulMerge } from "@/lib/prototype/implementationIntegrationPlanMergeStatus";
import type {
  ImplementationPreviewRenderModeV1,
  ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isInternalPreviewPath } from "@/lib/prototype/previewUrlClassification";

export type ImplementationAppPreviewBuildStatusV1 =
  | "passed"
  | "failed"
  | "pending"
  | "unknown";

export type ImplementationAppPreviewTargetV1 = Readonly<{
  readonly integrationBranch: string | null;
  readonly appEntryPath: string | null;
  readonly buildStatus: ImplementationAppPreviewBuildStatusV1;
  readonly renderMode: ImplementationPreviewRenderModeV1 | null;
  readonly previewUrl: string | null;
  readonly internalRoute: string | null;
  readonly externalPreviewUrl: string | null;
  readonly includedCodeTaskIds: readonly string[];
  readonly finalWiringCodeTaskId: string | null;
}>;

export function resolveIntegrationPlanBuildStatus(
  plan: CodeTaskIntegrationPlanV1 | null | undefined,
): ImplementationAppPreviewBuildStatusV1 {
  if (!plan) return "pending";
  if (plan.status === "failed" || plan.status === "conflict") return "failed";
  if (plan.checkResult?.status === "failed") return "failed";
  if (plan.checkResult?.status === "passed") return "passed";
  if (integrationPlanHasSuccessfulMerge(plan)) return "passed";
  if (plan.status === "preview_ready" || plan.status === "pr_ready") return "passed";
  return "pending";
}

export function resolveImplementationAppPreviewTarget(input: {
  readonly projectId?: string | null;
  readonly runtime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly finalWiringCodeTaskId?: string | null;
}): ImplementationAppPreviewTargetV1 {
  const runtime = input.runtime ?? null;
  const plan = input.integrationPlan ?? null;
  const integrationBranch =
    String(runtime?.sourceIntegrationBranch ?? plan?.integrationBranch ?? "").trim() || null;
  const internalRoute =
    String(runtime?.internalAppPreviewUrl ?? "").trim() ||
    (runtime?.appPreviewUrl && isInternalPreviewPath(runtime.appPreviewUrl)
      ? String(runtime.appPreviewUrl).trim()
      : "") ||
    (input.projectId?.trim() ? buildInternalGeneratedAppPreviewUrl(input.projectId.trim()) : null);
  const appEntryPath =
    internalRoute && internalRoute.includes("/preview/app") ? internalRoute : internalRoute;
  const externalPreviewUrl = String(runtime?.externalPreviewUrl ?? "").trim() || null;

  return {
    integrationBranch,
    appEntryPath,
    buildStatus: resolveIntegrationPlanBuildStatus(plan),
    renderMode: runtime?.renderMode ?? null,
    previewUrl: String(runtime?.previewUrl ?? "").trim() || null,
    internalRoute: internalRoute || null,
    externalPreviewUrl,
    includedCodeTaskIds: runtime?.includedCodeTaskIds ?? [],
    finalWiringCodeTaskId: input.finalWiringCodeTaskId ?? null,
  };
}

/** Integrated App Preview는 scope chip 목록 fallback이 아닌 실제 app entry 또는 외부 배포 URL만 인정한다. */
export function isIntegratedAppRenderTarget(input: {
  readonly runtime?: ImplementationPreviewRuntimeV1 | null;
  readonly integrationPlan?: CodeTaskIntegrationPlanV1 | null;
  readonly projectId?: string | null;
}): boolean {
  const runtime = input.runtime ?? null;
  if (!runtime || runtime.status !== "ready") return false;
  if (
    runtime.openMode === "scope_summary_fallback" ||
    runtime.renderMode === "scope_summary_fallback"
  ) {
    return false;
  }
  const target = resolveImplementationAppPreviewTarget({
    projectId: input.projectId,
    runtime,
    integrationPlan: input.integrationPlan,
  });
  if (!target.integrationBranch?.trim()) return false;
  if (target.buildStatus !== "passed") return false;
  if (target.externalPreviewUrl) return true;
  return Boolean(target.appEntryPath && target.appEntryPath.includes("/preview/app"));
}
