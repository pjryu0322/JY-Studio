import { describe, expect, it } from "vitest";
import {
  buildImplementationPreviewViewerPageUrl,
  sanitizePreviewViewerTargetParam,
} from "@/lib/prototype/implementationPreviewViewerWindow";

describe("implementationPreviewViewerWindow", () => {
  it("accepts in-project relative preview targets", () => {
    expect(
      sanitizePreviewViewerTargetParam({
        projectId: "p1",
        target: "/projects/p1/preview/app?scope=latest",
      }),
    ).toBe("/projects/p1/preview/app?scope=latest");
  });

  it("rejects other project paths", () => {
    expect(
      sanitizePreviewViewerTargetParam({
        projectId: "p1",
        target: "/projects/p2/preview/app",
      }),
    ).toBeNull();
  });

  it("builds viewer page url with encoded target", () => {
    const url = buildImplementationPreviewViewerPageUrl({
      projectId: "p1",
      previewUrl: "/projects/p1/preview/app?scope=latest",
    });
    expect(url).toContain("/projects/p1/preview/viewer");
    expect(url).toContain("target=");
  });
});
