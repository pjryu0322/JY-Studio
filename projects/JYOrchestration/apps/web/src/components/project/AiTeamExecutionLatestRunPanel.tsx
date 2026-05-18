"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchExecutionRuns,
  type TaskExecutionRunDto,
} from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";

export function AiTeamExecutionLatestRunPanel({ projectId }: { projectId: string }) {
  const [run, setRun] = useState<TaskExecutionRunDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    setLoading(true);
    try {
      const { res, json } = await fetchExecutionRuns(pid, { take: 1 });
      if (!res.ok || !json.success || !json.data?.length) {
        setRun(null);
        return;
      }
      setRun(json.data[0] ?? null);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApproveRuntime = useCallback(async () => {
    const taskId = run?.taskId?.trim();
    if (!taskId || approving) return;
    setApproving(true);
    setApproveError(null);
    try {
      const res = await credentialsIncludeFetch("/api/task/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          action: "workflow-approve-ai-team-runtime",
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setApproveError(json.message ?? "승인 요청에 실패했습니다.");
        return;
      }
      await load();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "승인 요청 중 오류가 발생했습니다.");
    } finally {
      setApproving(false);
    }
  }, [approving, load, run?.taskId]);

  if (!projectId.trim()) return null;

  const team = run?.teamRuntime;
  const showApproveButton = team?.status === "approval_waiting" && Boolean(run?.taskId);

  return (
    <section
      data-testid="ai-team-execution-latest-run"
      style={{
        marginBottom: 16,
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        background: "#fff",
      }}
    >
      <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        AI팀 실행 Runtime (최근 기록)
      </h3>
      {loading ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>불러오는 중…</p>
      ) : !run || !team ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>실행 기록이 없습니다.</p>
      ) : (
        <>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gap: 6,
              fontSize: 12,
              gridTemplateColumns: "minmax(120px,auto) 1fr",
              color: "#334155",
            }}
          >
            <dt style={{ color: "#64748b" }}>전체 상태</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>{team.statusKo}</dd>
            <dt style={{ color: "#64748b" }}>AI개발자</dt>
            <dd style={{ margin: 0 }}>
              {team.developer.status}
              {team.developer.cursorRunId ? ` · run ${team.developer.cursorRunId}` : ""}
              {team.developer.branchName ? ` · ${team.developer.branchName}` : ""}
              {team.developer.commitSha ? ` · ${team.developer.commitSha.slice(0, 8)}` : ""}
              {team.developer.changedFilesCount != null ? ` · files ${team.developer.changedFilesCount}` : ""}
            </dd>
            <dt style={{ color: "#64748b" }}>AI검수자</dt>
            <dd style={{ margin: 0 }}>{team.review.status}</dd>
            <dt style={{ color: "#64748b" }}>AI보안관</dt>
            <dd style={{ margin: 0 }}>{team.security.status}</dd>
            <dt style={{ color: "#64748b" }}>사용자 승인</dt>
            <dd style={{ margin: 0 }}>
              {team.approval.required ? team.approval.status : "불필요"}
            </dd>
            {team.pr ? (
              <>
                <dt style={{ color: "#64748b" }}>PR</dt>
                <dd style={{ margin: 0 }}>
                  {team.pr.pullRequestState ?? "—"}
                  {team.pr.pullRequestNumber != null ? ` #${team.pr.pullRequestNumber}` : ""}
                  {team.pr.pullRequestUrl ? (
                    <>
                      {" "}
                      <a href={team.pr.pullRequestUrl} target="_blank" rel="noreferrer">
                        링크
                      </a>
                    </>
                  ) : null}
                </dd>
              </>
            ) : null}
            {team.blockReason ? (
              <>
                <dt style={{ color: "#64748b" }}>차단 사유</dt>
                <dd style={{ margin: 0, color: "#b45309" }}>{team.blockReason}</dd>
              </>
            ) : null}
          </dl>
          {showApproveButton ? (
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                data-testid="ai-team-runtime-approve-btn"
                disabled={approving}
                onClick={() => void handleApproveRuntime()}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #2563eb",
                  background: approving ? "#e2e8f0" : "#2563eb",
                  color: approving ? "#64748b" : "#fff",
                  cursor: approving ? "not-allowed" : "pointer",
                }}
              >
                {approving ? "승인 처리 중…" : "AI팀 Runtime 승인"}
              </button>
              {approveError ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b45309" }}>{approveError}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
