import { describe, expect, it } from "vitest";
import {
  isReplayLatestDisabled,
  isReplayNextDisabled,
  isReplayPreviousDisabled,
  isReplayControlsBlocked,
  replayAutoplayTick,
  replayLatestIndex,
  replayNextIndex,
  replayPreviousIndex,
  resolveReplayAutoplayStartIndex,
} from "@/lib/project-knowledge/projectKnowledgeReplayNavigation";

describe("projectKnowledgeReplayNavigation", () => {
  it("moves to previous index", () => {
    expect(replayPreviousIndex(2)).toBe(1);
    expect(replayPreviousIndex(0)).toBe(0);
  });

  it("moves to next index within bounds", () => {
    expect(replayNextIndex(0, 3)).toBe(1);
    expect(replayNextIndex(2, 3)).toBe(2);
  });

  it("jumps to latest index", () => {
    expect(replayLatestIndex(5)).toBe(4);
    expect(replayLatestIndex(0)).toBe(0);
  });

  it("disables nav buttons at boundaries", () => {
    expect(isReplayPreviousDisabled(0)).toBe(true);
    expect(isReplayNextDisabled(2, 3)).toBe(true);
    expect(isReplayLatestDisabled(2, 3)).toBe(true);
    expect(isReplayLatestDisabled(1, 3)).toBe(false);
  });

  it("autoplay stops at last step", () => {
    expect(replayAutoplayTick(1, 3)).toEqual({ nextIndex: 2, stop: false });
    expect(replayAutoplayTick(2, 3)).toEqual({ nextIndex: 2, stop: true });
  });

  it("starts autoplay from first step when currently on latest", () => {
    expect(resolveReplayAutoplayStartIndex(4, 5)).toBe(0);
    expect(resolveReplayAutoplayStartIndex(2, 5)).toBe(2);
  });

  it("blocks controls while loading or empty", () => {
    expect(isReplayControlsBlocked({ listLoading: true, detailLoading: false, revisionCount: 3 })).toBe(true);
    expect(isReplayControlsBlocked({ listLoading: false, detailLoading: false, revisionCount: 0 })).toBe(true);
    expect(isReplayControlsBlocked({ listLoading: false, detailLoading: false, revisionCount: 2 })).toBe(false);
  });
});
