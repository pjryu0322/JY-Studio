"use client";

import { AddDefaultAiMembersButton } from "@/components/project-spec/ai-members/AddDefaultAiMembersButton";
import type { EnvironmentTestLastDto } from "@/components/project-spec/api";

function shortFinal(last: EnvironmentTestLastDto | null): string | null {
  if (!last?.stage2FinalOutcome) return null;
  return last.stage2FinalOutcome;
}

function shortFinalColor(v: string): string {
  if (v === "COMPLETED") return "#15803d";
  if (v === "PARTIAL") return "#b45309";
  if (v === "FAILED") return "#b91c1c";
  return "#64748b";
}

export function AiMembersStage2SummaryCard(props: {
  readiness: {
    executorLabel: string;
    reviewerLabel: string;
    securityLabel: string;
    scmLabel: string;
  };
  /** 프로젝트 편집 권한(역할 분리 환경 검증 API 호출 가능) */
  canRunStage2EnvTest: boolean;
  /** Cursor·GitHub 실행기 연결 완료 */
  executorReady: boolean;
  canRunTest: boolean;
  canAddDefaults: boolean;
  busyRun: boolean;
  busyDefaults: boolean;
  note: string | null;
  stage2Last: EnvironmentTestLastDto | null;
  onRunStage2: () => void | Promise<void>;
  onAddDefaults: () => void | Promise<void>;
}) {
  const fin = shortFinal(props.stage2Last);
  return (
    <div
      data-testid="ai-members-stage2-summary-card"
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 12,
        border: "1px solid #c4b5fd",
        background: "linear-gradient(180deg, #f5f3ff 0%, #fff 100%)",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 14, color: "#4c1d95", marginBottom: 8 }}>역할 분리 환경 검증</div>
      <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
        기본 환경 연결 테스트가 준비된 뒤, AI 역할 협업 경로를 검증합니다. Reviewer·Security는 플랫폼이 대신하지 않습니다.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
          marginBottom: 12,
          fontSize: 11,
          color: "#4c1d95",
        }}
      >
        <div>
          <div style={{ fontWeight: 800 }}>Executor</div>
          <div>{props.readiness.executorLabel}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>Reviewer</div>
          <div>{props.readiness.reviewerLabel}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>Security</div>
          <div>{props.readiness.securityLabel}</div>
        </div>
        <div>
          <div style={{ fontWeight: 800 }}>SCM</div>
          <div>{props.readiness.scmLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
        <AddDefaultAiMembersButton
          disabled={!props.canAddDefaults}
          busy={props.busyDefaults}
          onClick={props.onAddDefaults}
        />
        <button
          type="button"
          disabled={!props.canRunTest || props.busyRun || props.busyDefaults}
          onClick={() => void props.onRunStage2()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #5b21b6",
            background: "#6d28d9",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: !props.canRunTest || props.busyRun || props.busyDefaults ? "not-allowed" : "pointer",
          }}
        >
          {props.busyRun ? "실행 중…" : "역할 분리 환경 검증 실행"}
        </button>
      </div>
      {!props.canAddDefaults ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b" }}>기본 멤버 추가는 프로젝트 OWNER만 할 수 있습니다.</p>
      ) : null}
      {!props.canRunStage2EnvTest ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b" }}>
          역할 분리 환경 검증은 프로젝트 편집 권한이 필요합니다.
        </p>
      ) : !props.executorReady ? (
        <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b" }}>
          Executor(Cursor)가 준비되지 않았습니다. <strong>실행 환경</strong> 탭에서 Git·GitHub·Cursor 연결을 완료하세요.
        </p>
      ) : null}
      {props.note ? (
        <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#334155" }}>{props.note}</p>
      ) : null}
      {fin ? (
        <div
          style={{
            marginTop: 4,
            paddingTop: 10,
            borderTop: "1px dashed #ddd6fe",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#64748b" }}>최근 실행 요약</span>{" "}
          <strong style={{ color: shortFinalColor(fin) }}>{fin}</strong>
        </div>
      ) : (
        <p style={{ margin: "8px 0 0 0", fontSize: 11, color: "#94a3b8" }}>최근 역할 분리 검증 완료 요약 없음</p>
      )}
    </div>
  );
}
