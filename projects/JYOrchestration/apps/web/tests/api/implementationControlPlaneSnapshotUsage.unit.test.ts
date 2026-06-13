import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const previewDir = join(__dirname, "../../src/components/preview");

describe("implementation control plane snapshot usage in stage panel", () => {
  it("usePrototypeImplementationStagePanel imports and documents snapshot as SoT", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("useImplementationControlPlaneSnapshot");
    expect(src).toContain("toolbar/dispatch fallback");
    expect(src).toContain("pickIntegrationPipelineClientBoardSummary");
  });

  it("PrototypeImplementationStagePanel passes controlPlaneSnapshot to the board", () => {
    const src = readFileSync(join(previewDir, "PrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("controlPlaneSnapshot={implementationControlPlaneSnapshot}");
  });

  it("ImplementationExecutionBoardPanel applies control plane to integration button", () => {
    const src = readFileSync(join(previewDir, "ImplementationExecutionBoardPanel.tsx"), "utf8");
    expect(src).toContain("applyControlPlaneIntegrationPipelineButtonGate");
    expect(src).toContain("buildImplementationControlPlaneSnapshot");
    expect(src).toContain("localControlPlaneSnapshot");
    expect(src).toContain("effectiveControlPlaneSnapshot");
    expect(src).toContain("isSameControlPlaneBoardSummary");
  });

  it("usePrototypeImplementationStagePanel documents parent snapshot as toolbar fallback", () => {
    const src = readFileSync(join(previewDir, "usePrototypeImplementationStagePanel.tsx"), "utf8");
    expect(src).toContain("toolbar/dispatch fallback");
    expect(src).toContain("pickIntegrationPipelineClientBoardSummary");
  });
});
