import { describe, expect, it } from "vitest";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { detectStructureConflicts, jaccardSimilarity } from "@/lib/project-structure/projectStructureConflicts";
import {
  buildStructureCandidateNodeKey,
  fingerprintStructureText,
  planStructureCandidatesFromEvent,
  planStructureCandidatesFromEvents,
} from "@/lib/project-structure/projectStructureExtractorPlan";
import { STRUCTURE_CANDIDATE_NODE_TYPES, STRUCTURE_CONFLICT_KINDS } from "@/lib/project-structure/projectStructureTypes";

describe("planStructureCandidatesFromEvent", () => {
  it("creates Idea structure from project.created graph mapping", () => {
    const plan = planStructureCandidatesFromEvent({
      id: "e1",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
      payload: { name: "App", projectType: "WEB" },
    });
    expect(plan.nodes.some((n) => n.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.IDEA)).toBe(true);
    expect(plan.nodes[0]?.idempotencyKey).toBe(buildStructureCandidateNodeKey("e1", STRUCTURE_CANDIDATE_NODE_TYPES.IDEA));
  });

  it("creates Requirement from conversation message", () => {
    const plan = planStructureCandidatesFromEvent({
      id: "e2",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
      payload: { sourceMessageId: "m1" },
      messageContent: "Users must log in securely",
    });
    expect(plan.nodes.some((n) => n.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT)).toBe(true);
  });

  it("replay merge is idempotent in plan keys", () => {
    const events = [
      {
        id: "e1",
        projectId: "p1",
        eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
        payload: { name: "A" },
      },
      {
        id: "e1",
        projectId: "p1",
        eventType: PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED,
        payload: { name: "A" },
      },
    ];
    const once = planStructureCandidatesFromEvents(events.slice(0, 1));
    const twice = planStructureCandidatesFromEvents(events);
    expect(twice.nodes.length).toBe(once.nodes.length);
  });
});

describe("detectStructureConflicts", () => {
  it("detects duplicate requirements by fingerprint", () => {
    const fp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, "Login", "Users need login");
    const conflicts = detectStructureConflicts([
      {
        id: "c1",
        nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT,
        title: "Login",
        summary: "Users need login",
        fingerprint: fp,
        metadata: {},
        lifecycleStatus: "CANDIDATE",
      },
      {
        id: "c2",
        nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT,
        title: "Login",
        summary: "Users need login",
        fingerprint: fp,
        metadata: {},
        lifecycleStatus: "CANDIDATE",
      },
    ]);
    expect(conflicts.some((c) => c.kind === STRUCTURE_CONFLICT_KINDS.DUPLICATE_REQUIREMENT)).toBe(true);
  });
});

describe("jaccardSimilarity", () => {
  it("returns high score for similar phrases", () => {
    expect(jaccardSimilarity("user login required", "user login required")).toBe(1);
  });
});
