"use client";

import type { Dispatch, SetStateAction } from "react";
import { WorkspaceSectionHeader } from "@/components/project-spec/WorkspaceSectionHeader";
import {
  ProjectSpecAiDraftPlanSection,
  type ProjectSpecAiDraftPlanSectionProps,
} from "@/components/project-spec/ProjectSpecAiDraftPlanSection";
import type { FormState } from "@/components/project-spec/workspaceFormState";
import { specWsPanelWhiteTightBottom } from "@/components/project-spec/projectSpecWorkspaceStyles";

export type ProjectSpecExecutionPlanContextSectionProps = Readonly<{
  generatingContext: boolean;
  baseInputsOk: boolean;
  allSpecFieldsEmpty: boolean;
  canEdit: boolean;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  saving: boolean;
  actionBusyAiSpec: boolean;
  actionBusyPlanRevise: boolean;
  onSaveProjectInfo: () => void | Promise<void>;
  draftPlan: ProjectSpecAiDraftPlanSectionProps;
}>;

export function ProjectSpecExecutionPlanContextSection({
  generatingContext,
  baseInputsOk,
  allSpecFieldsEmpty,
  canEdit,
  form,
  setForm,
  saving,
  actionBusyAiSpec,
  actionBusyPlanRevise,
  onSaveProjectInfo,
  draftPlan,
}: ProjectSpecExecutionPlanContextSectionProps) {
  return (
    <div style={specWsPanelWhiteTightBottom}>
      <WorkspaceSectionHeader section="projectContext" marginBottom={12} />

      {generatingContext ? (
        <p
          data-testid="spec-workspace-ai-context-loading"
          style={{
            margin: "0 0 12px 0",
            padding: "10px 12px",
            borderRadius: 8,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: 14,
          }}
          role="status"
        >
          AI가 실행 계획 문서 초안을 생성하고 있습니다...
        </p>
      ) : null}

      {baseInputsOk && allSpecFieldsEmpty && canEdit && !generatingContext ? (
        <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#64748b" }}>
          조건이 맞으면 AI가 먼저 실행 계획 전체 문서를 제안합니다. 계획 입력 필드가 이미 채워져 있으면 자동 생성은 건너뜁니다.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <WorkspaceSectionHeader section="basicFields" marginBottom={8} />
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트명</span>
              <input
                data-testid="spec-workspace-project-name"
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트 설명</span>
              <textarea
                data-testid="spec-workspace-project-description"
                value={form.description}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", resize: "vertical" }}
              />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>프로젝트 유형</span>
              <select
                data-testid="spec-workspace-project-type"
                value={form.projectType}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, projectType: e.target.value }))}
                style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", maxWidth: 320 }}
              >
                <option value="web-service">web-service</option>
              </select>
            </label>
          </div>
        </div>

        <ProjectSpecAiDraftPlanSection {...draftPlan} />

        {canEdit ? (
          <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              현재 작업 중인 실행 계획을 저장합니다. 저장된 실행 계획은 다음 단계의 AI 실행 계획 문서 생성에만 사용됩니다 (아직 공식 확정본이
              아닙니다).
            </p>
            <button
              type="button"
              data-testid="spec-workspace-save-project"
              onClick={() => void onSaveProjectInfo()}
              disabled={saving || generatingContext || actionBusyAiSpec || actionBusyPlanRevise}
              style={{
                justifySelf: "start",
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor:
                  saving || generatingContext || actionBusyAiSpec || actionBusyPlanRevise ? "wait" : "pointer",
              }}
            >
              {saving ? "저장 중…" : "실행계획 저장"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
