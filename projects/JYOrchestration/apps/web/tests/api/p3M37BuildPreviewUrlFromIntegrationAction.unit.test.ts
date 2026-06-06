import { describe, expect, it } from "vitest";
import { buildPreviewFromCompletedCodeTasks } from "@/lib/prototype/buildPreviewFromCompletedCodeTasks";
import { buildImplementationIntegrationBoardSection } from "@/lib/prototype/implementationIntegrationBoardSection";
import {
  getPreviewOpenTarget,
  PRE_INTEGRATION_PREVIEW_HINT,
  PREVIEW_URL_NOT_READY_HINT,
} from "@/lib/prototype/implementationPreviewOpenTarget";
import { buildImplementationPreviewScopeV1 } from "@/lib/prototype/implementationPreviewScopeV1";
import { applyIntegratedPipelineSyncSteps } from "@/lib/prototype/implementationIntegratedPipelineBatch";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { mergePendingImplementationPatchFromOrchestration } from "@/lib/prototype/effectiveImplementationState";

const NOW = "2026-06-04T00:00:00.000Z";

describe("P3-M37 preview url from integration", () => {
  it("shows pre-integration hint instead of url-not-ready when can integrate", () => {
    const target = getPreviewOpenTarget({ runtime: null, canIntegrate: true });
    expect(target.hint).toBe(PRE_INTEGRATION_PREVIEW_HINT);
    expect(target.hint).not.toBe(PREVIEW_URL_NOT_READY_HINT);
  });

  it("board section includes pre-integration preview line", () => {
    const vm = buildImplementationIntegrationBoardSection({
      eligibility: {
        canIntegrate: true,
        included: [{ codeTaskId: "CT-1", title: "Shell" }],
        excluded: [],
        warnings: ["완료된 화면 CodeTask가 없어 Preview에서 확인 가능한 화면이 제한됩니다."],
        hasAppShell: false,
        hasAnyScreenTask: false,
      },
      integratedPipelineLines: [],
      previewScope: null,
      previewRuntime: null,
    });
    expect(vm.preIntegrationPreviewLine).toBe(PRE_INTEGRATION_PREVIEW_HINT);
    expect(vm.summaryLines.some((l) => l.includes("통합을 실행하면 Preview"))).toBe(true);
  });

  it("builds ready preview with internal urls when no external url", () => {
    const scope = buildImplementationPreviewScopeV1({
      generatedAt: NOW,
      included: [{ codeTaskId: "CT-1", taskId: "DEV-1", title: "Shell", commitSha: "abc" }],
      excluded: [],
      warnings: ["완료된 화면 CodeTask가 없어 Preview에서 확인 가능한 화면이 제한됩니다."],
    });
    const built = buildPreviewFromCompletedCodeTasks({
      projectId: "p1",
      previewScope: scope,
      nowIso: NOW,
    });
    expect(built.ok).toBe(true);
    expect(built.runtime.status).toBe("ready");
    expect(built.previewUrl).toContain("/projects/p1/preview?scope=latest");
    expect(built.runtime.internalAppPreviewUrl).toContain("/preview/app?scope=latest");
    expect(built.runtime.openMode).toBe("internal_renderer");
  });

  it("pipeline batch produces preview runtime when scope has included tasks", () => {
    const batch = applyIntegratedPipelineSyncSteps({
      projectId: "p1",
      nowIso: NOW,
      orchestration: {
        implementationTaskListV1: {
          version: "implementation_task_list_v1",
          tasks: [{ id: "DEV-1", title: "T", description: "", type: "feature", priority: "P1", status: "ready" }],
        },
        implementationCodeTaskPlanV1: {
          version: "implementation_code_task_plan_v1",
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          tasks: [
            {
              codeTaskId: "CT-1",
              parentTaskId: "DEV-1",
              title: "Shell",
              description: "",
              changeType: "component",
              acceptanceCriteria: [],
              verificationHints: [],
              forbiddenPaths: [],
              priority: "P1",
              status: "completed",
              blockers: [],
            },
          ],
        },
        codeTaskExecutionRunsV1: [
          {
            version: "code_task_execution_run_v1",
            runId: "run-1",
            projectId: "p1",
            processTaskId: "DEV-1",
            workItemId: "wi-1",
            codeTaskId: "CT-1",
            status: "completed",
            attemptNo: 1,
            commitSha: "sha",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    });
    expect(batch.ok).toBe(true);
    if (!batch.ok) return;
    expect(batch.previewScope?.includedCodeTasks.length).toBeGreaterThan(0);
    expect(batch.previewRuntime?.status).toBe("ready");
    expect(batch.previewUrl).toContain("/preview");
  });

  it("persist patch keeps preview runtime fields", () => {
    const merged = buildPrototypeExecutionOrchestrationPersistPatch(
      {},
      {
        implementationPreviewRuntimeV1: {
          version: "implementation_preview_runtime_v1",
          status: "ready",
          previewUrl: "/projects/p1/preview?scope=latest",
          internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
          renderMode: "internal_generated_app",
          openMode: "internal_renderer",
          sourceScopeVersion: "implementation_preview_scope_v1",
          includedCodeTaskIds: ["CT-1"],
          excludedCodeTaskIds: [],
          warnings: [],
        },
      },
    );
    expect(merged.implementationPreviewRuntimeV1?.status).toBe("ready");
  });

  it("pending patch merge includes preview runtime for immediate UI", () => {
    const pending = mergePendingImplementationPatchFromOrchestration({
      implementationPreviewRuntimeV1: {
        version: "implementation_preview_runtime_v1",
        status: "ready",
        previewUrl: "/projects/p1/preview?scope=latest",
        internalAppPreviewUrl: "/projects/p1/preview/app?scope=latest",
        renderMode: "internal_generated_app",
        openMode: "internal_renderer",
        sourceScopeVersion: "implementation_preview_scope_v1",
        includedCodeTaskIds: ["CT-1"],
        excludedCodeTaskIds: [],
        warnings: [],
      },
    });
    expect(pending?.implementationPreviewRuntimeV1?.previewUrl).toContain("/preview");
  });
});
