"use client";

import { LabelTag } from "@/components/ui/LabelTag";
import type { AiDraftCandidate } from "@/components/project-spec/api";
import { formatTestedAt } from "@/components/project-spec/format";
import {
  SPEC_WORKSPACE_AI_MODELS,
  SPEC_WORKSPACE_MODEL_LABELS,
  type SpecWorkspaceAiModelId,
} from "@/lib/project-spec/specWorkspaceModels";

export type ProjectSpecAiDraftPlanSectionProps = {
  canEdit: boolean;
  baseInputsOk: boolean;
  generatingContext: boolean;
  selectedModelsForPlan: SpecWorkspaceAiModelId[];
  onToggleModel: (m: SpecWorkspaceAiModelId) => void;
  onGenerate: (mode: "initial" | "regenerate") => void;
  planCandidates: AiDraftCandidate[];
  planFailures: Array<{ modelId: string; message: string }>;
  selectedPlanCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  workingDocument: string;
  onWorkingDocumentChange: (next: string) => void;
  planDocumentDirty: boolean;
  revisionModel: SpecWorkspaceAiModelId;
  onRevisionModelChange: (m: SpecWorkspaceAiModelId) => void;
  revisionInstruction: string;
  onRevisionInstructionChange: (s: string) => void;
  revisionSuggestion: { instruction: string; content: string; createdAt: string } | null;
  onRequestRevision: () => void;
  onApplyRevision: () => void;
  onIgnoreRevision: () => void;
  revisionBusy: boolean;
};

function docSizeLabel(content: string): string {
  const n = content?.length ?? 0;
  if (n < 1024) return `${n}자`;
  return `${(n / 1024).toFixed(1)}KB`;
}

/** 전체 문서 수준 비교용: 앞부분만 잘라 카드에 표시 (섹션 diff 없음) */
function documentPreviewSnippet(content: string, maxChars = 560): string {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const head = lines.slice(0, 18).join("\n").trim();
  if (!head) {
    return "(비어 있음)";
  }
  if (head.length <= maxChars) {
    return head;
  }
  return `${head.slice(0, maxChars)}…`;
}

