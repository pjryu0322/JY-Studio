"use client";

import type { ReactNode } from "react";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

export function RequirementsWorkspaceStageRenderer({
  activeStage,
  ideationStage,
  serviceFlowStage,
  featurePlanningStage,
}: {
  readonly activeStage: RequirementsWorkspaceStage;
  readonly ideationStage: ReactNode;
  readonly serviceFlowStage: ReactNode;
  readonly featurePlanningStage: ReactNode;
}) {
  if (activeStage === "feature-planning") return <>{featurePlanningStage}</>;
  if (activeStage === "service-flow") return <>{serviceFlowStage}</>;
  return <>{ideationStage}</>;
}
