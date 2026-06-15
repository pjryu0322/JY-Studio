import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveImplementationChatAvailability } from "@/lib/prototype/implementationChatAvailability";

describe("implementationPreviewReadyChatEnabled", () => {
  it("canChat true enables capture attach flags in workspace controller", () => {
    const src = readFileSync(
      resolve(process.cwd(), "src/components/preview/useImplementationSingleChatWorkspaceController.ts"),
      "utf8",
    );
    expect(src).toContain("captureAttachEnabled: implementationChatAvailability.canChat");
    expect(src).toContain("fileAttachEnabled: implementationChatAvailability.canChat");
    expect(src).toContain("buildImplementationChatAvailabilityInput");
  });

  it("preview viewer passes composerAttach when opening from toolbar", () => {
    const panel = readFileSync(
      resolve(process.cwd(), "src/components/preview/usePrototypeImplementationStagePanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("composerAttachEnabled: implementationChatAvailability.canChat");
  });

  it("strict preview ready availability unlocks chat", () => {
    const availability = resolveImplementationChatAvailability({
      implementationStarted: true,
      codeTasksCompleted: true,
      githubVerified: true,
      integrationCompleted: true,
      previewUrl: "https://demo.github.io/app",
      previewReady: true,
      previewOpenTargetReady: true,
      sampleDataRequired: true,
      sampleDataQualityOk: true,
      sampleDataRenderedOk: true,
      hasFailedTasks: false,
      board: null,
      integrationPipelineUnlocked: true,
      activeTaskCursorRunning: false,
      taskCursorGithubVerifying: false,
    });
    expect(availability.canChat).toBe(true);
    expect(availability.status).toBe("available");
  });
});
