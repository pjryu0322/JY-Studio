"use client";

import type { CSSProperties } from "react";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";

const bar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
  boxSizing: "border-box",
};

function previewStatusShort(run: PrototypeRun | null): string {
  if (!run) return "—";
  if (run.previewUrl) return "연결됨";
  if (run.deploymentStatus === "RUNNING" || run.deploymentStatus === "REQUESTED") return "배포 중";
  if (run.deploymentStatus === "FAILED") return "배포 실패";
  if (run.deploymentStatus === "DONE" && (run.resultUrl || run.suggestedPreviewUrl)) return "URL 확인";
  if (run.status === "PREVIEW_READY") return "준비됨";
  return "대기";
}

export function ReviewHeader(p: {
  readonly run: PrototypeRun | null;
  readonly versionNo: number | null;
  readonly runOptions: readonly { id: string; label: string }[];
  readonly selectedRunId: string | null;
  readonly onSelectRun: (runId: string) => void;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onFullscreen: () => void;
}) {
  const versionLabel = p.versionNo != null ? `V${p.versionNo}` : p.run ? "V—" : "—";

  return (
    <header style={bar} aria-label="프로토타입 검토 도구">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, whiteSpace: "nowrap" }}>
          현재 버전 <span style={{ color: t.primary }}>{versionLabel}</span>
        </div>
        <span style={{ fontSize: 13, color: t.textSecondary, whiteSpace: "nowrap" }}>
          Preview <strong style={{ color: t.textPrimary }}>{previewStatusShort(p.run)}</strong>
        </span>
        {p.runOptions.length > 1 ? (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: t.textMuted }}>
            <span style={{ whiteSpace: "nowrap" }}>실행 선택</span>
            <select
              value={p.selectedRunId ?? ""}
              onChange={(e) => p.onSelectRun(e.target.value)}
              style={{
                maxWidth: 220,
                padding: "6px 8px",
                borderRadius: t.radiusMd,
                border: `1px solid ${t.borderStrong}`,
                fontSize: 12,
                fontWeight: 700,
                color: t.textPrimary,
                background: t.bgCard,
              }}
            >
              {p.runOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Button type="button" variant="secondary" size="sm" loading={p.refreshing} disabled={!p.run || p.refreshing} onClick={p.onRefresh}>
          새로고침
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={!p.run} onClick={p.onFullscreen}>
          전체화면 보기
        </Button>
      </div>
    </header>
  );
}
