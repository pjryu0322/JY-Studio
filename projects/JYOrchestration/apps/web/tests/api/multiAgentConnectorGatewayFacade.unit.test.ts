import { describe, expect, it } from "vitest";
import {
  planConnectorInvocation,
  planCursorConnectorInvocation,
  planGithubConnectorInvocation,
} from "@/lib/agents/connectorGatewayFacade";
import { buildConnectorPlanFromAgentMetadata } from "@/lib/agents/connectorGatewayFacade";

describe("multi-agent connector gateway facade stage 2-2", () => {
  it("planConnectorInvocation returns cursor dry_run as planned and allowed", () => {
    const r = planConnectorInvocation({
      connectorId: "cursor",
      operation: "prototype_build.plan",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
      mode: "dry_run",
    });
    expect(r.status).toBe("planned");
    expect(r.allowed).toBe(true);
    expect(r.connectorId).toBe("cursor");
  });

  it("planConnectorInvocation returns github dry_run as planned and allowed", () => {
    const r = planConnectorInvocation({
      connectorId: "github",
      operation: "pr.sync",
      agentId: "ai-scm",
      capabilityId: "git.pr.merge.control",
      mode: "dry_run",
    });
    expect(r.status).toBe("planned");
    expect(r.allowed).toBe(true);
  });

  it("unknown connectorId is blocked with allowed=false", () => {
    const r = planConnectorInvocation({
      connectorId: "nonexistent_connector",
      operation: "test",
    });
    expect(r.status).toBe("blocked");
    expect(r.allowed).toBe(false);
  });

  it("disabled codex connector returns allowed=false", () => {
    const r = planConnectorInvocation({
      connectorId: "codex",
      operation: "review",
      agentId: "ai-developer",
    });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe("skipped");
  });

  it("disabled copilot connector returns allowed=false", () => {
    const r = planConnectorInvocation({
      connectorId: "copilot",
      operation: "assist",
    });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe("skipped");
  });

  it("ai-developer + cursor returns allowed=true", () => {
    const r = planCursorConnectorInvocation({
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
      operation: "generate_prompt",
    });
    expect(r.allowed).toBe(true);
    expect(r.status).toBe("planned");
  });

  it("ai-planner + cursor returns blocked or allowed=false", () => {
    const r = planCursorConnectorInvocation({
      agentId: "ai-planner",
      capabilityId: "project.idea.structure",
      operation: "generate_prompt",
    });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe("blocked");
  });

  it("capability requiredConnectors mismatch with connectorId returns allowed=false", () => {
    const r = planCursorConnectorInvocation({
      agentId: "ai-developer",
      capabilityId: "source.review",
      operation: "review",
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("capability_connector_mismatch");
  });

  it("pass_through mode returns passed_through without external invocation", () => {
    const r = planConnectorInvocation({
      connectorId: "cursor",
      operation: "pass_through.record",
      agentId: "ai-developer",
      capabilityId: "cursor.implementation.plan",
      mode: "pass_through",
    });
    expect(r.status).toBe("passed_through");
    expect(r.allowed).toBe(true);
    expect(r.mode).toBe("pass_through");
  });

  it("buildConnectorPlanFromAgentMetadata reflects agentId and capabilityId from metadata", () => {
    const r = buildConnectorPlanFromAgentMetadata({
      connectorId: "github",
      operation: "pr.merge.check",
      agentRuntimeMetadata: {
        agentId: "ai-scm",
        capabilityId: "git.pr.merge.control",
      },
      projectId: "proj-1",
      runId: "run-1",
    });
    expect(r.allowed).toBe(true);
    expect(r.agentId).toBe("ai-scm");
    expect(r.capabilityId).toBe("git.pr.merge.control");
  });

  it("planGithubConnectorInvocation wraps github connector plan", () => {
    const r = planGithubConnectorInvocation({
      agentId: "ai-reviewer",
      capabilityId: "source.review",
      operation: "review.diff",
    });
    expect(r.connectorId).toBe("github");
    expect(r.allowed).toBe(true);
  });
});
