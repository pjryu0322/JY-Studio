import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAgentExecutionRecordSchemaPrApprovalPackage } from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrApprovalPackage";
import * as schemaPrReadinessModule from "@/lib/agents/evaluateAgentExecutionRecordSchemaPrReadiness";

function checklistItem(
  report: ReturnType<typeof evaluateAgentExecutionRecordSchemaPrApprovalPackage>,
  item: string,
) {
  return report.approvalChecklist.find((c) => c.item === item);
}

const FORBIDDEN_IN_DRAFT = [
  "rawPrompt",
  "fullInput",
  "fullOutput",
  "codeDiff",
  "token",
  "apiKey",
  "stackTraceRaw",
] as const;

describe("multi-agent agent execution record schema PR approval package stage 2-26", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("explicitUserApproval=false returns defer", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: false }).decision,
    ).toBe("defer");
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
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true }).decision,
    ).toBe("ready_for_explicit_schema_pr_approval");
  });

  it("explicitUserApproval=true provides non-empty modelDraft", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.modelDraft.length).toBeGreaterThan(0);
  });

  it("approvalChecklist includes explicit user approval confirmed", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(checklistItem(report, "explicit user approval confirmed")).toBeDefined();
  });

  it("explicitUserApproval=false sets explicit user approval confirmed false", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: false,
    });
    expect(checklistItem(report, "explicit user approval confirmed")?.satisfied).toBe(false);
  });

  it("explicitUserApproval=true sets explicit user approval confirmed true", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(checklistItem(report, "explicit user approval confirmed")?.satisfied).toBe(true);
  });

  it("explicitUserApprovalProvided matches input", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: false })
        .explicitUserApprovalProvided,
    ).toBe(false);
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true })
        .explicitUserApprovalProvided,
    ).toBe(true);
  });

  it("requiresExplicitUserApproval is always true", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: false })
        .requiresExplicitUserApproval,
    ).toBe(true);
  });

  it("modelName is AgentExecutionRecord when ready", () => {
    expect(
      evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true }).modelName,
    ).toBe("AgentExecutionRecord");
  });

  it("blocked target clears modelDraft and modelName", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      target: "invalid",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
    expect(report.modelDraft).toBe("");
    expect(report.modelName).toBe("");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("modelDraft does not include forbidden fields", () => {
    const draft = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    }).modelDraft;
    for (const field of FORBIDDEN_IN_DRAFT) {
      expect(draft).not.toContain(field);
    }
  });

  it("forbidden model draft in readiness blocks approval package", () => {
    vi.spyOn(schemaPrReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness").mockReturnValue({
      mode: "read_only_agent_execution_record_schema_pr_readiness",
      decision: "ready_for_schema_pr_plan",
      target: "agent_execution_record",
      sourceSchemaDecision: "ready_for_schema_proposal",
      sourceProposedTableName: "AgentExecutionRecord",
      sourceRequiresPrismaSchemaChange: true,
      sourceRequiresMigration: true,
      sourceFieldProposalCount: 1,
      sourceExcludedFieldCount: 7,
      sourceForbiddenFieldNames: ["rawPrompt"],
      modelCandidates: [
        {
          modelName: "AgentExecutionRecord",
          modelDraft: "model AgentExecutionRecord { rawPrompt String }",
          caution: "read-only",
        },
      ],
      migrationChecklist: [],
      rollbackChecklist: [],
      retentionAccessChecklist: [],
      forbiddenFieldChecklist: [],
      requiresSeparatePr: true,
      modifiesSchemaInThisStep: false,
      createsMigrationInThisStep: false,
      writesDataInThisStep: false,
      findings: [],
    });

    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("blocked");
    expect(
      report.findings.some((f) => f.code === "approval_package_model_draft_contains_forbidden_field"),
    ).toBe(true);
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
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
    expect(
      checklistItem(
        evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true }),
        "no schema modification in this step",
      )?.satisfied,
    ).toBe(true);
  });

  it("forbiddenFieldChecklist items are all satisfied", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      explicitUserApproval: true,
    });
    expect(report.forbiddenFieldChecklist.every((item) => item.satisfied)).toBe(true);
  });

  it("timeline_event_link returns defer with empty modelDraft", () => {
    const report = evaluateAgentExecutionRecordSchemaPrApprovalPackage({
      target: "timeline_event_link",
      explicitUserApproval: true,
    });
    expect(report.decision).toBe("defer");
    expect(report.modelDraft).toBe("");
    expect(report.findings.some((f) => f.code === "model_draft_missing")).toBe(false);
  });

  it("uses schema PR readiness only without Prisma migration or DB write", () => {
    const readinessSpy = vi.spyOn(schemaPrReadinessModule, "evaluateAgentExecutionRecordSchemaPrReadiness");
    evaluateAgentExecutionRecordSchemaPrApprovalPackage({ explicitUserApproval: true });
    expect(readinessSpy).toHaveBeenCalledTimes(1);
  });
});
