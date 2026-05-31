import { describe, expect, it } from "vitest";
import {
  buildExecutionSetupAvailabilityFingerprint,
  buildExecutionSetupAvailabilityTimelineEntry,
} from "@/lib/prototype/cursorExecutionAvailability";
import { isSameImplementationBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import { buildImplementationEntryTimelineEntry } from "@/lib/prototype/implementationEntryState";
import { deriveImplementationEntryState } from "@/lib/prototype/implementationEntryState";
import {
  appendPromptTimelineEntryOnce,
  buildPromptTimelineEntryFingerprint,
} from "@/lib/requirements/promptTimelineState";
import { newRequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-05-28T12:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p-loop",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "업로드",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

describe("promptTimeline dedup", () => {
  it("appendPromptTimelineEntryOnce skips duplicate fingerprint within window", () => {
    const entry = buildExecutionSetupAvailabilityTimelineEntry({
      action: "execution_setup_saved_and_board_refreshed",
      projectId: "p1",
      setup: { gitRepoName: "o/r", hasCursorToken: true, workspacePath: "C:/w" },
      source: "execution_setup_saved",
      nowIso: NOW,
    });
    const fingerprint = buildExecutionSetupAvailabilityFingerprint({
      projectId: "p1",
      action: "execution_setup_saved_and_board_refreshed",
      source: "execution_setup_saved",
      setup: { gitRepoName: "o/r", hasCursorToken: true, workspacePath: "C:/w" },
    });
    const once = appendPromptTimelineEntryOnce([], entry, { fingerprint });
    const twice = appendPromptTimelineEntryOnce(once, entry, { fingerprint });
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
  });

  it("deterministic execution setup timeline uses platform provider", () => {
    const entry = buildExecutionSetupAvailabilityTimelineEntry({
      action: "execution_setup_saved_and_board_refreshed",
      projectId: "p1",
      setup: { hasCursorToken: true },
      source: "execution_setup_saved",
      nowIso: NOW,
    });
    expect(entry.source).toBe("platform");
    expect(entry.provider).toBe("platform");
    expect(entry.model).toBe("deterministic");
  });

  it("bootstrap bundle does not duplicate timeline when promptTimeline already has entries", () => {
    const taskList = sampleTaskList();
    const entryState = deriveImplementationEntryState({
      implementationTaskListV1: taskList,
      cursorWorkItemsV1: [{ id: "wi-1" } as never],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "plan",
          content: "# p",
          createdAt: NOW,
          createdBy: "ai",
          sourceStage: "IDEATION",
        },
      ],
    });
    const existingEntry = buildImplementationEntryTimelineEntry({
      projectId: "p-loop",
      entryState,
      nowIso: NOW,
    });
    const first = buildImplementationBootstrapBundle({
      projectId: "p-loop",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: [],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "plan",
          content: "# p",
          createdAt: NOW,
          createdBy: "ai",
          sourceStage: "IDEATION",
        },
      ],
      artifactOrchestrationV1: null,
      designOk: true,
      implementationTaskListV1: taskList,
      cursorWorkItemsV1: [{ id: "wi-1" } as never],
      promptTimeline: [],
    });
    expect(first.timelineEntries.length).toBeGreaterThan(0);

    const second = buildImplementationBootstrapBundle({
      projectId: "p-loop",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: [],
      projectArtifacts: [
        {
          id: "a1",
          type: "fast_prototype_plan",
          title: "plan",
          content: "# p",
          createdAt: NOW,
          createdBy: "ai",
          sourceStage: "IDEATION",
        },
      ],
      artifactOrchestrationV1: null,
      designOk: true,
      implementationTaskListV1: taskList,
      cursorWorkItemsV1: [{ id: "wi-1" } as never],
      promptTimeline: [existingEntry, ...first.timelineEntries],
    });
    expect(second.timelineEntries).toHaveLength(0);
  });

  it("isSameImplementationBoardMessage compares content and chips", () => {
    const left = newRequirementsMessage({
      id: "a",
      role: "ai",
      content: "board",
      createdAt: NOW,
      meta: { interviewSuggestions: ["chip-a"] },
    });
    const right = newRequirementsMessage({
      id: "b",
      role: "ai",
      content: "board",
      createdAt: NOW,
      meta: { interviewSuggestions: ["chip-a"] },
    });
    const different = newRequirementsMessage({
      id: "c",
      role: "ai",
      content: "board",
      createdAt: NOW,
      meta: { interviewSuggestions: ["chip-b"] },
    });
    expect(isSameImplementationBoardMessage(left, right)).toBe(true);
    expect(isSameImplementationBoardMessage(left, different)).toBe(false);
  });

  it("changed availability fingerprint differs when workspace status changes", () => {
    const base = {
      projectId: "p1",
      action: "execution_setup_saved_and_board_refreshed" as const,
      source: "execution_setup_saved",
    };
    const withWorkspace = buildExecutionSetupAvailabilityFingerprint({
      ...base,
      setup: { hasCursorToken: true, gitRepoName: "o/r", workspacePath: "C:/w" },
    });
    const withoutWorkspace = buildExecutionSetupAvailabilityFingerprint({
      ...base,
      setup: { hasCursorToken: true, gitRepoName: "o/r" },
    });
    expect(withWorkspace).not.toBe(withoutWorkspace);
  });

  it("buildPromptTimelineEntryFingerprint is stable for same responseText", () => {
    const entry = buildExecutionSetupAvailabilityTimelineEntry({
      action: "execution_setup_saved_and_board_refreshed",
      projectId: "p1",
      setup: { hasCursorToken: true },
      source: "execution_setup_saved",
      nowIso: NOW,
    });
    expect(buildPromptTimelineEntryFingerprint(entry)).toBe(buildPromptTimelineEntryFingerprint(entry));
  });

  it("ignores null timeline entries when deduplicating bootstrap append", () => {
    const entry = buildExecutionSetupAvailabilityTimelineEntry({
      action: "execution_setup_saved_and_board_refreshed",
      projectId: "p1",
      setup: { hasCursorToken: true },
      source: "execution_setup_saved",
      nowIso: NOW,
    });
    const merged = appendPromptTimelineEntryOnce(
      [null as unknown as typeof entry, entry],
      entry,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.action).toBe(entry.action);
  });
});
