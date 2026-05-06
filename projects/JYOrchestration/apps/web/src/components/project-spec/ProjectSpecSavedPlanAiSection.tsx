"use client";

import type { Dispatch, SetStateAction } from "react";
import { WorkspaceSectionHeader } from "@/components/project-spec/WorkspaceSectionHeader";
import { DEFAULT_SPEC_GENERATION_USER_TEMPLATE } from "@/lib/project-spec/buildWorkspacePromptText";
import {
  SPEC_PROMPT_PRESET_IDS,
  SPEC_PROMPT_PRESET_LABELS,
  type SpecPromptPresetId,
} from "@/lib/project-spec/specPromptPresets";
import {
  SPEC_WORKSPACE_AI_MODELS,
  SPEC_WORKSPACE_MODEL_LABELS,
  type SpecWorkspaceAiModelId,
} from "@/lib/project-spec/specWorkspaceModels";
import { specWsPanelWhite } from "@/components/project-spec/projectSpecWorkspaceStyles";

export type SpecPromptDraftState = { readonly template: string; readonly preset: SpecPromptPresetId };

export type ProjectSpecSavedPlanAiSectionProps = Readonly<{
  canEdit: boolean;
  specPromptUiBusy: boolean;
  specPromptDraft: SpecPromptDraftState;
  setSpecPromptDraft: Dispatch<SetStateAction<SpecPromptDraftState>>;
  onSaveSpecPromptSettings: () => void | Promise<void>;
  showSpecGenStaleWarning: boolean;
  selectedModel: SpecWorkspaceAiModelId;
  setSelectedModel: Dispatch<SetStateAction<SpecWorkspaceAiModelId>>;
  onAiProjectSpecGeneration: () => void | Promise<void>;
  actionBusy: string | null;
  saving: boolean;
  generatingContext: boolean;
  canRunAiProjectSpec: boolean;
  baseInputsOk: boolean;
  savedExecutionPlanOk: boolean;
  planDocumentDirty: boolean;
}>;

