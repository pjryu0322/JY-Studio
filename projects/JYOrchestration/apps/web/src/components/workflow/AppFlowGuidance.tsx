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
import { buildAppFlowStatusLines } from "@/lib/workflow/flow-status-lines";
import { stripStepReachableForUi, gateReasonForStep } from "@/components/workflow/flowStripHelpers";
import { FlowStatusSummary } from "@/components/workflow/FlowStatusSummary";
import { FlowNextActionCard } from "@/components/workflow/FlowNextActionCard";

export function AppFlowGuidance({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const current = resolveAppFlowStepFromLocation(pathname, searchParams);
  const pathProjectId = projectIdFromPathname(pathname);
  const queryProjectId = String(searchParams.get("projectId") ?? "").trim() || null;

  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setStoredProjectId(sessionStorage.getItem(APP_FLOW_LAST_PROJECT_KEY));
    } catch {
      setStoredProjectId(null);
    }
  }, [pathname]);

  useEffect(() => {
    if (pathProjectId && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(APP_FLOW_LAST_PROJECT_KEY, pathProjectId);
        setStoredProjectId(pathProjectId);
      } catch {
        /* ignore */
      }
    }
  }, [pathProjectId]);

  const effectiveProjectId = pathProjectId ?? queryProjectId ?? storedProjectId;

  const reloadFlowData = useCallback(async () => {
    if (!effectiveProjectId) {
      setProject(null);
      setTaskCount(0);
      setExecutionSetup(null);
      return;
    }
    try {
      const ctx = await loadAppFlowProjectContext(effectiveProjectId);
      setProject(ctx.project);
      setTaskCount(ctx.taskCount);
      setExecutionSetup(ctx.executionSetup);
    } catch {
      /* ignore transient load errors */
    }
  }, [effectiveProjectId]);

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
        projectId: effectiveProjectId,
        project,
        executionSetup,
      }),
    [effectiveProjectId, project, executionSetup]
  );

  const offFlow = current === null && !pathname.startsWith("/login");
  const next = current ? nextStepAfter(current) : null;
  const nextReachable = next ? stripStepReachableForUi(next.id, current, gates) : false;
  const nextBlockReason = next && !nextReachable ? gateReasonForStep(next.id, gates) : null;

  const statusLines = useMemo(
    () =>
      buildAppFlowStatusLines({
        effectiveProjectId,
        project,
        taskCount,
        gates,
      }),
    [effectiveProjectId, project, taskCount, gates]
  );

  if (current === null && pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const onRequirementsPage = current === "requirements";
  const hideGuidanceFooter = onRequirementsPage;

  return (
    <div data-testid="app-flow-guidance">
      <div style={{ marginBottom: 20 }}>{children}</div>

      {hideGuidanceFooter ? null : (
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
            projectId={effectiveProjectId}
          />
        </div>
      )}
    </div>
  );
}
