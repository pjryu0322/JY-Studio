import { describe, expect, it } from "vitest";
import { validateCodeTaskPromptDraftSafety } from "@/lib/prototype/codeTaskPromptDraftSafety";
import { formatCodeTaskPromptDraft } from "@/lib/prototype/formatCodeTaskPromptDraft";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const sampleTask = (): ImplementationCodeTaskV1 => ({
  codeTaskId: "CODE-1",
  parentTaskId: "DEV-1",
  title: "재시도 공통 기능",
  description: "재시도 UX",
  changeType: "component",
  acceptanceCriteria: ["재시도 버튼"],
  verificationHints: [],
  forbiddenPaths: [],
  candidateFiles: [],
  candidateFileHints: [],
});

describe("validateCodeTaskPromptDraftSafety", () => {
  it("allows CodeTask ID in draft", () => {
    const draft = formatCodeTaskPromptDraft({ codeTask: sampleTask(), parentTask: null, promptContext: null });
    expect(draft).toContain("CodeTask ID");
    expect(validateCodeTaskPromptDraftSafety({ prompt: draft }).ok).toBe(true);
  });

  it("blocks runtime/repo strings", () => {
    expect(validateCodeTaskPromptDraftSafety({ prompt: "GitHub 저장소 설정" }).ok).toBe(false);
    expect(validateCodeTaskPromptDraftSafety({ prompt: "work branch: main" }).ok).toBe(false);
    expect(validateCodeTaskPromptDraftSafety({ prompt: "commit 후 push" }).ok).toBe(false);
    expect(validateCodeTaskPromptDraftSafety({ prompt: "projects/JYOrchestration/foo" }).ok).toBe(false);
  });
});
