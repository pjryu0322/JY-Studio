import { describe, expect, it } from "vitest";
import { buildQuickDesignImplementationReadyChatMessage } from "@/lib/requirements/quickDesignConfirmArtifacts";
import type { QuickDesignConfirmImplementationPrepResult } from "@/lib/requirements/quickDesignConfirmImplementationPrep";

const NOW = "2026-06-01T00:00:00.000Z";

function prepBase(overrides: Partial<QuickDesignConfirmImplementationPrepResult>): QuickDesignConfirmImplementationPrepResult {
  return {
    orchestration: { version: 1, projectId: "p1", updatedAt: NOW, slots: {} } as never,
    implementationSeedV1: {
      version: 1,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      lifecycleStatus: "confirmed",
      readiness: { ready: true, missing: [] },
      processImplementationItems: [],
      screenImplementationItems: [],
      actorCapabilityMatrix: [],
      commonDetailFeatures: [],
      dataAndMockPolicy: [],
    } as never,
    implementationTaskListV1: {
      version: 1,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed_v1",
      tasks: [],
      roleSummary: { developer: 0, designer: 0, reviewer: 0, security: 0, scm: 0 },
    } as never,
    implementationCodeTaskPlanV1: {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list",
      parentTaskCount: 1,
      codeTaskCount: 55,
      tasks: [{ codeTaskId: "CODE-1", parentTaskId: "DEV-1", refinementSource: "llm" } as never],
      readiness: { ready: true, missing: [] },
      refinementStatus: "llm_refined",
      validationReport: { status: "passed", checkedAt: NOW, errors: [], warnings: [] },
      llmRefinementSummary: {
        totalBatches: 14,
        llmRefinedBatches: 14,
        fallbackBatches: 0,
        llmRefinedTaskCount: 55,
        fallbackTaskCount: 0,
      },
    } as never,
    cursorWorkItemsV1: [{ id: "wi-1" } as never],
    implementationWorkItemPreflightSummaryV1: {
      version: "implementation_work_item_preflight_summary_v1",
      projectId: "p1",
      checkedAt: NOW,
      status: "passed",
      workItemCount: 1,
      failedWorkItemIds: [],
      failedReasons: [],
    } as never,
    codeTaskPromptContextMapV1: null,
    implementationCodeTaskQualityGateV1: {
      version: "implementation_code_task_quality_gate_v1",
      projectId: "p1",
      checkedAt: NOW,
      status: "passed",
      issueCount: 0,
      errorCount: 0,
      warningCount: 0,
      issues: [],
    } as never,
    readiness: { ready: true, missing: [], missingRequired: [] } as never,
    lifecycleStatus: "confirmed" as never,
    autoCandidateGenerated: false,
    autoConfirmedRequired: true,
    touchedGapKeys: [],
    chipLabels: [],
    prepComplete: true,
    postConfirmState: { seedReady: true, designOk: true, envOk: true, hasReferenceArtifacts: true } as never,
    timelineEntries: [],
    ...overrides,
  };
}

describe("buildQuickDesignImplementationReadyChatMessage readiness summary", () => {
  it("adds ready summary lines without internal operational strings", () => {
    const msg = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1"],
      artifactTitles: ["프로젝트 요약서"],
      nowIso: NOW,
      prep: prepBase({
        implementationTaskListV1: {
          version: 1,
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          source: "implementation_seed_v1",
          tasks: [{ taskId: "DEV-1" } as never],
          roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
        } as never,
      }),
    });
    expect(msg.content).toContain("구현 준비가 완료되었습니다.");
    expect(msg.content).toContain("상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.");
    expect(msg.content).not.toContain("CodeTask LLM 정제:");
    expect(msg.content).not.toContain("Fallback");
    expect(msg.content).not.toContain("병렬 처리");
    expect(msg.meta?.implementationPreparationDiagnosticsText).toContain("CodeTask LLM 정제:");
    expect(msg.meta?.implementationPreparationDiagnosticsText).toContain("전체 CodeTask: 55개");
    expect(msg.content).toContain("구현 준비 정보:");
    expect(msg.content).toContain("CodeTask:");
    expect(msg.content).not.toMatch(/생성된 산출물:\n\n-/);
    expect(msg.content).not.toMatch(/구현 준비 정보:\n\n-/);
    expect(msg.content).not.toContain("Validation");
    expect(msg.content).not.toContain("Preflight");
    expect(msg.content).not.toContain("LLM Refinement");
    expect(msg.content).not.toContain("heuristic only");
    expect(msg.content).not.toContain("위험 CodeTask");
  });

  it("adds compact artifact and prep bullet sections", () => {
    const msg = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1", "a2"],
      artifactTitles: ["프로젝트 요약서", "프로토타입 기획안"],
      nowIso: NOW,
      prep: prepBase({
        implementationTaskListV1: {
          version: 1,
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          source: "implementation_seed_v1",
          tasks: [{ taskId: "DEV-1" } as never],
          roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
        } as never,
      }),
    });
    expect(msg.content).toContain("생성된 산출물:\n- 프로젝트 요약서\n- 프로토타입 기획안");
    expect(msg.content).not.toMatch(/- 프로젝트 요약서\n\n-/);
    expect(msg.content).toContain("이제 구현단계에서 실행할 CodeTask를 선택할 수 있습니다.");
  });

  it("adds warning summary line when quality gate is warning", () => {
    const msg = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1"],
      artifactTitles: ["프로젝트 요약서"],
      nowIso: NOW,
      prep: prepBase({
        implementationTaskListV1: {
          version: 1,
          projectId: "p1",
          createdAt: NOW,
          updatedAt: NOW,
          source: "implementation_seed_v1",
          tasks: [{ taskId: "DEV-1" } as never],
          roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
        } as never,
        implementationCodeTaskQualityGateV1: {
          version: "implementation_code_task_quality_gate_v1",
          projectId: "p1",
          checkedAt: NOW,
          status: "warning",
          issueCount: 1,
          errorCount: 0,
          warningCount: 1,
          issues: [
            {
              codeTaskId: "CODE-1",
              parentTaskId: "DEV-1",
              severity: "warning",
              issueCode: "missing_test_task",
              message: "test task missing",
            },
          ],
        } as never,
      }),
    });
    expect(msg.content).toContain("구현 준비가 완료되었습니다.");
    expect(msg.content).toContain("주의 항목 1개가 있지만 구현단계 진행은 가능합니다.");
  });

  it("adds blocked summary lines when readiness is not executable", () => {
    const msg = buildQuickDesignImplementationReadyChatMessage({
      artifactIds: ["a1"],
      artifactTitles: ["프로젝트 요약서"],
      nowIso: NOW,
      prep: prepBase({
        implementationTaskListV1: null,
        implementationCodeTaskPlanV1: null,
        cursorWorkItemsV1: null,
        implementationWorkItemPreflightSummaryV1: null,
        implementationCodeTaskQualityGateV1: null,
      }),
    });
    expect(msg.content).toContain("구현 준비 보완이 필요합니다.");
    expect(msg.content).toContain("상세 내용은 로그 탭의 실행 로그에서 확인할 수 있습니다.");
  });
});

