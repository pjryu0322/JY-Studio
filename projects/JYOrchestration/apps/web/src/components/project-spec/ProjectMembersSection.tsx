"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TaskItem } from "@/components/project-spec/types";
import type { GitChangeRequestItem, TaskPromptItem } from "@/components/task/TaskListSection";
import type { ProjectRole } from "@/lib/auth/roles";
import type { AiMemberActionTypeId } from "@/lib/ai-member/aiMemberActionTypes";
import {
  parseAiMemberRole,
  resolveEffectiveReviewerModel,
  reviewerModelDisplayLabel,
  isLowCapabilityReviewerModel,
  REVIEW_MODEL_PRESETS,
} from "@/lib/ai-member/aiMemberOrchestration";
import { AiMembersPage } from "@/components/project-spec/ai-members/AiMembersPage";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  memberRowToUnified,
  memberTypeLabelKr,
  projectRoleLabelKr,
} from "@/lib/project/unifiedMemberPresentation";

export type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";

type AiActionRow = {
  id: string;
  projectId: string;
  actionType: string;
  status: string;
  executionMode: string;
  providerKey: string | null;
  taskId: string | null;
  gitChangeRequestId: string | null;
  requestedAt: string;
  requestedByUserId: string;
  summaryPreview: string | null;
  errorMessage: string | null;
  lastError: string | null;
  retryCount: number;
  consumedBy: string | null;
  reviewStatus: string | null;
  applyStatus: string;
  reviewComment: string | null;
  reviewedAt: string | null;
  canReview?: boolean;
  canApply?: boolean;
  resultPayload?: unknown;
  targetMember: {
    displayName: string | null;
    role: string;
    aiProvider: string | null;
  };
};

type ReviewLogRow = {
  id: string;
  decision: string;
  comment: string | null;
  reviewerName: string;
  createdAt: string;
};

type ProjectMembersSectionProps = {
  projectId: string;
  members: ProjectMemberUiRow[];
  canManageMembers: boolean;
  onChanged: () => Promise<void>;
  tasks?: TaskItem[];
  gitRequests?: GitChangeRequestItem[];
  taskPrompts?: TaskPromptItem[];
  canRequestAiMemberAction?: boolean;
  canRequestAiReviewAction?: boolean;
  /** OWNER/EDITOR: 디스패치·run-once·재시도 큐잉 */
  canDispatchAiMemberAction?: boolean;
  /** 액션 수정(스텁/완료) 권한 판별용 */
  currentProjectRole?: ProjectRole | null;
  currentUserId?: string | null;
  /** 탭 분리: 사람 멤버만 / AI만 / 전체 / 통합(사용자+AI 한 화면) */
  memberSurface?: "all" | "human" | "ai" | "unified";
  /** AI Members: Stage 2 환경 테스트 실행(프로젝트 편집 권한) */
  canRunStage2EnvTest?: boolean;
  /** AI Members: 기본 Stage2 멤버 일괄 추가(OWNER 전용 API) */
  isProjectOwner?: boolean;
};

const ROLE_OPTIONS: ProjectRole[] = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"];

const AI_ORCHESTRATION_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "(오케스트레이션 역할 없음)" },
  { value: "planner", label: "planner" },
  { value: "service-designer", label: "service-designer (서비스 설계)" },
  { value: "domain-expert", label: "domain-expert (업무 전문가)" },
  { value: "reviewer", label: "reviewer (실행 리뷰)" },
  { value: "security-reviewer", label: "security-reviewer (보안)" },
  { value: "quality-reviewer", label: "quality-reviewer (품질)" },
  { value: "spec-reviewer", label: "spec-reviewer" },
  { value: "task-reviewer", label: "task-reviewer" },
  { value: "scm-manager", label: "scm-manager (PR/merge)" },
];

const ORCHESTRATION_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "(스테이지 없음)" },
  { value: "spec", label: "spec" },
  { value: "service-flow", label: "service-flow (액터·서비스 흐름)" },
  { value: "task", label: "task" },
  { value: "execution-review", label: "execution-review (Cursor 실행 후)" },
  { value: "scm-manager", label: "scm-manager (PR/merge)" },
];

const ORCH_ROLE_LABELS: Record<string, { title: string; description: string }> = {
  reviewer: {
    title: "실행 리뷰어",
    description: "요구사항 충족 여부 검토",
  },
  "security-reviewer": {
    title: "보안 리뷰어",
    description: "인증/보안 위험 검토",
  },
  "quality-reviewer": {
    title: "품질 리뷰어",
    description: "구조/테스트/유지보수성 검토",
  },
  "spec-reviewer": {
    title: "Spec 리뷰어",
    description: "실행 계획·요구 정합성을 검토합니다.",
  },
  "task-reviewer": {
    title: "Task 리뷰어",
    description: "태스크 목표 대비 산출을 검토합니다.",
  },
  planner: {
    title: "Planner",
    description: "기획·분해 단계(실행 계획·태스크)에 참여하는 역할입니다.",
  },
  "service-designer": {
    title: "AI 서비스 설계자",
    description: "액터와 서비스 흐름 초안을 구조화하는 역할입니다.",
  },
  "domain-expert": {
    title: "업무 전문가",
    description: "현업 절차·예외 흐름을 검토하는 역할입니다.",
  },
  "scm-manager": {
    title: "SCM Manager",
    description: "Reviewer 승인 후 PR 생성·merge를 담당합니다.",
  },
};

const EXECUTION_REVIEW_ROLES_UI = ["reviewer", "security-reviewer", "quality-reviewer"] as const;
const PLANNING_ROLES_UI = ["planner", "spec-reviewer", "task-reviewer"] as const;

function stageLabel(v: string | null | undefined): string {
  if (!v?.trim()) return "—";
  const o = ORCHESTRATION_STAGE_OPTIONS.find((x) => x.value === v);
  return o?.label ?? v;
}

const ACTIVE_ORCH_HINT = (
  <p
    style={{
      margin: "4px 0 0 0",
      fontSize: 10,
      color: "#64748b",
      lineHeight: 1.45,
      maxWidth: 440,
    }}
  >
    끄면 파이프라인·오케스트레이션에서만 제외됩니다. 멤버 레코드는 유지됩니다. 완전 삭제는 아래 제거 버튼을 사용하세요.
  </p>
);

function isExecutionReviewerOrchRole(role: string | null | undefined): boolean {
  const o = parseAiMemberRole(role);
  if (!o) return false;
  return (EXECUTION_REVIEW_ROLES_UI as readonly string[]).includes(o);
}

function AiExecutionReviewerPolicyOverrides({
  member,
  disabled,
  canEdit,
  onError,
  onMessage,
  onSaved,
}: {
  member: ProjectMemberUiRow;
  disabled: boolean;
  canEdit: boolean;
  onError: (msg: string | null) => void;
  onMessage: (msg: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [approval, setApproval] = useState<string>(member.aiActionApprovalModeOverride ?? "");
  const [apply, setApply] = useState<string>(member.aiActionApplyModeOverride ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setApproval(member.aiActionApprovalModeOverride ?? "");
    setApply(member.aiActionApplyModeOverride ?? "");
  }, [member.memberId, member.aiActionApprovalModeOverride, member.aiActionApplyModeOverride]);

  if (!isExecutionReviewerOrchRole(member.aiOrchestrationRole)) return null;

  async function savePolicy() {
    setSaving(true);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(member.memberId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiActionApprovalModeOverride: approval.trim() ? approval : null,
          aiActionApplyModeOverride: apply.trim() ? apply : null,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      onMessage("이 리뷰어의 승인 정책을 저장했습니다.");
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "저장 중 오류입니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="ai-reviewer-policy-section"
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        border: "1px solid #e0e7ff",
        background: "#f8fafc",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, color: "#312e81", marginBottom: 6 }}>승인 정책</div>
      <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
        실행 리뷰어(reviewer / security-reviewer / quality-reviewer) 대상 AI 멤버 액션에만 적용됩니다. 시스템
        기본은 승인=자동 실행, 적용=검토 후 실행입니다.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 11 }}>
          <span style={{ fontWeight: 700, color: "#334155" }}>승인</span>
          <select
            data-testid="ai-reviewer-policy-approval"
            value={approval}
            disabled={disabled || saving || !canEdit}
            onChange={(e) => setApproval(e.target.value)}
            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            <option value="">시스템 기본</option>
            <option value="AUTO_APPROVE">자동 실행</option>
            <option value="MANUAL_REVIEW">검토 후 실행</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11 }}>
          <span style={{ fontWeight: 700, color: "#334155" }}>적용</span>
          <select
            data-testid="ai-reviewer-policy-apply"
            value={apply}
            disabled={disabled || saving || !canEdit}
            onChange={(e) => setApply(e.target.value)}
            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
          >
            <option value="">시스템 기본</option>
            <option value="AUTO_APPLY">자동 실행</option>
            <option value="MANUAL_APPLY">검토 후 실행</option>
          </select>
        </label>
      </div>
      {canEdit ? (
        <button
          type="button"
          data-testid="ai-reviewer-policy-save"
          disabled={disabled || saving}
          onClick={() => void savePolicy()}
          style={{
            marginTop: 10,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid #4338ca",
            background: "#4f46e5",
            color: "#fff",
            fontWeight: 700,
            fontSize: 12,
            cursor: disabled || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "저장 중…" : "이 멤버 정책 저장"}
        </button>
      ) : null}
    </div>
  );
}

