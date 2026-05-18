/**
 * MVP — Screen flow model (in-memory only).
 *
 * Represents navigation / dependency relationships between screens for preparation-time ordering.
 * NOT wired into execution runtime yet.
 */

import type { MvpScreen } from "../domain/mvpDomainTypes";

export type ScreenFlowEdgeType = "NAVIGATION" | "DEPENDENCY";

export type ScreenFlowEdge = {
  id: string;
  projectId: string;
  fromScreenId: string;
  toScreenId: string;
  type: ScreenFlowEdgeType;
  /** Optional edge-order within the same `fromScreenId` + `type` group. */
  order?: number;
};

export type ScreenFlowGraph = {
  screens: MvpScreen[];
  edges: ScreenFlowEdge[];
};

