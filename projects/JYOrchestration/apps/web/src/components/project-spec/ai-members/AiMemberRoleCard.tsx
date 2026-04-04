"use client";

import { useState, type ReactNode } from "react";
import type { ProjectMemberUiRow } from "@/components/project-spec/memberUiTypes";
import { AiMemberPolicyPanel } from "@/components/project-spec/ai-members/AiMemberPolicyPanel";
import type { AiMemberRoleKey } from "@/lib/ai-member/aiMemberRoleDefinitions";
import {
  AI_MEMBER_ROLE_DEFINITIONS,
  AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL,
  orchestrationInviteKeyForRole,
} from "@/lib/ai-member/aiMemberRoleDefinitions";
import { parseAiMemberRole, reviewerModelDisplayLabel } from "@/lib/ai-member/aiMemberOrchestration";

export function AiMemberRoleCard(props: {
  roleKey: AiMemberRoleKey;
  member: ProjectMemberUiRow | null;
  canManage: boolean;
  /** Executor(Cursor) 실행환경 준비 여부 */
  executorEnvironmentReady: boolean;
  recentStage2Line: string | null;
  onMembersChanged: () => Promise<void>;
  onOpenPresetInvite: (orchKey: string) => void;
  onRemoveMember: (memberId: string) => void;
  setMessage: (msg: string) => void;
  setError: (msg: string | null) => void;
}) {
  const {
    roleKey,
    member,
    canManage,
    executorEnvironmentReady,
    recentStage2Line,
    onMembersChanged,
    onOpenPresetInvite,
    onRemoveMember,
    setMessage,
    setError,
  } = props;
  const d = AI_MEMBER_ROLE_DEFINITIONS[roleKey];
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const orch = orchestrationInviteKeyForRole(roleKey);
  const rowOrch = member ? parseAiMemberRole(member.aiOrchestrationRole) : null;

  let modelLine: ReactNode = (
    <>
      {d.provider} / {AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL}
    </>
  );
  if (member && rowOrch) {
    modelLine = (
      <>
        {d.provider} / {reviewerModelDisplayLabel(rowOrch, member.aiModelOverride)}
      </>
    );
  }

  const active = member ? member.orchestrationEnabled !== false : d.roleKey === "executor" && executorEnvironmentReady;
  const fallbackLine = d.platformFallback
    ? "플랫폼 fallback 허용 · 미등록 시 플랫폼 merge"
    : "플랫폼 fallback 금지";

  async function toggleEnabled(checked: boolean) {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/project/members/${encodeURIComponent(member.memberId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orchestrationEnabled: checked }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || "저장에 실패했습니다.");
      }
      setMessage("활성 상태를 저장했습니다.");
      await onMembersChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류입니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid={`ai-member-role-card-${roleKey}`}
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        background: "#fafafa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{d.displayName}</div>
          <div style={{ fontSize: 10, color: "#6d28d9", fontWeight: 800, marginTop: 4 }}>Stage 2 역할</div>
        </div>
        {d.requiredForStage2 ? (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 999,
              background: "#fef3c7",
              color: "#92400e",
            }}
          >
            필수
          </span>
        ) : null}
      </div>
      <p style={{ margin: "8px 0 10px 0", fontSize: 12, color: "#475569", lineHeight: 1.45 }}>{d.description}</p>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: "#64748b" }}>모델</span> <strong>{modelLine}</strong>
      </div>
      <div style={{ fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: "#64748b" }}>활성</span>{" "}
        <strong>{active ? "예" : "아니오"}</strong>
        {d.roleKey === "executor" ? (
          <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b" }}>(실행 환경 연결 기준)</span>
        ) : null}
      </div>
      <div style={{ fontSize: 11, color: "#b45309", marginBottom: 6, lineHeight: 1.45 }}>{fallbackLine}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: "#334155" }}>Stage 2 포함</span> 예 · 이 역할이 ENV_TEST Stage2 파이프라인에
        참여합니다.
      </div>
      {recentStage2Line ? (
        <div style={{ fontSize: 11, marginBottom: 10, color: "#0f172a" }}>
          <span style={{ color: "#64748b" }}>최근 Stage 2</span> {recentStage2Line}
        </div>
      ) : null}

      {d.roleKey === "executor" ? (
        <p style={{ fontSize: 11, color: "#b45309", margin: "0 0 8px 0", fontWeight: 700 }}>
          Executor 필수 · Stage 2는 Cursor 실행기 없이 진행할 수 없으며 플랫폼이 대체하지 않습니다.
        </p>
      ) : null}
      {d.roleKey === "executor" ? (
        <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px 0" }}>
          프로젝트 AI 멤버 레코드가 아닙니다. 연결·정책은 <strong>실행 환경</strong> 탭에서 설정합니다.
        </p>
      ) : null}

      {member && canManage ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={member.orchestrationEnabled !== false}
              disabled={saving}
              onChange={(e) => void toggleEnabled(e.target.checked)}
            />
            활성
          </label>
          {!member.isOwner ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onRemoveMember(member.memberId)}
              style={{
                fontSize: 12,
                border: "1px solid #dc2626",
                background: "#fff",
                color: "#b91c1c",
                fontWeight: 600,
                borderRadius: 6,
                padding: "4px 10px",
              }}
            >
              삭제
            </button>
          ) : null}
        </div>
      ) : null}

      {!member && d.persistedAsProjectMember && canManage && orch ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => onOpenPresetInvite(orch)}
          style={{
            marginBottom: 10,
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

      <details open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
        <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, color: "#4338ca" }}>
          고급 · 정책·입출력 스키마
        </summary>
        <div style={{ marginTop: 10 }}>
          <AiMemberPolicyPanel roleKey={roleKey} />
        </div>
      </details>
    </div>
  );
}
