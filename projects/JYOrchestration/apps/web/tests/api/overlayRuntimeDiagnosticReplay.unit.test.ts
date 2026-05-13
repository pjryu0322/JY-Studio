/**
 * 진단 API와 동일한 summary helper 조합을 직접 호출해 replay 결과를 검증한다.
 * (HTTP 서버 없이도 안정적으로 검증되도록 helper-level 통합 테스트)
 */
import { describe, expect, it } from "vitest";
import { extractOverlayPromptTraceMetadata } from "@/lib/overlay/overlayPromptTraceExtract";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { summarizeOverlaySelectedContextRefs } from "@/lib/overlay/overlayContextSelection";
import {
  summarizeOverlayContextBudgetMetadata,
  type OverlayContextBudgetSummaryWire,
} from "@/lib/overlay/overlayContextBudget";
import { summarizeOverlayConflictWarnings } from "@/lib/overlay/overlayConflictDetection";

describe("Overlay runtime diagnostic replay (helper-level integration)", () => {
  const baseRow = {
    createdAt: "2026-03-01T00:00:00.000Z",
    action: "requirementsChatOrchestration",
    stage: "ideation",
    source: "llm" as const,
  };

  it("builds non-empty summaries from a fully-populated last promptTrace entry", () => {
    const parsed = parseRequirementsStateJson({
      promptTimeline: [
        {
          ...baseRow,
          overlaySelectedContextRefs: [
            { type: "role", source: "planner", reason: "role_resolved", priority: 0 },
            { type: "memory", source: "project", reason: "role_memory_scope", priority: 10 },
            { type: "knowledge", source: "pack1", reason: "role_knowledge_hint", priority: 20 },
          ],
          overlayContextBudget: {
            budgetPolicy: "balanced",
            overflowRisk: "medium",
            estimatedInputTokens: 2200,
            estimatedOutputTokens: 700,
          },
          overlayConflictWarnings: [
            {
              code: "OVERLAY_CONFLICT_LOCALSTORAGE_VS_JWT",
              severity: "warning",
              category: "storage",
              message: "x",
            },
            {
              code: "OVERLAY_CONFLICT_MONOLITH_VS_MICROSERVICE",
              severity: "info",
              category: "architecture",
              message: "y",
            },
          ],
        },
      ],
    });
    const last = parsed.promptTimeline?.[parsed.promptTimeline.length - 1];
    const extract = extractOverlayPromptTraceMetadata(last!);

    const selectionSummary = summarizeOverlaySelectedContextRefs(
      extract.overlaySelectedContextRefs ?? []
    );
    expect(selectionSummary.selectedContextCount).toBe(3);
    expect(selectionSummary.roleCount).toBe(1);
    expect(selectionSummary.memoryCount).toBe(1);
    expect(selectionSummary.knowledgeHintCount).toBe(1);

    const budgetSummary = summarizeOverlayContextBudgetMetadata(extract.overlayContextBudget);
    expect(budgetSummary.budgetPolicy).toBe("balanced");
    expect(budgetSummary.overflowRisk).toBe("medium");

    const conflictSummary = summarizeOverlayConflictWarnings(extract.overlayConflictWarnings ?? []);
    expect(conflictSummary.warningCount).toBe(1);
    expect(conflictSummary.infoCount).toBe(1);
    expect(conflictSummary.byCategory.storage).toBe(1);
    expect(conflictSummary.byCategory.architecture).toBe(1);
  });

  it("falls back to all-null budget summary and zero-count summaries when no preparation metadata is present", () => {
    const parsed = parseRequirementsStateJson({ promptTimeline: [{ ...baseRow }] });
    const last = parsed.promptTimeline?.[parsed.promptTimeline.length - 1];
    const extract = extractOverlayPromptTraceMetadata(last!);

    const budgetSummary: OverlayContextBudgetSummaryWire = summarizeOverlayContextBudgetMetadata(
      extract.overlayContextBudget
    );
    expect(budgetSummary).toEqual({
      budgetPolicy: null,
      overflowRisk: null,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
    });

    const conflictSummary = summarizeOverlayConflictWarnings(extract.overlayConflictWarnings ?? []);
    expect(conflictSummary.warningCount + conflictSummary.infoCount).toBe(0);

    const selectionSummary = summarizeOverlaySelectedContextRefs(
      extract.overlaySelectedContextRefs ?? []
    );
    expect(selectionSummary.selectedContextCount).toBe(0);
  });
});
