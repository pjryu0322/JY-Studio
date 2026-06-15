import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldBlockImplementationSupplementChat } from "@/lib/prototype/implementationChatAvailabilityGuard";
import { resolveImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";

describe("implementationChatGuard", () => {
  it("blocks when chat is not available", () => {
    const availability = resolveImplementationChatAvailability({
      implementationStarted: true,
      hasFailedTasks: false,
      integrationPipelineUnlocked: false,
      activeTaskCursorRunning: true,
      taskCursorGithubVerifying: false,
      board: null,
      previewReady: false,
      previewUrl: null,
    });
    expect(shouldBlockImplementationSupplementChat(availability)).toBe(true);
  });

  it("working queue operational send applies availability guard", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/lib/prototype/implementationWorkingQueueOperationalSend.ts"),
      "utf8",
    );
    expect(src).toContain("blockWhenImplementationChatUnavailable");
    expect(src).toContain("chatAvailability");
  });
});

describe("implementationComposerDisabled wiring", () => {
  it("single chat workspace blocks input when preview not ready", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/preview/useImplementationSingleChatWorkspaceController.ts"),
      "utf8",
    );
    expect(src).toContain("implementationChatAvailability");
    expect(src).toContain("captureAttachEnabled");
    expect(src).toContain("buildImplementationChatAvailabilityBlockedOperationalResult");
  });

  it("stage panel shows locked notice", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/PrototypeImplementationStagePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("ImplementationChatLockedNotice");
    expect(panel).toContain("inputDisabled={isMessageInputBlocked}");
  });
});
