import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/openAiChatCompletions", () => ({
  postOpenAiChatCompletion: vi.fn(),
}));

import { postOpenAiChatCompletion } from "@/lib/ai/openAiChatCompletions";
import { runOptionalAdvisoryCalls } from "../../src/lib/service-design/serviceDesignAdvisoryCall";

const mockPost = vi.mocked(postOpenAiChatCompletion);

describe("runOptionalAdvisoryCalls", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it("returns empty array when no advisors (no LLM calls)", async () => {
    const out = await runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "hello",
      advisors: [],
      stage: "ideation",
      intent: "GENERAL",
    });
    expect(out).toEqual([]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("calls at most two advisors when three are requested", async () => {
    mockPost.mockResolvedValue({ ok: true, text: "요약 의견입니다." });

    await runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "보안 검토",
      advisors: ["security_reviewer", "designer", "scm_manager"],
      stage: "ideation",
      intent: "SECURITY",
    });

    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("records error without throwing when advisory LLM fails", async () => {
    mockPost.mockResolvedValue({ ok: false, code: "HTTP_500", message: "upstream error" });

    const out = await runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "질문",
      advisors: ["security_reviewer"],
      stage: "service-flow",
      intent: "SECURITY",
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.error).toBeTruthy();
    expect(out[0]?.summary).toBe("");
  });

  it("records exception without throwing when postOpenAiChatCompletion throws", async () => {
    mockPost.mockRejectedValue(new Error("network"));

    const out = await runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "질문",
      advisors: ["designer"],
      stage: "feature-planning",
      intent: "DESIGN",
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.error).toBe("network");
  });

  it("returns summaries when advisory succeeds", async () => {
    mockPost.mockResolvedValue({ ok: true, text: "  참고 의견입니다. " });

    const out = await runOptionalAdvisoryCalls({
      apiKey: "k",
      userMessage: "배포 파이프라인",
      advisors: ["scm_manager"],
      stage: "ideation",
      intent: "DEPLOY",
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.summary).toContain("참고");
    expect(out[0]?.error).toBeUndefined();
  });
});
