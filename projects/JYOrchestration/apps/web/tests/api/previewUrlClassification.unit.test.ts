import { describe, expect, it } from "vitest";
import {
  isExternalPreviewUrl,
  isGithubPagesPreviewUrl,
  isInternalPreviewPath,
} from "@/lib/prototype/previewUrlClassification";

describe("previewUrlClassification", () => {
  it("detects GitHub Pages URLs as external", () => {
    expect(isGithubPagesPreviewUrl("https://owner.github.io/repo/")).toBe(true);
    expect(isExternalPreviewUrl("https://owner.github.io/repo/")).toBe(true);
  });

  it("treats internal app route as internal", () => {
    expect(isInternalPreviewPath("/projects/p1/preview/app?scope=latest")).toBe(true);
    expect(isExternalPreviewUrl("/projects/p1/preview/app?scope=latest")).toBe(false);
  });
});
