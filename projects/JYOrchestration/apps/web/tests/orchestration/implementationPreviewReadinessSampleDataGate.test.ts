import { describe, expect, it } from "vitest";
import { evaluateImplementationPreviewReadiness } from "@/lib/prototype/implementationPreviewReadiness";
import { IMPLEMENTATION_PREVIEW_RUNTIME_VERSION } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

function runtimeWithSampleGate(input: {
  readonly qualityOk: boolean;
  readonly renderedOk: boolean;
  readonly status: string;
}) {
  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready" as const,
    sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
    renderMode: "external_preview" as const,
    openMode: "external_new_window" as const,
    includedCodeTaskIds: [],
    excludedCodeTaskIds: [],
    warnings: [],
    externalPreviewUrl: "https://pages.github.io/demo/app/",
    sourceIntegrationBranch: "integration/demo",
    sampleDataQualityOk: input.qualityOk,
    sampleDataRenderedOk: input.renderedOk,
    sampleDataStatus: input.status,
    sampleDataIssues: [],
  };
}

describe("implementationPreviewReadiness sample data gate", () => {
  const baseInput = {
    projectId: "p1",
    codeTaskPlan: null,
    codeTaskRuns: [],
    eligibility: { canIntegrate: true, included: [], excluded: [], reasons: [] },
    integrationPlan: {
      integrationBranch: "integration/demo",
      status: "completed",
    },
    requirementsState: {},
  } as const;

  it("sampleDataQualityOk=false → integrated_app_preview_ready false", () => {
    const r = evaluateImplementationPreviewReadiness({
      ...baseInput,
      previewRuntime: runtimeWithSampleGate({
        qualityOk: false,
        renderedOk: false,
        status: "missing",
      }),
    });
    expect(r.integratedAppPreviewReady).toBe(false);
    expect(r.sampleDataQualityOk).toBe(false);
  });

  it("sampleDataRenderedOk=false → integrated_app_preview_ready false", () => {
    const r = evaluateImplementationPreviewReadiness({
      ...baseInput,
      previewRuntime: runtimeWithSampleGate({
        qualityOk: true,
        renderedOk: false,
        status: "not_rendered",
      }),
    });
    expect(r.integratedAppPreviewReady).toBe(false);
    expect(r.sampleDataRenderedOk).toBe(false);
    expect(r.mode).not.toBe("integrated_app_preview_ready");
  });

  it("sample quality + rendered ok on runtime → sample flags ready", () => {
    const r = evaluateImplementationPreviewReadiness({
      ...baseInput,
      previewRuntime: runtimeWithSampleGate({
        qualityOk: true,
        renderedOk: true,
        status: "ready",
      }),
    });
    expect(r.sampleDataQualityOk).toBe(true);
    expect(r.sampleDataRenderedOk).toBe(true);
    expect(r.sampleDataStatus).toBe("ready");
  });
});
