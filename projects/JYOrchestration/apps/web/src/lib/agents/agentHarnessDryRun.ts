/**
 * Agent Harness Dry-run — combines Stage 2-1 resolver + Stage 2-2 connector facade (no execution).
 */

import { validateAgentCapabilityBinding } from "@/lib/agents/agentCapabilityBinding";
import type {
  HarnessDryRunRequest,
  HarnessDryRunResult,
  HarnessDryRunStatus,
  HarnessGovernancePrecheck,
  HarnessGovernancePrecheckStatus,
} from "@/lib/agents/agentHarnessDryRunTypes";
import { getAgentById } from "@/lib/agents/agentRegistry";
import { getCapabilityById } from "@/lib/agents/capabilityRegistry";
import { planConnectorInvocation } from "@/lib/agents/connectorGatewayFacade";
import type { ConnectorInvocationResult } from "@/lib/agents/connectorGatewayFacadeTypes";
import { evaluateGovernancePrecheckDryRun } from "@/lib/agents/governancePrecheckDryRun";
import type { GovernancePrecheckDryRunResult } from "@/lib/agents/governancePrecheckDryRunTypes";
import type { HarnessGovernanceDryRunSummary } from "@/lib/agents/agentHarnessDryRunTypes";
import {
  resolveDispatchAgent,
  resolveDispatchCapability,
} from "@/lib/agents/requirementsDispatchAgentMetadata";

function trimOptional(value: string | undefined): string | undefined {
  const t = String(value ?? "").trim();
  return t || undefined;
}

const HARNESS_STRING_FIELDS = [
  "intent",
  "action",
  "stage",
  "agentId",
  "capabilityId",
  "runtimeRole",
  "aiMemberRole",
  "projectId",
  "conversationId",
  "runId",
  "taskId",
] as const satisfies readonly (keyof HarnessDryRunRequest)[];

function pickRequestFields(input: Partial<HarnessDryRunRequest>): HarnessDryRunRequest {
  const out: HarnessDryRunRequest = {};
  for (const key of HARNESS_STRING_FIELDS) {
    const value = trimOptional(input[key]);
    if (value) out[key] = value;
  }
  if (input.source) out.source = input.source;
  return out;
}

export function buildHarnessDryRunRequest(
  input: Partial<HarnessDryRunRequest>,
): HarnessDryRunRequest {
  try {
    return pickRequestFields(input);
  } catch {
    return {};
  }
}

function deriveHarnessGovernancePrecheckStatus(input: {
  readonly blocking: readonly string[];
  readonly warnings: readonly string[];
  readonly requiredChecks: readonly string[];
}): HarnessGovernancePrecheckStatus {
  if (input.blocking.length) return "blocked";
  if (input.warnings.length) return "warning";
  if (input.requiredChecks.length) return "pass_candidate";
  return "not_evaluated";
}

export function buildGovernancePrecheckForCapability(
  capabilityId?: string,
  options?: Readonly<{
    readonly blockingReasons?: readonly string[];
    readonly warnings?: readonly string[];
  }>,
): HarnessGovernancePrecheck {
  const blocking = [...(options?.blockingReasons ?? [])];
  const warnings = [...(options?.warnings ?? [])];

  if (!capabilityId?.trim()) {
    return {
      requiredChecks: [],
      status: deriveHarnessGovernancePrecheckStatus({
        blocking,
        warnings,
        requiredChecks: [],
      }),
      ...(warnings.length ? { warnings } : {}),
      ...(blocking.length ? { blockingReasons: blocking } : {}),
    };
  }

  const cap = getCapabilityById(capabilityId.trim());
  if (!cap) {
    const mergedWarnings = [`unknown_capability:${capabilityId}`, ...warnings];
    return {
      requiredChecks: [],
      status: blocking.length ? "blocked" : "warning",
      warnings: mergedWarnings,
      ...(blocking.length ? { blockingReasons: blocking } : {}),
    };
  }

  const requiredChecks = [...(cap.governanceChecks ?? [])];
  return {
    requiredChecks,
    status: deriveHarnessGovernancePrecheckStatus({ blocking, warnings, requiredChecks }),
    ...(warnings.length ? { warnings } : {}),
    ...(blocking.length ? { blockingReasons: blocking } : {}),
  };
}

