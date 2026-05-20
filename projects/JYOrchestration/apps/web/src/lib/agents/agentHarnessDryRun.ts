/**
 * Agent Harness Dry-run — combines Stage 2-1 resolver + Stage 2-2 connector facade (no execution).
 */

import { validateAgentCapabilityBinding } from "@/lib/agents/agentCapabilityBinding";
import type {
  HarnessDryRunRequest,
  HarnessDryRunResult,
  HarnessDryRunStatus,
  HarnessGovernancePrecheck,
} from "@/lib/agents/agentHarnessDryRunTypes";
import { getAgentById } from "@/lib/agents/agentRegistry";
import { getCapabilityById } from "@/lib/agents/capabilityRegistry";
import { planConnectorInvocation } from "@/lib/agents/connectorGatewayFacade";
import type { ConnectorInvocationResult } from "@/lib/agents/connectorGatewayFacadeTypes";
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
    const status = blocking.length ? "blocked" : warnings.length ? "warning" : "not_evaluated";
    return {
      requiredChecks: [],
      status,
      ...(warnings.length ? { warnings } : {}),
      ...(blocking.length ? { blockingReasons: blocking } : {}),
    };
  }

  const cap = getCapabilityById(capabilityId.trim());
  if (!cap) {
    return {
      requiredChecks: [],
      status: "warning",
      warnings: [`unknown_capability:${capabilityId}`],
      ...(blocking.length ? { blockingReasons: blocking } : {}),
    };
  }

  const requiredChecks = [...(cap.governanceChecks ?? [])];
  let status: HarnessGovernancePrecheck["status"] = "not_evaluated";
  if (blocking.length) status = "blocked";
  else if (warnings.length) status = "warning";
  else if (requiredChecks.length) status = "pass_candidate";

  return {
    requiredChecks,
    status,
    ...(warnings.length ? { warnings } : {}),
    ...(blocking.length ? { blockingReasons: blocking } : {}),
  };
}

function resolveHarnessAgentId(request: HarnessDryRunRequest): {
  readonly agentId?: string;
  readonly warnings: string[];
} {
  const warnings: string[] = [];
  const direct = trimOptional(request.agentId);
  if (direct) {
    if (!getAgentById(direct)) warnings.push(`unknown_agent:${direct}`);
    return { agentId: direct, warnings };
  }

  const resolved = resolveDispatchAgent({
    intentToken: request.intent,
    suggestedActionId: request.action,
    stage: request.stage,
    runtimeRole: request.runtimeRole,
    aiMemberRole: request.aiMemberRole,
  });

  if (resolved.agentId) return { agentId: resolved.agentId, warnings: [...warnings, ...(resolved.warnings ?? [])] };
  return {
    warnings: [...warnings, ...(resolved.warnings ?? []), resolved.reason],
  };
}

function resolveHarnessCapabilityId(
  request: HarnessDryRunRequest,
  agentId?: string,
): {
  readonly capabilityId?: string;
  readonly warnings: string[];
} {
  const warnings: string[] = [];
  const direct = trimOptional(request.capabilityId);
  if (direct) {
    if (!getCapabilityById(direct)) warnings.push(`unknown_capability:${direct}`);
    return { capabilityId: direct, warnings };
  }

  const resolved = resolveDispatchCapability({
    agentId,
    intentToken: request.intent,
    stage: request.stage,
    suggestedActionId: request.action,
  });

  if (resolved.capabilityId) {
    return { capabilityId: resolved.capabilityId, warnings: [...warnings, ...(resolved.warnings ?? [])] };
  }
  return {
    warnings: [...warnings, ...(resolved.warnings ?? []), resolved.reason],
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

function harnessUnresolvedResult(input: {
  readonly status: Extract<HarnessDryRunStatus, "no_agent" | "no_capability">;
  readonly reason: string;
  readonly agentId?: string;
  readonly blockingKey: "no_agent" | "no_capability";
  readonly warnings: string[];
}): HarnessDryRunResult {
  return finalizeHarnessResult({
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
  });
}

function finalizeHarnessResult(input: {
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
  readonly metadata?: Readonly<Record<string, unknown>>;
}): HarnessDryRunResult {
  const agent = input.agentId ? getAgentById(input.agentId) : undefined;
  return {
    status: input.status,
    executable: input.executable,
    reason: input.reason,
    requiredConnectors: input.requiredConnectors,
    connectorPlans: input.connectorPlans,
    governancePrecheck: input.governancePrecheck,
    warnings: [...input.warnings],
    blockingReasons: [...input.blockingReasons],
    ...(input.agentId ? { agentId: input.agentId } : {}),
    ...(agent ? { agentType: agent.type } : {}),
    ...(input.capabilityId ? { capabilityId: input.capabilityId } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
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
        status: "no_agent",
        reason: "harness:no_agent_resolved",
        blockingKey: "no_agent",
        warnings,
      });
    }

    const agentId = agentResolution.agentId;
    const capabilityResolution = resolveHarnessCapabilityId(request, agentId);
    warnings.push(...capabilityResolution.warnings);

    if (!capabilityResolution.capabilityId) {
      return finalizeHarnessResult({
        status: "no_capability",
        executable: false,
        reason: "harness:no_capability_resolved",
        agentId,
        requiredConnectors: [],
        connectorPlans: [],
        governancePrecheck: buildGovernancePrecheckForCapability(undefined, { warnings }),
        warnings,
        blockingReasons: ["no_capability"],
      });
    }

    const capabilityId = capabilityResolution.capabilityId;
    const cap = getCapabilityById(capabilityId);

    if (!validateAgentCapabilityBinding(agentId, capabilityId)) {
      blockingReasons.push(`agent_capability_binding_invalid:${agentId}+${capabilityId}`);
      return finalizeHarnessResult({
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

    if (blockingReasons.length) {
      return finalizeHarnessResult({
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
      });
    }

    if (warnings.length) {
      return finalizeHarnessResult({
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
      });
    }

    return finalizeHarnessResult({
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
      metadata: request.source ? { source: request.source } : undefined,
    });
  } catch {
    return {
      status: "blocked",
      executable: false,
      reason: "harness:plan_failed",
      requiredConnectors: [],
      connectorPlans: [],
      governancePrecheck: buildGovernancePrecheckForCapability(),
      warnings: [],
      blockingReasons: ["harness_internal_error"],
    };
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
