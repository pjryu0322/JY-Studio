import { describe, expect, it } from "vitest";
import {
  buildJyoPreviewPagesWorkflowYaml,
  JYO_PREVIEW_PAGES_WORKFLOW_PATH,
} from "@/lib/prototype/githubPagesWorkflowService";

describe("githubPagesPreviewWorkflow", () => {
  it("11. workflow yaml path and dispatch inputs", () => {
    expect(JYO_PREVIEW_PAGES_WORKFLOW_PATH).toBe(".github/workflows/jyo-preview-pages.yml");
    const yaml = buildJyoPreviewPagesWorkflowYaml();
    expect(yaml).toContain("workflow_dispatch");
    expect(yaml).toContain("project_id");
    expect(yaml).toContain("source_branch");
    expect(yaml).toContain("pages_path");
    expect(yaml).toContain("npm run build");
    expect(yaml).toContain("upload-pages-artifact");
    expect(yaml).toContain("deploy-pages");
    expect(yaml).not.toContain("git push origin gh-pages");
    expect(yaml).not.toMatch(/ghp_[A-Za-z0-9]+/);
  });
});