function AiOrchestrationControls({
  member,
  disabled,
  onError,
  onMessage,
  onSaved,
  layout = "inline",
  canRemove = false,
  onRemove,
}: {
  member: ProjectMemberUiRow;
  disabled: boolean;
  onError: (msg: string | null) => void;
  onMessage: (msg: string) => void;
  onSaved: () => Promise<void>;
  layout?: "inline" | "card";
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const [role, setRole] = useState(member.aiOrchestrationRole ?? "");
  const [stage, setStage] = useState(member.orchestrationStage ?? "");
  const [model, setModel] = useState(member.aiModelOverride ?? "");
  const [enabled, setEnabled] = useState(member.orchestrationEnabled !== false);
  const [saving, setSaving] = useState(false);
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [customModelPicked, setCustomModelPicked] = useState(false);

  useEffect(() => {
    setRole(member.aiOrchestrationRole ?? "");
    setStage(member.orchestrationStage ?? "");
    setModel(member.aiModelOverride ?? "");
    setEnabled(member.orchestrationEnabled !== false);
    setCustomModelPicked(false);
  }, [
    member.memberId,
    member.aiOrchestrationRole,
    member.orchestrationStage,
    member.aiModelOverride,
    member.orchestrationEnabled,
  ]);

  const orchRole = parseAiMemberRole(role);
  const modelTrim = model.trim();
  const isNonPresetModel = Boolean(
    orchRole && modelTrim !== "" && modelTrim !== "gpt-5" && modelTrim !== "gpt-5-mini"
  );
  const showCustomModelField = Boolean(orchRole && (customModelPicked || isNonPresetModel));

  async function save() {
    const trimModel = model.trim();
    if (orchRole === "reviewer") {
      const effective = resolveEffectiveReviewerModel("reviewer", trimModel ? trimModel : null);
      if (isLowCapabilityReviewerModel(effective)) {
        const ok = window.confirm(
          "실행 리뷰어는 고역량 모델(GPT-5 등)을 권장합니다. 경량/저비용 모델로 저장할까요?"
        );
        if (!ok) return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(member.memberId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiOrchestrationRole: role.trim() ? role : null,
          orchestrationStage: stage.trim() ? stage : null,
          aiModelOverride: trimModel ? trimModel : null,
          orchestrationEnabled: enabled,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      onMessage("오케스트레이션 설정을 저장했습니다.");
      setModelPanelOpen(false);
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "저장 중 오류입니다.");
    } finally {
      setSaving(false);
    }
  }

  const modelPicker = (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#475569" }}>
          모델:{" "}
          <strong>
            {orchRole != null
              ? reviewerModelDisplayLabel(orchRole, model)
              : modelTrim || "—"}
          </strong>
          {orchRole && !modelTrim ? (
            <span style={{ color: "#94a3b8", fontWeight: 400 }}> (역할 기본)</span>
          ) : null}
        </span>
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => setModelPanelOpen((v) => !v)}
          style={{
            fontSize: 12,
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: disabled || saving ? "not-allowed" : "pointer",
            color: "#2563eb",
            padding: 0,
          }}
        >
          [모델 변경]
        </button>
      </div>
      {modelPanelOpen ? (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "#fff",
            display: "grid",
            gap: 8,
            fontSize: 12,
          }}
          role="group"
          aria-label="reviewer-model-override"
        >
          {orchRole == null ? (
            <p style={{ margin: 0, color: "#64748b" }}>
              오케스트레이션 역할을 선택하면 역할별 기본 모델이 적용됩니다.
            </p>
          ) : null}
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name={`orch-model-${member.memberId}`}
              checked={!modelTrim}
              disabled={disabled || saving || !orchRole}
              onChange={() => {
                setCustomModelPicked(false);
                setModel("");
              }}
            />
            역할 기본값 사용
          </label>
          {REVIEW_MODEL_PRESETS.map((p) => (
            <label key={p.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name={`orch-model-${member.memberId}`}
                checked={modelTrim === p.value}
                disabled={disabled || saving || !orchRole}
                onChange={() => {
                  setCustomModelPicked(false);
                  setModel(p.value);
                }}
              />
              {p.label}
            </label>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="radio"
              name={`orch-model-${member.memberId}`}
              checked={showCustomModelField}
              disabled={disabled || saving || !orchRole}
              onChange={() => {
                setCustomModelPicked(true);
                setModel((prev) => {
                  const t = prev.trim();
                  if (t === "gpt-5" || t === "gpt-5-mini") return "";
                  return prev;
                });
              }}
            />
            기타 모델 (고급)
          </label>
          {showCustomModelField ? (
            <input
              placeholder="모델 ID (예: gpt-4o)"
              value={model}
              disabled={disabled || saving}
              onChange={(e) => setModel(e.target.value)}
              style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              aria-label="ai-model-custom"
            />
          ) : null}
          {!orchRole ? (
            <input
              placeholder="모델 ID (역할 미지정 시)"
              value={model}
              disabled={disabled || saving}
              onChange={(e) => setModel(e.target.value)}
              style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
              aria-label="ai-model-override-fallback"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const saveRemoveRow = (opts: { variant: "card" | "inline" }) => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        width: "100%",
        ...(opts.variant === "card" ? { marginTop: 2 } : { flexBasis: "100%", marginTop: 6 }),
      }}
    >
      <button
        type="button"
        disabled={disabled || saving}
        onClick={save}
        style={
          opts.variant === "card"
            ? {
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                cursor: disabled || saving ? "not-allowed" : "pointer",
              }
            : {}
        }
      >
        {saving ? "저장…" : opts.variant === "card" ? "저장" : "오케 설정 저장"}
      </button>
      {canRemove && onRemove ? (
        <button
          type="button"
          disabled={disabled || saving}
          onClick={onRemove}
          style={{
            marginLeft: "auto",
            ...(opts.variant === "card"
              ? {
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #dc2626",
                  background: "#fff",
                  color: "#b91c1c",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: disabled || saving ? "not-allowed" : "pointer",
                }
              : {
                  fontSize: 12,
                  border: "1px solid #dc2626",
                  background: "#fff",
                  color: "#b91c1c",
                  fontWeight: 600,
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: disabled || saving ? "not-allowed" : "pointer",
                }),
          }}
        >
          제거
        </button>
      ) : null}
    </div>
  );

  if (layout === "card") {
    return (
      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid #e2e8f0",
          display: "grid",
          gap: 10,
        }}
      >
        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 700, color: "#334155" }}>역할</span>
          <select
            value={role}
            disabled={disabled || saving}
            onChange={(e) => {
              setRole(e.target.value);
              setCustomModelPicked(false);
            }}
            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            aria-label="ai-orchestration-role"
          >
            {AI_ORCHESTRATION_ROLE_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 700, color: "#334155" }}>단계</span>
          <select
            value={stage}
            disabled={disabled || saving}
            onChange={(e) => setStage(e.target.value)}
            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1" }}
            aria-label="orchestration-stage"
          >
            {ORCHESTRATION_STAGE_OPTIONS.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 700, color: "#334155" }}>모델</span>
          {modelPicker}
        </label>
        <div>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
            <input
              type="checkbox"
              checked={enabled}
              disabled={disabled || saving}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            활성
          </label>
          {ACTIVE_ORCH_HINT}
        </div>
        {saveRemoveRow({ variant: "card" })}
      </div>
    );
  }

  return (
    <div
      style={{
        flexBasis: "100%",
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "flex-start",
        padding: "8px 0 4px 0",
        borderTop: "1px dashed #e2e8f0",
        marginTop: 4,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>오케스트레이션 (AI)</span>
      <select
        value={role}
        disabled={disabled || saving}
        onChange={(e) => {
          setRole(e.target.value);
          setCustomModelPicked(false);
        }}
        style={{ fontSize: 12 }}
        aria-label="ai-orchestration-role"
      >
        {AI_ORCHESTRATION_ROLE_OPTIONS.map((o) => (
          <option key={o.value || "none"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        value={stage}
        disabled={disabled || saving}
        onChange={(e) => setStage(e.target.value)}
        style={{ fontSize: 12 }}
        aria-label="orchestration-stage"
      >
        {ORCHESTRATION_STAGE_OPTIONS.map((o) => (
          <option key={o.value || "none"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <div style={{ flex: "1 1 220px", minWidth: 200 }}>{modelPicker}</div>
      <div style={{ flexBasis: "100%" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled || saving}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          활성
        </label>
        {ACTIVE_ORCH_HINT}
      </div>
      {saveRemoveRow({ variant: "inline" })}
    </div>
  );
}

function statusBadgeStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
  };
  switch (status) {
    case "DONE":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "FAILED":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    case "IN_PROGRESS":
      return { ...base, background: "#fef9c3", color: "#854d0e" };
    case "CANCELED":
      return { ...base, background: "#f3f4f6", color: "#4b5563" };
    default:
      return { ...base, background: "#e0f2fe", color: "#0369a1" };
  }
}

function reviewBadgeStyle(rs: string | null): CSSProperties {
  const base: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 999,
  };
  switch (rs) {
    case "APPROVED":
      return { ...base, background: "#d1fae5", color: "#065f46" };
    case "REJECTED":
      return { ...base, background: "#fecaca", color: "#991b1b" };
    case "NEEDS_REVISION":
      return { ...base, background: "#fde68a", color: "#92400e" };
    case "PENDING_REVIEW":
      return { ...base, background: "#dbeafe", color: "#1e40af" };
    default:
      return { ...base, background: "#f1f5f9", color: "#475569" };
  }
}

export function ProjectMembersSection({
  projectId,
  members,
  canManageMembers,
  onChanged,
  tasks = [],
  gitRequests = [],
  taskPrompts = [],
  canRequestAiMemberAction = false,
  canRequestAiReviewAction = false,
  canDispatchAiMemberAction = false,
  currentProjectRole = null,
  currentUserId = null,
  memberSurface = "all",
  canRunStage2EnvTest = false,
  isProjectOwner = false,
}: ProjectMembersSectionProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteType, setInviteType] = useState<"HUMAN" | "AI">(
    memberSurface === "ai" ? "AI" : "HUMAN"
  );
  const [inviteRole, setInviteRole] = useState<ProjectRole>("VIEWER");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteAiProvider, setInviteAiProvider] = useState("");
  const [inviteAiAgentKey, setInviteAiAgentKey] = useState("");
  const [inviteOrchRole, setInviteOrchRole] = useState("");
  const [inviteOrchStage, setInviteOrchStage] = useState("execution-review");
  const [inviteOrchModel, setInviteOrchModel] = useState("");
  const [inviteOrchEnabled, setInviteOrchEnabled] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [aiActions, setAiActions] = useState<AiActionRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [runOnceBusy, setRunOnceBusy] = useState(false);
  const [reviewCommentDraft, setReviewCommentDraft] = useState<Record<string, string>>({});
  const [reviewHistoryByAction, setReviewHistoryByAction] = useState<Record<string, ReviewLogRow[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMemberId, setRequestMemberId] = useState<string | null>(null);
  const [requestActionType, setRequestActionType] = useState<AiMemberActionTypeId>("SUMMARY_REQUEST");
  const [requestTaskId, setRequestTaskId] = useState("");
  const [requestGitId, setRequestGitId] = useState("");
  const [requestPromptId, setRequestPromptId] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  const showScreenLabels = useShowScreenLabels();
  const [unifiedMemberTab, setUnifiedMemberTab] = useState<"all" | "human" | "ai">("all");
  const [unifiedSelectedId, setUnifiedSelectedId] = useState<string | null>(null);

  const canAnyAiRequest = canRequestAiMemberAction || canRequestAiReviewAction;

  function canPatchListedAction(a: AiActionRow): boolean {
    if (currentUserId && a.requestedByUserId === currentUserId) {
      return true;
    }
    const role = currentProjectRole;
    if (!role) return false;
    if (role === "OWNER" || role === "EDITOR") return true;
    if (role === "REVIEWER") return a.actionType === "REVIEW_REQUEST";
    return false;
  }

  function formatActionTarget(a: AiActionRow): string {
    if (a.gitChangeRequestId) {
      return `Git 변경 요청 ${a.gitChangeRequestId.slice(0, 8)}…`;
    }
    if (a.taskId) {
      const t = tasks.find((x) => x.id === a.taskId);
      return t ? `Task: ${t.name}` : `Task ${a.taskId.slice(0, 8)}…`;
    }
    return "프로젝트";
  }

  const reloadActions = useCallback(async () => {
    if (!projectId) return;
    setActionsLoading(true);
    try {
      const res = await fetch(`/api/ai-member-actions?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: AiActionRow[] };
      if (res.ok && json.success && Array.isArray(json.data)) {
        setAiActions(json.data);
      } else {
        setAiActions([]);
      }
    } catch {
      setAiActions([]);
    } finally {
      setActionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reloadActions();
  }, [reloadActions]);

  useEffect(() => {
    if (memberSurface === "human") setInviteType("HUMAN");
    if (memberSurface === "ai") setInviteType("AI");
    if (memberSurface === "unified") setInviteType("HUMAN");
  }, [memberSurface]);

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        if (a.memberType !== b.memberType) return a.memberType === "HUMAN" ? -1 : 1;
        return a.displayName.localeCompare(b.displayName);
      }),
    [members]
  );

  const displayMembers = useMemo(() => {
    if (memberSurface === "human") return sortedMembers.filter((m) => m.memberType === "HUMAN");
    if (memberSurface === "ai") return sortedMembers.filter((m) => m.memberType === "AI");
    if (memberSurface === "unified") {
      if (unifiedMemberTab === "human") return sortedMembers.filter((m) => m.memberType === "HUMAN");
      if (unifiedMemberTab === "ai") return sortedMembers.filter((m) => m.memberType === "AI");
      return sortedMembers;
    }
    return sortedMembers;
  }, [sortedMembers, memberSurface, unifiedMemberTab]);

  const unifiedSelectedMember = useMemo(
    () => sortedMembers.find((m) => m.memberId === unifiedSelectedId) ?? null,
    [sortedMembers, unifiedSelectedId]
  );

  useEffect(() => {
    if (memberSurface !== "unified" || !unifiedSelectedId) return;
    if (!displayMembers.some((m) => m.memberId === unifiedSelectedId)) {
      setUnifiedSelectedId(null);
    }
  }, [memberSurface, displayMembers, unifiedSelectedId]);

  const aiOrchestrationSplit = useMemo(() => {
    const ai = sortedMembers.filter((m) => m.memberType === "AI");
    const byRole = new Map<string, ProjectMemberUiRow[]>();
    const others: ProjectMemberUiRow[] = [];
    for (const m of ai) {
      const r = m.aiOrchestrationRole?.trim();
      if (!r) {
        others.push(m);
        continue;
      }
      const list = byRole.get(r) ?? [];
      list.push(m);
      byRole.set(r, list);
    }
    return { byRole, others };
  }, [sortedMembers]);

  const actionOptionsForModal = useMemo(() => {
    const opts: { value: AiMemberActionTypeId; label: string }[] = [];
    if (canRequestAiReviewAction) {
      opts.push({ value: "REVIEW_REQUEST", label: "코드/변경 리뷰" });
    }
    if (canRequestAiMemberAction) {
      opts.push(
        { value: "TASK_DRAFT_REQUEST", label: "Task 초안" },
        { value: "QA_CHECK_REQUEST", label: "QA 점검" },
        { value: "SUMMARY_REQUEST", label: "요약" }
      );
    }
    return opts;
  }, [canRequestAiMemberAction, canRequestAiReviewAction]);

  function openRequestModal(memberId: string, suggested?: AiMemberActionTypeId) {
    setRequestMemberId(memberId);
    const first = actionOptionsForModal[0]?.value ?? "SUMMARY_REQUEST";
    setRequestActionType(suggested ?? first);
    setRequestTaskId(tasks[0]?.id ?? "");
    setRequestGitId(gitRequests[0]?.id ?? "");
    setRequestPromptId("");
    setRequestOpen(true);
  }

  async function submitAiRequest() {
    if (!requestMemberId || !projectId) return;
    setRequestBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        projectId,
        projectMemberId: requestMemberId,
        actionType: requestActionType,
        executionMode: "STUB",
      };
      if (requestActionType === "REVIEW_REQUEST") {
        if (!requestGitId.trim()) {
          throw new Error("리뷰 요청은 Git 변경 요청을 선택해야 합니다.");
        }
        body.gitChangeRequestId = requestGitId.trim();
        const g = gitRequests.find((x) => x.id === requestGitId);
        if (g) body.taskId = g.taskId;
      } else {
        if (!requestTaskId.trim()) {
          throw new Error("Task를 선택하세요.");
        }
        body.taskId = requestTaskId.trim();
        if (requestPromptId.trim()) {
          body.taskPromptId = requestPromptId.trim();
        }
      }
      const res = await fetch("/api/ai-member-actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "요청 생성에 실패했습니다.");
      }
      setMessage("AI 멤버 요청이 등록되었습니다.");
      setRequestOpen(false);
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function patchAction(actionId: string, payload: Record<string, unknown>) {
    setError(null);
    setActionBusyId(actionId);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "상태 변경에 실패했습니다.");
      }
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 중 오류입니다.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function dispatchAction(actionId: string) {
    setError(null);
    setActionBusyId(actionId);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}/dispatch`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "디스패치에 실패했습니다.");
      }
      setMessage("액션이 디스패치되었습니다.");
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "디스패치 중 오류입니다.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function retryAction(actionId: string) {
    setError(null);
    setActionBusyId(actionId);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}/retry`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "재시도 큐잉에 실패했습니다.");
      }
      setMessage("액션을 다시 요청(REQUESTED) 상태로 두었습니다.");
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "재시도 중 오류입니다.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function runDispatchOnceForProject() {
    if (!projectId) return;
    setError(null);
    setRunOnceBusy(true);
    try {
      const res = await fetch("/api/ai-member-actions/dispatch/run-once", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "run-once 실행에 실패했습니다.");
      }
      setMessage("디스패처 1회 실행을 완료했습니다.");
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "run-once 중 오류입니다.");
    } finally {
      setRunOnceBusy(false);
    }
  }

  async function submitReviewDecision(
    actionId: string,
    decision: "APPROVE" | "REJECT" | "REQUEST_REVISION"
  ) {
    setError(null);
    setActionBusyId(actionId);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}/review`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          comment: reviewCommentDraft[actionId]?.trim() || null,
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "검토 처리에 실패했습니다.");
      }
      setMessage("검토가 반영되었습니다.");
      setReviewCommentDraft((prev) => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "검토 중 오류입니다.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function applyApprovedAction(actionId: string) {
    setError(null);
    setActionBusyId(actionId);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}/apply`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "적용에 실패했습니다.");
      }
      setMessage("승인 결과를 시스템에 반영했습니다.");
      await reloadActions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "적용 중 오류입니다.");
    } finally {
      setActionBusyId(null);
    }
  }

  async function toggleReviewHistory(actionId: string) {
    if (historyOpenId === actionId) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(actionId);
    if (reviewHistoryByAction[actionId]?.length) {
      return;
    }
    setHistoryLoadingId(actionId);
    setError(null);
    try {
      const res = await fetch(`/api/ai-member-actions/${encodeURIComponent(actionId)}/reviews`, {
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; data?: ReviewLogRow[] };
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        throw new Error("검토 이력을 불러오지 못했습니다.");
      }
      setReviewHistoryByAction((prev) => ({ ...prev, [actionId]: json.data ?? [] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력 로드 오류");
      setHistoryOpenId(null);
    } finally {
      setHistoryLoadingId(null);
    }
  }

  async function handleInviteSubmit() {
    setError(null);
    setMessage(null);
    if (inviteType === "AI" && inviteOrchRole.trim() === "reviewer") {
      const eff = resolveEffectiveReviewerModel("reviewer", inviteOrchModel.trim() || null);
      if (isLowCapabilityReviewerModel(eff)) {
        const ok = window.confirm(
          "실행 리뷰어는 고역량 모델(GPT-5 등)을 권장합니다. 경량/저비용 모델로 초대할까요?"
        );
        if (!ok) return;
      }
    }
    setInviteBusy(true);
    try {
      const payload =
        inviteType === "HUMAN"
          ? {
              projectId,
              memberType: inviteType,
              role: inviteRole,
              email: inviteEmail.trim(),
            }
          : {
              projectId,
              memberType: inviteType,
              role: inviteRole,
              displayName: inviteDisplayName.trim(),
              aiProvider: inviteAiProvider.trim() || null,
              aiAgentKey: inviteAiAgentKey.trim() || null,
              ...(inviteOrchRole.trim()
                ? { aiOrchestrationRole: inviteOrchRole.trim(), orchestrationStage: inviteOrchStage.trim() || undefined }
                : {}),
              ...(inviteOrchModel.trim() ? { aiModelOverride: inviteOrchModel.trim() } : {}),
              orchestrationEnabled: inviteOrchEnabled,
            };
      const res = await fetch("/api/project/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "멤버 초대에 실패했습니다.");
      }
      setInviteEmail("");
      setInviteDisplayName("");
      setInviteAiProvider("");
      setInviteAiAgentKey("");
      setInviteOrchRole("");
      setInviteOrchStage("execution-review");
      setInviteOrchModel("");
      setInviteOrchEnabled(true);
      setMessage(json.message || "멤버가 추가되었습니다.");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "멤버 초대 중 오류가 발생했습니다.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRoleChange(memberId: string, role: ProjectRole) {
    setError(null);
    setMessage(null);
    setBusyMemberId(memberId);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "역할 변경에 실패했습니다.");
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "역할 변경 중 오류가 발생했습니다.");
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleRemove(memberId: string) {
    const ok = window.confirm(
      "이 멤버를 프로젝트에서 완전히 제거합니다. (활성 해제와 다릅니다.) 계속할까요?"
    );
    if (!ok) return;
    setError(null);
    setMessage(null);
    setBusyMemberId(memberId);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(memberId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "멤버 제거에 실패했습니다.");
      }
      setMessage("멤버가 제거되었습니다.");
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "멤버 제거 중 오류가 발생했습니다.");
    } finally {
      setBusyMemberId(null);
    }
  }

  const promptsForTask = useMemo(() => {
    if (!requestTaskId) return [];
    return taskPrompts.filter((p) => p.taskId === requestTaskId);
  }, [taskPrompts, requestTaskId]);

  const title =
    memberSurface === "human"
      ? "사람 멤버"
      : memberSurface === "ai"
        ? "AI 멤버 · 오케스트레이션"
        : memberSurface === "unified"
          ? "멤버"
          : "멤버 관리";
  const subtitle =
    memberSurface === "human"
      ? "프로젝트에 참여하는 사람 사용자를 초대·역할 변경합니다."
      : memberSurface === "ai"
        ? "Stage 2에 사용하는 역할을 카드로 관리합니다. 상단에서 기본 멤버 추가와 역할 테스트를 실행할 수 있습니다."
        : memberSurface === "unified"
          ? "사람과 AI가 같은 멤버 목록에 표시됩니다. 역할은 동일하게 적용되며, AI만 모델·오케스트레이션 설정이 추가됩니다."
          : "HUMAN / AI 멤버를 프로젝트 단위로 관리합니다. AI 멤버에는 사람(actor)이 액션을 요청할 수 있습니다.";

  const collabSurfaceVisible = memberSurface !== "human";
  const showCollaborationQueuePanel =
    collabSurfaceVisible && (actionsLoading || aiActions.length > 0);
  const showDispatchRunOnceAlone =
    collabSurfaceVisible &&
    !actionsLoading &&
    aiActions.length === 0 &&
    canDispatchAiMemberAction;

  function openPresetInviteForOrchRole(orchKey: string) {
    setInviteOpen(true);
    setInviteType("AI");
    setInviteRole("REVIEWER");
    setInviteOrchRole(orchKey);
    const st =
      orchKey === "reviewer" || orchKey === "security-reviewer" || orchKey === "quality-reviewer"
        ? "execution-review"
        : orchKey === "scm-manager"
          ? "scm-manager"
        : orchKey === "task-reviewer"
          ? "task"
          : "spec";
    setInviteOrchStage(st);
    const label = ORCH_ROLE_LABELS[orchKey]?.title ?? orchKey;
    setInviteDisplayName((prev) => (prev.trim() ? prev : label));
  }

  function renderStandardMemberRow(m: ProjectMemberUiRow) {
    return (
      <li
        key={m.memberId}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid #eee",
          paddingBottom: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>{m.memberType === "AI" ? "🤖" : "👤"}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: m.memberType === "AI" ? "#ede9fe" : "#eef2ff",
            color: m.memberType === "AI" ? "#5b21b6" : "#1d4ed8",
          }}
        >
          {m.memberType}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #d0d5dd",
            background: "#f8fafc",
          }}
        >
          {m.role}
        </span>
        <strong>{m.displayName}</strong>
        {m.aiProvider ? <span style={{ color: "#666", fontSize: 12 }}>({m.aiProvider})</span> : null}
        {m.memberType === "AI" && canAnyAiRequest && actionOptionsForModal.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() =>
                openRequestModal(
                  m.memberId,
                  m.role === "REVIEWER"
                    ? "REVIEW_REQUEST"
                    : m.role === "EDITOR"
                      ? "TASK_DRAFT_REQUEST"
                      : "QA_CHECK_REQUEST"
                )
              }
            >
              AI 요청…
            </button>
            {m.role === "REVIEWER" && canRequestAiReviewAction ? (
              <button type="button" onClick={() => openRequestModal(m.memberId, "REVIEW_REQUEST")}>
                리뷰
              </button>
            ) : null}
            {m.role === "EDITOR" && canRequestAiMemberAction ? (
              <>
                <button type="button" onClick={() => openRequestModal(m.memberId, "TASK_DRAFT_REQUEST")}>
                  초안
                </button>
                <button type="button" onClick={() => openRequestModal(m.memberId, "SUMMARY_REQUEST")}>
                  요약
                </button>
              </>
            ) : null}
            {(m.role === "VIEWER" || m.role === "EDITOR") && canRequestAiMemberAction ? (
              <button type="button" onClick={() => openRequestModal(m.memberId, "QA_CHECK_REQUEST")}>
                점검
              </button>
            ) : null}
          </>
        ) : null}
        {canManageMembers ? (
          <>
            <select
              disabled={busyMemberId === m.memberId || m.isOwner}
              value={m.role}
              onChange={(e) => handleRoleChange(m.memberId, e.target.value as ProjectRole)}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {m.memberType !== "AI" ? (
              <button
                type="button"
                disabled={busyMemberId === m.memberId || m.isOwner}
                onClick={() => handleRemove(m.memberId)}
              >
                제거
              </button>
            ) : null}
          </>
        ) : null}
        {m.memberType === "AI" && canManageMembers ? (
          <AiOrchestrationControls
            member={m}
            disabled={busyMemberId === m.memberId}
            onError={(msg) => setError(msg)}
            onMessage={(msg) => setMessage(msg)}
            onSaved={onChanged}
            canRemove={!m.isOwner}
            onRemove={() => handleRemove(m.memberId)}
          />
        ) : null}
        {m.memberType === "AI" && isExecutionReviewerOrchRole(m.aiOrchestrationRole) ? (
          <AiExecutionReviewerPolicyOverrides
            member={m}
            disabled={busyMemberId === m.memberId}
            canEdit={canManageMembers}
            onError={(msg) => setError(msg)}
            onMessage={(msg) => setMessage(msg)}
            onSaved={onChanged}
          />
        ) : null}
      </li>
    );
  }

  function renderOrchestrationRoleCard(orchKey: string, opts?: { compact?: boolean }) {
    const compact = opts?.compact === true;
    const meta = ORCH_ROLE_LABELS[orchKey];
    if (!meta) return null;
    const cardOrchRole = parseAiMemberRole(orchKey);
    const assigned = aiOrchestrationSplit.byRole.get(orchKey) ?? [];
    return (
      <div
        key={orchKey}
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12,
          background: "#fafafa",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{meta.title}</div>
        {compact ? (
          <div style={{ fontSize: 10, color: "#6d28d9", fontWeight: 800, margin: "4px 0 4px 0" }}>Stage 2 역할</div>
        ) : null}
        {orchKey === "reviewer" && compact ? (
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#b45309", lineHeight: 1.45 }}>
            멤버 없음/비활성 시 플랫폼이 리뷰를 대신하지 않습니다(MISSING/DISABLED 기록).
          </p>
        ) : null}
        {orchKey === "security-reviewer" && compact ? (
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#b45309", lineHeight: 1.45 }}>
            멤버 없음/비활성 시 플랫폼이 보안 검증을 대신하지 않습니다(MISSING/DISABLED 기록).
          </p>
        ) : null}
        {orchKey === "scm-manager" && compact ? (
          <p style={{ margin: "0 0 8px 0", fontSize: 11, color: "#64748b", lineHeight: 1.45 }}>
            미등록 시 플랫폼이 merge·verify를 수행합니다.
          </p>
        ) : null}
        <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>{meta.description}</p>
        {cardOrchRole && !compact ? (
          <div style={{ fontSize: 12, color: "#334155", marginBottom: 10 }}>
            <span style={{ color: "#64748b" }}>역할 기본 모델:</span>{" "}
            <strong>{reviewerModelDisplayLabel(cardOrchRole, null)}</strong>
          </div>
        ) : null}
        {compact && cardOrchRole ? (
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 8 }}>
            <span style={{ color: "#64748b" }}>모델:</span> openai · Stage2 기본{" "}
            <span style={{ fontFamily: "monospace" }}>gpt-4o-mini</span>
            {assigned[0]
              ? ` · 멤버 지정: ${reviewerModelDisplayLabel(cardOrchRole, assigned[0].aiModelOverride)}`
              : null}
          </div>
        ) : null}
        {assigned.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>배정된 AI 멤버 없음</div>
        ) : (
          assigned.map((m, i) => {
            const rowOrch = parseAiMemberRole(m.aiOrchestrationRole);
            return (
            <div
              key={m.memberId}
              style={{
                marginTop: i === 0 ? 0 : 10,
                paddingTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? "none" : "1px solid #e2e8f0",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 14 }}>{m.displayName}</strong>
                {!canManageMembers ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #d0d5dd",
                      background: "#fff",
                    }}
                  >
                    프로젝트 역할 {m.role}
                  </span>
                ) : null}
                {canAnyAiRequest && actionOptionsForModal.length > 0 && !compact ? (
                  <button type="button" onClick={() => openRequestModal(m.memberId, "SUMMARY_REQUEST")}>
                    AI 요청…
                  </button>
                ) : null}
              </div>
              {compact && canManageMembers ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 8 }}>
                  <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={m.orchestrationEnabled !== false}
                      disabled={busyMemberId === m.memberId}
                      onChange={async (e) => {
                        setBusyMemberId(m.memberId);
                        setError(null);
                        try {
                          const res = await fetch(`/api/project/members/${encodeURIComponent(m.memberId)}`, {
                            method: "PATCH",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ orchestrationEnabled: e.target.checked }),
                          });
                          const json = (await res.json()) as { success?: boolean; message?: string };
                          if (!res.ok || !json.success) {
                            throw new Error(json.message || "저장에 실패했습니다.");
                          }
                          setMessage("활성 상태를 저장했습니다.");
                          await onChanged();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "저장 중 오류입니다.");
                        } finally {
                          setBusyMemberId(null);
                        }
                      }}
                    />
                    활성
                  </label>
                  {!m.isOwner ? (
                    <button
                      type="button"
                      disabled={busyMemberId === m.memberId}
                      onClick={() => handleRemove(m.memberId)}
                      style={{
                        fontSize: 12,
                        border: "1px solid #dc2626",
                        background: "#fff",
                        color: "#b91c1c",
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: "4px 10px",
                        cursor: busyMemberId === m.memberId ? "not-allowed" : "pointer",
                      }}
                    >
                      삭제
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!compact && canManageMembers ? (
                <label
                  style={{
                    display: "grid",
                    gap: 4,
                    marginTop: 8,
                    fontSize: 11,
                    color: "#64748b",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#334155" }}>프로젝트 역할</span>
                  <select
                    disabled={busyMemberId === m.memberId || m.isOwner}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.memberId, e.target.value as ProjectRole)}
                    style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", maxWidth: 280 }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {canManageMembers ? (
                compact ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#4338ca" }}>
                      고급 설정 (역할·단계·모델)
                    </summary>
                    <div style={{ marginTop: 8 }}>
                      <AiOrchestrationControls
                        layout="card"
                        member={m}
                        disabled={busyMemberId === m.memberId}
                        onError={(msg) => setError(msg)}
                        onMessage={(msg) => setMessage(msg)}
                        onSaved={onChanged}
                        canRemove={!m.isOwner}
                        onRemove={() => handleRemove(m.memberId)}
                      />
                    </div>
                  </details>
                ) : (
                  <AiOrchestrationControls
                    layout="card"
                    member={m}
                    disabled={busyMemberId === m.memberId}
                    onError={(msg) => setError(msg)}
                    onMessage={(msg) => setMessage(msg)}
                    onSaved={onChanged}
                    canRemove={!m.isOwner}
                    onRemove={() => handleRemove(m.memberId)}
                  />
                )
              ) : (
                <div style={{ fontSize: 12, color: "#475569", marginTop: 8, lineHeight: 1.5 }}>
                  <span style={{ color: "#64748b" }}>모델:</span>{" "}
                  {rowOrch
                    ? reviewerModelDisplayLabel(rowOrch, m.aiModelOverride)
                    : m.aiModelOverride?.trim() || "—"}{" "}
                  · <span style={{ color: "#64748b" }}>단계:</span> {stageLabel(m.orchestrationStage)} ·{" "}
                  <span style={{ color: "#64748b" }}>활성:</span>{" "}
                  {m.orchestrationEnabled !== false ? "예" : "아니오"}
                </div>
              )}
              {isExecutionReviewerOrchRole(m.aiOrchestrationRole) && !compact ? (
                <AiExecutionReviewerPolicyOverrides
                  member={m}
                  disabled={busyMemberId === m.memberId}
                  canEdit={canManageMembers}
                  onError={(msg) => setError(msg)}
                  onMessage={(msg) => setMessage(msg)}
                  onSaved={onChanged}
                />
              ) : null}
            </div>
          );
          })
        )}
        {canManageMembers ? (
          <button
            type="button"
            onClick={() => openPresetInviteForOrchRole(orchKey)}
            style={{
              marginTop: 10,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #94a3b8",
              background: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            이 역할로 멤버 추가
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <section
      data-testid={
        memberSurface === "human"
          ? "project-members-human-section"
          : memberSurface === "ai"
            ? "project-members-ai-section"
            : memberSurface === "unified"
              ? "project-unified-members-section"
              : "project-members-section"
      }
      data-ui-label={
        memberSurface === "human"
          ? "[P-6-1] Members Surface — Human"
          : memberSurface === "ai"
            ? "[P-6-2] Members Surface — AI"
            : memberSurface === "unified"
              ? "[P-6-3] Members Surface — Unified"
              : "[P-6-0] Members Surface — All"
      }
      style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}
    >
      <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#666", lineHeight: 1.5 }}>{subtitle}</p>
      {canManageMembers ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button type="button" data-testid="member-invite-toggle" onClick={() => setInviteOpen((v) => !v)}>
            {inviteOpen ? "초대 패널 닫기" : "멤버 초대"}
          </button>
        </div>
      ) : null}
      {inviteOpen && canManageMembers ? (
        <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {memberSurface === "all" || memberSurface === "unified" ? (
              <select value={inviteType} onChange={(e) => setInviteType(e.target.value as "HUMAN" | "AI")}>
                <option value="HUMAN">HUMAN</option>
                <option value="AI">AI</option>
              </select>
            ) : (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: inviteType === "AI" ? "#ede9fe" : "#eef2ff",
                  color: inviteType === "AI" ? "#5b21b6" : "#1d4ed8",
                }}
              >
                {inviteType}
              </span>
            )}
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as ProjectRole)}>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            {inviteType === "HUMAN" ? (
              <input
                placeholder="user email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                data-testid="invite-human-email"
              />
            ) : (
              <>
                <input
                  placeholder="AI display name"
                  value={inviteDisplayName}
                  onChange={(e) => setInviteDisplayName(e.target.value)}
                  data-testid="invite-ai-display-name"
                />
                <input
                  placeholder="AI provider (optional)"
                  value={inviteAiProvider}
                  onChange={(e) => setInviteAiProvider(e.target.value)}
                  data-testid="invite-ai-provider"
                />
                <input
                  placeholder="AI agent key (optional)"
                  value={inviteAiAgentKey}
                  onChange={(e) => setInviteAiAgentKey(e.target.value)}
                  data-testid="invite-ai-agent-key"
                />
                <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>실행 후 검토 AI 멤버 (선택)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteDisplayName("실행 리뷰어");
                      setInviteOrchRole("reviewer");
                      setInviteOrchStage("execution-review");
                      setInviteRole("REVIEWER");
                    }}
                  >
                    프리셋: 실행 리뷰어
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteDisplayName("보안 리뷰어");
                      setInviteOrchRole("security-reviewer");
                      setInviteOrchStage("execution-review");
                      setInviteRole("REVIEWER");
                    }}
                  >
                    프리셋: 보안 리뷰어
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteDisplayName("품질 리뷰어");
                      setInviteOrchRole("quality-reviewer");
                      setInviteOrchStage("execution-review");
                      setInviteRole("REVIEWER");
                    }}
                  >
                    프리셋: 품질 리뷰어
                  </button>
                  <select
                    value={inviteOrchRole}
                    onChange={(e) => setInviteOrchRole(e.target.value)}
                    style={{ fontSize: 12 }}
                    aria-label="invite-ai-orch-role"
                  >
                    {AI_ORCHESTRATION_ROLE_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={inviteOrchStage}
                    onChange={(e) => setInviteOrchStage(e.target.value)}
                    style={{ fontSize: 12 }}
                  >
                    {ORCHESTRATION_STAGE_OPTIONS.filter((o) => o.value).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#64748b" }}>모델</span>
                    <button type="button" style={{ fontSize: 11 }} onClick={() => setInviteOrchModel("")}>
                      역할 기본
                    </button>
                    {REVIEW_MODEL_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        style={{ fontSize: 11 }}
                        onClick={() => setInviteOrchModel(p.value)}
                      >
                        {p.value}
                      </button>
                    ))}
                    <input
                      placeholder="기타 모델 ID"
                      value={inviteOrchModel}
                      onChange={(e) => setInviteOrchModel(e.target.value)}
                      style={{ fontSize: 12, width: 140 }}
                      aria-label="invite-ai-model-override"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={inviteOrchEnabled}
                        onChange={(e) => setInviteOrchEnabled(e.target.checked)}
                      />
                      활성
                    </label>
                    {ACTIVE_ORCH_HINT}
                  </div>
                </div>
              </>
            )}
            <button type="button" data-testid="invite-submit" disabled={inviteBusy} onClick={handleInviteSubmit}>
              {inviteBusy ? "처리 중..." : "추가"}
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p style={{ color: "#0b6b0b", fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: "#b42318", fontSize: 13 }}>{error}</p> : null}

      {memberSurface === "ai" || memberSurface === "unified" ? (
        <>
          {memberSurface === "unified" ? (
            <div data-testid="project-unified-members-table-wrap" style={{ marginBottom: 20 }}>
              <ScreenLabel label="프로젝트관리-멤버-탭-구역" visible={showScreenLabels} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {(["all", "human", "ai"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setUnifiedMemberTab(tab);
                      setUnifiedSelectedId(null);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: unifiedMemberTab === tab ? "1px solid #2563eb" : "1px solid #cbd5e1",
                      background: unifiedMemberTab === tab ? "#eff6ff" : "#fff",
                      fontWeight: unifiedMemberTab === tab ? 800 : 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {tab === "all" ? "전체" : tab === "human" ? "사용자" : "AI"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
                <div data-testid="project-unified-members-list-column" style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <ScreenLabel label="프로젝트관리-멤버-목록-테이블" visible={showScreenLabels} />
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>이름</th>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>유형</th>
                          <th style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>역할</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayMembers.map((m) => {
                          const u = memberRowToUnified(m);
                          const sel = unifiedSelectedId === m.memberId;
                          return (
                            <tr
                              key={m.memberId}
                              data-testid="project-unified-members-row"
                              onClick={() => setUnifiedSelectedId(m.memberId)}
                              style={{
                                cursor: "pointer",
                                background: sel ? "#eff6ff" : "#fff",
                                borderBottom: "1px solid #f1f5f9",
                              }}
                            >
                              <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                                  <ScreenLabel label="프로젝트관리-멤버-행-컨테이너" visible={showScreenLabels} />
                                  <span style={{ fontWeight: 700 }}>{u.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <ScreenLabel label="프로젝트관리-멤버-행-유형배지" visible={showScreenLabels} />
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    padding: "2px 8px",
                                    borderRadius: 999,
                                    background: u.type === "AI" ? "#ede9fe" : "#eef2ff",
                                    color: u.type === "AI" ? "#5b21b6" : "#1d4ed8",
                                  }}
                                >
                                  {memberTypeLabelKr(u.type)}
                                </span>
                              </td>
                              <td style={{ padding: "10px 12px", color: "#334155" }}>{u.roles.join(" · ")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <aside
                  data-testid="project-unified-members-detail"
                  style={{
                    flex: "1 1 280px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 14,
                    background: "#fafafa",
                    minHeight: 200,
                  }}
                >
                  <ScreenLabel label="프로젝트관리-멤버-상세-패널" visible={showScreenLabels} />
                  {!unifiedSelectedMember ? (
                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>목록에서 멤버를 선택하세요.</p>
                  ) : unifiedSelectedMember.memberType === "HUMAN" ? (
                    <div>
                      <h3 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 800 }}>멤버 상세</h3>
                      <p style={{ margin: "0 0 6px 0", fontSize: 13 }}>
                        <span style={{ color: "#64748b" }}>이름</span> {unifiedSelectedMember.displayName}
                      </p>
                      <label style={{ display: "grid", gap: 6, marginTop: 12, fontSize: 13 }}>
                        <span style={{ fontWeight: 700 }}>역할</span>
                        <select
                          disabled={
                            !canManageMembers ||
                            busyMemberId === unifiedSelectedMember.memberId ||
                            unifiedSelectedMember.isOwner
                          }
                          value={unifiedSelectedMember.role}
                          onChange={(e) =>
                            handleRoleChange(unifiedSelectedMember.memberId, e.target.value as ProjectRole)
                          }
                          style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1" }}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {projectRoleLabelKr(role)} ({role})
                            </option>
                          ))}
                        </select>
                      </label>
                      {canManageMembers && !unifiedSelectedMember.isOwner ? (
                        <button
                          type="button"
                          style={{ marginTop: 14, padding: "8px 12px", borderRadius: 8 }}
                          onClick={() => void handleRemove(unifiedSelectedMember.memberId)}
                          disabled={busyMemberId === unifiedSelectedMember.memberId}
                        >
                          제거
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 800 }}>AI 멤버 상세</h3>
                      <ScreenLabel label="프로젝트관리-멤버-상세-AI설정" visible={showScreenLabels} />
                      <p style={{ margin: "0 0 6px 0", fontSize: 13 }}>
                        <span style={{ color: "#64748b" }}>이름</span> {unifiedSelectedMember.displayName}
                      </p>
                      <p style={{ margin: "0 0 12px 0", fontSize: 13 }}>
                        <span style={{ color: "#64748b" }}>프로젝트 역할</span>{" "}
                        {projectRoleLabelKr(unifiedSelectedMember.role)} ({unifiedSelectedMember.role})
                      </p>
                      {canManageMembers ? (
                        <AiOrchestrationControls
                          member={unifiedSelectedMember}
                          disabled={busyMemberId === unifiedSelectedMember.memberId}
                          onError={(msg) => setError(msg)}
                          onMessage={(msg) => setMessage(msg)}
                          onSaved={onChanged}
                          canRemove={!unifiedSelectedMember.isOwner}
                          onRemove={() => void handleRemove(unifiedSelectedMember.memberId)}
                        />
                      ) : null}
                      {isExecutionReviewerOrchRole(unifiedSelectedMember.aiOrchestrationRole) ? (
                        <AiExecutionReviewerPolicyOverrides
                          member={unifiedSelectedMember}
                          disabled={busyMemberId === unifiedSelectedMember.memberId}
                          canEdit={canManageMembers}
                          onError={(msg) => setError(msg)}
                          onMessage={(msg) => setMessage(msg)}
                          onSaved={onChanged}
                        />
                      ) : null}
                    </div>
                  )}
                </aside>
              </div>
            </div>
          ) : null}
          <AiMembersPage
          projectId={projectId}
          members={sortedMembers}
          canManageMembers={canManageMembers}
          canRunStage2EnvTest={canRunStage2EnvTest}
          isProjectOwner={isProjectOwner}
          onMembersChanged={onChanged}
          onOpenPresetInvite={openPresetInviteForOrchRole}
          onRemoveMember={(memberId) => void handleRemove(memberId)}
          setMessage={(msg) => setMessage(msg)}
          setError={setError}
        >
          <details
            style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px", background: "#fafafa" }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 13, color: "#334155" }}>
              고급 · 품질 리뷰어 및 기획 역할
            </summary>
            <p style={{ margin: "10px 0 10px 0", fontSize: 12, color: "#64748b" }}>
              Stage 2 기본 역할 카드에 포함되지 않는 오케스트레이션 역할입니다.
            </p>
            <div style={{ display: "grid", gap: 12 }}>
              {renderOrchestrationRoleCard("quality-reviewer")}
            </div>
          </details>

          {PLANNING_ROLES_UI.some((k) => (aiOrchestrationSplit.byRole.get(k) ?? []).length > 0) ? (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px 0", color: "#0f172a" }}>
                기획·문서 담당
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {PLANNING_ROLES_UI.filter((k) => (aiOrchestrationSplit.byRole.get(k) ?? []).length > 0).map((k) =>
                  renderOrchestrationRoleCard(k)
                )}
              </div>
            </div>
          ) : null}

          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
            추적: Task 실행 기록 화면에서 리뷰어별 요약·모델·판단을 확인할 수 있습니다.
          </p>

          {aiOrchestrationSplit.others.length > 0 && memberSurface !== "unified" ? (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 8px 0", color: "#0f172a" }}>
                기타 AI 멤버
              </h3>
              <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#64748b" }}>
                오케스트레이션 역할이 없는 멤버입니다. 아래에서 역할·모델을 지정할 수 있습니다.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {aiOrchestrationSplit.others.map((m) => renderStandardMemberRow(m))}
              </ul>
            </div>
          ) : null}
        </AiMembersPage>
        </>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {displayMembers.map((m) => renderStandardMemberRow(m))}
        </ul>
      )}

      {requestOpen && requestMemberId ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #ccc",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <strong>AI 멤버 요청</strong>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, alignItems: "center" }}>
            <select
              value={requestActionType}
              onChange={(e) => setRequestActionType(e.target.value as AiMemberActionTypeId)}
            >
              {actionOptionsForModal.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {requestActionType === "REVIEW_REQUEST" ? (
              <select value={requestGitId} onChange={(e) => setRequestGitId(e.target.value)}>
                <option value="">Git 변경 요청 선택</option>
                {gitRequests.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id.slice(0, 8)}… / task {g.taskId.slice(0, 8)}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select value={requestTaskId} onChange={(e) => setRequestTaskId(e.target.value)}>
                  <option value="">Task 선택</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select value={requestPromptId} onChange={(e) => setRequestPromptId(e.target.value)}>
                  <option value="">프롬프트(선택)</option>
                  {promptsForTask.map((p) => (
                    <option key={p.id} value={p.id}>
                      v{p.version} · {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button type="button" disabled={requestBusy} onClick={submitAiRequest}>
              {requestBusy ? "처리 중..." : "요청 보내기"}
            </button>
            <button type="button" onClick={() => setRequestOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}

      {showDispatchRunOnceAlone ? (
        <div
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            data-testid="ai-dispatch-run-once"
            disabled={runOnceBusy || !projectId}
            onClick={runDispatchOnceForProject}
          >
            {runOnceBusy ? "실행 중…" : "디스패처 1회(run-once)"}
          </button>
        </div>
      ) : null}
      {showCollaborationQueuePanel ? (
        <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: "#0f172a" }}>
            {memberSurface === "ai" || memberSurface === "unified" ? "협업 액션 큐" : "AI 멤버 액션"}
          </h3>
          {canDispatchAiMemberAction ? (
            <button
              type="button"
              data-testid="ai-dispatch-run-once"
              disabled={runOnceBusy || !projectId}
              onClick={runDispatchOnceForProject}
            >
              {runOnceBusy ? "실행 중…" : "디스패처 1회(run-once)"}
            </button>
          ) : null}
        </div>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 10px 0" }}>
          {memberSurface === "ai" || memberSurface === "unified"
            ? "요청·디스패치·사람 검토·적용 워크플로입니다. 실행 루프(Cursor) 검토와는 별도입니다."
            : "백그라운드 처리는 환경 변수 AI_ACTION_WORKER_ENABLED=true 로 켤 수 있습니다. 결과는 자동 반영되지 않으며 사람 검토·적용이 필요합니다."}
        </p>
        {actionsLoading ? (
          <p style={{ fontSize: 13, color: "#666" }}>불러오는 중…</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
            {aiActions.slice(0, 30).map((a) => {
              const busy = actionBusyId === a.id;
              const aiLabel =
                a.targetMember.displayName ??
                a.targetMember.aiProvider ??
                a.targetMember.role;
              return (
                <li
                  key={a.id}
                  style={{
                    fontSize: 13,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    background: "#fafafa",
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={statusBadgeStyle(a.status)}>{a.status}</span>
                    <span style={{ fontWeight: 600 }}>{a.actionType}</span>
                    <span style={{ color: "#64748b", fontSize: 12 }}>
                      {a.executionMode}
                      {a.providerKey ? ` · ${a.providerKey}` : ""}
                    </span>
                  </div>
                  <div style={{ color: "#334155", marginBottom: 4 }}>
                    🤖 {aiLabel} → 대상: {formatActionTarget(a)}
                  </div>
                  {a.summaryPreview ? (
                    <div style={{ color: "#475569", fontSize: 12, marginBottom: 4, lineHeight: 1.45 }}>
                      요약: {a.summaryPreview}
                      {a.summaryPreview.length >= 240 ? "…" : ""}
                    </div>
                  ) : null}
                  {(a.lastError || a.errorMessage) && (a.status === "FAILED" || a.status === "IN_PROGRESS") ? (
                    <div style={{ color: "#b91c1c", fontSize: 12, marginBottom: 4 }}>
                      {a.lastError || a.errorMessage}
                    </div>
                  ) : null}
                  <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6 }}>{a.requestedAt}</div>
                  {a.status === "DONE" ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 8 }}>
                      <span style={reviewBadgeStyle(a.reviewStatus)}>검토: {a.reviewStatus ?? "—"}</span>
                      <span style={{ fontSize: 11, color: "#64748b" }}>적용: {a.applyStatus}</span>
                    </div>
                  ) : null}
                  {a.status === "DONE" && a.reviewComment ? (
                    <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
                      최근 검토 코멘트: {a.reviewComment}
                    </div>
                  ) : null}
                  {a.status === "DONE" && a.resultPayload != null ? (
                    <details style={{ marginBottom: 8, fontSize: 11, color: "#64748b" }}>
                      <summary style={{ cursor: "pointer" }}>AI 제안 결과(JSON) 미리보기</summary>
                      <pre
                        style={{
                          marginTop: 6,
                          padding: 8,
                          background: "#fff",
                          borderRadius: 6,
                          overflow: "auto",
                          maxHeight: 160,
                          fontSize: 10,
                        }}
                      >
                        {(() => {
                          try {
                            return JSON.stringify(a.resultPayload, null, 2).slice(0, 4000);
                          } catch {
                            return String(a.resultPayload);
                          }
                        })()}
                      </pre>
                    </details>
                  ) : null}
                  {a.canReview ? (
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                        검토 코멘트
                      </label>
                      <textarea
                        value={reviewCommentDraft[a.id] ?? ""}
                        onChange={(e) =>
                          setReviewCommentDraft((prev) => ({ ...prev, [a.id]: e.target.value }))
                        }
                        rows={2}
                        style={{ width: "100%", maxWidth: 480, fontSize: 12, padding: 6 }}
                        placeholder="반려 사유 등(선택)"
                      />
                    </div>
                  ) : null}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {canDispatchAiMemberAction && a.status === "REQUESTED" ? (
                      <button type="button" disabled={busy} onClick={() => dispatchAction(a.id)}>
                        {busy ? "처리 중…" : "디스패치"}
                      </button>
                    ) : null}
                    {canDispatchAiMemberAction && (a.status === "FAILED" || a.status === "CANCELED") ? (
                      <button type="button" disabled={busy} onClick={() => retryAction(a.id)}>
                        {busy ? "처리 중…" : "다시 요청"}
                      </button>
                    ) : null}
                    {canPatchListedAction(a) ? (
                      <>
                        {a.status === "REQUESTED" || a.status === "IN_PROGRESS" ? (
                          <>
                            <button type="button" disabled={busy} onClick={() => patchAction(a.id, { runStub: true })}>
                              스텁 완료
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                patchAction(a.id, { status: "DONE", resultPayload: { manual: true } })
                              }
                            >
                              수동 완료
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                patchAction(a.id, { status: "FAILED", errorMessage: "수동 실패" })
                              }
                            >
                              실패 처리
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {a.canReview ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => submitReviewDecision(a.id, "APPROVE")}>
                          승인
                        </button>
                        <button type="button" disabled={busy} onClick={() => submitReviewDecision(a.id, "REJECT")}>
                          반려
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => submitReviewDecision(a.id, "REQUEST_REVISION")}
                        >
                          재검토 요청
                        </button>
                      </>
                    ) : null}
                    {a.canApply ? (
                      <button type="button" disabled={busy} onClick={() => applyApprovedAction(a.id)}>
                        적용
                      </button>
                    ) : null}
                    {a.status === "DONE" ? (
                      <button type="button" disabled={historyLoadingId === a.id} onClick={() => toggleReviewHistory(a.id)}>
                        {historyOpenId === a.id ? "이력 닫기" : "검토 이력"}
                      </button>
                    ) : null}
                  </div>
                  {historyOpenId === a.id ? (
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: 18, fontSize: 12, color: "#475569" }}>
                      {(reviewHistoryByAction[a.id] ?? []).length === 0 && historyLoadingId === a.id ? (
                        <li>불러오는 중…</li>
                      ) : null}
                      {(reviewHistoryByAction[a.id] ?? []).map((h) => (
                        <li key={h.id} style={{ marginBottom: 4 }}>
                          <strong>{h.decision}</strong> · {h.reviewerName} · {h.createdAt}
                          {h.comment ? <div style={{ color: "#64748b" }}>{h.comment}</div> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      ) : null}
    </section>
  );
}
