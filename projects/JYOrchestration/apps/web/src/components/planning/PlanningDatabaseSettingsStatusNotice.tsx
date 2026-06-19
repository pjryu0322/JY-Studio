"use client";

import { useState } from "react";
import type { PlanningDatabaseSettingsV1 } from "@/lib/planning/planningDatabaseSettingsV1";
import {
  buildProjectDatabaseStatusNotice,
  projectDatabaseActionGuide,
} from "@/lib/planning/projectDatabaseCreationFailure";
import { projectDatabaseUserSectionHeadline } from "@/lib/planning/projectDatabaseUserDisplay";

type Props = Readonly<{
  readonly settings: PlanningDatabaseSettingsV1;
  readonly onRetry?: () => void;
  readonly retryBusy?: boolean;
  readonly canEdit?: boolean;
}>;

export function PlanningDatabaseSettingsStatusNotice({
  settings,
  onRetry,
  retryBusy = false,
  canEdit = true,
}: Props) {
  const [guideOpen, setGuideOpen] = useState(false);
  const notice = buildProjectDatabaseStatusNotice(settings);
  if (!notice) return null;

  const guide = notice.failureReason
    ? projectDatabaseActionGuide({ failureReason: notice.failureReason })
    : null;
  const detailLine =
    notice.detail && notice.detail !== notice.summary ? notice.detail : null;

  return (
    <div
      data-testid="planning-database-status-notice"
      style={{
        marginBottom: 12,
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <p style={{ margin: "0 0 6px 0", fontSize: 12, color: "#64748b" }}>
        현재 상태: {projectDatabaseUserSectionHeadline(settings)}
      </p>
      <p
        style={{
          margin: "0 0 6px 0",
          fontSize: 13,
          fontWeight: 700,
          color: notice.headline === "플랫폼 확인 필요" ? "#b45309" : "#334155",
          lineHeight: 1.5,
        }}
      >
        {notice.summary}
      </p>
      {detailLine ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#475569", lineHeight: 1.55 }}>{detailLine}</p>
      ) : null}
      {notice.showActionGuide && guide ? (
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            style={{
              padding: "4px 0",
              border: "none",
              background: "transparent",
              color: "#2563eb",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {guideOpen ? "조치 방법 숨기기" : "조치 방법 보기"}
          </button>
          {guideOpen ? (
            <div
              style={{
                marginTop: 8,
                padding: "10px 12px",
                borderRadius: 8,
                background: "#fff",
                border: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {guide.adminGuide}
              {guide.sqlExample ? (
                <>
                  {"\n\nPostgreSQL 예시:\n"}
                  <code style={{ display: "block", marginTop: 6, fontFamily: "monospace" }}>{guide.sqlExample}</code>
                </>
              ) : null}
              {guide.securityNote ? `\n\n${guide.securityNote}` : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {notice.retryable && onRetry ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            disabled={!canEdit || retryBusy}
            onClick={onRetry}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #b45309",
              background: "#fff",
              color: "#b45309",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {retryBusy ? "프로젝트 저장소 schema를 다시 준비하고 있습니다…" : "저장소 준비 재시도"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
