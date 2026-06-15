import { evaluateCodeTaskIntegration } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import type { CodeTaskIntegrationSource } from "@/lib/prototype/implementationCodeTaskIntegrationContext";
import {
  evaluateImplementationPreviewReadiness,
  type ImplementationPreviewReadinessV1,
} from "@/lib/prototype/implementationPreviewReadiness";
import { getPreviewOpenTarget } from "@/lib/prototype/implementationPreviewOpenTarget";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { isIntegrationPreviewRuntimeReady } from "@/lib/prototype/implementationIntegrationButtonPolicy";
import { parseCodeTaskIntegrationPlanV1 } from "@/lib/prototype/implementationIntegrationPlan";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  isImplementationPreviewSampleDataReady,
  resolveImplementationPreviewSampleDataReadiness,
} from "@/lib/prototype/implementationPreviewSampleDataReadiness";

export type ImplementationChatPreviewAccess = Readonly<{
  readonly previewUrl: string | null;
  readonly previewReady: boolean;
  readonly previewOpenTargetReady: boolean;
  readonly readiness: ImplementationPreviewReadinessV1;
}>;

export function resolveImplementationChatPreviewAccess(input: Readonly<{
  readonly projectId: string;
  readonly integrationSource: CodeTaskIntegrationSource;
  readonly requirementsState: RequirementsStateJson;
  readonly controlPlanePreviewReady: boolean;
  readonly controlPlanePreviewUrl: string | null;
}>): ImplementationChatPreviewAccess {
  const previewRuntime =
    parseImplementationPreviewRuntimeV1(input.requirementsState.implementationPreviewRuntimeV1) ?? null;
  const codeTaskPlan = parseImplementationCodeTaskPlanV1(input.requirementsState.implementationCodeTaskPlanV1) ?? null;
  const integrationPlan = parseCodeTaskIntegrationPlanV1(input.requirementsState.codeTaskIntegrationPlanV1) ?? null;
  const eligibility = evaluateCodeTaskIntegration(input.integrationSource);
  const readiness = evaluateImplementationPreviewReadiness({
    projectId: input.projectId,
    codeTaskPlan,
    codeTaskRuns: input.integrationSource.codeTaskRuns ?? null,
    eligibility,
    previewRuntime,
    integrationPlan,
    requirementsState: input.requirementsState,
  });

  const openTarget = getPreviewOpenTarget({ runtime: previewRuntime });
  const previewUrl =
    String(input.controlPlanePreviewUrl ?? "").trim() ||
    String(openTarget.url ?? "").trim() ||
    resolvePreviewUrlFromRuntime(previewRuntime) ||
    null;

  const runtimeReady = isIntegrationPreviewRuntimeReady(previewRuntime);
  const sampleDataReadiness = resolveImplementationPreviewSampleDataReadiness({ previewRuntime });
  const sampleDataReady = isImplementationPreviewSampleDataReady(sampleDataReadiness);
  const previewReady =
    input.controlPlanePreviewReady === true &&
    readiness.integratedAppPreviewReady === true &&
    runtimeReady &&
    sampleDataReady;

  const previewOpenTargetReady = Boolean(openTarget.url?.trim());

  return {
    previewUrl,
    previewReady,
    previewOpenTargetReady,
    readiness,
  };
}

function resolvePreviewUrlFromRuntime(runtime: ImplementationPreviewRuntimeV1 | null): string | null {
  if (!runtime) return null;
  const external = String(runtime.externalPreviewUrl ?? "").trim();
  if (external) return external;
  const internal = String(runtime.internalAppPreviewUrl ?? "").trim();
  if (internal) return internal;
  const wrapper = String(runtime.previewUrl ?? "").trim();
  return wrapper || null;
}
