"use client";

import { useMemo, useState } from "react";
import type { DriftItem, DriftResult, DriftSeverity } from "@/lib/templateDrift/driftTypes";

interface TemplateDriftViewerProps {
  drift: DriftResult | null;
  recentItems?: Array<{
    docId: string;
    severity: DriftSeverity;
    score: number;
    updatedAt: string;
  }>;
  loading: boolean;
  message?: string | null;
  onRun: () => void;
  onGuideCreateVersion?: () => void;
  onContinueWithCurrentTemplate?: () => void;
  onEditInBuilder?: () => void;
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
  recentItems = [],
  loading,
  message,
  onRun,
  onGuideCreateVersion,
  onContinueWithCurrentTemplate,
  onEditInBuilder,
  onItemClick,
}: TemplateDriftViewerProps) {
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const summaryRecommendation = useMemo(() => {
    if (!drift) return "드리프트 결과를 먼저 실행해 주세요.";
    if (drift.severity === "high" || drift.score >= 0.7) {
      return "자동 적용 대신 템플릿 수정 또는 새 버전 저장을 권장합니다.";
    }
    if (drift.severity === "medium" || drift.score >= 0.4) {
      return "구조 변경 여부를 검토한 뒤 적용하세요.";
    }
    return "경미한 차이입니다. 적용 후 미리보기를 확인하세요.";
  }, [drift]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10, marginTop: 12 }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fff",
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 8,
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Drift 요약</div>
        <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>
          {summaryRecommendation}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" onClick={onContinueWithCurrentTemplate} style={{ fontSize: 12, padding: "5px 8px" }}>
            현재 템플릿으로 계속 진행
          </button>
          <button type="button" onClick={onGuideCreateVersion} style={{ fontSize: 12, padding: "5px 8px" }}>
            새 버전 저장으로 이동
          </button>
          <button type="button" onClick={onEditInBuilder} style={{ fontSize: 12, padding: "5px 8px" }}>
            Builder에서 수정 계속
          </button>
        </div>
      </div>

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
          {(drift.severity === "high" || drift.score >= 0.7) && (
            <button
              type="button"
              onClick={onGuideCreateVersion}
              style={{ fontSize: 12, padding: "6px 8px", marginBottom: 10 }}
            >
              이 결과로 새 버전 생성 가이드
            </button>
          )}

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
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedKey((prev) =>
                                prev === `${item.kind}-${idx}-${refKey}`
                                  ? null
                                  : `${item.kind}-${idx}-${refKey}`
                              );
                            }}
                            style={{
                              fontSize: 11,
                              color: "#1e88e5",
                              textDecoration: "underline",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                            }}
                          >
                            {expandedKey === `${item.kind}-${idx}-${refKey}` ? "상세 접기" : "상세 보기"}
                          </button>
                        </div>
                        {expandedKey === `${item.kind}-${idx}-${refKey}` && (
                          <div
                            style={{
                              marginTop: 6,
                              paddingTop: 6,
                              borderTop: "1px dashed #ddd",
                              fontSize: 12,
                              color: "#444",
                              display: "grid",
                              gap: 4,
                            }}
                          >
                            <div>
                              <strong>why:</strong>{" "}
                              {item.reason ?? "매칭/비교 결과로 해당 드리프트 항목이 분류되었습니다."}
                            </div>
                            <div>
                              <strong>next:</strong>{" "}
                              {item.recommendedAction ?? "필요 시 템플릿 구조를 조정하고 새 버전을 검토하세요."}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          최근 드리프트 기록
        </div>
        {recentItems.length === 0 ? (
          <div style={{ fontSize: 12, color: "#666" }}>기록이 없습니다.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {recentItems.slice(0, 8).map((item) => (
              <div
                key={`${item.docId}-${item.updatedAt}`}
                style={{ border: "1px solid #eee", borderRadius: 6, padding: 8, fontSize: 12 }}
              >
                <div>
                  docId: {item.docId}
                </div>
                <div style={{ color: "#555" }}>
                  severity={item.severity}, score={item.score.toFixed(2)}
                </div>
                <div style={{ color: "#777" }}>{item.updatedAt}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
