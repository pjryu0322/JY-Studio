/**
 * Artifact dependency graph — flow → feature → screen → api propagation for Hub UX.
 */

import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ArtifactLifecycleEntryWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { computeOrchestrationSourceHash } from "@/lib/requirements/requirementsArtifactLifecycle";
import { MAX_ARTIFACT_DEPENDENCY_EDGES } from "@/lib/requirements/requirementsOrchestrationConstants";

export type ArtifactDependencyKind = "flow" | "feature_spec" | "screen_spec" | "api_spec" | "project_artifacts";

export type ArtifactDependencyEdge = Readonly<{
  readonly from: ArtifactDependencyKind;
  readonly to: ArtifactDependencyKind;
  readonly stale: boolean;
  readonly reason?: string;
}>;

const CHAIN: readonly ArtifactDependencyKind[] = ["flow", "feature_spec", "screen_spec", "api_spec"];

export function buildArtifactDependencyGraph(input: {
  readonly state: RequirementsStateJson;
  readonly lifecycle?: readonly ArtifactLifecycleEntryWire[];
  readonly flowChanged?: boolean;
}): readonly ArtifactDependencyEdge[] {
  const hash = computeOrchestrationSourceHash(input.state);
  const headStale = input.lifecycle?.some((e) => e.stale && e.artifactKey === "project-artifacts");
  const flowStale = input.flowChanged === true;
  const edges: ArtifactDependencyEdge[] = [];

  for (let i = 0; i < CHAIN.length - 1; i++) {
    const from = CHAIN[i]!;
    const to = CHAIN[i + 1]!;
    const stale = flowStale || (from === "flow" && headStale === true) || Boolean(headStale);
    edges.push({
      from,
      to,
      stale,
      ...(stale ? { reason: `${from} 변경으로 ${to} 갱신 필요` } : {}),
    });
  }

  edges.push({
    from: "api_spec",
    to: "project_artifacts",
    stale: Boolean(headStale),
    ...(headStale ? { reason: "runtime/artifact hash drift" } : {}),
  });

  void hash;
  return edges.slice(0, MAX_ARTIFACT_DEPENDENCY_EDGES);
}

export function artifactPropagationLabelsKo(edges: readonly ArtifactDependencyEdge[]): readonly string[] {
  return edges.filter((e) => e.stale).map((e) => e.reason ?? `${e.from}→${e.to}`);
}
