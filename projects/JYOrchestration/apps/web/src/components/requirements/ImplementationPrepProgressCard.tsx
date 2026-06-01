"use client";

import { useEffect, useState } from "react";
import {
  buildPseudoImplementationPrepProgress,
  formatImplementationPrepStepLine,
  IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY,
  type ImplementationPrepProgressSnapshot,
} from "@/lib/requirements/implementationPrepProgress";

export function ImplementationPrepProgressCard(input: {
  readonly active: boolean;
  readonly batchConcurrency?: number;
}) {
  const [snapshot, setSnapshot] = useState<ImplementationPrepProgressSnapshot>(() =>
    buildPseudoImplementationPrepProgress(0, {
      batchConcurrency: input.batchConcurrency ?? IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY,
    }),
  );

  useEffect(() => {
    if (!input.active) return;
    const startedAt = Date.now();
    const concurrency = input.batchConcurrency ?? IMPLEMENTATION_PREP_DEFAULT_BATCH_CONCURRENCY;
    setSnapshot(buildPseudoImplementationPrepProgress(0, { batchConcurrency: concurrency }));
    const timer = window.setInterval(() => {
      setSnapshot(
        buildPseudoImplementationPrepProgress(Date.now() - startedAt, { batchConcurrency: concurrency }),
      );
    }, 450);
    return () => window.clearInterval(timer);
  }, [input.active, input.batchConcurrency]);

  if (!input.active) return null;

  const barWidth = `${Math.max(4, Math.min(100, snapshot.percent))}%`;

  return (
    <div
      className="jyo-implementation-prep-progress"
      style={{
        margin: "8px 0 12px",
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
      }}
      role="status"
      aria-live="polite"
      aria-label="구현준비 생성 진행 상태"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "#dbeafe",
            color: "#1d4ed8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          ⚙
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            구현준비 생성 중
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", lineHeight: 1.45 }}>
            {snapshot.headline}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.45 }}>
            {snapshot.description}
          </div>
          {snapshot.detailLine ? (
            <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>
              {snapshot.detailLine}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "#e2e8f0",
          overflow: "hidden",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            width: barWidth,
            borderRadius: 999,
            background: "linear-gradient(90deg, #3b82f6, #6366f1)",
            transition: "width 0.35s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", marginBottom: 10 }}>
        {snapshot.percent}%
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", marginBottom: 6 }}>세부 정보</div>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 11.5, color: "#64748b", lineHeight: 1.5 }}>
        {snapshot.metaLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", marginBottom: 6 }}>현재 단계</div>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "#334155", lineHeight: 1.55 }}>
        {snapshot.steps.map((step) => (
          <li
            key={step.label}
            style={{
              fontWeight: step.status === "active" ? 800 : 500,
              color: step.status === "active" ? "#1e40af" : step.status === "done" ? "#64748b" : "#94a3b8",
            }}
          >
            {formatImplementationPrepStepLine(step)}
          </li>
        ))}
      </ol>
    </div>
  );
}
