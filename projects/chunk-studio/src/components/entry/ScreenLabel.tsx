"use client";

interface ScreenLabelProps {
  screen: string;
  mode?: "Operator" | "Manager";
  context: string;
}

export default function ScreenLabel({ screen, mode, context }: ScreenLabelProps) {
  const modeTone =
    mode === "Operator"
      ? {
          color: "#1e40af",
          border: "1px solid rgba(59, 130, 246, 0.25)",
          background: "rgba(219, 234, 254, 0.7)",
        }
      : {
          color: "#4338ca",
          border: "1px solid rgba(99, 102, 241, 0.25)",
          background: "rgba(224, 231, 255, 0.72)",
        };

  return (
    <div
      style={{
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.72)",
        padding: "6px 9px",
        fontSize: 11,
        color: "#64748b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <strong style={{ color: "#122549" }}>Chunk Studio</strong>
          <span style={{ color: "#7a889f" }}>/</span>
          {mode ? (
            <>
              <span>{mode}</span>
              <span style={{ color: "#7a889f" }}>/</span>
            </>
          ) : null}
          <span>{screen}</span>
          <span style={{ color: "#7a889f" }}>/</span>
          <span>{context}</span>
        </div>
        {mode ? (
          <span
            style={{
              ...modeTone,
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {mode}
          </span>
        ) : null}
      </div>
    </div>
  );
}
