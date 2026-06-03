export function AiTeamRuntimeApproveSection({
  approving,
  successMessage,
  error,
  onApprove,
}: {
  approving: boolean;
  successMessage: string | null;
  error: string | null;
  onApprove: () => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        data-testid="ai-team-runtime-approve-btn"
        disabled={approving}
        onClick={onApprove}
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
      {successMessage ? (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#166534" }}>{successMessage}</p>
      ) : null}
      {error ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b45309" }}>{error}</p> : null}
    </div>
  );
}
