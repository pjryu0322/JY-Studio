"use client";

import { useEffect, useState } from "react";
import {
  buildPseudoImplementationPrepProgress,
  type ImplementationPrepProgressSnapshot,
} from "@/lib/requirements/implementationPrepProgress";

export function ImplementationPrepProgressCard(input: { readonly active: boolean }) {
  const [snapshot, setSnapshot] = useState<ImplementationPrepProgressSnapshot>(() =>
    buildPseudoImplementationPrepProgress(0),
  );

  useEffect(() => {
    if (!input.active) return;
    const startedAt = Date.now();
    setSnapshot(buildPseudoImplementationPrepProgress(0));
    const timer = window.setInterval(() => {
      setSnapshot(buildPseudoImplementationPrepProgress(Date.now() - startedAt));
    }, 450);
    return () => window.clearInterval(timer);
  }, [input.active]);

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
        background: "#f8fafc",
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
        구현준비 생성 중
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
        {snapshot.label}
        {snapshot.phase === "codetask_refining" ? " 진행 중" : "…"}
      </div>
      {snapshot.detail ? (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.45 }}>
          {snapshot.detail}
        </div>
      ) : null}
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
      <div style={{ fontSize: 11.5, color: "#64748b" }}>{snapshot.percent}%</div>
    </div>
  );
}
