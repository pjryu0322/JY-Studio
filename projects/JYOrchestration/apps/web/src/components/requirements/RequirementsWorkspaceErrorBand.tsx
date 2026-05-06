"use client";

export type RequirementsWorkspaceErrorBandProps = Readonly<{
  error: string | null;
  organizeState: "idle" | "running" | "done" | "error";
  organizeError: string | null;
  /** 상태 초기화 후 기획안 생성 재시도 */
  onRetryOrganizeProposal: () => void | Promise<void>;
}>;

export function RequirementsWorkspaceErrorBand({
  error,
  organizeState,
  organizeError,
  onRetryOrganizeProposal,
}: RequirementsWorkspaceErrorBandProps) {
  if (!error) {
    return null;
  }

  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ color: "#b91c1c", fontWeight: 600, fontSize: 13 }} role="alert">
        {error}
      </p>
      {organizeState === "error" && organizeError ? (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => void onRetryOrganizeProposal()}
            style={{
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            기획안 생성 다시 시도
          </button>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 600 }}>
            현재 확보된 내용으로 기획안을 다시 생성합니다
          </div>
        </div>
      ) : null}
    </div>
  );
}
