"use client";

import type { CSSProperties } from "react";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { uiTokens as t } from "@/components/ui/tokens";

const panel: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  minHeight: 360,
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
  overflow: "hidden",
};

const header: CSSProperties = {
  padding: "12px 14px",
  borderBottom: `1px solid ${t.border}`,
  background: t.bgPage,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  justifyContent: "space-between",
};

function previewStatusLabel(run: PrototypeRun | null): string {
  if (!run) return "—";
  if (run.previewUrl) return "프리뷰 연결됨";
  if (run.deploymentStatus === "DONE" && (run.resultUrl || run.suggestedPreviewUrl)) return "배포·URL 확인";
  if (run.deploymentStatus === "RUNNING" || run.deploymentStatus === "REQUESTED") return "배포 진행 중";
  if (run.deploymentStatus === "FAILED") return "배포 실패";
  if (run.status === "PREVIEW_READY") return "준비됨(URL 확인)";
  return run.status;
}

export function ReviewPreviewPanel(p: {
  readonly run: PrototypeRun | null;
  readonly versionNo: number | null;
  readonly totalRuns: number | null;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}) {
  const url = p.run?.previewUrl || p.run?.suggestedPreviewUrl || p.run?.resultUrl || "";
  const safe = url.startsWith("http://") || url.startsWith("https://");

  return (
    <section aria-label="프로토타입 프리뷰" style={panel}>
      <div style={header}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: t.textPrimary }}>
            현재 버전
            {p.versionNo != null ? (
              <span style={{ fontWeight: 700, color: t.textSecondary, marginLeft: 8 }}>
                {p.versionNo}
                {p.totalRuns != null ? ` / 전체 ${p.totalRuns}회 실행` : ""}
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            Preview 상태: <strong style={{ color: t.textSecondary }}>{previewStatusLabel(p.run)}</strong>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" loading={p.refreshing} disabled={!p.run || p.refreshing} onClick={p.onRefresh}>
          새로고침
        </Button>
      </div>
      <div style={{ flex: 1, minHeight: 280, background: t.bgPage, position: "relative" }}>
        {!p.run ? (
          <div style={{ padding: 16 }}>
            <EmptyState title="실행 정보 없음" description="프로토타입 생성 단계에서 실행을 시작하면 여기에 프리뷰가 연결됩니다." />
          </div>
        ) : !safe ? (
          <div style={{ padding: 16, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ margin: 0, textAlign: "center", fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
              등록된 Preview 화면이 없습니다.
            </p>
          </div>
        ) : (
          <iframe
            title="프로토타입 프리뷰"
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            style={{ width: "100%", height: "100%", minHeight: 360, border: "none", display: "block" }}
          />
        )}
      </div>
    </section>
  );
}
