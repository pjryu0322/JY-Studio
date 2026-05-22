/**
 * Stage 7-A runtime implementation planning candidate constants (read-only).
 */

import type {
  RuntimeImplementationPlanningCandidateArea,
  RuntimeImplementationPlanningItem,
} from "@/lib/agents/runtimeImplementationPlanningCandidateTypes";

export const RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_VERSION =
  "runtime_implementation_planning_candidate_v1" as const;

export const RUNTIME_IMPLEMENTATION_PLANNING_CANDIDATE_TITLE =
  "Runtime Implementation Planning Candidate" as const;

export const REQUIRED_STAGE7_A_IMPLEMENTATION_PLANNING_CONFIRMATIONS = [
  "runtimeImplementationPlanningReviewed",
  "runtimeImplementationSeparatePrConfirmed",
  "runtimeImplementationNoActualExecutionConfirmed",
  "runtimeImplementationRollbackPlanReviewed",
  "runtimeImplementationOperatorApprovalRequiredConfirmed",
] as const;

export const STAGE7_A_REQUIRED_PLANNING_ITEM_IDS = [
  "runtime-api-design-pr",
  "execution-runner-design-pr",
  "dry-run-runner-design-pr",
  "cursor-github-wire-design-pr",
  "connector-gateway-routing-design-pr",
  "persistence-design-pr",
  "schema-migration-approval-pr",
  "feature-flag-wire-design-pr",
  "runtime-ui-design-pr",
  "operator-approval-flow-design-pr",
] as const;

export const STAGE7_A_RECOMMENDED_NEXT_PHASES = [
  "stage_7_b_runtime_api_contract_design",
  "stage_7_c_execution_runner_contract_design",
  "stage_7_d_dry_run_runner_contract_design",
  "stage_7_e_cursor_github_wire_contract_design",
  "stage_7_f_persistence_schema_approval_planning",
] as const;

export const STAGE7_A_SEPARATED_WORK_ITEMS = [
  "actual_runtime_execution_api",
  "actual_execution_runner",
  "actual_dry_run_runner",
  "actual_cursor_execution_wire",
  "actual_github_operation_wire",
  "actual_connector_gateway_routing_change",
  "actual_feature_flag_wire",
  "actual_db_write",
  "actual_persistence_implementation",
  "actual_schema_migration",
  "actual_runtime_execution_ui",
] as const;

type PlanningItemSpec = {
  readonly area: RuntimeImplementationPlanningCandidateArea;
  readonly title: string;
  readonly purpose: string;
  readonly recommendedPrType: RuntimeImplementationPlanningItem["recommendedPrType"];
  readonly dependsOn: readonly string[];
  readonly requiredApprovals: readonly string[];
  readonly forbiddenInThisStep: readonly string[];
};

export const STAGE7_A_PLANNING_ITEM_SPECS: Record<
  (typeof STAGE7_A_REQUIRED_PLANNING_ITEM_IDS)[number],
  PlanningItemSpec
> = {
  "runtime-api-design-pr": {
    area: "runtime_api",
    title: "Runtime API Design PR",
    purpose: "Plan separate design PR for runtime execution API contracts without implementing endpoints.",
    recommendedPrType: "design_pr",
    dependsOn: [],
    requiredApprovals: ["runtime_operator"],
    forbiddenInThisStep: ["actual_runtime_execution_api"],
  },
  "execution-runner-design-pr": {
    area: "execution_runner",
    title: "Execution Runner Design PR",
    purpose: "Plan execution runner contract and approval boundaries in a dedicated design PR.",
    recommendedPrType: "separate_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["runtime_operator"],
    forbiddenInThisStep: ["actual_execution_runner"],
  },
  "dry-run-runner-design-pr": {
    area: "dry_run_runner",
    title: "Dry-run Runner Design PR",
    purpose: "Plan dry-run runner contract separate from live execution runner implementation.",
    recommendedPrType: "separate_pr",
    dependsOn: ["execution-runner-design-pr"],
    requiredApprovals: ["runtime_operator"],
    forbiddenInThisStep: ["actual_dry_run_runner"],
  },
  "cursor-github-wire-design-pr": {
    area: "cursor_github_wire",
    title: "Cursor/GitHub Wire Design PR",
    purpose: "Plan Cursor execution and GitHub operation wire contracts without live calls.",
    recommendedPrType: "design_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["runtime_operator", "github_operator"],
    forbiddenInThisStep: ["actual_cursor_execution_wire", "actual_github_operation_wire"],
  },
  "connector-gateway-routing-design-pr": {
    area: "connector_gateway_routing",
    title: "Connector Gateway Routing Design PR",
    purpose: "Plan connector gateway routing change approval and shadow routing design.",
    recommendedPrType: "design_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["connector_operator"],
    forbiddenInThisStep: ["actual_connector_gateway_routing_change"],
  },
  "persistence-design-pr": {
    area: "persistence",
    title: "Persistence Design PR",
    purpose: "Plan persistence layer design and write-boundary approvals before any DB implementation.",
    recommendedPrType: "separate_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["persistence_operator"],
    forbiddenInThisStep: ["actual_db_write", "actual_persistence_implementation"],
  },
  "schema-migration-approval-pr": {
    area: "schema_migration",
    title: "Schema Migration Approval PR",
    purpose: "Plan schema migration approval flow separate from runtime API implementation.",
    recommendedPrType: "approval_pr",
    dependsOn: ["persistence-design-pr"],
    requiredApprovals: ["schema_operator", "runtime_operator"],
    forbiddenInThisStep: ["actual_schema_migration"],
  },
  "feature-flag-wire-design-pr": {
    area: "feature_flag",
    title: "Feature Flag Wire Design PR",
    purpose: "Plan feature flag wire design without enabling production flag changes.",
    recommendedPrType: "design_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["runtime_operator"],
    forbiddenInThisStep: ["actual_feature_flag_wire"],
  },
  "runtime-ui-design-pr": {
    area: "ui",
    title: "Runtime UI Design PR",
    purpose: "Plan runtime execution UI design PR separate from backend implementation.",
    recommendedPrType: "design_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["ui_operator"],
    forbiddenInThisStep: ["actual_runtime_execution_ui"],
  },
  "operator-approval-flow-design-pr": {
    area: "approval",
    title: "Operator Approval Flow Design PR",
    purpose: "Plan operator approval gates required before any Stage 7-B+ implementation PR.",
    recommendedPrType: "approval_pr",
    dependsOn: ["runtime-api-design-pr"],
    requiredApprovals: ["runtime_operator", "security_operator"],
    forbiddenInThisStep: ["actual_runtime_execution_api", "actual_execution_runner"],
  },
};
