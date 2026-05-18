import type { WorkspaceAiAvatarGlyphKey, WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";

/** 참여 멤버 모달·사이드바·`useWorkspaceParticipants` 등 공통 타입 */

export type ParticipantOption = {
  readonly id: string;
  readonly name: string;
  readonly kind: "ai" | "human";
  /** 현재 앱에 로그인한 사용자 본인 여부(간이 온라인 표시) */
  readonly onlineHint: boolean;
  /** AI 멤버: OpenAI 연결·호출 상태 한 줄(있으면 이 값을 우선 표시) */
  readonly aiStatusLabel?: string;
  /** 플랫폼 AI: 실행 제공자 표시(예: OpenAI, Cursor) */
  readonly aiExecutionProviderLabel?: string;
  /** 이 화면 담당이 아닐 때 — 직전 작업 한 줄 */
  readonly aiRecentActivityLabel?: string;
  /** 프로젝트 멤버 역할(표시용) */
  readonly roleLabel?: string;
  /** userId 없이 초대만 된 사람 멤버 */
  readonly invited?: boolean;
  /** 화면별 전담 AI 로스터 항목 */
  readonly platformMemberId?: WorkspaceAiMemberId;
  /** 현재 화면 담당 AI(강조 표시) */
  readonly isCurrentScreenAi?: boolean;
  /** 플랫폼 AI 전용 기본 아바타(사람 멤버 프로필과 별도) */
  readonly aiAvatarGlyphKey?: WorkspaceAiAvatarGlyphKey;
  readonly aiAvatarAccent?: string;
  readonly aiAvatarLabel?: string;
  /** 향후 프로젝트별 커스텀 이미지 — 사람 멤버 avatar URL과 혼동 금지 */
  readonly aiAvatarUrl?: string | null;
};
