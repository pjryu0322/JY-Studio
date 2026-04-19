"use client";

import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

export function RequirementsHeader({
  projectName,
  autosave,
  showProjectWorkflowNav,
}: {
  /** 실제 프로젝트명(또는 로딩·오류 시 사람이 읽을 수 있는 짧은 문구). raw projectId 축약 문자열 금지. */
  readonly projectName: string;
  /** 자동 저장 상태(프로젝트 연결 시) */
  readonly autosave?: {
    state: "idle" | "saving" | "saved" | "error";
    lastTimeLabel?: string | null;
  };
  /** 프로젝트가 열려 있을 때 워크플로·멤버/설정/추적 탭을 헤더 하단에 표시 */
  readonly showProjectWorkflowNav: boolean;
}) {
  const showScreenLabels = useShowScreenLabels();

  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "16px 0 18px",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div className="relative" style={{ position: "relative", minWidth: 0 }}>
        <ScreenLabel label="요구사항-헤더-프로젝트정보" visible={showScreenLabels} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "-0.02em",
              minWidth: 0,
              flex: "1 1 160px",
            }}
          >
            {projectName}
          </div>
          {autosave ? (
            <span
              title={autosave.lastTimeLabel ? `마지막 저장 ${autosave.lastTimeLabel}` : undefined}
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid #e2e8f0",
                background:
                  autosave.state === "error" ? "#fef2f2" : autosave.state === "saving" ? "#f1f5f9" : autosave.state === "saved" ? "#ecfdf5" : "#f8fafc",
                color:
                  autosave.state === "error"
                    ? "#b91c1c"
                    : autosave.state === "saving"
                      ? "#475569"
                      : autosave.state === "saved"
                        ? "#047857"
                        : "#64748b",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {autosave.state === "saving"
                ? "저장 중…"
                : autosave.state === "error"
                  ? "저장 실패"
                  : autosave.state === "saved" || autosave.lastTimeLabel
                    ? autosave.lastTimeLabel
                      ? `저장됨 · ${autosave.lastTimeLabel}`
                      : "저장됨"
                    : "자동 저장"}
            </span>
          ) : null}
        </div>
      </div>

      {showProjectWorkflowNav ? (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e2e8f0", width: "100%" }}>
          <ProjectWorkflowNav />
        </div>
      ) : null}
    </header>
  );
}
