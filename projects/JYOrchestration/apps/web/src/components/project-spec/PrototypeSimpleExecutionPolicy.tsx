"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { Dispatch, SetStateAction } from "react";
import { patchExecutionSetup, type ExecutionSetupDto } from "@/components/project-spec/api";
import type { ExecutionSetupBusyKey } from "@/components/project-spec/executionSetupBusyKey";

export type PrototypeAutomationLevel = "review" | "pr" | "merge";

export function deriveAutomationLevel(es: ExecutionSetupDto | null): PrototypeAutomationLevel {
  if (!es) return "pr";
  if (es.requireApprovalBeforeApply) return "review";
  if (es.autoPush && es.autoPr && !es.requireApprovalBeforeApply) {
    return es.stopOnOutOfScopeChange === false ? "merge" : "pr";
  }
  return "pr";
}

export function prototypeAutomationLevelToPatch(level: PrototypeAutomationLevel) {
  const base = {
    autoCommit: true,
    maxAutoRetriesPerTask: 1,
    requireTestsBeforePush: false,
    stopOnTestFailure: true,
    stopOnRepeatedFailure: true,
    requireApprovalForSensitiveTasks: true,
    dryRunAllowed: true,
    autoAdvanceToNextTask: true,
  } as const;

  if (level === "review") {
    return {
      ...base,
      requireApprovalBeforeApply: true,
      autoPush: false,
      autoPr: false,
      stopOnOutOfScopeChange: true,
    };
  }
  if (level === "merge") {
    return {
      ...base,
      requireApprovalBeforeApply: false,
      autoPush: true,
      autoPr: true,
      stopOnOutOfScopeChange: false,
    };
  }
  return {
    ...base,
    requireApprovalBeforeApply: false,
    autoPush: true,
    autoPr: true,
    stopOnOutOfScopeChange: true,
  };
}

export function PrototypeSimpleExecutionPolicy(props: {
  projectId: string;
  canEdit: boolean;
  es: ExecutionSetupDto | null;
  setExecutionSetup: Dispatch<SetStateAction<ExecutionSetupDto | null>>;
  setMessage: (msg: string | null) => void;
  setBusy: Dispatch<SetStateAction<ExecutionSetupBusyKey>>;
  busy: ExecutionSetupBusyKey;
  /** MVP 하단 「저장」과 동기화할 때: 부모가 수준을 소유하면 로컬 상태·es 동기화 effect를 쓰지 않는다. */
  automationLevel?: PrototypeAutomationLevel;
  onAutomationLevelChange?: (level: PrototypeAutomationLevel) => void;
  /** true면 인라인 저장 버튼을 숨긴다(카드 타이틀 옆 버튼 등 부모에서 저장). */
  hideSaveButton?: boolean;
}) {
  const {
    projectId,
    canEdit,
    es,
    setExecutionSetup,
    setMessage,
    setBusy,
    busy,
    automationLevel: controlledLevel,
    onAutomationLevelChange,
    hideSaveButton = false,
  } = props;
  const saving = busy === "save-policy";
  const isControlled = controlledLevel != null && onAutomationLevelChange != null;
  const [internalLevel, setInternalLevel] = useState<PrototypeAutomationLevel>(() => deriveAutomationLevel(es));
  const level = isControlled ? controlledLevel! : internalLevel;
  const setLevel = isControlled ? onAutomationLevelChange! : setInternalLevel;

  useEffect(() => {
    if (isControlled) return;
    setInternalLevel(deriveAutomationLevel(es));
  }, [
    isControlled,
    es,
    es?.requireApprovalBeforeApply,
    es?.autoPush,
    es?.autoPr,
    es?.stopOnOutOfScopeChange,
  ]);

  const rowStyle: CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
    fontSize: 13,
    color: "#334155",
    cursor: !canEdit || !es ? "not-allowed" : "pointer",
  };

  return (
    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55 }}>
      <div style={{ fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>자동화 수준</div>
      <label style={rowStyle}>
        <input
          type="radio"
          name="prototype-automation"
          checked={level === "review"}
          disabled={!canEdit || !es || saving}
          onChange={() => setLevel("review")}
        />
        <span>
          <strong>검토 후 실행</strong>
          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
            반영 전 승인이 필요합니다. 자동 푸시·PR은 사용하지 않습니다.
          </span>
        </span>
      </label>
      <label style={rowStyle}>
        <input
          type="radio"
          name="prototype-automation"
          checked={level === "pr"}
          disabled={!canEdit || !es || saving}
          onChange={() => setLevel("pr")}
        />
        <span>
          <strong>자동 PR 생성까지</strong> <span style={{ fontSize: 11, color: "#15803d", fontWeight: 800 }}>(기본)</span>
          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
            커밋·푸시·PR 생성까지 자동으로 진행합니다.
          </span>
        </span>
      </label>
      <label style={rowStyle}>
        <input
          type="radio"
          name="prototype-automation"
          checked={level === "merge"}
          disabled={!canEdit || !es || saving}
          onChange={() => setLevel("merge")}
        />
        <span>
          <strong>자동 Merge까지</strong>
          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 2 }}>
            PR 이후 머지까지 자동화를 최대한 허용합니다(범위 위반 중단은 완화).
          </span>
        </span>
      </label>

      {hideSaveButton ? null : (
        <div style={{ marginTop: 16 }}>
          <button
            type="button"
            disabled={!canEdit || !es || saving}
            onClick={async () => {
              if (!projectId.trim() || !es) return;
              setBusy("save-policy");
              try {
                const patch = prototypeAutomationLevelToPatch(level);
                const { res, json } = await patchExecutionSetup(projectId, patch);
                if (!res.ok || !json.success || !json.data) {
                  setMessage(json.message || "실행 정책 저장에 실패했습니다.");
                  return;
                }
                setExecutionSetup(json.data);
                setMessage("실행 정책을 저장했습니다.");
              } finally {
                setBusy(null);
              }
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #475569",
              background: "#334155",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: saving ? "wait" : !canEdit || !es ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "저장 중…" : "실행 정책 저장"}
          </button>
        </div>
      )}
    </div>
  );
}
