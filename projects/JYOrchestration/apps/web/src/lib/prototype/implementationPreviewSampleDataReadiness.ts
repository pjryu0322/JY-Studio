import type { ActualPreviewSampleDataQualityResultV1 } from "@/lib/prototype/actualPreviewSampleDataQualityGate";
import type { ImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";

export type ImplementationPreviewSampleDataReadinessStatus =
  | "not_required"
  | "pending"
  | "ready"
  | "missing"
  | "not_rendered"
  | "wiring_failed"
  | "quality_failed";

export type ImplementationPreviewSampleDataReadinessV1 = Readonly<{
  readonly sampleDataRequired: boolean;
  readonly sampleDataQualityOk: boolean;
  readonly sampleDataRenderedOk: boolean;
  readonly sampleDataStatus: ImplementationPreviewSampleDataReadinessStatus;
  readonly sampleDataIssues: readonly string[];
}>;

export type ImplementationPreviewRuntimeSampleDataGateFieldsV1 = Readonly<{
  readonly sampleDataQualityOk?: boolean;
  readonly sampleDataRenderedOk?: boolean;
  readonly sampleDataStatus?: ImplementationPreviewSampleDataReadinessStatus;
  readonly sampleDataIssues?: readonly string[];
}>;

export function resolveSampleDataRequiredForImplementationPreview(): boolean {
  return true;
}

export function readPreviewRuntimeSampleDataGate(
  runtime: ImplementationPreviewRuntimeV1 | null | undefined,
): ImplementationPreviewSampleDataReadinessV1 | null {
  if (!runtime) return null;
  const r = runtime as ImplementationPreviewRuntimeV1 & ImplementationPreviewRuntimeSampleDataGateFieldsV1;
  if (
    r.sampleDataStatus == null &&
    r.sampleDataRenderedOk == null &&
    r.sampleDataQualityOk == null
  ) {
    return null;
  }
  const sampleDataRequired = resolveSampleDataRequiredForImplementationPreview();
  const status = r.sampleDataStatus ?? "pending";
  return {
    sampleDataRequired,
    sampleDataQualityOk: r.sampleDataQualityOk === true,
    sampleDataRenderedOk: r.sampleDataRenderedOk === true,
    sampleDataStatus: status,
    sampleDataIssues: r.sampleDataIssues ?? [],
  };
}

export function buildPreviewSampleDataReadinessFromQualityResult(input: {
  readonly quality: ActualPreviewSampleDataQualityResultV1;
  readonly renderedOk?: boolean;
  readonly renderedStatus?: ImplementationPreviewSampleDataReadinessStatus;
  readonly renderedIssues?: readonly string[];
}): ImplementationPreviewSampleDataReadinessV1 {
  const sampleDataRequired = resolveSampleDataRequiredForImplementationPreview();
  if (!sampleDataRequired) {
    return {
      sampleDataRequired: false,
      sampleDataQualityOk: true,
      sampleDataRenderedOk: true,
      sampleDataStatus: "not_required",
      sampleDataIssues: [],
    };
  }
  if (!input.quality.ok) {
    const status: ImplementationPreviewSampleDataReadinessStatus =
      input.quality.missing.length > 0 ? "missing" : "quality_failed";
    return {
      sampleDataRequired: true,
      sampleDataQualityOk: false,
      sampleDataRenderedOk: false,
      sampleDataStatus: status,
      sampleDataIssues: [...input.quality.missing, ...input.quality.warning],
    };
  }
  const renderedOk = input.renderedOk === true;
  const status: ImplementationPreviewSampleDataReadinessStatus = renderedOk
    ? "ready"
    : input.renderedStatus ?? "not_rendered";
  return {
    sampleDataRequired: true,
    sampleDataQualityOk: true,
    sampleDataRenderedOk: renderedOk,
    sampleDataStatus: status,
    sampleDataIssues: input.renderedIssues ?? (renderedOk ? [] : ["sample_data_not_rendered_in_preview"]),
  };
}

export function resolveImplementationPreviewSampleDataReadiness(input: Readonly<{
  readonly previewRuntime?: ImplementationPreviewRuntimeV1 | null;
}>): ImplementationPreviewSampleDataReadinessV1 {
  const sampleDataRequired = resolveSampleDataRequiredForImplementationPreview();
  if (!sampleDataRequired) {
    return {
      sampleDataRequired: false,
      sampleDataQualityOk: true,
      sampleDataRenderedOk: true,
      sampleDataStatus: "not_required",
      sampleDataIssues: [],
    };
  }

  const fromRuntime = readPreviewRuntimeSampleDataGate(input.previewRuntime);
  if (fromRuntime) return fromRuntime;

  return {
    sampleDataRequired: true,
    sampleDataQualityOk: false,
    sampleDataRenderedOk: false,
    sampleDataStatus: "pending",
    sampleDataIssues: ["sample_data_gate_not_verified"],
  };
}

export function isImplementationPreviewSampleDataReady(
  readiness: ImplementationPreviewSampleDataReadinessV1,
): boolean {
  if (!readiness.sampleDataRequired) return true;
  return readiness.sampleDataQualityOk && readiness.sampleDataRenderedOk;
}

export function patchPreviewRuntimeSampleDataGate(
  runtime: ImplementationPreviewRuntimeV1,
  gate: ImplementationPreviewSampleDataReadinessV1,
): ImplementationPreviewRuntimeV1 {
  return {
    ...runtime,
    sampleDataQualityOk: gate.sampleDataQualityOk,
    sampleDataRenderedOk: gate.sampleDataRenderedOk,
    sampleDataStatus: gate.sampleDataStatus,
    sampleDataIssues: gate.sampleDataIssues,
  } as ImplementationPreviewRuntimeV1;
}
