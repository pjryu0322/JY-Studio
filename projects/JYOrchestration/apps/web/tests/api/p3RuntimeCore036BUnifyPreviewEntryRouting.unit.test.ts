import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveCompletedCodeTaskPreviewPageHeader,
} from "@/lib/prototype/completedCodeTaskPreviewView";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import {
  INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE,
} from "@/lib/prototype/implementationIntegrationErrors";
import {
  evaluateImplementationPreviewEntryState,
  resolveImplementationPreviewIntegratedReady,
  sanitizeIntegratedAppPreviewUrl,
  shouldSuppressImplementationStageNoticeModal,
} from "@/lib/prototype/implementationPreviewEntryPolicy";
import {
  evaluateImplementationPreviewButtonState,
  shouldSuppressIntegrationContinueUserMessage,
} from "@/lib/prototype/implementationPreviewButtonPolicy";
import {
  IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
  type ImplementationPreviewRuntimeV1,
} from "@/lib/prototype/implementationPreviewRuntimeV1";
import { buildImplementationRuntimeSnapshot } from "@/lib/prototype/implementationRuntimeSnapshotBuilder";
import { resolveEffectiveIntegrationSourceBranch } from "@/lib/prototype/integrationEffectiveSourceBranch";

const PID = "p-runtime-core-036b";
const NOW = "2026-06-09T02:00:00.000Z";
const INTEGRATION_BRANCH = "integration/p-036b-20260609";

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, "../../src/components/preview");
const prototypeDir = join(__dirname, "../../src/lib/prototype");

function integratedRuntime(overrides?: Partial<ImplementationPreviewRuntimeV1>): ImplementationPreviewRuntimeV1 {
  return {
    version: IMPLEMENTATION_PREVIEW_RUNTIME_VERSION,
    status: "ready",
    generatedAt: NOW,
    previewUrl: `/projects/${PID}/preview?scope=latest`,
    internalAppPreviewUrl: `/projects/${PID}/preview/app/generated`,
    sourceIntegrationBranch: INTEGRATION_BRANCH,
    openMode: "internal_renderer",
    renderMode: "internal_app",
    sourceScopeVersion: "implementation_preview_scope_v1",
    includedCodeTaskIds: ["CODE-1"],
    excludedCodeTaskIds: [],
    warnings: [],
    errorMessage: null,
    ...overrides,
  };
}

function snapshotIntegratedReady() {
  return buildImplementationRuntimeSnapshot({
    projectId: PID,
    executionUnits: [],
    selectedExecutionUnitIds: [],
    codeTaskRuns: [],
    integrationSteps: [],
    previewRuntime: integratedRuntime(),
  });
}