export function ProjectSpecSavedPlanAiSection({
  canEdit,
  specPromptUiBusy,
  specPromptDraft,
  setSpecPromptDraft,
  onSaveSpecPromptSettings,
  showSpecGenStaleWarning,
  selectedModel,
  setSelectedModel,
  onAiProjectSpecGeneration,
  actionBusy,
  saving,
  generatingContext,
  canRunAiProjectSpec,
  baseInputsOk,
  savedExecutionPlanOk,
  planDocumentDirty,
}: ProjectSpecSavedPlanAiSectionProps) {
  return (
    <div style={specWsPanelWhite}>
      <WorkspaceSectionHeader section="specFromSavedPlan" layout="column" marginBottom={10} />

      <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
        순서: <strong>1. AI 생성 설정</strong> → <strong>2. AI 실행 계획 문서 생성</strong> → 아래 <strong>AI 응답</strong> 섹션에서
        비교·확정. 실행 계획 본문은 서버가 주입합니다.
      </p>

      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 8 }}>1. AI 생성 설정</div>
      <div
        data-testid="spec-workspace-spec-generation-settings"
        data-ui-label="[F-1-3-3] AI generation settings"
        style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 10,
          border: "1px solid #c4b5fd",
          background: "#f5f3ff",
        }}
      >
        <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#5b21b6", lineHeight: 1.5 }}>
          서버는 OpenAI <strong>system</strong> 안전 규칙 + 아래 <strong>템플릿</strong> + 저장된 <strong>실행 계획</strong>을 합쳐 생성합니다.
          System 층 내용은 UI에 노출하지 않습니다.
        </p>
        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Preset</span>
          <select
            value={specPromptDraft.preset}
            disabled={!canEdit || specPromptUiBusy}
            onChange={(e) => setSpecPromptDraft((d) => ({ ...d, preset: e.target.value as SpecPromptPresetId }))}
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", maxWidth: 280 }}
          >
            {SPEC_PROMPT_PRESET_IDS.map((pid) => (
              <option key={pid} value={pid}>
                {SPEC_PROMPT_PRESET_LABELS[pid]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Prompt Template</span>
          <textarea
            value={specPromptDraft.template}
            disabled={!canEdit || specPromptUiBusy}
            onChange={(e) => setSpecPromptDraft((d) => ({ ...d, template: e.target.value }))}
            rows={12}
            style={{
              width: "100%",
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              lineHeight: 1.45,
            }}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            data-testid="spec-workspace-prompt-save"
            disabled={!canEdit || specPromptUiBusy}
            onClick={() => void onSaveSpecPromptSettings()}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #6d28d9",
              background: "#6d28d9",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit || specPromptUiBusy ? "not-allowed" : "pointer",
            }}
          >
            {specPromptUiBusy ? "저장 중…" : "설정 저장"}
          </button>
          <button
            type="button"
            data-testid="spec-workspace-prompt-reset"
            disabled={!canEdit || specPromptUiBusy}
            onClick={() => setSpecPromptDraft((d) => ({ ...d, template: DEFAULT_SPEC_GENERATION_USER_TEMPLATE }))}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #7c3aed",
              background: "#fff",
              color: "#5b21b6",
              fontWeight: 800,
              fontSize: 12,
              cursor: !canEdit || specPromptUiBusy ? "not-allowed" : "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {showSpecGenStaleWarning ? (
        <p
          role="status"
          style={{
            margin: "0 0 14px 0",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            fontSize: 13,
            color: "#92400e",
            lineHeight: 1.5,
          }}
        >
          설정이 변경되었습니다. 다시 생성해야 반영됩니다.
        </p>
      ) : null}

      <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b", marginBottom: 10 }}>2. AI 실행 계획 문서 생성</div>

      <label style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>AI 모델</span>
        <select
          data-testid="spec-workspace-ai-model"
          value={selectedModel}
          disabled={!canEdit || actionBusy === "ai-spec" || generatingContext}
          onChange={(e) => setSelectedModel(e.target.value as SpecWorkspaceAiModelId)}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", minWidth: 160 }}
        >
          {SPEC_WORKSPACE_AI_MODELS.map((m) => (
            <option key={m} value={m}>
              {SPEC_WORKSPACE_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          data-testid="spec-workspace-ai-request"
          onClick={() => void onAiProjectSpecGeneration()}
          disabled={
            !canEdit || actionBusy === "ai-spec" || saving || generatingContext || !canRunAiProjectSpec
          }
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #0f766e",
            background: "#0d9488",
            color: "#fff",
            fontWeight: 700,
            cursor: canEdit && canRunAiProjectSpec ? "pointer" : "not-allowed",
          }}
        >
          {actionBusy === "ai-spec" ? "저장 후 AI 요청 중…" : "AI 실행 계획 문서 생성"}
        </button>
      </div>
      {canEdit && baseInputsOk && savedExecutionPlanOk && !planDocumentDirty && !specPromptDraft.template.trim() ? (
        <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#b45309" }}>
          프롬프트 템플릿을 입력한 뒤 생성할 수 있습니다.
        </p>
      ) : null}
      {canEdit && baseInputsOk && !savedExecutionPlanOk ? (
        <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#b45309" }}>
          실행 계획 문서를 작성한 뒤 「실행계획 저장」을 실행하세요. AI는 저장된 실행 계획만을 근거로 문서를 생성합니다.
        </p>
      ) : null}
      {canEdit && baseInputsOk && savedExecutionPlanOk && planDocumentDirty ? (
        <p style={{ margin: "10px 0 0 0", fontSize: 12, color: "#b45309" }}>
          저장되지 않은 편집이 있습니다. 「실행계획 저장」 후 다시 시도하세요.
        </p>
      ) : null}
      {actionBusy === "ai-spec" ? (
        <p
          data-testid="spec-workspace-ai-spec-progress"
          role="status"
          data-ui-label="[F-1-3-2-s2] Inline — AI execution plan document request"
          style={{ margin: "10px 0 0 0", fontSize: 13, color: "#0f766e", fontWeight: 600 }}
        >
          저장된 실행 계획을 반영해 AI에 실행 계획 문서 응답을 요청하는 중…
        </p>
      ) : null}
    </div>
  );
}
