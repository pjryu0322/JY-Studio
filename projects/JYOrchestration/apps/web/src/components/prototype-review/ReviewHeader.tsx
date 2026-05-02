"use client";

import type { CSSProperties } from "react";
import type { PrototypeDeployStatusSnapshot, PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
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

function previewStatusShort(run: PrototypeRun | null, deploy: PrototypeDeployStatusSnapshot): string {
  if (!run) return "—";
  if (deploy.deployStatus === "DEPLOYED") return "정식 배포됨";
  if (deploy.deployStatus === "DEPLOYING") return "Pages 배포 중";
  if (deploy.deployStatus === "FAILED") return "배포 실패";
  const draft = String(run.previewUrl ?? run.suggestedPreviewUrl ?? "").trim();
  if (draft) return "검토용 URL";
  return "Preview 준비 필요";
}

export function ReviewHeader(p: {
  readonly projectId: string;
  readonly run: PrototypeRun | null;
  readonly deploy: PrototypeDeployStatusSnapshot;
  readonly versionNo: number | null;
  readonly runOptions: readonly { id: string; label: string }[];
  readonly selectedRunId: string | null;
  readonly onSelectRun: (runId: string) => void;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
  readonly onFullscreen: () => void;
  readonly onRequestDeploy: () => void;
  readonly deployRequestBusy: boolean;
}) {
  const versionLabel = p.versionNo != null ? `V${p.versionNo}` : p.run ? "V—" : "—";
  const publicUrl = String(p.deploy.publicUrl ?? "").trim();
  const canRequest =
    Boolean(p.run?.id) &&
    (p.run?.status === "PREVIEW_READY" || p.run?.status === "PR_OPENED" || p.run?.status === "DEPLOY_FAILED") &&
    p.deploy.deployStatus !== "DEPLOYING" &&
    p.deploy.deployStatus !== "DEPLOYED";

  const deployBanner = (() => {
    if (p.deploy.deployStatus === "DEPLOYED" && publicUrl) {
      return (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55, flex: "1 1 220px", minWidth: 0 }}>
          배포가 완료되었습니다. 공개 URL을 확인할 수 있습니다.
          <br />
          <span style={{ color: t.textPrimary, fontWeight: 700 }}>정식 배포 완료</span> ·{" "}
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.primary, fontWeight: 700 }}>
            {publicUrl}
          </a>
        </div>
      );
    }
    if (p.deploy.deployStatus === "DEPLOYING") {
      return (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55, flex: "1 1 220px", minWidth: 0 }}>
          GitHub Pages 배포 중입니다.
        </div>
      );
    }
    if (p.deploy.deployStatus === "FAILED") {
      return (
        <div style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.55, flex: "1 1 220px", minWidth: 0 }}>
          배포에 실패했습니다. 새로고침으로 상태를 확인하거나 다시 배포를 요청해 주세요.
        </div>
      );
    }
    return (
      <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55, flex: "1 1 220px", minWidth: 0 }}>
        아직 정식 배포되지 않았습니다. Preview를 확인한 뒤 [배포 요청]으로 GitHub Pages 공개를 진행합니다.
      </div>
    );
  })();

  return (
    <header style={{ ...bar, flexDirection: "column", alignItems: "stretch" }} aria-label="프로토타입 검토 도구">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, whiteSpace: "nowrap" }}>
          현재 버전 <span style={{ color: t.primary }}>{versionLabel}</span>
        </div>
        <span style={{ fontSize: 13, color: t.textSecondary, whiteSpace: "nowrap" }}>
          Preview <strong style={{ color: t.textPrimary }}>{previewStatusShort(p.run, p.deploy)}</strong>
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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${t.border}`,
        }}
      >
        {deployBanner}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginLeft: "auto" }}>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={p.deployRequestBusy}
            disabled={!canRequest || p.deployRequestBusy || !p.projectId.trim()}
            onClick={p.onRequestDeploy}
          >
            배포 요청
          </Button>
          {p.deploy.deployStatus === "DEPLOYED" && publicUrl ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void navigator.clipboard?.writeText(publicUrl).catch(() => {})}
              >
                URL 복사
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}>
                새 창에서 열기
              </Button>
            </>
          ) : null}
          <Button type="button" variant="secondary" size="sm" loading={p.refreshing} disabled={!p.run || p.refreshing} onClick={p.onRefresh}>
            새로고침
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!p.run} onClick={p.onFullscreen}>
            전체화면 보기
          </Button>
        </div>
      </div>
    </header>
  );
}