describe("P3-Runtime-Core-03-6B unify preview entry routing", () => {
  it("1. integratedAppPreviewReady resolves integrated_app_preview mode", () => {
    const snapshot = snapshotIntegratedReady();
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: { ...snapshot, preview: { ...snapshot.preview, integratedAppPreviewReady: true } },
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: true,
    });
    expect(entry.mode).toBe("integrated_app_preview");
    expect(entry.suppressNoticeModal).toBe(true);
  });

  it("2. integrated mode URL uses app path or external URL", () => {
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: snapshotIntegratedReady(),
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: true,
    });
    expect(entry.url).toContain("/preview/app");
  });

  it("3. integrated mode never returns codetask scope URL", () => {
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: snapshotIntegratedReady(),
      previewRuntime: integratedRuntime({
        previewUrl: `/projects/${PID}/preview?scope=latest`,
        internalAppPreviewUrl: null,
        externalPreviewUrl: null,
        appPreviewUrl: null,
      }),
      integratedAppPreviewReady: true,
    });
    expect(entry.url).not.toMatch(/\/preview\?scope=/);
    expect(entry.url).toContain("/preview/app");
  });

  it("4. integrated mode wins over codeTaskPreviewReady", () => {
    const snapshot = snapshotIntegratedReady();
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: {
        ...snapshot,
        preview: {
          ...snapshot.preview,
          integratedAppPreviewReady: true,
          codeTaskPreviewReady: true,
        },
      },
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: true,
      codeTaskPreviewReady: true,
    });
    expect(entry.mode).toBe("integrated_app_preview");
  });

  it("5. failed CodeTask yields disabled entry", () => {
    const snapshot = snapshotIntegratedReady();
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: {
        ...snapshot,
        codeTask: { ...snapshot.codeTask, failed: 2 },
        preview: { ...snapshot.preview, integratedAppPreviewReady: false },
      },
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: false,
    });
    expect(entry.mode).toBe("disabled");
  });

  it("6. sanitizeIntegratedAppPreviewUrl corrects scope preview URL", () => {
    const fixed = sanitizeIntegratedAppPreviewUrl({
      projectId: PID,
      url: `/projects/${PID}/preview?scope=latest`,
    });
    expect(fixed).toBe(`/projects/${encodeURIComponent(PID)}/preview/app?scope=latest`);
  });

  it("7. integrated entry suppresses notice modal", () => {
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: snapshotIntegratedReady(),
      previewRuntime: integratedRuntime(),
      integratedAppPreviewReady: true,
    });
    expect(shouldSuppressImplementationStageNoticeModal({ entry })).toBe(true);
  });

  it("8. codetask preview entry does not suppress notice modal", () => {
    const snapshot = snapshotIntegratedReady();
    const entry = evaluateImplementationPreviewEntryState({
      projectId: PID,
      snapshot: {
        ...snapshot,
        preview: { ...snapshot.preview, integratedAppPreviewReady: false, codeTaskPreviewReady: true },
      },
      previewRuntime: integratedRuntime({
        sourceIntegrationBranch: null,
        internalAppPreviewUrl: null,
        openMode: "scope_summary_fallback",
        renderMode: "scope_summary_fallback",
      }),
      integratedAppPreviewReady: false,
      codeTaskPreviewReady: true,
    });
    expect(entry.mode).toBe("codetask_result_preview");
    expect(entry.suppressNoticeModal).toBe(false);
  });

  it("9. board panel click handler guards integrated URL", () => {
    const src = readFileSync(join(componentsDir, "ImplementationExecutionBoardPanel.tsx"), "utf8");
    expect(src).toContain('previewButtonState.mode === "integrated_app_preview"');
    expect(src).toContain("sanitizeIntegratedAppPreviewUrl");
  });

  it("10. integrated ready board section scope lines omit codetask exclusion", () => {
    const vm = buildImplementationIntegrationBoardSection({
      projectId: PID,
      eligibility: {
        canIntegrate: true,
        included: [],
        excluded: [],
        warnings: [],
        hasAppShell: true,
        hasAnyScreenTask: true,
      },
      integratedPipelineLines: [],
      previewRuntime: integratedRuntime(),
      runtimeSnapshot: {
        ...snapshotIntegratedReady(),
        preview: {
          ...snapshotIntegratedReady().preview,
          integratedAppPreviewReady: true,
        },
      },
    });
    expect(vm.integratedAppPreviewReady).toBe(true);
    expect(vm.scopeDetailLines.join("\n")).not.toContain("이번 Preview는 완료된 CodeTask");
    expect(vm.scopeDetailLines.join("\n")).not.toContain("제외:");
  });

  it("11. runtime ready internal_renderer uses integrated page title", () => {
    const header = resolveCompletedCodeTaskPreviewPageHeader({
      scopeIncludedCount: 15,
      scopeExcludedCount: 1,
      runtime: integratedRuntime(),
      mainMode: "internal_iframe",
    });
    expect(header.title).toBe("실제 앱 Preview");
    expect(header.subtitle).toBeNull();
    expect(header.showScopeDetails).toBe(false);
  });

  it("12. scope_summary_fallback keeps codetask title", () => {
    const header = resolveCompletedCodeTaskPreviewPageHeader({
      scopeIncludedCount: 3,
      scopeExcludedCount: 1,
      runtime: integratedRuntime({ openMode: "scope_summary_fallback", renderMode: "scope_summary_fallback" }),
      mainMode: "scope_summary_fallback",
    });
    expect(header.title).toContain("완료된 CodeTask");
    expect(header.subtitle).toContain("미완료");
  });

  it("13. previewReady suppresses continue toast", () => {
    expect(shouldSuppressIntegrationContinueUserMessage({ previewReady: true })).toBe(true);
  });

  it("14. integrated status uses success user message constant", () => {
    expect(INTEGRATION_APP_PREVIEW_READY_SUCCESS_USER_MESSAGE).toContain("실제 앱 Preview가 준비되었습니다");
  });

  it("15. PrototypePreviewPanel skips notice modal when integrated ready", () => {
    const src = readFileSync(join(componentsDir, "PrototypePreviewPanel.tsx"), "utf8");
    expect(src).toContain("resolveIntegratedAppPreviewReadyFromOrchestration");
    expect(src).toContain("COMPLETED_CODETASK_PREVIEW_NOTICE_SUPPRESSED_LOG_ACTION");
  });

  it("16. runtime internal_app render mode counts as integrated ready signal", () => {
    expect(
      resolveImplementationPreviewIntegratedReady({
        projectId: PID,
        snapshot: snapshotIntegratedReady(),
        previewRuntime: integratedRuntime({ renderMode: "internal_app" }),
      }),
    ).toBe(true);
  });

  it("17. source branch resolver prefers contextSourceBranch", () => {
    const result = resolveEffectiveIntegrationSourceBranch({
      contextSourceBranch: "wip/screen/workspace",
      contextTargetBranch: "wip/integration/final-wiring",
      contextIntegrationBranch: INTEGRATION_BRANCH,
      topologyChainHead: null,
      includedWorkBranches: ["wip/screen/workspace"],
    });
    expect(result.sourceBranch).toBe("wip/screen/workspace");
  });

  it("18. button policy delegates to entry policy", () => {
    const src = readFileSync(join(prototypeDir, "implementationPreviewButtonPolicy.ts"), "utf8");
    expect(src).toContain("evaluateImplementationPreviewEntryState");
  });

  it("19. entry policy module exists", () => {
    const src = readFileSync(join(prototypeDir, "implementationPreviewEntryPolicy.ts"), "utf8");
    expect(src).toContain("evaluateImplementationPreviewEntryState");
    expect(src).toContain("suppressNoticeModal");
  });

  it("20. no prisma changes in preview entry work", () => {
    const src = readFileSync(join(prototypeDir, "implementationPreviewEntryPolicy.ts"), "utf8");
    expect(src).not.toContain("prisma");
  });
});
