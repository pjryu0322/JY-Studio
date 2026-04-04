"use client";

import { AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL, STAGE2_DASHBOARD_ROLE_ORDER } from "@/lib/ai-member/aiMemberRoleDefinitions";

export function AddDefaultAiMembersButton(props: {
  disabled: boolean;
  busy: boolean;
  onClick: () => void | Promise<void>;
}) {
  const { disabled, busy, onClick } = props;
  return (
    <div>
      <button
        type="button"
        data-testid="add-default-ai-members"
        disabled={disabled || busy}
        onClick={() => void onClick()}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid #7c3aed",
          background: "#fff",
          fontWeight: 700,
          fontSize: 12,
          cursor: disabled || busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "추가 중…" : "기본 AI 멤버 추가"}
      </button>
      <p style={{ margin: "6px 0 0 0", fontSize: 10, color: "#64748b", maxWidth: 420, lineHeight: 1.45 }}>
        Executor({STAGE2_DASHBOARD_ROLE_ORDER[0]})는 Cursor·실행 환경에서 필수이며 DB 멤버로 추가되지 않습니다. 나머지{" "}
        {STAGE2_DASHBOARD_ROLE_ORDER.length - 1}개 역할(Reviewer·Security·SCM)을 OpenAI·
        {AI_MEMBER_STAGE2_DEFAULT_MODEL_LABEL} 로 채웁니다.
      </p>
    </div>
  );
}
