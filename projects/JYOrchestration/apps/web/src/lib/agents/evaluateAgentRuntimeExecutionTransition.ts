/**
 * Evaluate Multi-Agent Runtime execution transition readiness (read-only; no execution).
 */

import type {
  AgentRuntimeExecutionTransitionDecision,
  AgentRuntimeExecutionTransitionFinding,
  AgentRuntimeExecutionTransitionReport,
  AgentRuntimeExecutionTransitionTarget,
} from "@/lib/agents/agentRuntimeExecutionTransitionTypes";

function normalizeExecutionTransitionTarget(
  raw: string,
): AgentRuntimeExecutionTransitionTarget {
  const t = String(raw ?? "").trim();
  if (
    t === "harness_execution" ||
    t === "agent_execution_record" ||
    t === "connector_execution_bridge" ||
    t === "governance_enforcement" ||
    t === "timeline_replay_persist"
  ) {
    return t;
  }
  return "unknown";
}

function finding(
  severity: AgentRuntimeExecutionTransitionFinding["severity"],
  code: string,
  message: string,
): AgentRuntimeExecutionTransitionFinding {
  return { severity, code, message };
}

function resolveDecision(
  target: AgentRuntimeExecutionTransitionTarget,
): AgentRuntimeExecutionTransitionDecision {
  switch (target) {
    case "harness_execution":
    case "connector_execution_bridge":
    case "timeline_replay_persist":
      return "defer";
    case "agent_execution_record":
      return "ready_for_design";
    case "governance_enforcement":
      return "blocked";
    case "unknown":
      return "blocked";
    default:
      return "defer";
  }
}

function appendTargetFindings(
  findings: AgentRuntimeExecutionTransitionFinding[],
  target: AgentRuntimeExecutionTransitionTarget,
  decision: AgentRuntimeExecutionTransitionDecision,
): void {
  if (target === "unknown") {
    findings.push(finding("blocking", "unknown_target", "unknown execution transition target"));
    return;
  }

  if (target === "harness_execution") {
    findings.push(
      finding(
        "info",
        "defer_harness_execution",
        "dry-run planner to runtime executor has high impact; defer",
      ),
    );
    return;
  }

  if (target === "agent_execution_record") {
    findings.push(
      finding(
        "info",
        decision === "ready_for_design" ? "ready_execution_record" : "defer_execution_record",
        "execution record design is possible; review storage impact before wire",
      ),
    );
    return;
  }

  if (target === "connector_execution_bridge") {
    findings.push(
      finding(
        "info",
        "defer_connector_bridge",
        "Cursor/GitHub execution path impact; defer connector bridge",
      ),
    );
    return;
  }

  if (target === "governance_enforcement") {
    findings.push(
      finding(
        "blocking",
        "governance_enforcement_blocked",
        "actual governance enforcement requires policy approval",
      ),
    );
    return;
  }

  if (target === "timeline_replay_persist") {
    findings.push(
      finding(
        "info",
        "defer_timeline_replay_persist",
        "Timeline/Replay persist affects DB/schema; defer",
      ),
    );
  }
}

/** Read-only execution transition report — does not run agents or wire connectors. */
export function evaluateAgentRuntimeExecutionTransition(input: {
  readonly target: AgentRuntimeExecutionTransitionTarget;
}): AgentRuntimeExecutionTransitionReport {
  const findings: AgentRuntimeExecutionTransitionFinding[] = [];
  const target = normalizeExecutionTransitionTarget(String(input.target ?? ""));
  const decision = resolveDecision(target);

  appendTargetFindings(findings, target, decision);

  return {
    mode: "read_only_execution_transition_decision",
    decision,
    target,
    requiresOperatorApproval: true,
    requiresRollbackPlan: true,
    requiresRegressionTest:
      target === "connector_execution_bridge" ||
      target === "governance_enforcement" ||
      target === "timeline_replay_persist",
    findings,
  };
}