export function ProjectSpecAiDraftPlanSection(props: ProjectSpecAiDraftPlanSectionProps) {
  const {
    canEdit,
    baseInputsOk,
    generatingContext,
    selectedModelsForPlan,
    onToggleModel,
    onGenerate,
    planCandidates,
    planFailures,
    selectedPlanCandidateId,
    onSelectCandidate,
    workingDocument,
    onWorkingDocumentChange,
    planDocumentDirty,
    revisionModel,
    onRevisionModelChange,
    revisionInstruction,
    onRevisionInstructionChange,
    revisionSuggestion,
    onRequestRevision,
    onApplyRevision,
    onIgnoreRevision,
    revisionBusy,
  } = props;

  const canGenerate =
    canEdit && baseInputsOk && selectedModelsForPlan.length > 0 && !generatingContext;

  const canRevise =
    canEdit &&
    Boolean(selectedPlanCandidateId) &&
    workingDocument.trim().length > 0 &&
    !revisionBusy &&
    !generatingContext;

  return (
    <>
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <LabelTag label="[F-1-3-1b] Workspace — AI Draft Actions" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>AI 실행 계획 초안</p>
        </div>
        {!baseInputsOk ? (
          <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#b45309" }}>
            프로젝트명·설명·유형을 입력한 뒤 생성할 수 있습니다.
          </p>
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#334155", display: "block", marginBottom: 6 }}>
            비교할 AI 모델 (복수 선택 가능) · 미니 모델 포함
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {SPEC_WORKSPACE_AI_MODELS.map((m) => (
              <label
                key={m}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  cursor: canEdit ? "pointer" : "not-allowed",
                  opacity: canEdit ? 1 : 0.6,
                }}
              >
                <input
                  type="checkbox"
                  data-testid={`spec-workspace-plan-model-${m}`}
                  checked={selectedModelsForPlan.includes(m)}
                  disabled={!canEdit || generatingContext}
                  onChange={() => onToggleModel(m)}
                />
                {SPEC_WORKSPACE_MODEL_LABELS[m]}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <button
            type="button"
            data-testid="spec-workspace-ai-draft-generate"
            disabled={!canGenerate}
            onClick={() => onGenerate("initial")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #7c3aed",
              background: canGenerate ? "#7c3aed" : "#e9d5ff",
              color: canGenerate ? "#fff" : "#6b21a8",
              fontWeight: 700,
              cursor: canGenerate ? "pointer" : "not-allowed",
            }}
          >
            실행 계획 생성
          </button>
          <button
            type="button"
            data-testid="spec-workspace-ai-draft-regenerate"
            disabled={!canGenerate}
            onClick={() => onGenerate("regenerate")}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: canGenerate ? "#f1f5f9" : "#f8fafc",
              fontWeight: 700,
              cursor: canGenerate ? "pointer" : "not-allowed",
            }}
          >
            다시 생성
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
            <span>개선 제안용 모델</span>
            <select
              data-testid="spec-workspace-plan-revision-model"
              value={revisionModel}
              disabled={!canEdit || generatingContext}
              onChange={(e) => onRevisionModelChange(e.target.value as SpecWorkspaceAiModelId)}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            >
              {SPEC_WORKSPACE_AI_MODELS.map((m) => (
                <option key={m} value={m}>
                  {SPEC_WORKSPACE_MODEL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {generatingContext ? (
          <p
            role="status"
            data-testid="spec-workspace-inline-ai-field-draft"
            data-ui-label="[F-1-3-1b-s] Inline — AI project plan document draft status"
            style={{ margin: "10px 0 0 0", fontSize: 13, fontWeight: 600, color: "#5b21b6" }}
          >
            선택한 모델별로 실행 계획 전체 문서를 생성하는 중입니다…
          </p>
        ) : null}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <LabelTag label="[F-1-3-1c] Workspace — AI Draft Candidates" />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
            문서 후보 비교 · 작업 편집기 (전체 문서 단위)
          </p>
        </div>
        <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          모델별 <strong>AI Draft Candidates</strong>(전체 마크다운)를 비교하고, 하나를 골라 작업 문서로 삼습니다. 카드 미리보기는
          앞부분만 보여 주며, 섹션 diff·줄 단위 비교 UI는 없습니다.
        </p>

        {planFailures.length > 0 ? (
          <div
            role="status"
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 8,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              fontSize: 12,
              color: "#991b1b",
            }}
          >
            <strong>일부 모델 실패</strong>
            <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
              {planFailures.map((f) => (
                <li key={f.modelId}>
                  {SPEC_WORKSPACE_MODEL_LABELS[f.modelId as SpecWorkspaceAiModelId] ?? f.modelId}: {f.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {planCandidates.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
              alignItems: "stretch",
            }}
          >
            {planCandidates.map((c) => {
              const selected = c.id === selectedPlanCandidateId;
              return (
                <div
                  key={c.id}
                  data-testid={`spec-workspace-plan-candidate-${c.id}`}
                  style={{
                    flex: "1 1 200px",
                    maxWidth: 280,
                    borderRadius: 10,
                    border: selected ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                    padding: 10,
                    background: selected ? "#faf5ff" : "#fff",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>
                    {SPEC_WORKSPACE_MODEL_LABELS[c.modelId as SpecWorkspaceAiModelId] ?? c.modelId}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                    {formatTestedAt(c.createdAt)} · {docSizeLabel(c.content)}
                  </div>
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: 11,
                      lineHeight: 1.45,
                      color: "#475569",
                      maxHeight: 120,
                      overflow: "hidden",
                      wordBreak: "break-word",
                    }}
                  >
                    {documentPreviewSnippet(c.content)}
                  </p>
                  <button
                    type="button"
                    data-testid={`spec-workspace-plan-use-${c.id}`}
                    disabled={!canEdit || selected}
                    onClick={() => onSelectCandidate(c.id)}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: selected ? "#e9d5ff" : "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: canEdit && !selected ? "pointer" : "default",
                    }}
                  >
                    {selected ? "선택됨" : "이 문서로 작업"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>생성된 후보가 없습니다. 위에서 모델을 선택 후 생성하세요.</p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: "2 1 320px", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>실행 계획 초안 (마크다운)</span>
              {planDocumentDirty ? (
                <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700 }}>편집 저장 전</span>
              ) : (
                <span style={{ fontSize: 11, color: "#64748b" }}>저장 시 아래 필드에 반영됩니다</span>
              )}
            </div>
            <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
              이 문서는 실행 계획이며 최종 Spec이 아닙니다. 「실행계획 저장」으로 저장한 내용만 다음 단계 AI Spec 생성에
              사용됩니다.
            </p>
            <textarea
              data-testid="spec-workspace-plan-working-document"
              value={workingDocument}
              disabled={!canEdit}
              onChange={(e) => onWorkingDocumentChange(e.target.value)}
              rows={18}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                lineHeight: 1.45,
                resize: "vertical",
              }}
            />
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                data-testid="spec-workspace-plan-revision-request"
                disabled={!canRevise}
                onClick={() => onRequestRevision()}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #0d9488",
                  background: canRevise ? "#0d9488" : "#ccfbf1",
                  color: canRevise ? "#fff" : "#64748b",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: canRevise ? "pointer" : "not-allowed",
                }}
              >
                {revisionBusy ? "제안 생성 중…" : "AI 개선 제안 받기"}
              </button>
              <span style={{ fontSize: 11, color: "#64748b" }}>후보를 선택한 뒤에만 사용할 수 있습니다.</span>
            </div>
            <label style={{ display: "grid", gap: 4, marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                개선 지시 (선택) — 예: 구현 관점으로 구체화, 비기능 요구 강화, 공공·엔터프라이즈 톤
              </span>
              <textarea
                data-testid="spec-workspace-plan-revision-instruction"
                value={revisionInstruction}
                disabled={!canEdit || revisionBusy}
                onChange={(e) => onRevisionInstructionChange(e.target.value)}
                rows={2}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
            </label>
          </div>

          <div
            style={{
              flex: "1 1 240px",
              minWidth: 200,
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: 14,
              background: "#f8fafc",
              alignSelf: "stretch",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#334155", marginBottom: 8 }}>AI 개선 제안 (참고만)</div>
            {!revisionSuggestion ? (
              <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                제안이 없습니다. 후보를 선택한 뒤 「AI 개선 제안 받기」를 누르면 여기에 표시됩니다. 제안은 자동 반영되지 않으며,
                적용 여부는 항상 사용자가 결정합니다.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                  참고용 제안 · {formatTestedAt(revisionSuggestion.createdAt)}
                </p>
                <pre
                  style={{
                    margin: 0,
                    minHeight: 120,
                    maxHeight: 280,
                    overflow: "auto",
                    padding: 8,
                    borderRadius: 8,
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    fontSize: 11,
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {revisionSuggestion.content}
                </pre>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-testid="spec-workspace-plan-revision-apply"
                    disabled={!canEdit}
                    onClick={onApplyRevision}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #7c3aed",
                      background: "#7c3aed",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: canEdit ? "pointer" : "not-allowed",
                    }}
                  >
                    제안 적용
                  </button>
                  <button
                    type="button"
                    data-testid="spec-workspace-plan-revision-ignore"
                    disabled={!canEdit}
                    onClick={onIgnoreRevision}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: canEdit ? "pointer" : "not-allowed",
                    }}
                  >
                    무시
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
