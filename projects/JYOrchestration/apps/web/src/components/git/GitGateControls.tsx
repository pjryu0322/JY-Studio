"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import { GIT_APPROVAL_MODE_MANUAL_APPROVAL } from "@/lib/git-apply/retry";

const btn: CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
};

const btnPrimary: CSSProperties = {
  ...btn,
  background: "#0a7d2e",
  color: "#fff",
  borderColor: "#0a7d2e",
};

const btnDanger: CSSProperties = {
  ...btn,
  borderColor: "#b00020",
  color: "#b00020",
};

export type GitGateControlsProps = {
  gitChangeRequestId: string;
  status: string;
  /** 프로젝트 정책이 MANUAL_APPROVAL일 때만 표시. 생략 시 API의 gitApprovalMode와 동일하게 두는 것을 권장. */
  gitApprovalMode?: string | null;
  /** OPERATOR 이상 — 승인 요청 제출·재요청 */
  canSubmitApproval?: boolean;
  /** REVIEWER 이상 — 승인·반려 */
  canReviewApproval?: boolean;
  onAfterMutation?: () => void | Promise<void>;
};

function statusLabel(s: string): string {
  switch (s) {
    case "REQUESTED":
      return "등록됨 (승인 절차 전)";
    case "APPROVAL_REQUIRED":
      return "승인 대기";
    case "APPROVED":
      return "승인됨 — Git 반영 실행 가능";
    case "REJECTED":
      return "반려됨";
    case "DONE":
      return "반영 완료";
    default:
      return s;
  }
}

export function GitGateControls({
  gitChangeRequestId,
  status,
  gitApprovalMode,
  canSubmitApproval = true,
  canReviewApproval = true,
  onAfterMutation,
}: GitGateControlsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const mode = String(gitApprovalMode ?? "NO_APPROVAL").trim();

  const run = useCallback(
    async (path: string, body: object) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          success?: boolean;
          message?: string;
        };
        if (!res.ok || !json.success) {
          setError(json.message || `요청 실패 (${res.status})`);
          return;
        }
        await onAfterMutation?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "네트워크 오류");
      } finally {
        setLoading(false);
      }
    },
    [onAfterMutation]
  );

  if (mode !== GIT_APPROVAL_MODE_MANUAL_APPROVAL) {
    return null;
  }

  const showSubmit = status === "REJECTED" && canSubmitApproval;
  const showReview = status === "APPROVAL_REQUIRED" && canReviewApproval;

  return (
    <div style={{ marginTop: 8, fontSize: 13 }}>
      <div style={{ marginBottom: 6, color: "#444" }}>
        <strong>승인 게이트:</strong> {statusLabel(status)}
      </div>
      {error ? (
        <p style={{ margin: "0 0 8px 0", color: "#b00020" }}>{error}</p>
      ) : null}
      {showSubmit ? (
        <button
          type="button"
          style={btnPrimary}
          disabled={loading}
          onClick={() =>
            run("/api/git/submit-approval", { gitChangeRequestId })
          }
        >
          {loading ? "처리 중…" : "승인 재요청"}
        </button>
      ) : null}
      {showReview ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              style={btnPrimary}
              disabled={loading}
              onClick={() =>
                run("/api/git/approve", { gitChangeRequestId })
              }
            >
              {loading ? "처리 중…" : "승인"}
            </button>
            <button
              type="button"
              style={btnDanger}
              disabled={loading}
              onClick={() =>
                run("/api/git/reject", {
                  gitChangeRequestId,
                  reason: rejectReason.trim() || undefined,
                })
              }
            >
              반려
            </button>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ color: "#666" }}>반려 사유 (선택)</span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={2}
              style={{
                width: "100%",
                maxWidth: 420,
                fontSize: 13,
                padding: 6,
                borderRadius: 6,
                border: "1px solid #ccc",
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
