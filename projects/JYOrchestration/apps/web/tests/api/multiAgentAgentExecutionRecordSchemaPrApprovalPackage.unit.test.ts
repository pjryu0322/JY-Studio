import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordSchemaPrApprovalPackage } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrApprovalPackage";
import * as schemaPrReadinessModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";

function checklistItem(
  report: ReturnType<typeof evaluateAgentExecutionRecordSchemaPrApprovalPackage>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

describe("multi-agent agent execution record schema PR approval package stage 2-26", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explicitUserApproval=false returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: false,
    });
    expect(report.decision).toBe("defer");
  });

  it("explicitUserApproval=false keeps schema change flags false", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: false,
    });
    expect(report.modelDraft.length).toBeGreaterThan(0);
    expect(report.modifiesSchemaInThisStep).toBe(false);
    expect(report.createsMigrationInThisStep).toBe(false);
    expect(report.writesDataInThisStep).toBe(false);
  });

  it("explicitUserApproval=true returns ready_for_explicit_schema_pr_approval", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("ready_for_explicit_schema_pr_approval");
  });

  it("explicitUserApproval=true provides non-empty modelDraft", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.modelDraft.length).toBeGreaterThan(0);
  });

  it("modelName is AgentExecutionRecord", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.modelName).toBe("AgentExecutionRecord");
  });

  it("sourceReadinessDecision is ready_for_schema_pr_plan", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.sourceReadinessDecision).toBe("ready_for_schema_pr_plan");
  });

  it("sourceSchemaDecision is ready_for_schema_proposal", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.sourceSchemaDecision).toBe("ready_for_schema_proposal");
  });

  it("requiresExplicitUserApproval is true", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .requiresExplicitUserApproval,
    ).toBe(true);
  });

  it("requiresSeparatePr is true", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .requiresSeparatePr,
    ).toBe(true);
  });

  it("modifiesSchemaInThisStep is false", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .modifiesSchemaInThisStep,
    ).toBe(false);
  });

  it("createsMigrationInThisStep is false", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .createsMigrationInThisStep,
    ).toBe(false);
  });

  it("writesDataInThisStep is false", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .writesDataInThisStep,
    ).toBe(false);
  });

  it("approvalChecklist includes no schema modification satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(checklistItem(report, "no schema modification in this step")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no migration creation satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(checklistItem(report, "no migration creation in this step")?.satisfied).toBe(true);
  });

  it("approvalChecklist includes no DB write satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(checklistItem(report, "no DB write in this step")?.satisfied).toBe(true);
  });

  it("forbiddenFieldChecklist items are all satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.forbiddenFieldChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("timeline_event_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      target: "timeline_event_link",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
  });

  it("audit_trail_link returns defer", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      target: "audit_trail_link",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
  });

  it("unknown target returns blocked", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      target: "invalid",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
  });

  it("uses schema PR readiness only without Prisma migration or DB write", () => {
    const readinessSpy = vi.spyOn(schemaPrReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness");
    evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true });
    expect(readinessSpy).toHaveBeenCalledTimes(1);
  });
});
