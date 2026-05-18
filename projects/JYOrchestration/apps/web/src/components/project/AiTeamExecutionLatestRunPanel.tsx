"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchExecutionRuns,
  type TaskExecutionRunDto,
} from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";

export function AiTeamExecutionLatestRunPanel({ projectId }: { projectId: string }) {
  const [run, setRun] = useState<TaskExecutionRunDto | null>(null);
  const [loading, setLoading] = useState(false);

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

  if (!projectId.trim()) return null;

  const team = run?.teamRuntime;

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
          {team.blockReason ? (
            <>
              <dt style={{ color: "#64748b" }}>차단 사유</dt>
              <dd style={{ margin: 0, color: "#b45309" }}>{team.blockReason}</dd>
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}