function buildHarnessDryRunMetadata(
  request: HarnessDryRunRequest,
  extras?: Readonly<{
    readonly agentResolutionReason?: string;
    readonly capabilityResolutionReason?: string;
    readonly connectorPlanSummary?: string;
    readonly governancePrecheckStatus?: string;
    readonly governanceDryRunStatus?: string;
  }>,
): Readonly<Record<string, unknown>> | undefined {
  const metadata: Record<string, unknown> = {};
  if (request.source) metadata.source = request.source;
  if (request.projectId) metadata.projectId = request.projectId;
  if (request.conversationId) metadata.conversationId = request.conversationId;
  if (request.runId) metadata.runId = request.runId;
  if (request.taskId) metadata.taskId = request.taskId;
  if (extras?.agentResolutionReason) metadata.agentResolutionReason = extras.agentResolutionReason;
  if (extras?.capabilityResolutionReason) {
    metadata.capabilityResolutionReason = extras.capabilityResolutionReason;
  }
  if (extras?.connectorPlanSummary) metadata.connectorPlanSummary = extras.connectorPlanSummary;
  if (extras?.governancePrecheckStatus) {
    metadata.governancePrecheckStatus = extras.governancePrecheckStatus;
  }
  if (extras?.governanceDryRunStatus) metadata.governanceDryRunStatus = extras.governanceDryRunStatus;
  return Object.keys(metadata).length ? metadata : undefined;
}

function summarizeConnectorPlans(
  plans: readonly ConnectorInvocationResult[],
): string | undefined {
  if (!plans.length) return undefined;
  return plans.map((p) => `${p.connectorId}:${p.status}:${p.allowed}`).join(",");
}

function resolveHarnessAgentId(request: HarnessDryRunRequest): {
  readonly agentId?: string;
  readonly warnings: string[];
  readonly resolutionReason?: string;
} {
  const warnings: string[] = [];
  const direct = trimOptional(request.agentId);
  if (direct) {
    if (!getAgentById(direct)) warnings.push(`unknown_agent:${direct}`);
    return { agentId: direct, warnings, resolutionReason: `direct:${direct}` };
  }

  const resolved = resolveDispatchAgent({
    intentToken: request.intent,
    suggestedActionId: request.action,
    stage: request.stage,
    runtimeRole: request.runtimeRole,
    aiMemberRole: request.aiMemberRole,
  });

  if (resolved.agentId) {
    return {
      agentId: resolved.agentId,
      warnings: [...warnings, ...(resolved.warnings ?? [])],
      resolutionReason: resolved.reason,
    };
  }
  return {
    warnings: [...warnings, ...(resolved.warnings ?? []), resolved.reason],
    resolutionReason: resolved.reason,
  };
}

function resolveHarnessCapabilityId(
  request: HarnessDryRunRequest,
  agentId?: string,
): {
  readonly capabilityId?: string;
  readonly warnings: string[];
  readonly resolutionReason?: string;
} {
  const warnings: string[] = [];
  const direct = trimOptional(request.capabilityId);
  if (direct) {
    if (!getCapabilityById(direct)) warnings.push(`unknown_capability:${direct}`);
    return { capabilityId: direct, warnings, resolutionReason: `direct:${direct}` };
  }

  const resolved = resolveDispatchCapability({
    agentId,
    intentToken: request.intent,
    stage: request.stage,
    suggestedActionId: request.action,
  });

  if (resolved.capabilityId) {
    return {
      capabilityId: resolved.capabilityId,
      warnings: [...warnings, ...(resolved.warnings ?? [])],
      resolutionReason: resolved.reason,
    };
  }
  return {
    warnings: [...warnings, ...(resolved.warnings ?? []), resolved.reason],
    resolutionReason: resolved.reason,
  };
}

function buildConnectorPlansForHarness(input: {
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly requiredConnectors: readonly string[];
  readonly request: HarnessDryRunRequest;
}): readonly ConnectorInvocationResult[] {
  if (!input.requiredConnectors.length) return [];
  return input.requiredConnectors.map((connectorId) =>
    planConnectorInvocation({
      connectorId,
      operation: `harness.dry_run.${connectorId}`,
      agentId: input.agentId,
      capabilityId: input.capabilityId,
      projectId: input.request.projectId,
      runId: input.request.runId,
      taskId: input.request.taskId,
      conversationId: input.request.conversationId,
      mode: "dry_run",
    }),
  );
}

export function summarizeGovernanceDryRun(
  result: GovernancePrecheckDryRunResult,
): HarnessGovernanceDryRunSummary {
  return {
    status: result.status,
    evaluatedPolicyCount: result.evaluatedPolicyIds.length,
    findingCount: result.findings.length,
    warningCount: result.warnings.length,
    blockingCandidateCount: result.blockingCandidates.length,
  };
}

