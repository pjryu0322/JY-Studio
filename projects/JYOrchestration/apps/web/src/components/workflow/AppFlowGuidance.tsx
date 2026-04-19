"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "@/components/project-spec/types";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import {
  APP_FLOW_LAST_PROJECT_KEY,
  APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT,
  computeFlowGates,
  loadAppFlowProjectContext,
  nextStepAfter,
  projectIdFromPathname,
  resolveAppFlowStepFromLocation,
} from "@/lib/workflow/appFlowModel";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";
import { buildAppFlowStatusLines } from "@/lib/workflow/flow-status-lines";
import { stripStepReachableForUi, gateReasonForStep } from "@/components/workflow/flowStripHelpers";
import { FlowStatusSummary } from "@/components/workflow/FlowStatusSummary";
import { FlowNextActionCard } from "@/components/workflow/FlowNextActionCard";

export function AppFlowGuidance({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const current = resolveAppFlowStepFromLocation(pathname, searchParams);
  const pathProjectId = projectIdFromPathname(pathname);

  const guidanceProjectId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams)?.trim() || null,
    [pathname, searchParams]
  );

  const [project, setProject] = useState<Project | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);

  useEffect(() => {
    if (pathProjectId && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(APP_FLOW_LAST_PROJECT_KEY, pathProjectId);
      } catch {
        /* ignore */
      }
    }
  }, [pathProjectId]);

  const reloadFlowData = useCallback(async () => {
    if (!guidanceProjectId) {
      setProject(null);
      setTaskCount(0);
      setExecutionSetup(null);
      return;
    }
    try {
      const ctx = await loadAppFlowProjectContext(guidanceProjectId);
      setProject(ctx.project);
      setTaskCount(ctx.taskCount);
      setExecutionSetup(ctx.executionSetup);
    } catch {
      /* ignore transient load errors */
    }
  }, [guidanceProjectId]);

  useEffect(() => {
    void reloadFlowData();
  }, [reloadFlowData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRefresh = () => {
      void reloadFlowData();
    };
    window.addEventListener(APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(APP_FLOW_PROJECT_CONTEXT_REFRESH_EVENT, onRefresh);
  }, [reloadFlowData]);

  const gates = useMemo(
    () =>
      computeFlowGates({
        projectId: guidanceProjectId,
        project,
        executionSetup,
      }),
    [guidanceProjectId, project, executionSetup]
  );

  const offFlow = current === null && !pathname.startsWith("/login");
  const next = current ? nextStepAfter(current) : null;
  const nextReachable = next ? stripStepReachableForUi(next.id, current, gates) : false;
  const nextBlockReason = next && !nextReachable ? gateReasonForStep(next.id, gates) : null;

  const statusLines = useMemo(
    () =>
      buildAppFlowStatusLines({
        effectiveProjectId: guidanceProjectId,
        project,
        taskCount,
        gates,
      }),
    [guidanceProjectId, project, taskCount, gates]
  );

  if (current === null && pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const onRequirementsPage = current === "requirements";
  const hideGuidanceFooter = onRequirementsPage;
  const showGuidanceFooter = Boolean(guidanceProjectId) && !hideGuidanceFooter;

  return (
    <div data-testid="app-flow-guidance">
      <div style={{ marginBottom: 20 }}>{children}</div>

      {showGuidanceFooter ? (
        <div
          style={{
            marginTop: 8,
            paddingTop: 16,
            borderTop: "1px solid #e5e7eb",
            display: "grid",
            gap: 12,
          }}
        >
          <FlowStatusSummary lines={statusLines} />
          <FlowNextActionCard
            offFlow={offFlow}
            currentIsRequirements={onRequirementsPage}
            next={next}
            nextReachable={nextReachable}
            nextBlockReason={nextBlockReason}
            projectId={guidanceProjectId}
          />
        </div>
      ) : null}
    </div>
  );
}
