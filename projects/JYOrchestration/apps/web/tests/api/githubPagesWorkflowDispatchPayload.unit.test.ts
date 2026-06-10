import { describe, expect, it } from "vitest";
import { buildJyoPreviewPagesWorkflowDispatchPayload } from "@/lib/prototype/githubPagesWorkflowService";

describe("githubPagesWorkflowDispatchPayload", () => {
  it("11-14. sends required workflow_dispatch inputs with defaultBranch ref", () => {
    const payload = buildJyoPreviewPagesWorkflowDispatchPayload({
      projectId: "proj-1",
      integrationBranch: "jyo/int/proj-1",
      workflowRefBranch: "main",
      pagesPath: "previews/proj-1",
    });
    expect(payload.ref).toBe("main");
    expect(payload.inputs.project_id).toBe("proj-1");
    expect(payload.inputs.source_branch).toBe("jyo/int/proj-1");
    expect(payload.inputs.pages_path).toBe("previews/proj-1");
    expect(Object.keys(payload.inputs).sort()).toEqual(
      ["pages_path", "project_id", "source_branch"].sort(),
    );
  });
});
