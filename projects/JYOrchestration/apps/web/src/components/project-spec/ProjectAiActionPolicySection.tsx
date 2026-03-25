"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";

type PolicyRow = {
  projectId: string;
  actionType: string;
  approvalMode: string;
  applyMode: string;
  persisted: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  REVIEW_REQUEST: "리뷰 요청",
  TASK_DRAFT_REQUEST: "태스크 초안",
  QA_CHECK_REQUEST: "QA 점검",
  SUMMARY_REQUEST: "요약",
};

const cardStyle: CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "#fafafa",
};

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(140px, 1fr) 1fr 1fr",
  gap: 12,
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 13,
};

const labelStyle: CSSProperties = { fontWeight: 600, color: "#334155" };

type Props = {
  projectId: string;
  canEditPolicy: boolean;
};

export function ProjectAiActionPolicySection({ projectId, canEditPolicy }: Props) {
  const [rows, setRows] = useState<PolicyRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-action-policy?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: PolicyRow[]; message?: string };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "정책을 불러오지 못했습니다.");
      }
      setRows(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "정책을 불러오지 못했습니다.");
      setRows(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChangeRow = async (actionType: string, field: "approvalMode" | "applyMode", value: string) => {
    if (!canEditPolicy || !rows) return;
    const current = rows.find((r) => r.actionType === actionType);
    if (!current) return;
    const nextApproval = field === "approvalMode" ? value : current.approvalMode;
    const nextApply = field === "applyMode" ? value : current.applyMode;
    setSavingKey(actionType);
    setError(null);
    try {
      const res = await fetch("/api/ai-action-policy", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          actionType,
          approvalMode: nextApproval,
          applyMode: nextApply,
        }),
      });
      const json = (await res.json()) as { success?: boolean; data?: PolicyRow[]; message?: string };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      setRows(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section data-testid="ai-action-policy-section" style={cardStyle}>
      <h3 style={{ margin: "0 0 4px 0", fontSize: 15, color: "#0f172a" }}>AI 승인 정책</h3>
      <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        액션 유형별로 완료 후 검토(승인)와 결과 반영(적용) 방식을 구분해 둡니다. 행이 없을 때와 동일한 기본값은
        승인 자동(AUTO_APPROVE), 적용 수동(MANUAL_APPLY)입니다. OWNER만 변경할 수 있습니다.
      </p>
      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>불러오는 중…</p>
      ) : error ? (
        <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>
      ) : rows && rows.length > 0 ? (
        <div>
          <div
            style={{
              ...rowStyle,
              paddingTop: 0,
              borderBottom: "2px solid #cbd5e1",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#64748b",
            }}
          >
            <span>액션 유형</span>
            <span>승인</span>
            <span>적용</span>
          </div>
          {rows.map((r) => (
            <div key={r.actionType} style={rowStyle}>
              <span style={labelStyle}>{ACTION_LABELS[r.actionType] ?? r.actionType}</span>
              <select
                data-testid={`policy-approval-${r.actionType}`}
                value={r.approvalMode}
                disabled={!canEditPolicy || savingKey === r.actionType}
                onChange={(e) => void onChangeRow(r.actionType, "approvalMode", e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  background: canEditPolicy ? "#fff" : "#f1f5f9",
                }}
              >
                <option value="AUTO_APPROVE">자동 승인</option>
                <option value="MANUAL_REVIEW">수동 검토</option>
              </select>
              <select
                value={r.applyMode}
                disabled={!canEditPolicy || savingKey === r.actionType}
                onChange={(e) => void onChangeRow(r.actionType, "applyMode", e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  background: canEditPolicy ? "#fff" : "#f1f5f9",
                }}
              >
                <option value="MANUAL_APPLY">수동 적용</option>
                <option value="AUTO_APPLY">자동 적용</option>
              </select>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>표시할 정책이 없습니다.</p>
      )}
    </section>
  );
}
