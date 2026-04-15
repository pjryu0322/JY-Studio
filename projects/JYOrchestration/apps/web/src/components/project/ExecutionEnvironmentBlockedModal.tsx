"use client";

type Props = Readonly<{
  open: boolean;
  onCancel: () => void;
  onGoSettings: () => void;
}>;

export function ExecutionEnvironmentBlockedModal({ open, onCancel, onGoSettings }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exec-env-blocked-title"
      data-testid="execution-environment-blocked-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15, 23, 42, 0.45)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 12,
          padding: "20px 22px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
        }}
      >
        <h2
          id="exec-env-blocked-title"
          style={{ margin: "0 0 10px 0", fontSize: 18, fontWeight: 800, color: "#0f172a" }}
        >
          실행 환경이 준비되지 않았습니다
        </h2>
        <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#475569", lineHeight: 1.5 }}>필수:</p>
        <ul style={{ margin: "0 0 18px 18px", padding: 0, fontSize: 14, color: "#334155", lineHeight: 1.6 }}>
          <li>Git 연결</li>
          <li>Cursor 설정</li>
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#f8fafc",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#334155",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onGoSettings}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2563eb",
              background: "#2563eb",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: "#fff",
            }}
          >
            설정으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}
