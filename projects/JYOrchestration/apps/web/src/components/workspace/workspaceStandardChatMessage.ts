import type { CSSProperties } from "react";
import type { WorkshopRole } from "@/components/service-flow/serviceFlowWorkshopTypes";
import { messageTone } from "@/components/service-flow/serviceFlowWorkshopTypes";
import { uiTokens as t } from "@/components/ui/tokens";

/** ServiceFlowChatPanel / RequirementsChatPanel(아이디어)과 동일한 메타 줄 */
export const WORKSPACE_STANDARD_CHAT_HEADER_STYLE: CSSProperties = {
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 900,
  color: t.textMuted,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
};

/** 본문 타이포(14px / 1.65 / pre-wrap) */
export const WORKSPACE_STANDARD_CHAT_BODY_STYLE: CSSProperties = {
  fontSize: 14,
  color: t.textPrimary,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
  userSelect: "text",
};

/**
 * 액터·서비스 흐름 워크숍 말풍선과 동일한 셸(배경·테두리·maxWidth).
 * `messageTone`의 justifySelf는 그리드 직계 자식에 적용되는 경우가 많아 여기서는 배경·테두리만 맞춘다.
 */
export function workspaceStandardChatBubbleShell(role: WorkshopRole): CSSProperties {
  const tone = messageTone(role);
  return {
    background: String(tone.background ?? t.bgCard),
    border: `1px solid ${String(tone.borderColor ?? t.border)}`,
    borderRadius: 14,
    padding: "10px 12px",
    boxShadow: t.shadowSoft,
    boxSizing: "border-box",
    maxWidth: role === "user" ? ("78%" as const) : ("min(100%, 620px)" as const),
    /** 그리드 타임라인에서 justifySelf와 함께 쓰이면 행 전체를 채우지 않고 좌/우 정렬된다 */
    width: "fit-content",
    minWidth: 0,
  };
}
