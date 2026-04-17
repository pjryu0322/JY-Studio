"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchExecutionSetup,
  fetchGeneratedTasks,
  fetchProjectById,
} from "@/components/project-spec/api";
import type { ExecutionSetupDto } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import {
  APP_FLOW_LAST_PROJECT_KEY,
  APP_FLOW_STEPS,
  computeFlowGates,
  nextStepAfter,
  projectHasFeatureBaseline,
  projectIdFromPathname,
  resolveAppFlowStepFromPathname,
  stepReachableInStrip,
  type AppFlowStepId,
} from "@/lib/workflow/appFlowModel";
import { isRequirementsPendingWorkflow } from "@/lib/project/projectWorkflowStatus";

function stripStepReachable(
  stepId: AppFlowStepId,
  current: AppFlowStepId | null,
  gates: ReturnType<typeof computeFlowGates>
): boolean {
  if (current && stepId === current) return true;
  return stepReachableInStrip(stepId, gates);
}

function gateReasonForStep(stepId: AppFlowStepId, gates: ReturnType<typeof computeFlowGates>): string | null {
  if (stepId === "collaboration") return gates.collaborationReason;
  if (stepId === "features") return gates.featuresReason;
  if (stepId === "tasks") return gates.tasksReason;
  if (stepId === "planning") return gates.planningReason;
  if (stepId === "execution") return gates.executionReason;
  if (stepId === "trace") return gates.traceReason;
  return null;
}

export function AppFlowGuidance({ children }: { readonly children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const current = resolveAppFlowStepFromPathname(pathname);
  const pathProjectId = projectIdFromPathname(pathname);
  const queryProjectId = String(searchParams.get("projectId") ?? "").trim() || null;

  const [storedProjectId, setStoredProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [executionSetup, setExecutionSetup] = useState<ExecutionSetupDto | null>(null);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    try {
      const [{ project: p }, tasksRes, setupRes] = await Promise.all([
        fetchProjectById(effectiveProjectId),
        fetchGeneratedTasks(effectiveProjectId),
        fetchExecutionSetup(effectiveProjectId),
      ]);
      setProject(p);
      if (tasksRes.res.ok && tasksRes.json.success && Array.isArray(tasksRes.json.data)) {
        setTaskCount(tasksRes.json.data.length);
      } else {
        setTaskCount(0);
      }
      if (setupRes.res.ok && setupRes.json.success && setupRes.json.data) {
        setExecutionSetup(setupRes.json.data);
      } else {
        setExecutionSetup(null);
      }
    } finally {
      setLoading(false);
    }
  }, [effectiveProjectId]);

  useEffect(() => {
    void reloadFlowData();
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
  const nextReachable = next ? stripStepReachable(next.id, current, gates) : false;
  const nextBlockReason = next && !nextReachable ? gateReasonForStep(next.id, gates) : null;

  const statusLines = useMemo(() => {
    const lines: string[] = [];
    if (effectiveProjectId) {
      lines.push(`프로젝트: ${project?.name ?? effectiveProjectId}`);
      if (isRequirementsPendingWorkflow(project?.workflowStatus)) {
        lines.push("요구사항: 아직 단계 미완료 — 협업·실행 계획 등은 요구사항을 마친 뒤 단계 네비게이션에서 열 수 있습니다");
      }
      lines.push(
        projectHasFeatureBaseline(project)
          ? "스펙·실행 계획: 입력됨(작업 단계로 진행 가능)"
          : "스펙·실행 계획: 아직 없음(작업 단계는 스펙 또는 실행 계획이 있어야 합니다)"
      );
      lines.push(`작업 ${taskCount}개 생성됨`);
      lines.push(
        gates.executionEnabled
          ? "실행 환경: 검증 완료(실행 가능)"
          : `실행 환경: 준비 필요${gates.executionReason ? ` — ${gates.executionReason}` : ""}`
      );
    } else {
      lines.push("프로젝트: 아직 선택되지 않음(목록에서 프로젝트를 열면 단계 조건이 표시됩니다)");
    }
    return lines;
  }, [effectiveProjectId, project, taskCount, gates]);

  if (current === null && pathname.startsWith("/login")) {
    return <>{children}</>;
  }

  const stripStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    fontSize: 13,
  };

  return (
    <div data-testid="app-flow-guidance">
      <nav aria-label="전체 워크플로 단계" style={stripStyle}>
        {APP_FLOW_STEPS.map((s, i) => {
          const active = current === s.id;
          const reachable = stripStepReachable(s.id, current, gates);
          const reason = gateReasonForStep(s.id, gates);
          const labelStyle: CSSProperties = {
            fontWeight: active ? 800 : 600,
            color: active ? "#1d4ed8" : reachable ? "#334155" : "#94a3b8",
            whiteSpace: "nowrap",
          };
          const sep = i > 0 ? <span style={{ color: "#cbd5e1" }}>→</span> : null;
          return (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {sep}
              {reachable ? (
                <Link href={s.href} style={{ ...labelStyle, textDecoration: "none" }}>
                  {s.label}
                </Link>
              ) : (
                <span title={reason ?? undefined} style={{ ...labelStyle, cursor: "not-allowed" }}>
                  {s.label}
                </span>
              )}
            </span>
          );
        })}
        {loading ? <span style={{ marginLeft: 8, fontSize: 11, color: "#64748b" }}>상태 불러오는 중…</span> : null}
      </nav>

      <div style={{ marginBottom: 24 }}>{children}</div>

      <div
        style={{
          marginTop: 8,
          paddingTop: 16,
          borderTop: "1px solid #e5e7eb",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            background: "#fafafa",
            fontSize: 13,
            color: "#334155",
            lineHeight: 1.55,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6, color: "#0f172a" }}>현재 상태</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {statusLines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>다음 단계</span>
          {offFlow ? (
            <Link
              href="/requirements"
              style={{
                display: "inline-block",
                padding: "10px 16px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              요구사항에서 워크플로 시작
            </Link>
          ) : next ? (
            nextReachable ? (
              <Link
                href={next.href}
                style={{
                  display: "inline-block",
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                다음: {next.label} (이동)
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  style={{
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    color: "#64748b",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "not-allowed",
                  }}
                >
                  다음: {next.label} (조건 미충족)
                </button>
                {nextBlockReason ? (
                  <span style={{ fontSize: 12, color: "#b45309", maxWidth: 480 }}>{nextBlockReason}</span>
                ) : null}
              </>
            )
          ) : (
            <span style={{ fontSize: 13, color: "#64748b" }}>마지막 단계입니다. 필요하면 요구사항으로 돌아가 워크플로를 다시 시작하세요.</span>
          )}
          {current !== "requirements" && !offFlow ? (
            <Link href="/requirements" style={{ fontSize: 13, color: "#1d4ed8", fontWeight: 600 }}>
              요구사항으로
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