function deriveHarnessStatusWithGovernance(input: {
  readonly baseStatus: HarnessDryRunStatus;
  readonly governanceStatus: GovernancePrecheckDryRunResult["status"];
}): HarnessDryRunStatus {
  if (
    input.baseStatus === "blocked" ||
    input.baseStatus === "no_agent" ||
    input.baseStatus === "no_capability"
  ) {
    return input.baseStatus;
  }
  if (
    input.governanceStatus === "warning_candidate" ||
    input.governanceStatus === "blocking_candidate"
  ) {
    return "warning";
  }
  return input.baseStatus;
}

function deriveHarnessReasonWithGovernance(
  baseReason: string,
  governanceStatus: GovernancePrecheckDryRunResult["status"],
): string {
  if (governanceStatus === "warning_candidate") {
    return `${baseReason}:governance_warning_candidate`;
  }
  if (governanceStatus === "blocking_candidate") {
    return `${baseReason}:governance_blocking_candidate`;
  }
  return baseReason;
}

function mergeGovernanceDryRunWarnings(
  warnings: string[],
  governanceDryRun: ReturnType<typeof evaluateGovernancePrecheckDryRun>,
): void {
  warnings.push(...governanceDryRun.warnings);
  if (governanceDryRun.status === "blocking_candidate") {
    for (const policyId of governanceDryRun.blockingCandidates) {
      warnings.push(`governance_blocking_candidate:${policyId}`);
    }
  }
}

