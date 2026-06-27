import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildRequirementsTurnUserMemoryTimelineTraceFields,
  prepareRequirementsTurnKnowledgeContext,
} from "@/lib/requirements/requirementsTurnKnowledgeContext";
import type { PreparedUserProjectKnowledgeMemoryPromptContexts } from "@/lib/project-knowledge/projectKnowledgeUserMemoryUsageRecording";

const buildReferenceMock = vi.fn();
const referenceTimelineMock = vi.fn();
const wrapReferenceMock = vi.fn();
const loadControlMock = vi.fn();
const prepareMemoryMock = vi.fn();
const buildSummariesMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeReferencePromptContext", () => ({
  buildReferencePromptContextForProjectTurn: (...args: unknown[]) => buildReferenceMock(...args),
  referencePromptContextTimelineFields: (...args: unknown[]) => referenceTimelineMock(...args),
  wrapReferenceContextForOrchestrationLlm: (...args: unknown[]) => wrapReferenceMock(...args),
}));

vi.mock("@/lib/project-knowledge/userMemoryFacade", () => ({
  loadUserProjectKnowledgeMemoryControlForProject: (...args: unknown[]) => loadControlMock(...args),
  prepareSameUserProjectKnowledgeMemoryPromptContexts: (...args: unknown[]) => prepareMemoryMock(...args),
  buildUserProjectKnowledgeMemoryTimelineSummaries: (...args: unknown[]) => buildSummariesMock(...args),
}));

describe("requirementsTurnKnowledgeContext", () => {
  beforeEach(() => {
    buildReferenceMock.mockReset();
    referenceTimelineMock.mockReset();
    wrapReferenceMock.mockReset();
    loadControlMock.mockReset();
    prepareMemoryMock.mockReset();
    buildSummariesMock.mockReset();

    referenceTimelineMock.mockReturnValue({ referenceContextInjected: false });
    wrapReferenceMock.mockImplementation((text: string) => `\n[reference_context]\n${text}`);
  });

  it("returns empty reference and user memory without projectId", async () => {
    const ctx = await prepareRequirementsTurnKnowledgeContext({
      projectId: "",
      userId: "u1",
      userMessage: "hello",
    });
    expect(ctx.referencePromptContextBlock).toBe("");
    expect(ctx.userMemoryPrepared).toBeNull();
    expect(ctx.userMemoryTimelineTraceFields).toEqual({});
    expect(buildReferenceMock).not.toHaveBeenCalled();
    expect(loadControlMock).not.toHaveBeenCalled();
  });

  it("loads reference and user memory when projectId is set", async () => {
    buildReferenceMock.mockResolvedValue({
      hasReference: true,
      promptText: "ref body",
    });
    referenceTimelineMock.mockReturnValue({ referenceContextInjected: true, referenceContextMode: "SUMMARY" });
    loadControlMock.mockResolvedValue({
      version: "user_project_knowledge_memory_control_v1",
      enabled: true,
      excludedSourceProjectIds: [],
      ignoredMemoryItemIds: [],
      pinnedMemoryItemIds: [],
    });
    const prepared = {
      byAgent: {},
      totalItemCount: 1,
      sourceProjectCount: 1,
      memoryControlEnabled: true,
    } satisfies PreparedUserProjectKnowledgeMemoryPromptContexts;
    prepareMemoryMock.mockResolvedValue(prepared);
    buildSummariesMock.mockReturnValue([
      {
        kind: "user_project_knowledge_memory_context",
        agent: "planner",
        itemCount: 1,
        sourceProjectCount: 1,
        injected: true,
      },
    ]);

    const ctx = await prepareRequirementsTurnKnowledgeContext({
      projectId: "p1",
      userId: "u1",
      userMessage: "msg",
      bootstrapInterview: false,
    });

    expect(buildReferenceMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", userMessage: "msg" }),
    );
    expect(loadControlMock).toHaveBeenCalledWith("p1");
    expect(prepareMemoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ targetProjectId: "p1", userId: "u1" }),
    );
    expect(ctx.referencePlanningContextBlock).toBe(ctx.referencePromptContextBlock);
    expect(ctx.userMemoryTimelineTraceFields).toHaveProperty("userProjectKnowledgeMemoryContexts");
  });

  it("includes control disabled flag in trace fields", () => {
    const fields = buildRequirementsTurnUserMemoryTimelineTraceFields({
      prepared: {
        byAgent: {},
        totalItemCount: 0,
        sourceProjectCount: 0,
        memoryControlEnabled: false,
      },
      timelineMeta: [],
    });
    expect(fields).toEqual({ userProjectKnowledgeMemoryControlEnabled: false });
  });
});
