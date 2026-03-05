"use client";

import { useMemo, useState } from "react";
import type { DriftItem, DriftResult, DriftSeverity } from "@/lib/templateDrift/driftTypes";

interface TemplateDriftViewerProps {
  drift: DriftResult | null;
  loading: boolean;
  message?: string | null;
  onRun: () => void;
  onItemClick?: (item: DriftItem) => void;
}

const severityOrder: DriftSeverity[] = ["high", "medium", "low"];

function badgeStyle(severity: DriftSeverity) {
  if (severity === "high") {
    return { border: "1px solid #ef9a9a", background: "#ffebee", color: "#b71c1c" };
  }
  if (severity === "medium") {
    return { border: "1px solid #ffcc80", background: "#fff3e0", color: "#e65100" };
  }
  return { border: "1px solid #b0bec5", background: "#eceff1", color: "#37474f" };
}

export default function TemplateDriftViewer({
  drift,
  loading,
  message,
  onRun,
  onItemClick,
}: TemplateDriftViewerProps) {
  const [activeRef, setActiveRef] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!drift) return new Map<DriftSeverity, DriftItem[]>();
    const map = new Map<DriftSeverity, DriftItem[]>();
    for (const severity of severityOrder) map.set(severity, []);
    for (const item of drift.items) {
      const list = map.get(item.severity);
      if (list) list.push(item);
    }
    return map;
  }, [drift]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h4 style={{ margin: 0, fontSize: 13, flex: 1 }}>Template Drift</h4>
        <button type="button" onClick={onRun} disabled={loading} style={{ fontSize: 12, padding: "6px 8px" }}>
          {loading ? "검사 중..." : "드리프트 검사"}
        </button>
      </div>

      {message ? (
        <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>{message}</div>
      ) : null}

      {!drift ? (
        <div style={{ fontSize: 12, color: "#666" }}>아직 드리프트 결과가 없습니다.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            <span
              style={{
                ...badgeStyle(drift.severity),
                fontSize: 11,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              severity: {drift.severity}
            </span>
            <span style={{ fontSize: 12 }}>score: {drift.score.toFixed(2)}</span>
          </div>

          <div style={{ fontSize: 12, color: "#444", marginBottom: 10 }}>
            added {drift.summary.added} / removed {drift.summary.removed} / modified {drift.summary.modified} /
            anchorsMissing {drift.summary.anchorsMissing} / layoutShifts {drift.summary.layoutShifts}
          </div>

          {severityOrder.map((severity) => {
            const items = grouped.get(severity) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={severity} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {severity.toUpperCase()} ({items.length})
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {items.map((item, idx) => {
                    const refKey =
                      item.ref?.sectionId ||
                      item.ref?.fieldKey ||
                      item.ref?.tableId ||
                      item.ref?.repeatId ||
                      item.ref?.anchorValue ||
                      `${item.kind}-${idx}`;
                    const isActive = activeRef === refKey;
                    return (
                      <button
                        key={`${item.kind}-${idx}-${refKey}`}
                        type="button"
                        onClick={() => {
                          setActiveRef(refKey);
                          onItemClick?.(item);
                        }}
                        style={{
                          textAlign: "left",
                          border: isActive ? "1px solid #64b5f6" : "1px solid #eee",
                          borderRadius: 6,
                          background: isActive ? "#e3f2fd" : "#fff",
                          padding: 8,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {item.kind}
                        </div>
                        <div style={{ color: "#555", marginTop: 2 }}>{item.message}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
