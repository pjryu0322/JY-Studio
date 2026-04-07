"use client";

import type { Dispatch, SetStateAction } from "react";
import { patchExecutionSetup, type ExecutionSetupDto } from "@/components/project-spec/api";
import type { ExecutionSetupBusyKey } from "@/components/project-spec/executionSetupBusyKey";
import {
  GLOB_PLACEHOLDER,
  POLICY_APPROVAL,
  POLICY_AUTO,
  POLICY_EXTRA,
  POLICY_GATES,
} from "@/components/project-spec/executionSetupPolicyRows";

export function ExecutionSetupUnifiedPolicyBody(props: {
  projectId: string;
  canEdit: boolean;
  es: ExecutionSetupDto | null;
  setExecutionSetup: Dispatch<SetStateAction<ExecutionSetupDto | null | undefined>>;
  setMessage: (msg: string | null) => void;
  examplesOpen: boolean;
  setExamplesOpen: Dispatch<SetStateAction<boolean>>;
  showExecExamples: boolean;
  busy: ExecutionSetupBusyKey;
  setBusy: Dispatch<SetStateAction<ExecutionSetupBusyKey>>;
}) {
  const {
    projectId,
    canEdit,
    es,
    setExecutionSetup,
    setMessage,
    examplesOpen,
    setExamplesOpen,
    showExecExamples,
    busy,
    setBusy,
  } = props;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setExamplesOpen((v) => !v)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #94a3b8",
            background: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: canEdit ? "pointer" : "not-allowed",
          }}
        >
          {examplesOpen ? "실행 옵션 예시 접기" : "실행 옵션 예시 보기"}
        </button>
        <button
          type="button"
          disabled={!canEdit || !es}
          onClick={() => {
            if (!es) return;
            setExecutionSetup({
              ...es,
              branchStrategy: "feature-per-workflow",
              branchPrefix: "jy/agent/",
              allowedPathGlobs: ["src/**", "app/**", "tests/**"],
            });
            setMessage("브랜치 전략·접두어·허용 경로에 예시 값을 채웠습니다.「실행 옵션 저장」으로 저장하세요.");
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #7c3aed",
            background: canEdit && es ? "#f5f3ff" : "#f1f5f9",
            fontWeight: 700,
            fontSize: 12,
            cursor: !canEdit || !es ? "not-allowed" : "pointer",
            color: "#5b21b6",
          }}
        >
          실행 옵션 예시 적용
        </button>
      </div>
      {showExecExamples ? (
        <div
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            border: "1px dashed #94a3b8",
            background: "#f8fafc",
            fontSize: 12,
            color: "#334155",
            lineHeight: 1.55,
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          {`브랜치 전략 예: 워크플로마다 기능 브랜치 / 작업마다 기능 브랜치 / 수동
작업 브랜치 접두어 예: jy/agent/
허용 경로 glob 예:
${GLOB_PLACEHOLDER}`}
        </div>
      ) : null}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 12,
          background: "#fafafa",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>실행 옵션</div>
        <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          브랜치 전략·작업 브랜치 접두어·허용 경로를 저장합니다.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>브랜치 전략</span>
            <select
              value={es?.branchStrategy ?? "manual"}
              disabled={!canEdit || !es}
              onChange={(e) =>
                setExecutionSetup((p) => ({
                  ...(p ?? ({} as ExecutionSetupDto)),
                  branchStrategy: e.target.value as ExecutionSetupDto["branchStrategy"],
                }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            >
              <option value="feature-per-workflow">워크플로마다 기능 브랜치</option>
              <option value="feature-per-task">작업마다 기능 브랜치</option>
              <option value="manual">수동</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>작업 브랜치 접두어 (선택)</span>
            <input
              value={es?.branchPrefix ?? ""}
              disabled={!canEdit || !es}
              placeholder="jy/agent/"
              onChange={(e) =>
                setExecutionSetup((p) => ({
                  ...(p ?? ({} as ExecutionSetupDto)),
                  branchPrefix: e.target.value || null,
                }))
              }
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            />
          </label>
        </div>
        <label style={{ display: "grid", gap: 4, marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
            허용 경로 glob (선택, 줄바꿈으로 구분)
          </span>
          <textarea
            value={(es?.allowedPathGlobs ?? []).join("\n")}
            disabled={!canEdit || !es}
            placeholder={GLOB_PLACEHOLDER}
            rows={3}
            onChange={(e) => {
              const raw = e.target.value
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), allowedPathGlobs: raw }));
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
            }}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            disabled={!canEdit || !es || busy === "save-exec-options"}
            onClick={async () => {
              if (!projectId || !es) return;
              setBusy("save-exec-options");
              try {
                const { res, json } = await patchExecutionSetup(projectId, {
                  branchStrategy: es.branchStrategy,
                  branchPrefix: es.branchPrefix,
                  allowedPathGlobs: es.allowedPathGlobs ?? [],
                });
                if (!res.ok || !json.success || !json.data) {
                  setMessage(json.message || "저장에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setMessage("실행 옵션을 저장했습니다.");
              } finally {
                setBusy(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit || !es ? "not-allowed" : busy === "save-exec-options" ? "wait" : "pointer",
            }}
          >
            {busy === "save-exec-options" ? "저장 중…" : "실행 옵션 저장"}
          </button>
        </div>
      </div>
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fafafa" }}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 6, color: "#0f172a" }}>정책·승인·재시도</div>
        <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          자동 반영·검증·승인 규칙입니다. 정책만 변경한 경우 저장소·Cursor API 검증 결과는 유지됩니다.
        </p>

        <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "10px 0 6px" }}>자동 반영</div>
        <div style={{ display: "grid", gap: 10 }}>
          {POLICY_AUTO.map(({ key, label, help }) => (
            <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={!canEdit || !es}
                  checked={Boolean(es?.[key])}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                  }
                />
                <strong>{label}</strong>
              </span>
              <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
            </label>
          ))}
        </div>

        <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>검증·중단 조건</div>
        <div style={{ display: "grid", gap: 10 }}>
          {POLICY_GATES.map(({ key, label, help }) => (
            <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={!canEdit || !es}
                  checked={es ? es[key] !== false : true}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                  }
                />
                <strong>{label}</strong>
              </span>
              <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
            </label>
          ))}
        </div>

        <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>승인 정책</div>
        <div style={{ display: "grid", gap: 10 }}>
          {POLICY_APPROVAL.map(({ key, label, help }) => (
            <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={!canEdit || !es}
                  checked={
                    key === "requireApprovalForSensitiveTasks"
                      ? es?.requireApprovalForSensitiveTasks === true
                      : es
                        ? es[key] !== false
                        : true
                  }
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                  }
                />
                <strong>{label}</strong>
              </span>
              <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
            </label>
          ))}
        </div>

        <div style={{ fontWeight: 800, fontSize: 12, color: "#475569", margin: "14px 0 6px" }}>추가 옵션</div>
        <div style={{ display: "grid", gap: 10 }}>
          {POLICY_EXTRA.map(({ key, label, help }) => (
            <label key={key} style={{ display: "grid", gap: 4, fontSize: 13, color: "#334155" }}>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  disabled={!canEdit || !es}
                  checked={es ? es[key] !== false : true}
                  onChange={(e) =>
                    setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), [key]: e.target.checked }))
                  }
                />
                <strong>{label}</strong>
              </span>
              <span style={{ fontSize: 11, color: "#64748b", lineHeight: 1.45, paddingLeft: 24 }}>{help}</span>
            </label>
          ))}
        </div>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontSize: 13,
            color: "#334155",
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <span style={{ fontWeight: 800 }}>작업당 최대 자동 재시도 횟수</span>
          <input
            type="number"
            min={0}
            max={20}
            disabled={!canEdit || !es}
            value={es?.maxAutoRetriesPerTask ?? 2}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              const v = Number.isFinite(n) ? Math.min(20, Math.max(0, n)) : 2;
              setExecutionSetup((p) => ({ ...(p ?? ({} as ExecutionSetupDto)), maxAutoRetriesPerTask: v }));
            }}
            style={{
              width: 72,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
            }}
          />
          <span style={{ fontSize: 11, color: "#64748b", flex: "1 1 200px" }}>
            한 작업에서 오류가 날 때 자동으로 재시도하는 최대 횟수입니다.
          </span>
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            disabled={!canEdit || !es || busy === "save-policy"}
            onClick={async () => {
              if (!projectId || !es) return;
              setBusy("save-policy");
              try {
                const { res, json } = await patchExecutionSetup(projectId, {
                  autoCommit: es.autoCommit,
                  autoPush: es.autoPush,
                  autoPr: es.autoPr,
                  requireApprovalBeforeApply: es.requireApprovalBeforeApply,
                  requireTestsBeforePush: es.requireTestsBeforePush,
                  dryRunAllowed: es.dryRunAllowed,
                  autoAdvanceToNextTask: es.autoAdvanceToNextTask,
                  maxAutoRetriesPerTask: es.maxAutoRetriesPerTask,
                  stopOnTestFailure: es.stopOnTestFailure,
                  stopOnRepeatedFailure: es.stopOnRepeatedFailure,
                  stopOnOutOfScopeChange: es.stopOnOutOfScopeChange,
                  requireApprovalForSensitiveTasks: es.requireApprovalForSensitiveTasks,
                });
                if (!res.ok || !json.success || !json.data) {
                  setMessage(json.message || "정책 저장에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setMessage("실행 정책을 저장했습니다.");
              } finally {
                setBusy(null);
              }
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#334155",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit || !es ? "not-allowed" : busy === "save-policy" ? "wait" : "pointer",
            }}
          >
            {busy === "save-policy" ? "저장 중…" : "실행 정책 저장"}
          </button>
        </div>
      </div>
    </>
  );
}
