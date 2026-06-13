import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation deliverable viewer controller wiring", () => {
  it("declares deliverable viewer controller responsibility", () => {
    const src = readFileSync(
      join(previewDir, "useImplementationDeliverableViewerController.ts"),
      "utf8",
    );
    expect(src).toContain("Controls implementation-stage deliverable viewer state");
    expect(src).toContain("open deliverable viewer with selected asset ids");
  });

  it("uses deliverable viewer controller from parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).toContain("useImplementationDeliverableViewerController");
  });

  it("moves deliverable viewer state out of parent panel hook", () => {
    const parent = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(parent).not.toContain("const [deliverableViewerOpen, setDeliverableViewerOpen] = useState(false)");
    expect(parent).not.toContain(
      "const [deliverableViewerFocusId, setDeliverableViewerFocusId] = useState<string | null>(null)",
    );
    expect(parent).not.toContain("const openDeliverableViewer = useCallback");
    expect(parent).not.toContain("const closeDeliverableViewer = useCallback");
  });
});
