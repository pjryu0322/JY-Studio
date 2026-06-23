import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { exitProjectKnowledgeGraphView } from "@/lib/project-graph/projectKnowledgeGraphClose";

describe("exitProjectKnowledgeGraphView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("calls router.back when history has entries after close attempt", () => {
    const back = vi.fn();
    const push = vi.fn();
    const router = { back, push } as never;
    const close = vi.fn();
    vi.stubGlobal("window", {
      close,
      history: { length: 3 },
      setTimeout: (fn: () => void) => setTimeout(fn, 0),
    });

    exitProjectKnowledgeGraphView(router, "proj-1");
    expect(close).toHaveBeenCalled();
    vi.runAllTimers();
    expect(back).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to requirements when history is empty", () => {
    const back = vi.fn();
    const push = vi.fn();
    const router = { back, push } as never;
    vi.stubGlobal("window", {
      close: vi.fn(),
      history: { length: 1 },
      setTimeout: (fn: () => void) => setTimeout(fn, 0),
    });

    exitProjectKnowledgeGraphView(router, "proj-1");
    vi.runAllTimers();
    expect(back).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/requirements?projectId=proj-1");
  });
});
