import type { TeamRuntimeSummaryDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";

const dtStyle = { color: "#64748b" } as const;
const ddStyle = { margin: 0 } as const;

export function AiTeamRuntimeSummaryDl({ team }: { team: TeamRuntimeSummaryDto }) {
  return (
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
      <dt style={dtStyle}>전체 상태</dt>
      <dd style={{ ...ddStyle, fontWeight: 600 }}>{team.statusKo}</dd>
      <dt style={dtStyle}>AI개발자</dt>
      <dd style={ddStyle}>
        {team.developer.status}
        {team.developer.cursorRunId ? ` · run ${team.developer.cursorRunId}` : ""}
        {team.developer.branchName ? ` · ${team.developer.branchName}` : ""}
        {team.developer.commitSha ? ` · ${team.developer.commitSha.slice(0, 8)}` : ""}
        {team.developer.changedFilesCount != null ? ` · files ${team.developer.changedFilesCount}` : ""}
      </dd>
      <dt style={dtStyle}>AI검수자</dt>
      <dd style={ddStyle}>{team.review.status}</dd>
      <dt style={dtStyle}>AI보안관</dt>
      <dd style={ddStyle}>{team.security.status}</dd>
      <dt style={dtStyle}>사용자 승인</dt>
      <dd style={ddStyle}>{team.approval.required ? team.approval.status : "불필요"}</dd>
      {team.pr ? (
        <>
          <dt style={dtStyle}>PR</dt>
          <dd style={ddStyle}>
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
          <dt style={dtStyle}>차단 사유</dt>
          <dd style={{ ...ddStyle, color: "#b45309" }}>{team.blockReason}</dd>
        </>
      ) : null}
    </dl>
  );
}
