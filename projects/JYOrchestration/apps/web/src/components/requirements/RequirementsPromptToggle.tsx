"use client";


export function RequirementsPromptToggle({
  open,
  onToggle,
}: {
  readonly open: boolean;
  readonly onToggle: () => void;
}) {  return (
    <div className="relative" style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 8 }}>      <button
        type="button"
        onClick={onToggle}
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid #cbd5e1",
          background: open ? "#ecfeff" : "#fff",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {open ? "프롬프트 숨기기" : "AI 전달 프롬프트 보기"}
      </button>
      <span style={{ fontSize: 12, color: "#64748b" }}>사용자 검토용(민감정보 미포함)</span>
    </div>
  );
}

