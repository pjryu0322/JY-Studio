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
  projectIdFromPathname,
  resolveAppFlowStepFromLocation,
} from "@/lib/workflow/appFlowModel";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

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
      setExecutionSetup(null);
      return;
    }
    try {
      const ctx = await loadAppFlowProjectContext(guidanceProjectId);
      setProject(ctx.project);
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

  if (current === null && pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const showPlanningInlineWarning =
    current === "planning" && Boolean(guidanceProjectId) && !gates.executionEnabled && Boolean(gates.executionReason);

  return (
    <div
      data-testid="app-flow-guidance"
      style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, width: "100%" }}
    >
      {showPlanningInlineWarning ? (
        <div
          role="status"
          style={{
            marginBottom: 12,
            flexShrink: 0,
            padding: "8px 10px",
            border: "1px solid #fde68a",
            borderRadius: 10,
            background: "#fffbeb",
            color: "#92400e",
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          생성 준비 확인: {gates.executionReason}
        </div>
      ) : null}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", width: "100%", paddingBottom: 20 }}>
        {children}
      </div>
    </div>
  );
}
