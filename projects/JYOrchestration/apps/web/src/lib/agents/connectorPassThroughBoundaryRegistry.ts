/**
 * Pass-through boundary registry (no execution routing).
 */

import { DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES } from "@/lib/agents/defaultConnectorPassThroughBoundaries";
import type {
  ConnectorPassThroughBoundary,
  ConnectorPassThroughBoundaryKind,
} from "@/lib/agents/connectorPassThroughBoundaryTypes";

const byId = new Map<string, ConnectorPassThroughBoundary>(
  DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES.map((b) => [b.id, b]),
);

export function listConnectorPassThroughBoundaries(): readonly ConnectorPassThroughBoundary[] {
  return [...byId.values()];
}

export function getConnectorPassThroughBoundaryById(
  boundaryId: string,
): ConnectorPassThroughBoundary | undefined {
  return byId.get(String(boundaryId ?? "").trim());
}

export function getConnectorPassThroughBoundariesByConnector(
  connectorId: string,
): readonly ConnectorPassThroughBoundary[] {
  const id = String(connectorId ?? "").trim();
  return DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES.filter((b) => b.connectorId === id);
}

export function getConnectorPassThroughBoundariesByKind(
  kind: ConnectorPassThroughBoundaryKind,
): readonly ConnectorPassThroughBoundary[] {
  return DEFAULT_CONNECTOR_PASS_THROUGH_BOUNDARIES.filter((b) => b.kind === kind);
}
