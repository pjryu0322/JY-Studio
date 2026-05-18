"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  fetchExecutionRuns,
  type TaskExecutionRunDto,
} from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import { credentialsIncludeFetch } from "@/lib/http/credentialsIncludeFetch";
import { AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO } from "@/lib/ai-team-runtime/timeline";
import type { TeamRuntimeTimelineItemDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";

export function AiTeamExecutionLatestRunPanel({ projectId }: { projectId: string }) {
  const [run, setRun] = useState<TaskExecutionRunDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

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
    setApproveSuccess(null);
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
      setApproveSuccess("승인 완료. 동일 Task 실행 시 merge 단계로 진행됩니다.");
      await load();
    } catch (e) {
      setApproveError(e instanceof Error ? e.message : "승인 요청 중 오류가 발생했습니다.");
    } finally {
      setApproving(false);
    }
  }, [approving, load, run?.taskId]);

  if (!projectId.trim()) return null;

  const team = run?.teamRuntime;
  const timeline = team?.timeline ?? [];
  const showApproveButton = team?.status === "approval_waiting" && Boolean(run?.taskId);

  const badgeStyle = (status: string): CSSProperties => {
    const base: CSSProperties = {
      display: "inline-block",
      fontSize: 10,
      fontWeight: 700,
      padding: "2px 6px",
      borderRadius: 4,
      marginRight: 6,
    };
    switch (status) {
      case "succeeded":
        return { ...base, background: "#dcfce7", color: "#166534" };
      case "running":
        return { ...base, background: "#dbeafe", color: "#1d4ed8" };
      case "failed":
        return { ...base, background: "#fee2e2", color: "#991b1b" };
      case "blocked":
        return { ...base, background: "#fef3c7", color: "#b45309" };
      case "skipped":
        return { ...base, background: "#f1f5f9", color: "#64748b" };
      default:
        return { ...base, background: "#f8fafc", color: "#64748b" };
    }
  };

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
              {approveSuccess ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#166534" }}>{approveSuccess}</p>
              ) : null}
              {approveError ? (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b45309" }}>{approveError}</p>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
              AI팀 실행 타임라인
            </h4>
            {timeline.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                아직 표시할 실행 타임라인이 없습니다.
              </p>
            ) : (
              <ul
                data-testid="ai-team-runtime-timeline"
                style={{ margin: 0, padding: 0 }}
              >
                {timeline.map((item: TeamRuntimeTimelineItemDto) => {
                  const statusLabel =
                    AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO[
                      item.status as keyof typeof AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO
                    ] ?? item.status;
                  return (
                    <li
                      key={item.id}
                      data-testid={`ai-team-runtime-timeline-${item.id}`}
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: "8px 0",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
                        <span style={badgeStyle(item.status)}>{statusLabel}</span>
                        {item.titleKo}
                      </div>
                      {item.summaryKo ? (
                        <p style={{ margin: "0 0 4px", fontSize: 12, color: "#475569" }}>{item.summaryKo}</p>
                      ) : null}
                      <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                        {item.branchName ? `branch ${item.branchName}` : null}
                        {item.commitSha ? `${item.branchName ? " · " : ""}commit ${item.commitSha.slice(0, 8)}` : null}
                        {item.changedFileCount != null ? ` · files ${item.changedFileCount}` : null}
                        {item.prUrl ? (
                          <>
                            {" · "}
                            <a href={item.prUrl} target="_blank" rel="noreferrer">
                              PR{item.prNumber != null ? ` #${item.prNumber}` : ""}
                            </a>
                          </>
                        ) : null}
                      </p>
                      {item.blockReason ? (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                          {item.blockReason}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
