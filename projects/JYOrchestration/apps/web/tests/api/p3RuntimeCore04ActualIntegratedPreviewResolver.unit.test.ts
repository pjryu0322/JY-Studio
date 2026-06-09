import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildActualIntegratedAppPreviewRuntime,
  resolveActualIntegratedAppPreviewTarget,
} from "@/lib/prototype/actualIntegratedAppPreviewResolver";
import {
  isActualIntegratedAppPreviewRuntime,
  resolveImplementationPreviewRuntimeKindV1,
} from "@/lib/prototype/implementationPreviewRuntimeKind";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { buildPreviewFromCompletedCodeTasks } from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import { IMPLEMENTATION_PREVIEW_SCOPE_VERSION } from "@/lib/prototype/implementationPreviewScopeV1";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stepServicePath = join(
  __dirname,
  "../../src/lib/prototype/implementationAppPreviewTargetStepService.ts",
);

describe("P3-Runtime-Core-04 actual integrated preview resolver", () => {
  it("4. externalPreviewUrl yields actual preview ready target", () => {
    const target = resolveActualIntegratedAppPreviewTarget({
      projectId: "p",
      integrationBranch: "integration/p",
      integrationPlan: null,
      externalPreviewUrl: "https://example.com/app",
    });
    expect(target.ok).toBe(true);
    expect(target.externalPreviewUrl).toBe("https://example.com/app");
    const runtime = buildActualIntegratedAppPreviewRuntime({
      projectId: "p",
      target,
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    expect(isActualIntegratedAppPreviewRuntime({ projectId: "p", runtime })).toBe(true);
  });

  it("5. localPreviewServerUrl yields actual preview ready target", () => {
    const target = resolveActualIntegratedAppPreviewTarget({
      projectId: "p",
      integrationBranch: "integration/p",
      integrationPlan: null,
      localPreviewServerUrl: "http://127.0.0.1:4173/",
    });
    expect(target.ok).toBe(true);
    expect(target.internalPreviewUrl).toContain("127.0.0.1");
  });

  it("integration branch only without URL is not ok", () => {
    const target = resolveActualIntegratedAppPreviewTarget({
      projectId: "p",
      integrationBranch: "integration/p",
      integrationPlan: null,
    });
    expect(target.ok).toBe(false);
  });

  it("6–7. diagnostic runtime kind is not actual integrated ready", () => {
    const scope = {
      version: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      generatedAt: "2026-01-01T00:00:00.000Z",
      includedCodeTasks: [{ codeTaskId: "C1", taskId: "T1", title: "t" }],
      excludedCodeTasks: [],
      warnings: [],
    };
    const built = buildPreviewFromCompletedCodeTasks({
      projectId: "p",
      previewScope: scope,
      nowIso: "2026-01-01T00:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    expect(resolveImplementationPreviewRuntimeKindV1({ projectId: "p", runtime: built.runtime })).toBe(
      "codetask_diagnostic_preview",
    );
    expect(isActualIntegratedAppPreviewRuntime({ projectId: "p", runtime: built.runtime })).toBe(false);
  });

  it("explicit actual runtimeKind counts as actual", () => {
    const runtime: ImplementationPreviewRuntimeV1 = {
      version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
      status: "ready",
      sourceScopeVersion: IMPLEMENTATION_PREVIEW_SCOPE_VERSION,
      renderMode: "external_preview",
      openMode: "external_new_window",
      externalPreviewUrl: "https://deploy.example/app",
      includedCodeTaskIds: [],
      excludedCodeTaskIds: [],
      warnings: [],
      runtimeKind: "actual_integrated_app",
    };
    expect(isActualIntegratedAppPreviewRuntime({ projectId: "p", runtime })).toBe(true);
  });
});

describe("app preview target step service", () => {
  it("1. does not call buildPreviewFromCompletedCodeTasks", () => {
    const src = readFileSync(stepServicePath, "utf8");
    expect(src).not.toContain("buildPreviewFromCompletedCodeTasks");
    expect(src).not.toContain("integrateCompletedCodeTasksForPreview");
    expect(src).toContain("resolveActualIntegratedAppPreviewTarget");
  });
});
