import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");
const prototypeDir = join(__dirname, "../../src/lib/prototype");

/** Source text for implementation-stage wiring (panel + hook + shell + integration runner). */
export function readImplementationStagePanelSources(): string {
  return [
    "PrototypePreviewPanel.tsx",
    "PrototypeImplementationStagePanel.tsx",
    "usePrototypeImplementationStagePanel.tsx",
    "ImplementationExecutionBoardIntegrationFooter.tsx",
    join(prototypeDir, "implementationBoardIntegrationPipelineRun.ts"),
  ]
    .map((name) =>
      readFileSync(name.includes("/") || name.includes("\\") ? name : join(previewDir, name), "utf8"),
    )
    .join("\n");
}
