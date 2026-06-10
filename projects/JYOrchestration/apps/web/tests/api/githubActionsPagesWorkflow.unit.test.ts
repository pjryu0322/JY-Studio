import { describe, expect, it } from "vitest";
import {
  buildJyoPreviewPagesWorkflowDispatchPayload,
  buildJyoPreviewPagesWorkflowYaml,
} from "@/lib/prototype/githubPagesWorkflowService";

describe("githubActionsPagesWorkflow", () => {
  it("1-7. workflow uses Actions Pages deploy steps and permissions", () => {
    const yaml = buildJyoPreviewPagesWorkflowYaml();
    expect(yaml).toContain("actions/upload-pages-artifact@v3");
    expect(yaml).toContain("actions/deploy-pages@v4");
    expect(yaml).toContain("pages: write");
    expect(yaml).toContain("id-token: write");
    expect(yaml).toContain("project_id");
    expect(yaml).toContain("source_branch");
    expect(yaml).toContain("pages_path");
    expect(yaml).toContain("github.event.inputs.source_branch");
    expect(yaml).not.toContain("git push origin gh-pages");
  });

  it("8-10. dispatch payload uses defaultBranch ref and required inputs", () => {
    const payload = buildJyoPreviewPagesWorkflowDispatchPayload({
      projectId: "cmphxk7y10015unj0wjms1uch",
      integrationBranch: "integration/cmphxk7y1001-20260610-0232",
      workflowRefBranch: "main",
    });
    expect(payload.ref).toBe("main");
    expect(payload.ref).not.toBe("integration/cmphxk7y1001-20260610-0232");
    expect(payload.inputs.source_branch).toBe("integration/cmphxk7y1001-20260610-0232");
    expect(payload.inputs.pages_path).toBe("previews/cmphxk7y10015unj0wjms1uch");
    expect(payload.inputs.project_id).toBe("cmphxk7y10015unj0wjms1uch");
    expect(Object.keys(payload.inputs).length).toBe(3);
  });
});