function finalizeHarnessResult(input: {
  readonly request: HarnessDryRunRequest;
  readonly status: HarnessDryRunStatus;
  readonly executable: boolean;
  readonly reason: string;
  readonly agentId?: string;
  readonly capabilityId?: string;
  readonly requiredConnectors: readonly string[];
  readonly connectorPlans: readonly ConnectorInvocationResult[];
  readonly governancePrecheck: HarnessGovernancePrecheck;
  readonly warnings: readonly string[];
  readonly blockingReasons: readonly string[];
  readonly agentResolutionReason?: string;
  readonly capabilityResolutionReason?: string;
}): HarnessDryRunResult {
  const governanceDryRun = evaluateGovernancePrecheckDryRun({
    requiredChecks: input.governancePrecheck.requiredChecks,
    agentId: input.agentId,
    capabilityId: input.capabilityId,
  });

  const warnings = [...input.warnings];
  mergeGovernanceDryRunWarnings(warnings, governanceDryRun);

  const status = deriveHarnessStatusWithGovernance({
    baseStatus: input.status,
    governanceStatus: governanceDryRun.status,
  });
  const reason = deriveHarnessReasonWithGovernance(input.reason, governanceDryRun.status);
  const governanceDryRunSummary = summarizeGovernanceDryRun(governanceDryRun);

  const agent = input.agentId ? getAgentById(input.agentId) : undefined;
  const metadata = buildHarnessDryRunMetadata(input.request, {
    agentResolutionReason: input.agentResolutionReason,
    capabilityResolutionReason: input.capabilityResolutionReason,
    connectorPlanSummary: summarizeConnectorPlans(input.connectorPlans),
    governancePrecheckStatus: input.governancePrecheck.status,
    governanceDryRunStatus: governanceDryRun.status,
  });

  return {
    status,
    executable: input.executable,
    reason,
    requiredConnectors: input.requiredConnectors,
    connectorPlans: input.connectorPlans,
    governancePrecheck: input.governancePrecheck,
    governanceDryRun,
    governanceDryRunSummary,
    warnings,
    blockingReasons: [...input.blockingReasons],
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(agent ? { agentType: agent.type } : {}),
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function harnessUnresolvedResult(input: {
  readonly request: HarnessDryRunRequest;
  readonly status: Extract<HarnessDryRunStatus, "no_agent" | "no_capability">;
  readonly reason: string;
  readonly agentId?: string;
  readonly blockingKey: "no_agent" | "no_capability";
  readonly warnings: string[];
  readonly agentResolutionReason?: string;
  readonly capabilityResolutionReason?: string;
}): HarnessDryRunResult {
  return finalizeHarnessResult({
    request: input.request,
    status: input.status,
    executable: false,
    reason: input.reason,
    agentId: input.agentId,
    requiredConnectors: [],
    connectorPlans: [],
    governancePrecheck: buildGovernancePrecheckForCapability(undefined, {
      warnings: input.warnings,
    }),
    warnings: input.warnings,
    blockingReasons: [input.blockingKey],
    agentResolutionReason: input.agentResolutionReason,
    capabilityResolutionReason: input.capabilityResolutionReason,
  });
}

/** Safe wrapper — never throws. */
export function planAgentHarnessDryRun(request: HarnessDryRunRequest): HarnessDryRunResult {
  try {
    const warnings: string[] = [];
    const blockingReasons: string[] = [];

    const agentResolution = resolveHarnessAgentId(request);
    warnings.push(...agentResolution.warnings);

    if (!agentResolution.agentId) {
      return harnessUnresolvedResult({
        request,
        status: "no_agent",
        reason: "harness:no_agent_resolved",
        blockingKey: "no_agent",
        warnings,
        agentResolutionReason: agentResolution.resolutionReason,
      });
    }

    const agentId = agentResolution.agentId;
    const capabilityResolution = resolveHarnessCapabilityId(request, agentId);
    warnings.push(...capabilityResolution.warnings);

    if (!capabilityResolution.capabilityId) {
      return harnessUnresolvedResult({
        request,
        status: "no_capability",
        reason: "harness:no_capability_resolved",
        agentId,
        blockingKey: "no_capability",
        warnings,
        agentResolutionReason: agentResolution.resolutionReason,
        capabilityResolutionReason: capabilityResolution.resolutionReason,
      });
    }

    const capabilityId = capabilityResolution.capabilityId;
    const cap = getCapabilityById(capabilityId);

    if (!validateAgentCapabilityBinding(agentId, capabilityId)) {
      blockingReasons.push(`agent_capability_binding_invalid:${agentId}+${capabilityId}`);
      return finalizeHarnessResult({
        request,
        status: "blocked",
        executable: false,
        reason: "harness:binding_invalid",
        agentId,
        capabilityId,
        requiredConnectors: cap?.requiredConnectors ?? [],
        connectorPlans: [],
        governancePrecheck: buildGovernancePrecheckForCapability(capabilityId, {
          blockingReasons,
          warnings,
        }),
        warnings,
        blockingReasons,
        agentResolutionReason: agentResolution.resolutionReason,
        capabilityResolutionReason: capabilityResolution.resolutionReason,
      });
    }

    const requiredConnectors = [...(cap?.requiredConnectors ?? [])];
    const connectorPlans = buildConnectorPlansForHarness({
      agentId,
      capabilityId,
      requiredConnectors,
      request,
    });

    for (const plan of connectorPlans) {
      if (!plan.allowed) {
        blockingReasons.push(`connector_blocked:${plan.connectorId}:${plan.reason}`);
      }
    }

    const governancePrecheck = buildGovernancePrecheckForCapability(capabilityId, {
      blockingReasons: blockingReasons.length ? blockingReasons : undefined,
      warnings: warnings.length ? warnings : undefined,
    });

    const resolutionExtras = {
      agentResolutionReason: agentResolution.resolutionReason,
      capabilityResolutionReason: capabilityResolution.resolutionReason,
    };

    if (blockingReasons.length) {
      return finalizeHarnessResult({
        request,
        status: "blocked",
        executable: false,
        reason: "harness:connector_or_policy_blocked",
        agentId,
        capabilityId,
        requiredConnectors,
        connectorPlans,
        governancePrecheck: {
          ...governancePrecheck,
          status: "blocked",
          blockingReasons,
        },
        warnings,
        blockingReasons,
        ...resolutionExtras,
      });
    }

    if (warnings.length) {
      return finalizeHarnessResult({
        request,
        status: "warning",
        executable: true,
        reason: "harness:planned_with_warnings",
        agentId,
        capabilityId,
        requiredConnectors,
        connectorPlans,
        governancePrecheck,
        warnings,
        blockingReasons: [],
        ...resolutionExtras,
      });
    }

    return finalizeHarnessResult({
      request,
      status: "planned",
      executable: true,
      reason: "harness:planned",
      agentId,
      capabilityId,
      requiredConnectors,
      connectorPlans,
      governancePrecheck,
      warnings: [],
      blockingReasons: [],
      ...resolutionExtras,
    });
  } catch {
    return finalizeHarnessResult({
      request,
      status: "blocked",
      executable: false,
      reason: "harness:plan_failed",
      requiredConnectors: [],
      connectorPlans: [],
      governancePrecheck: buildGovernancePrecheckForCapability(),
      warnings: [],
      blockingReasons: ["harness_internal_error"],
    });
  }
}

export function planRequirementsHarnessDryRun(input: {
  readonly intent?: string;
  readonly action?: string;
  readonly stage?: string;
  readonly projectId?: string;
  readonly conversationId?: string;
  readonly runId?: string;
  readonly taskId?: string;
}): HarnessDryRunResult {
  return planAgentHarnessDryRun(
    buildHarnessDryRunRequest({
      ...input,
      source: "requirements",
    }),
  );
}
