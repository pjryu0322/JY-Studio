"use client";

export type AiPipelineStatus =
  | "idle"
  | "uploading"
  | "analyzing"
  | "generating_tasks"
  | "done"
  | "error";

type Props = {
  status: AiPipelineStatus;
  /** 0~3: (업로드, AI 분석, Task 생성) */
  progressStep?: 0 | 1 | 2 | 3;
};

function clampStep(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 3;
}

export function AiPipelineStatusPanel({ status, progressStep }: Props) {
  const step: 0 | 1 | 2 | 3 = clampStep(progressStep ?? (statusToStep(status) as number));

  const message = (() => {
    switch (status) {
      case "uploading":
        return "파일 업로드 중...";
      case "analyzing":
        return "AI가 요구사항을 분석하고 있습니다...";
      case "generating_tasks":
        return "AI가 작업(Task)을 생성하고 있습니다...";
      case "done":
        return "Task 생성 완료";
      case "error":
        return "분석 실패";
      case "idle":
      default:
        return "AI 분석을 시작하면 Task가 자동으로 생성됩니다.";
    }
  })();

  const stepsText = ["1/3 업로드", "2/3 AI 분석", "3/3 Task 생성"];

  return (
    <section
      data-testid="ai-pipeline-status-panel"
      data-ui-label="[F-1-L-2] Legacy — file upload pipeline status"
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>AI 분석 파이프라인</h3>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#4b5563", lineHeight: 1.45 }}>{message}</p>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#64748b", fontWeight: 700 }}>
          {stepsText[step === 0 ? 0 : step - 1]}
        </div>
      </div>

      <div
        aria-label="AI 파이프라인 진행률"
        style={{
          marginTop: 12,
          height: 10,
          borderRadius: 999,
          background: "#e5e7eb",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(step / 3) * 100}%`,
            height: "100%",
            transition: "width 200ms ease",
            background:
              status === "error" ? "#ef4444" : status === "done" ? "#22c55e" : "linear-gradient(90deg, #3b82f6, #6366f1)",
          }}
        />
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {stepsText.map((t, idx) => {
          const s = (idx + 1) as 1 | 2 | 3;
          const active = step >= s;
          return (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: active ? "#1d4ed8" : "#94a3b8",
              }}
            >
              {active ? "●" : "○"} {t}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function statusToStep(status: AiPipelineStatus): 0 | 1 | 2 | 3 {
  switch (status) {
    case "uploading":
      return 1;
    case "analyzing":
      return 2;
    case "generating_tasks":
      return 3;
    case "done":
      return 3;
    case "error":
      return 0;
    case "idle":
    default:
      return 0;
  }
}

