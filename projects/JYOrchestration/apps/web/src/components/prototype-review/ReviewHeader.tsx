"use client";

import type { CSSProperties } from "react";
import type { PrototypeDeployStatusSnapshot, PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { Button } from "@/components/ui/Button";
import { uiTokens as t } from "@/components/ui/tokens";
import { useProjectPrototypePreview } from "@/lib/project/useProjectPrototypePreview";

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

const sevColor: Record<string, string> = {
  HIGH: "#b91c1c",
  MEDIUM: "#b45309",
  LOW: t.textSecondary,
};

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
  readonly onDeployProceed: () => void;
  readonly onSecurityRecheck: () => void;
  readonly onSecurityFixRequest: () => void;
  readonly deployRequestBusy: boolean;
  readonly deployProceedBusy: boolean;
  readonly securityRecheckBusy: boolean;
  readonly securityFixBusy: boolean;
  readonly previewRotationLandscape: boolean;
  readonly onTogglePreviewRotation: () => void;
}) {
  const pp = useProjectPrototypePreview(p.projectId);
  const versionLabel = p.versionNo != null ? `V${p.versionNo}` : p.run ? "V—" : "—";
  const publicUrl = String(p.deploy.publicUrl ?? "").trim();
  const phase = p.run?.deploySecurityGatePhase ?? "NONE";

  const canRequestSecurityCheck =
    Boolean(p.run?.id) &&
    (p.run?.status === "PREVIEW_READY" || p.run?.status === "PR_OPENED" || p.run?.status === "DEPLOY_FAILED") &&
    p.deploy.deployStatus !== "DEPLOYING" &&
    p.deploy.deployStatus !== "DEPLOYED" &&
    (phase === "NONE" ||
      (phase === "SECURITY_PASSED" && (p.deploy.deployStatus === "FAILED" || p.run?.status === "DEPLOY_FAILED")));

  const canDeployProceed =
    Boolean(p.run?.id) &&
    phase === "SECURITY_PASSED" &&
    p.deploy.deployStatus !== "DEPLOYED" &&
    p.deploy.deployStatus !== "DEPLOYING";

  const canSecurityRecheck = Boolean(p.run?.id) && (phase === "PENDING_RECHECK" || phase === "SECURITY_FIX_REQUIRED");

  const canFixRequest =
    Boolean(p.run?.id) &&
    phase === "SECURITY_FIX_REQUIRED" &&
    (p.run?.deploySecurityFindings?.length ?? 0) > 0 &&
    p.run?.deploySecurityFixWorkUnitOrder == null;

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
          배포에 실패했습니다. 새로고침으로 상태를 확인하거나, 보안 점검·배포 절차를 처음부터 다시 진행해 주세요.
        </div>
      );
    }
    return (
      <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55, flex: "1 1 220px", minWidth: 0 }}>
        <span style={{ color: t.textPrimary, fontWeight: 700 }}>{p.deploy.deployGateUiLabelKo}</span>
        {phase === "SECURITY_PASSED" ? (
          <>
            <br />
            보안 점검을 통과했습니다. 「배포 진행」으로 GitHub Pages 공개를 시작합니다.
          </>
        ) : phase === "NONE" ? (
          <>
            <br />
            Preview를 확인한 뒤 「배포 요청」으로 AI 보안 점검을 시작합니다. 점검 통과 후에만 배포할 수 있습니다.
          </>
        ) : null}
      </div>
    );
  })();

  const findings = p.deploy.deploySecurityFindings ?? [];

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
        {pp.prototypePreviewWorkMode !== "auto" ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            {pp.prototypePreviewWorkMode === "mobile" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, whiteSpace: "nowrap" }}>Preview 기기</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => pp.setPrototypePreviewMobileDevice("iphone")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border:
                        pp.prototypePreviewMobileDevice === "iphone" ? `2px solid ${t.primary}` : `1px solid ${t.borderStrong}`,
                      background: pp.prototypePreviewMobileDevice === "iphone" ? "#eff6ff" : t.bgCard,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      color: t.textPrimary,
                    }}
                  >
                    iPhone
                  </button>
                  <button
                    type="button"
                    onClick={() => pp.setPrototypePreviewMobileDevice("android")}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 8,
                      border:
                        pp.prototypePreviewMobileDevice === "android" ? `2px solid ${t.primary}` : `1px solid ${t.borderStrong}`,
                      background: pp.prototypePreviewMobileDevice === "android" ? "#eff6ff" : t.bgCard,
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      color: t.textPrimary,
                    }}
                  >
                    Android
                  </button>
                </div>
              </div>
            ) : null}
            <Button type="button" variant="secondary" size="sm" onClick={p.onTogglePreviewRotation} title="Preview 뷰포트 가로·세로 전환">
              {p.previewRotationLandscape ? "세로 보기" : "가로 보기"}
            </Button>
          </div>
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
            disabled={!canRequestSecurityCheck || p.deployRequestBusy || !p.projectId.trim()}
            onClick={p.onRequestDeploy}
          >
            배포 요청
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={p.securityFixBusy}
            disabled={!canFixRequest || p.securityFixBusy}
            onClick={p.onSecurityFixRequest}
          >
            AI 개발자에게 조치 요청
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={p.securityRecheckBusy}
            disabled={!canSecurityRecheck || p.securityRecheckBusy}
            onClick={p.onSecurityRecheck}
          >
            보안 재점검
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={p.deployProceedBusy}
            disabled={!canDeployProceed || p.deployProceedBusy}
            onClick={p.onDeployProceed}
          >
            배포 진행
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

      {findings.length > 0 && phase !== "NONE" && phase !== "SECURITY_CHECKING" && phase !== "SECURITY_PASSED" ? (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary, marginBottom: 6 }}>취약점 목록</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: t.textMuted }}>
                <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>심각도</th>
                <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>위치</th>
                <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>설명</th>
                <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>권장 조치</th>
                <th style={{ padding: "6px 8px", borderBottom: `1px solid ${t.border}` }}>조치 상태</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id}>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, color: sevColor[f.severity] ?? t.textPrimary, fontWeight: 700 }}>
                    {f.severity}
                  </td>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, color: t.textPrimary, whiteSpace: "nowrap" }}>{f.location}</td>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>{f.description}</td>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>{f.recommendedAction}</td>
                  <td style={{ padding: "8px", borderBottom: `1px solid ${t.border}`, color: t.textSecondary }}>{f.fixStatus === "ADDRESSED" ? "조치됨" : "미조치"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </header>
  );
}
