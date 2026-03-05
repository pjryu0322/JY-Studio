"use client";

type PipelineStatus = "done" | "current" | "todo";

interface PipelineStep {
  key: string;
  label: string;
  status: PipelineStatus;
}

interface PipelineBarProps {
  steps: PipelineStep[];
}

function stylesFor(status: PipelineStatus): {
  border: string;
  background: string;
  color: string;
} {
  if (status === "done") {
    return {
      border: "1px solid #81c784",
      background: "#e8f5e9",
      color: "#1b5e20",
    };
  }
  if (status === "current") {
    return {
      border: "1px solid #64b5f6",
      background: "#e3f2fd",
      color: "#0d47a1",
    };
  }
  return {
    border: "1px solid #ddd",
    background: "#fff",
    color: "#666",
  };
}

export default function PipelineBar({ steps }: PipelineBarProps) {
  return (
    <div
      style={{
        borderBottom: "1px solid #eee",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {steps.map((step, idx) => {
        const style = stylesFor(step.status);
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                ...style,
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: step.status === "current" ? 600 : 500,
              }}
            >
              {step.label}
            </div>
            {idx < steps.length - 1 && <span style={{ color: "#999", fontSize: 12 }}>→</span>}
          </div>
        );
      })}
    </div>
  );
}
