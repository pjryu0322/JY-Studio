"use client";

interface ScreenLabelProps {
  screen: string;
  mode?: "Operator" | "Manager";
  context: string;
}

export default function ScreenLabel({ screen, mode, context }: ScreenLabelProps) {
  return (
    <div
      style={{
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderRadius: 12,
        background: "rgba(255,255,255,0.86)",
        padding: "8px 10px",
        fontSize: 12,
        color: "#516077",
      }}
    >
      <strong style={{ color: "#122549" }}>Chunk Studio</strong>
      <span> / {screen}</span>
      {mode ? <span> / {mode}</span> : null}
      <span> / {context}</span>
    </div>
  );
}
