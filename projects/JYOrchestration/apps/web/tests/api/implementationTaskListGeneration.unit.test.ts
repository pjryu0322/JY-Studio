import { describe, expect, it } from "vitest";
import { buildGenerateImplementationTaskListFromSeedResult } from "@/lib/prototype/implementationTaskListGeneration";
import { IMPLEMENTATION_GENERATION_REQUEST_CHIP } from "@/lib/requirements/implementationUxLabels";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-29T12:00:00.000Z";

function confirmedSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      { id: "p1", processName: "주문", actors: ["user"], screens: ["s1"], summary: "s" },
    ],
    screenImplementationItems: [
      {
        id: "s1",
        screenName: "목록",
        routeOrEntry: "/list",
        primaryActions: ["조회"],
        dataEntities: [],
        linkedProcesses: [],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: { entities: ["Order"], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    assumptions: [],
    gaps: [],
  };
}

describe("buildGenerateImplementationTaskListFromSeedResult", () => {
  it("creates taskList executionState and cursorWorkItems", () => {
    const result = buildGenerateImplementationTaskListFromSeedResult({
      projectId: "p1",
      seed: confirmedSeed(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.implementationTaskListV1?.tasks.length).toBeGreaterThan(0);
    expect(result.patch.implementationTaskExecutionStateV1?.items.length).toBeGreaterThan(0);
    expect(result.patch.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(result.patch.implementationCodeTaskPlanV1?.codeTaskCount).toBeGreaterThan(0);
    expect(result.patch.implementationWorkItemPreflightSummaryV1?.workItemCount).toBeGreaterThan(0);
    expect(result.alreadyExisted).toBe(false);
    expect(result.userMessage).toBe("구현 준비 산출물을 생성했습니다.");
  });

  it("GENERATE success appends exactly one unified board message", () => {
    const result = buildGenerateImplementationTaskListFromSeedResult({
      projectId: "p1",
      seed: confirmedSeed(),
      envOk: true,
      designOk: true,
      previewReady: false,
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages).toHaveLength(1);
    const boardMessage = result.messages[0]!;
    expect(boardMessage.content).toContain("구현 작업목록이 준비되었습니다");
    expect(boardMessage.content).toContain("작업 요약:");
    expect(boardMessage.content).toContain("전체 작업:");
    expect(boardMessage.content).not.toContain("Quick Design을 다시 확정");
    expect(boardMessage.meta?.interviewSuggestions).toContain(IMPLEMENTATION_GENERATION_REQUEST_CHIP);
  });
});
