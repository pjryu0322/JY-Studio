"use client";

import type { ReactNode } from "react";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

export function RequirementsWorkspaceStageRenderer({
  activeStage,
  ideationStage,
  serviceFlowStage,
}: {
  readonly activeStage: RequirementsWorkspaceStage;
  readonly ideationStage: ReactNode;
  readonly serviceFlowStage: ReactNode;
}) {
  return <>{activeStage === "service-flow" ? serviceFlowStage : ideationStage}</>;
}
