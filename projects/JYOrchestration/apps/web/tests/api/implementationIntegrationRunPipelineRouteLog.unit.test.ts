import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routePath = join(
  __dirname,
  "../../src/app/api/prototype/integration/run-pipeline/route.ts",
);

describe("integration run-pipeline route logging", () => {
  it("records route entered log before integration gate evaluation", () => {
    const src = readFileSync(routePath, "utf8");
    const postIdx = src.indexOf("export async function POST");
    const enteredIdx = src.indexOf("implementation_integration_run_pipeline_route_entered", postIdx);
    const gateIdx = src.indexOf("const integrationButtonGate = evaluateIntegrationButtonGate", postIdx);
    expect(enteredIdx).toBeGreaterThan(postIdx);
    expect(gateIdx).toBeGreaterThan(enteredIdx);
  });

  it("starts platform merge pipeline after gate with implementation_integration_pipeline_started log", () => {
    const src = readFileSync(routePath, "utf8");
    expect(src).toContain("implementation_integration_pipeline_started");
    expect(src).toContain("runProjectIntegrationPipeline");
  });
});
