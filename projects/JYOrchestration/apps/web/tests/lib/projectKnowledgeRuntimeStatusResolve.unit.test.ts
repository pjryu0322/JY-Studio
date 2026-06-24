import { describe, expect, it } from "vitest";
import {
  knowledgeRuntimeStatusLabel,
  resolveKnowledgeRuntimeStatus,
} from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusResolve";

describe("resolveKnowledgeRuntimeStatus", () => {
  it("returns PREPARING when graph is empty and no pipeline", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 0,
        pipelineStatus: null,
        hasPipelineRun: false,
        pendingReviewCandidateCount: 0,
      }),
    ).toBe("PREPARING");
  });

  it("returns STRUCTURING when pipeline is RUNNING", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 5,
        pipelineStatus: "RUNNING",
        hasPipelineRun: true,
        pendingReviewCandidateCount: 0,
      }),
    ).toBe("STRUCTURING");
  });

  it("returns ERROR when pipeline FAILED", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 3,
        pipelineStatus: "FAILED",
        hasPipelineRun: true,
        pendingReviewCandidateCount: 0,
      }),
    ).toBe("ERROR");
  });

  it("returns NEEDS_REVIEW when pending candidates exist", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 0,
        pipelineStatus: "COMPLETED",
        hasPipelineRun: true,
        pendingReviewCandidateCount: 2,
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("returns READY when graph has nodes and no higher priority state", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 12,
        pipelineStatus: "COMPLETED",
        hasPipelineRun: true,
        pendingReviewCandidateCount: 0,
      }),
    ).toBe("READY");
  });

  it("prioritizes ERROR over NEEDS_REVIEW", () => {
    expect(
      resolveKnowledgeRuntimeStatus({
        nodeCount: 1,
        pipelineStatus: "FAILED",
        hasPipelineRun: true,
        pendingReviewCandidateCount: 3,
      }),
    ).toBe("ERROR");
  });
});

describe("knowledgeRuntimeStatusLabel", () => {
  it("maps READY to user-facing label", () => {
    expect(knowledgeRuntimeStatusLabel("READY")).toBe("구조화 완료");
  });
});
